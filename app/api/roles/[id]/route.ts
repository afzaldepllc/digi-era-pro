import { type NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Role, { type IRole } from "@/models/Role"
import User from "@/models/User"
import { z } from "zod"
import mongoose, { type Document } from "mongoose"
import { updateRoleSchema } from "@/lib/validations/role"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// Simple cache for individual role lookups
const roleCache = new Map<string, { data: any, timestamp: number }>()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// Helper functions
function getClientInfo(request: NextRequest) {
  return {
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  }
}

function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

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




// GET /api/roles/[id] - Get single role by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'roles', 'read')

    const { id } = await params

    // Validate Object ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Invalid role ID', 400)
    }

    // Check cache first
    const cached = roleCache.get(id)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data
      })
    }

    await connectDB()

    const role = await Role.findById(id)
      .populate('departmentDetails', 'name description status')
      .populate('userCount')
      .select('-__v') // Exclude version field but include all other fields including permissions
      .lean()
      .exec() as (IRole & Document) | null

    if (!role) {
      return createErrorResponse('Role not found', 404)
    }

    // Get additional role statistics
    const [usersWithRole, activeUsersWithRole] = await Promise.all([
      User.countDocuments({ role: role._id }),
      User.countDocuments({ role: role._id, status: 'active' })
    ])

    const roleData = {
      ...role,
      statistics: {
        totalUsers: usersWithRole,
        activeUsers: activeUsersWithRole,
        inactiveUsers: usersWithRole - activeUsersWithRole,
        utilizationRate: role.maxUsers ? Math.round((usersWithRole / role.maxUsers) * 100) : null
      }
    }

    // Cache the result
    roleCache.set(id, {
      data: roleData,
      timestamp: Date.now()
    })

    // Log access
    console.log('Role accessed:', {
      userId: userEmail,
      roleId: id,
      roleName: role.name,
      ip: getClientInfo(request).ip
    })

    return NextResponse.json({
      success: true,
      data: roleData,
      message: 'Role retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in GET /api/roles/[id]:', error)
    return createErrorResponse("Internal server error", 500)
  }
}

// PUT /api/roles/[id] - Update role
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

    // Validate update data
    const validation = updateRoleSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse("Validation failed", 400, {
        errors: validation.error.errors
      })
    }

    const updateData = validation.data

    await connectDB()

    // Check if role exists
    const existingRole = await Role.findById(id) as IRole | null
    if (!existingRole || existingRole.status !== 'active') {
      return createErrorResponse('Role not found', 404)
    }

    // User info already extracted by middleware
    const isSuperAdmin = user.role === 'super_admin';

    // CRITICAL: Protect superadmin role from being modified
    // Check if this role is assigned to super_admin
    const superAdminUser = await User.findOne({
      role: id
    }).populate('role').lean()

    if (superAdminUser && (superAdminUser.role as any)?.name === 'super_admin') {
      return createErrorResponse('Super Administrator role cannot be modified. This role is protected to maintain system security.', 403)
    }

    if (superAdminUser) {
      return createErrorResponse('Super Administrator role cannot be modified. This role is protected to maintain system security.', 403)
    }

    // Prevent updating system roles
    if (existingRole.isSystemRole) {
      return createErrorResponse('System roles cannot be modified', 403)
    }

    // Extra protection for super admin roles by name
    if (existingRole.name === 'super_admin' || existingRole.name === 'superadmin' || (existingRole.metadata as any)?.isImmutable) {
      return createErrorResponse('Super Administrator role is protected and cannot be modified', 403)
    }

    // Check user permissions - only super admins can modify high-level roles
    if (!isSuperAdmin && existingRole.hierarchyLevel >= 8) {
      return createErrorResponse('Only Super Administrators can modify high-level roles', 403)
    }

    // Check for name conflicts if name is being updated
    if (updateData.name && updateData.name !== existingRole.name) {
      const nameConflict = await Role.findOne({
        name: updateData.name,
        department: existingRole.department,
        _id: { $ne: id },
        status: 'active'
      })

      if (nameConflict) {
        return createErrorResponse('Role with this name already exists in the department', 409)
      }
    }

    // Check user limit constraints if maxUsers is being reduced
    if (updateData.maxUsers && updateData.maxUsers < (existingRole.maxUsers || Infinity)) {
      const currentUserCount = await User.countDocuments({ role: id })
      if (currentUserCount > updateData.maxUsers) {
        return createErrorResponse(
          `Cannot reduce user limit below current user count (${currentUserCount})`,
          400
        )
      }
    }

    // Update role
    const updatedRole = await Role.findByIdAndUpdate(
      id,
      {
        ...updateData,
        'metadata.updatedBy': userEmail || 'unknown',
        'metadata.updatedAt': new Date(),
      },
      {
        new: true,
        runValidators: true
      }
    )
      .populate('departmentDetails', 'name description status')
      .lean() as (IRole & Document) | null

    // Clear cache
    roleCache.delete(id)

    // Log successful update
    console.log('Role updated successfully:', {
      updatedBy: userEmail,
      roleId: id,
      roleName: updatedRole?.name,
      changes: Object.keys(updateData),
      ip: getClientInfo(request).ip
    })

    return NextResponse.json({
      success: true,
      data: updatedRole,
      message: 'Role updated successfully'
    })

  } catch (error: any) {
    console.error('Error in PUT /api/roles/[id]:', error)

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return createErrorResponse("Role name already exists in this department", 409)
    }

    return createErrorResponse("Failed to update role", 500)
  }
}

// DELETE /api/roles/[id] - Delete role (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'roles', 'delete')

    await connectDB()

    // User info already extracted by middleware
    const isSuperAdmin = user.role === 'super_admin';
    const { id } = await params

    // Validate Object ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Invalid role ID', 400)
    }

    // Check if role exists
    const existingRole = await Role.findById(id) as (IRole & Document) | null
    if (!existingRole || existingRole.status !== 'active') {
      return createErrorResponse('Role not found', 404)
    }

    // Prevent deleting system roles
    if (existingRole.isSystemRole) {
      return createErrorResponse('System roles cannot be deleted', 403)
    }

    // Extra protection for super admin roles
    if (existingRole.name === 'super_admin') {
      return createErrorResponse('Super Administrator role is protected and cannot be deleted', 403)
    }
    // Prevent non-super admins from deleting high-level roles
    if (!isSuperAdmin && existingRole.hierarchyLevel >= 8) {
      return createErrorResponse('Only Super Administrators can delete high-level roles', 403)
    }

    // Check if any users are assigned to this role
    const usersWithRole = await User.countDocuments({ role: id, status: { $ne: 'inactive' } })
    if (usersWithRole > 0) {
      return createErrorResponse(
        `Cannot delete role: ${usersWithRole} active users are assigned to this role`,
        400,
        { usersWithRole }
      )
    } 

    // Soft delete - mark as inactive
    await Role.findByIdAndUpdate(id, {
      status: 'archived',
      'metadata.deletedBy': userEmail || 'unknown',
      'metadata.deletedAt': new Date(),
    })

    // Clear cache
    roleCache.delete(id)

    // Log successful deletion
    console.log('Role deleted successfully:', {
      deletedBy: userEmail,
      roleId: id,
      roleName: existingRole.name,
      ip: getClientInfo(request).ip
    })

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    })

  } catch (error: any) {
    console.error('Error in DELETE /api/roles/[id]:', error)
    return createErrorResponse("Failed to delete role", 500)
  }
}