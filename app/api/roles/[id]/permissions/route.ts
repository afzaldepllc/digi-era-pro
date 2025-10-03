import { type NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Role from "@/models/Role"
import { z } from "zod"
import mongoose from "mongoose"
import { genericApiRoutesMiddleware } from "@/lib/middleware/route-middleware"







// permissionSchema
// Permission schema for validation
const permissionSchema = z.object({
  resource: z.string().min(2).max(50).regex(/^[a-z][a-z0-9_]*$/),
  actions: z.array(z.enum(['create', 'read', 'update', 'delete', 'assign', 'approve', 'reject', 'export', 'import', 'archive', 'manage', 'configure', 'audit'])).min(1),
  conditions: z.object({
    own: z.boolean().optional(),
    department: z.boolean().optional(),
    assigned: z.boolean().optional(),
    subordinates: z.boolean().optional(),
    unrestricted: z.boolean().optional(),
  }).optional()
})

// Update permissions validation schema
const updatePermissionsSchema = z.object({
  permissions: z.array(permissionSchema).min(1, "At least one permission is required"),
})

function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// PUT /api/roles/[id]/permissions - Update role permissions only
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'roles', 'update')
    const { id } = await params

    // Validate Object ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Invalid role ID', 400)
    }

    const body = await request.json()

    // Validate permissions data
    const validation = updatePermissionsSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse("Validation failed", 400, {
        errors: validation.error.errors
      })
    }

    const { permissions } = validation.data

    await connectDB()

    // Check if role exists
    const existingRole = await Role.findById(id)
    if (!existingRole) {
      return createErrorResponse('Role not found', 404)
    }

    // CRITICAL: Prevent modification of superadmin role
    if (existingRole.name === 'super_admin' || existingRole.name === 'superadmin') {
      return createErrorResponse(
        'Super Administrator role permissions cannot be modified for security reasons',
        403
      )
    }

    // Update only the permissions field
    const updatedRole = await Role.findByIdAndUpdate(
      id,
      {
        permissions,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
        select: '-__v'
      }
    ).populate('departmentDetails', 'name description status')

    if (!updatedRole) {
      return createErrorResponse('Failed to update role permissions', 500)
    }

    // Log the permission update (userEmail already extracted by middleware)
    console.log('Role permissions updated:', {
      updatedBy: userEmail,
      roleId: id,
      roleName: updatedRole.name,
      permissionsCount: permissions.length,
      permissions: permissions.map(p => ({ resource: p.resource, actions: p.actions })),
      timestamp: new Date().toISOString()
    })

    // Clear the role cache to ensure fresh data on next fetch
    const roleCache = require('../route').roleCache
    if (roleCache && roleCache.delete) {
      roleCache.delete(id)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRole.toObject(),
        permissions: permissions // Ensure permissions are explicitly included
      },
      message: `Role permissions updated successfully. ${permissions.length} permission${permissions.length !== 1 ? 's' : ''} configured.`
    })

  } catch (error: any) {
    console.error('Error in PUT /api/roles/[id]/permissions:', error)

    if (error.name === 'ValidationError') {
      return createErrorResponse("Validation failed", 400, {
        errors: Object.values(error.errors).map((err: any) => ({
          field: err.path,
          message: err.message
        }))
      })
    }

    if (error.code === 11000) {
      return createErrorResponse('Role name already exists', 409)
    }

    return createErrorResponse("Internal server error", 500)
  }
}