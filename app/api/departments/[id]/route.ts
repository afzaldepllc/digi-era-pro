import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Department from "@/models/Department"
import { updateDepartmentSchema, departmentIdSchema } from "@/lib/validations/department"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

interface RouteParams {
  params: {
    id: string
  }
}

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/departments/[id] - Get department by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'read')

    // Validate department ID
    const validatedParams = departmentIdSchema.parse({ id: params.id })

    // Find department with automatic connection management
    const department = await executeGenericDbQuery(async () => {
      const dept = await Department.findOne({
        _id: validatedParams.id,
        status: 'active'
      }).lean()

      if (!dept) {
        throw new Error("Department not found")
      }
      return dept
    }, `department-${validatedParams.id}`, 300000) // 5-minute cache

    return NextResponse.json({
      success: true,
      data: { department },
      message: 'Department retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching department:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid department ID'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch department'
    }, { status: 500 })
  }
}

// PUT /api/departments/[id] - Update department
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'update')

    // Validate department ID
    const validatedParams = departmentIdSchema.parse({ id: params.id })

    const body = await request.json()
    const validatedData = updateDepartmentSchema.parse(body)

    // Update department with automatic connection management
    const updatedDepartment = await executeGenericDbQuery(async () => {
      // Check if department exists
      const existingDepartment = await Department.findOne({
        _id: validatedParams.id,
        status: 'active'
      })

      if (!existingDepartment) {
        throw new Error("Department not found")
      }

      // Check if new name already exists (if name is being updated)
      if (validatedData.name && validatedData.name !== existingDepartment.name) {
        const duplicateDepartment = await Department.findOne({
          name: { $regex: new RegExp(`^${validatedData.name}$`, 'i') },
          _id: { $ne: validatedParams.id },
          status: 'active'
        })

        if (duplicateDepartment) {
          throw new Error("Department name already exists")
        }
      }

      // Update department
      return await Department.findByIdAndUpdate(
        validatedParams.id,
        { ...validatedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean()
    })

    // Clear department-related caches
    clearCache(`department-${validatedParams.id}`)
    clearCache('departments')

    return NextResponse.json({
      success: true,
      data: { department: updatedDepartment },
      message: 'Department updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating department:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    if (error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'Department name already exists'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update department'
    }, { status: 500 })
  }
}

// DELETE /api/departments/[id] - Delete department (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'delete')

    // Validate department ID
    const validatedParams = departmentIdSchema.parse({ id: params.id })

    // Delete department with automatic connection management
    await executeGenericDbQuery(async () => {
      // Check if department exists
      const existingDepartment = await Department.findOne({
        _id: validatedParams.id,
      })

      if (!existingDepartment) {
        throw new Error("Department not found")
      }

      // TODO: Check if department has associated users before deletion
      // This would require importing User model and checking for references
      /*
      const associatedUsers = await User.countDocuments({
        department: existingDepartment.name,
        status: 'active'
      })

      if (associatedUsers > 0) {
        throw new Error("Cannot delete department with associated users")
      }
      */

      // Soft delete - set status to inactive
      return await Department.findByIdAndUpdate(
        validatedParams.id,
        { status: 'inactive', updatedAt: new Date() }
      )
    })

    // Clear department-related caches
    clearCache(`department-${validatedParams.id}`)
    clearCache('departments')

    return NextResponse.json({
      success: true,
      message: 'Department deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting department:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid department ID'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete department'
    }, { status: 500 })
  }
}