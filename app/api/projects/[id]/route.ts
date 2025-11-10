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

// Helper function to transform project tasks by department
function transformProjectTasksByDepartment(project: any) {
  if (!project.tasks || !Array.isArray(project.tasks)) {
    project.departmentTasks = []
    return project
  }

  const departmentTasks: { [key: string]: any } = {}
  
  // Initialize department structure from project departments OR from tasks if departments not assigned
  if (project.departments && Array.isArray(project.departments) && project.departments.length > 0) {
    // Use project departments if available
    project.departments.forEach((dept: any) => {
      departmentTasks[dept._id.toString()] = {
        departmentId: dept._id,
        departmentName: dept.name,
        tasks: [],
        taskCount: 0,
        subTaskCount: 0
      }
    })
  } else if (project.tasks && Array.isArray(project.tasks) && project.tasks.length > 0) {
    // If no departments assigned, infer from tasks
    const uniqueDepartments = new Map()
    project.tasks.forEach((task: any) => {
      if (task.department && task.departmentId) {
        uniqueDepartments.set(task.departmentId.toString(), {
          departmentId: task.departmentId,
          departmentName: task.department.name,
          tasks: [],
          taskCount: 0,
          subTaskCount: 0
        })
      }
    })
    uniqueDepartments.forEach((value, key) => {
      departmentTasks[key] = value
    })
  }

  // Process tasks - first add main tasks
  const mainTasks = project.tasks.filter((task: any) => task.type === 'task')
  const subTasks = project.tasks.filter((task: any) => task.type === 'sub-task')

  mainTasks.forEach((task: any) => {
    const deptId = task.departmentId?.toString()
    if (deptId) {
      // Ensure department exists in departmentTasks
      if (!departmentTasks[deptId] && task.department) {
        departmentTasks[deptId] = {
          departmentId: task.departmentId,
          departmentName: task.department.name,
          tasks: [],
          taskCount: 0,
          subTaskCount: 0
        }
      }

      if (departmentTasks[deptId]) {
        // Find sub-tasks for this main task
        const taskSubTasks = subTasks.filter((subTask: any) => 
          subTask.parentTaskId?.toString() === task._id.toString()
        )

        departmentTasks[deptId].tasks.push({
          ...task,
          subTasks: taskSubTasks
        })
        departmentTasks[deptId].taskCount++
        departmentTasks[deptId].subTaskCount += taskSubTasks.length
      }
    }
  })

  // Convert departmentTasks object to array for easier frontend consumption
  project.departmentTasks = Object.values(departmentTasks)
  
  // Remove departments and tasks arrays from response (keep only departmentIds and departmentTasks)
  delete project.departments
  delete project.tasks
  
  return project
}

// GET /api/projects/[id] - Get project by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'projects', 'read')
    
    const resolvedParams = await params
    const validatedParams = projectIdSchema.parse({ id: resolvedParams.id })

    // Fetch project with automatic connection management and caching
    const project: any = await executeGenericDbQuery(async () => {
      // Department-based filtering for non-support users
      const filter: any = { 
        _id: validatedParams.id,
        status: { $ne: 'inactive' }
      }

      // If user is not in support/admin, filter by their department
      if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        filter.departmentIds = user.departmentId
      }

      const projectData = await Project.findOne(filter)
        .populate('client', 'name email phone status')
        .populate('departments', 'name status description')
        .populate('creator', 'name email')
        .populate('approver', 'name email')
        .populate({
          path: 'tasks',
          populate: [
            { path: 'assignee', select: 'name email' },
            { path: 'department', select: 'name' },
            { path: 'creator', select: 'name email' },
            { path: 'parentTask', select: 'title' }
          ]
        })
        .populate('taskCount')

      return projectData?.toObject ? projectData.toObject() : projectData
    }, `project-${validatedParams.id}`, 300000) // 5-minute cache

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found or access denied'
      }, { status: 404 })
    }

    // Transform project to group tasks by departments
    transformProjectTasksByDepartment(project)

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
    console.log('📥 Received request body:', JSON.stringify(body, null, 2));
    
    let formData;
    try {
      formData = updateProjectFormSchema.parse(body);
    } catch (error: any) {
      console.error('❌ Validation error details:', error);
      console.error('❌ Validation error message:', error.message);
      console.error('❌ Validation error issues:', error.errors || error.issues);
      return NextResponse.json({ 
        error: 'Validation failed', 
        message: error.errors?.[0]?.message || error.issues?.[0]?.message || 'Invalid data format',
        details: error.errors || error.issues || [],
        receivedData: body
      }, { status: 400 });
    }
    
    // Convert form data to proper API format
    const validatedData = {
      ...formData,
      // Convert string fields to proper types
      budget: formData.budget ? parseFloat(formData.budget as string) : undefined,
      startDate: formData.startDate ? new Date(formData.startDate as string) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate as string) : undefined,

        
      // Transform nested objects with string-to-number conversion
      budgetBreakdown: formData.budgetBreakdown ? {
        development: formData.budgetBreakdown.development ? parseFloat(formData.budgetBreakdown.development as string) : undefined,
        design: formData.budgetBreakdown.design ? parseFloat(formData.budgetBreakdown.design as string) : undefined,
        testing: formData.budgetBreakdown.testing ? parseFloat(formData.budgetBreakdown.testing as string) : undefined,
        deployment: formData.budgetBreakdown.deployment ? parseFloat(formData.budgetBreakdown.deployment as string) : undefined,
        maintenance: formData.budgetBreakdown.maintenance ? parseFloat(formData.budgetBreakdown.maintenance as string) : undefined,
        contingency: formData.budgetBreakdown.contingency ? parseFloat(formData.budgetBreakdown.contingency as string) : undefined,
      } : undefined,
      
      resources: formData.resources ? {
        ...formData.resources,
        estimatedHours: formData.resources.estimatedHours ? parseFloat(formData.resources.estimatedHours as string) : undefined,
        actualHours: formData.resources.actualHours ? parseFloat(formData.resources.actualHours as string) : undefined,
        teamSize: formData.resources.teamSize ? parseInt(formData.resources.teamSize as string) : undefined,
      } : undefined,
      
      qualityMetrics: formData.qualityMetrics ? {
        ...formData.qualityMetrics,
        requirementsCoverage: formData.qualityMetrics.requirementsCoverage ? parseFloat(formData.qualityMetrics.requirementsCoverage as string) : undefined,
        defectDensity: formData.qualityMetrics.defectDensity ? parseFloat(formData.qualityMetrics.defectDensity as string) : undefined,
        customerSatisfaction: formData.qualityMetrics.customerSatisfaction ? parseFloat(formData.qualityMetrics.customerSatisfaction as string) : undefined,
      } : undefined,
      
      progress: formData.progress ? {
        ...formData.progress,
        overallProgress: formData.progress.overallProgress ? parseFloat(formData.progress.overallProgress as string) : undefined,
        completedTasks: formData.progress.completedTasks ? parseInt(formData.progress.completedTasks as string) : undefined,
        totalTasks: formData.progress.totalTasks ? parseInt(formData.progress.totalTasks as string) : undefined,
        lastUpdated: formData.progress.lastUpdated ? new Date(formData.progress.lastUpdated as string) : undefined,
      } : undefined,
    };

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
        // if (validatedData.status === 'approved' && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        //   throw new Error('Only support team can approve projects')
        // }  

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
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignee', select: 'name email' },
          { path: 'department', select: 'name' },
          { path: 'creator', select: 'name email' },
          { path: 'parentTask', select: 'title' }
        ]
      })
      .populate('taskCount')

      return updated?.toObject ? updated.toObject() : updated
    })

    if (!updatedProject) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // Transform project to group tasks by departments
    transformProjectTasksByDepartment(updatedProject)

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
        message: error.errors?.[0]?.message || 'Invalid data format',
        details: error.errors
      }, { status: 400 })
    }

    if (error.name === 'ValidationError') {
      return NextResponse.json({
        success: false,
        error: 'Database validation failed',
        message: error.message,
        details: error.errors
      }, { status: 400 })
    }

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 404 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update project'
    }, { status: 500 })
  }
}

// PATCH /api/projects/[id] - Update project (alias for PUT)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return PUT(request, { params });
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
      const updatedProject = await Project.findByIdAndUpdate(
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
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignee', select: 'name email' },
          { path: 'department', select: 'name' },
          { path: 'creator', select: 'name email' }
        ]
      })
      .populate('taskCount')

      return updatedProject?.toObject ? updatedProject.toObject() : updatedProject
    })

    // Transform project to group tasks by departments
    if (updatedProject) {
      transformProjectTasksByDepartment(updatedProject)
    }

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
      // if (!['support', 'admin'].includes(user.department?.name?.toLowerCase()) && user.role !== 'manager') {
      //   throw new Error('Only managers and support team can approve projects')
      // }

      const existingProject = await Project.findById(projectId);
      
      if (!existingProject) {
        throw new Error('Project not found')
      }
      console.log('Existing project: 417', existingProject);

      if (existingProject.status !== 'pending' && existingProject.status !== 'active') {
        throw new Error('Only pending or active projects can be approved');
      }
      
      if (existingProject.departmentIds.length === 0) {
        throw new Error('Project must be categorized before approval')
      }

      // Approve the project
      const approvedProject = await Project.findByIdAndUpdate(
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
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignee', select: 'name email' },
          { path: 'department', select: 'name' },
          { path: 'creator', select: 'name email' }
        ]
      })
      .populate('taskCount')

      return approvedProject?.toObject ? approvedProject.toObject() : approvedProject
    })

    // Transform project to group tasks by departments
    if (updatedProject) {
      transformProjectTasksByDepartment(updatedProject)
    }

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