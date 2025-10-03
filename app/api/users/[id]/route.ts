import { type NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import mongoose from "mongoose"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// Simple cache for individual user lookups
const userCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/users/[id] - Get single user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user: currentUser, userEmail } = await genericApiRoutesMiddleware(request, 'users', 'read')

    const { id } = await params

    // Validate Object ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Invalid user ID', 400)
    }

    // Check cache first
    const cached = userCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data
      })
    }

    await connectDB()

    const user = await User.findById(id)
      .populate('role', '_id name displayName hierarchyLevel permissions status')
      .populate('department','_id name status')
      .lean()
      .exec()

    if (!user) {
      return createErrorResponse('User not found', 404)
    }

    // Cache the result
    userCache.set(id, {
      data: user,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error: any) {
    console.error('Error in GET /api/users/[id]:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user: sessionUser, userEmail } = await genericApiRoutesMiddleware(request, 'users', 'update')

    const { id } = await params

    // Validate Object ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Invalid user ID', 400)
    }

    const body = await request.json()

    // Basic validation
    const allowedFields = ['name', 'email', 'role', 'phone', 'department', 'position', 'status'];
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return createErrorResponse('No valid fields to update', 400)
    }

    await connectDB()

    // Get current user's role for permission checking
    const currentUser = await User.findOne({ email: userEmail })
      .populate('role')
      .lean()

    if (!currentUser?.role) {
      return createErrorResponse('User or role not found', 403)
    }

    const currentUserRole = currentUser.role as any

    // Check if user exists and get their current role
    const existingUser = await User.findById(id).populate('role')
    if (!existingUser) {
      return createErrorResponse('User not found', 404)
    }

    const existingUserRole = existingUser.role as any

    // Protect super admin users from modification
    if ( existingUserRole?.name === 'super_admin') {
      return createErrorResponse('Super Administrator account cannot be modified', 403)
    }

    // Only super admins can modify admin users  
    if (existingUserRole?.name === 'admin' && currentUserRole.name !== 'super_admin') {
      return createErrorResponse('Only Super Administrators can modify admin users', 403)
    }

    // Prevent changing role to super_admin unless user is super_admin
    if (updateData.role && currentUserRole.name !== 'super_admin') {
      return createErrorResponse('Only Super Administrators can assign roles', 403)
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).select('name email role status department position createdAt updatedAt')

    // Clear cache
    userCache.delete(id);

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    })

  } catch (error: any) {
    console.error('Error in PUT /api/users/[id]:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user: sessionUser, userEmail } = await genericApiRoutesMiddleware(request, 'users', 'delete')

    const { id } = await params

    // Validate Object ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('Invalid user ID', 400)
    }

    await connectDB()

    // Get user with populated role information
    const currentUser = await User.findOne({ email: userEmail })
      .populate('role')
      .lean()

    if (!currentUser?.role) {
      return createErrorResponse('User or role not found', 403)
    }

    // For now, allow super_admin and admin roles to delete users
    // Also prevent deleting users with admin roles
    const currentUserRole = currentUser.role as any
    const allowedRoles = ['super_admin', 'admin'];
    if (!allowedRoles.includes(currentUserRole.name)) {
      return createErrorResponse('Insufficient permissions', 403)
    }

    // Check if target user exists
    const existingUser = await User.findById(id).populate('role').lean()
    if (!existingUser) {
      return createErrorResponse('User not found', 404)
    }

    // Prevent deleting users with admin roles
    const existingUserRole = existingUser.role as any
    if (existingUserRole && ['super_admin', 'admin'].includes(existingUserRole.name)) {
      return createErrorResponse('Cannot delete users with admin roles', 403)
    }

    // Extra protection for super admin users - only allow super admin to delete
    if (existingUserRole?.name === 'super_admin') {
      return createErrorResponse('Super Administrator accounts cannot be deleted', 403)
    }

    // Only super admins can delete other admin users
    if (existingUserRole?.name === 'admin' && currentUserRole.name !== 'super_admin') {
      return createErrorResponse('Only Super Administrators can delete admin users', 403)
    }

    // Delete user (or mark as inactive for soft delete)
    await User.findByIdAndUpdate(id, { 
      status: 'inactive',
      updatedAt: new Date()
    })

    // Clear cache
    userCache.delete(id);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error: any) {
    console.error('Error in DELETE /api/users/[id]:', error)
    return createErrorResponse('Internal server error', 500)
  }
}