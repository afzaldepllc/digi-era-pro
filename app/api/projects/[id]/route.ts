import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Project from "@/models/Project"
import Department from "@/models/Department"
import { updateProjectSchema, updateProjectFormSchema, projectIdSchema, categorizeDepartmentsSchema } from "@/lib/validations/project"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import mongoose from 'mongoose'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id] - Get project by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'projects', 'read')
    
    const resolvedParams = await params
    const validatedParams = projectIdSchema.parse({ id: resolvedParams.id })

    // Fetch project with automatic connection management and caching
    const project = await executeGenericDbQuery(async () => {
      // Department-based filtering for non-support users
      const filter: any = { 
        _id: validatedParams.id,
        status: { $ne: 'inactive' }
      }

      // If user is not in support/admin, filter by their department
      if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        filter.departmentIds = user.departmentId
      }

      return await Project.findOne(filter)
        .populate('client', 'name email phone status')
        .populate('departments', 'name status description')
        .populate('creator', 'name email')
        .populate('approver', 'name email')
        .lean()
    }, `project-${validatedParams.id}`, 300000) // 5-minute cache

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found or access denied'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: project,
      message: 'Project retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching project:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid project ID',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch project'
    }, { status: 500 })
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'projects', 'update')

    const validatedParams = projectIdSchema.parse({ id: (params as any).id })
    const body = await request.json()
    
    // Handle special operations
    if (body.operation === 'categorize') {
      return handleCategorizeDepartments(validatedParams.id, body, user)
    }
    
    if (body.operation === 'approve') {
      return handleApproveProject(validatedParams.id, user)
    }
    
    // Regular update operation
    // First validate with form schema (which accepts strings)
    const formData = updateProjectFormSchema.parse(body)
    
    // Then convert to proper API format
    const validatedData = {
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
    }

    // Update project with automatic connection management
    const updatedProject = await executeGenericDbQuery(async () => {
      // Find existing project with proper filtering
      const filter: any = { 
        _id: validatedParams.id,
        status: { $ne: 'inactive' }
      }

      // If user is not in support/admin, filter by their department
      if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        filter.departmentIds = user.departmentId
      }

      const existingProject = await Project.findOne(filter)
      
      if (!existingProject) {
        throw new Error('Project not found or access denied')
      }

      // Status change validations
      if (validatedData.status && validatedData.status !== existingProject.status) {
        // Only support can change status to approved
        if (validatedData.status === 'approved' && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
          throw new Error('Only support team can approve projects')
        }

        // Set approval fields
        if (validatedData.status === 'approved') {
          (validatedData as any).approvedBy = user.id
          ;(validatedData as any).approvedAt = new Date()
        }
      }

      // Update the project
      const updated = await Project.findByIdAndUpdate(
        validatedParams.id,
        { 
          $set: validatedData,
          updatedAt: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      )
      .populate('client', 'name email phone status')
      .populate('departments', 'name status description')
      .populate('creator', 'name email')
      .populate('approver', 'name email')

      return updated
    })

    if (!updatedProject) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // Clear relevant cache patterns after update
    clearCache('projects')
    clearCache(`project-${validatedParams.id}`)

    return NextResponse.json({
      success: true,
      data: updatedProject,
      message: 'Project updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating project:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update project'
    }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Soft delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'projects', 'delete')

    const validatedParams = projectIdSchema.parse({ id: (params as any).id })

    // Soft delete project with automatic connection management
    const deletedProject = await executeGenericDbQuery(async () => {
      // Only support team can delete projects
      if (!['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        throw new Error('Only support team can delete projects')
      }

      const filter: any = { 
        _id: validatedParams.id,
        status: { $ne: 'inactive' }
      }

      const existingProject = await Project.findOne(filter)
      
      if (!existingProject) {
        throw new Error('Project not found or already deleted')
      }

      // Check if project has active tasks
      const Task = mongoose.model('Task')
      const activeTasks = await Task.countDocuments({
        projectId: validatedParams.id,
        status: { $in: ['pending', 'in-progress'] }
      })

      if (activeTasks > 0) {
        throw new Error('Cannot delete project with active tasks')
      }

      // Soft delete by setting status to inactive
      return await Project.findByIdAndUpdate(
        validatedParams.id,
        { 
          status: 'inactive',
          updatedAt: new Date()
        },
        { new: true }
      )
    })

    // Clear relevant cache patterns after deletion
    clearCache('projects')
    clearCache(`project-${validatedParams.id}`)

    return NextResponse.json({
      success: true,
      data: deletedProject,
      message: 'Project deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting project:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid project ID',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete project'
    }, { status: 500 })
  }
}

// Helper function to handle department categorization
async function handleCategorizeDepartments(projectId: string, body: any, user: any) {
  try {
    const validatedData = categorizeDepartmentsSchema.parse({
      departmentIds: body.departmentIds
    })

    const updatedProject = await executeGenericDbQuery(async () => {
      // Only support team can categorize projects
      if (!['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        throw new Error('Only support team can categorize projects')
      }

      const existingProject = await Project.findById(projectId)
      
      if (!existingProject) {
        throw new Error('Project not found')
      }

      // Verify all departments exist and are active
      const departments = await Department.find({
        _id: { $in: validatedData.departmentIds },
        status: 'active'
      })

      if (departments.length !== validatedData.departmentIds.length) {
        throw new Error('One or more departments not found or inactive')
      }

      // Update project with departments
      return await Project.findByIdAndUpdate(
        projectId,
        { 
          departmentIds: validatedData.departmentIds,
          status: 'pending', // Set to pending for approval
          updatedAt: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      )
      .populate('client', 'name email')
      .populate('departments', 'name status')
      .populate('creator', 'name email')
    })

    // Clear cache
    clearCache('projects')
    clearCache(`project-${projectId}`)

    return NextResponse.json({
      success: true,
      data: updatedProject,
      message: 'Project categorized successfully and set to pending approval'
    })

  } catch (error: any) {
    console.error('Error categorizing project:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to categorize project'
    }, { status: 500 })
  }
}

// Helper function to handle project approval
async function handleApproveProject(projectId: string, user: any) {
  try {
    const updatedProject = await executeGenericDbQuery(async () => {
      // Only managers and support can approve projects
      if (!['support', 'admin'].includes(user.department?.name?.toLowerCase()) && user.role !== 'manager') {
        throw new Error('Only managers and support team can approve projects')
      }

      const existingProject = await Project.findById(projectId)
      
      if (!existingProject) {
        throw new Error('Project not found')
      }

      if (existingProject.status !== 'pending') {
        throw new Error('Only pending projects can be approved')
      }

      if (existingProject.departmentIds.length === 0) {
        throw new Error('Project must be categorized before approval')
      }

      // Approve the project
      return await Project.findByIdAndUpdate(
        projectId,
        { 
          status: 'approved',
          approvedBy: user.id,
          approvedAt: new Date(),
          updatedAt: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      )
      .populate('client', 'name email')
      .populate('departments', 'name status')
      .populate('creator', 'name email')
      .populate('approver', 'name email')
    })

    // Clear cache
    clearCache('projects')
    clearCache(`project-${projectId}`)

    return NextResponse.json({
      success: true,
      data: updatedProject,
      message: 'Project approved successfully'
    })

  } catch (error: any) {
    console.error('Error approving project:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to approve project'
    }, { status: 500 })
  }
}