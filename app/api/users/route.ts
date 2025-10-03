import { type NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import Department from "@/models/Department"
import mongoose from "mongoose"
import { SecurityUtils } from "@/lib/security/validation"
import {
  createUserSchema,
  userQuerySchema,
} from "@/lib/validations/user"
import bcrypt from "bcryptjs"
import { getClientInfo } from "@/lib/security/error-handler"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse, createAPISuccessResponse } from "@/lib/utils/api-responses"

// Simple in-memory cache for better performance
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes


// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/users - List users with pagination, search, and filters
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions) with filtering
    const { session, user, userEmail, isSuperAdmin, applyFilters } = await genericApiRoutesMiddleware(request, 'users', 'read')
    console.log("🔍 Users API: Authenticated user details:--36", { 
      permissions: JSON.stringify(user.permissions, null, 2), 
      isSuperAdmin,
      rolePermissions: user.role?.permissions?.map((p: any) => ({ resource: p.resource, conditions: p.conditions })),
      userRole: user.role?.name,
      userRoleObject: user.role,
      userId: user._id || user.id,
      userEmail: user.email,
      userDepartment: user.department,
      hasUserPermissions: !!user.permissions,
      hasRolePermissions: !!user.role?.permissions,
      permissionsCount: user.permissions?.length || user.role?.permissions?.length || 0
    });
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = userQuerySchema.safeParse(queryParams)
    if (!validation.success) {
      return createErrorResponse("Invalid query parameters", 400, {
        errors: validation.error.errors
      })
    }

    const { page, limit, search, role, status, department, sortBy, sortOrder } = validation.data

    // Generate cache key
    const cacheKey = `users:${page}:${limit}:${search}:${role}:${status}:${department}:${sortBy}:${sortOrder}`

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        message: 'Users retrieved successfully (cached)'
      })
    }

    await connectDB()

    // Ensure models are registered (fix for populate issues)
    if (!mongoose.models.Role) {
      require('@/models/Role')
    }
    if (!mongoose.models.Department) {
      require('@/models/Department')
    }

    // Build secure and optimized query
    const query: any = { status: 'active' }

    // Secure search implementation
    if (search) {
      const sanitizedSearch = SecurityUtils.sanitizeString(search)

      // Check for potential security threats
      if (SecurityUtils.containsSQLInjection && SecurityUtils.containsXSS) {
        if (SecurityUtils.containsSQLInjection(sanitizedSearch) ||
          SecurityUtils.containsXSS(sanitizedSearch)) {
          console.log('Malicious input detected in user search:', {
            userId: session.user.email,
            searchTerm: 'REDACTED',
            ip: getClientInfo(request).ipAddress
          })
          return createErrorResponse("Invalid search parameter", 400)
        }
      }

      if (sanitizedSearch.length >= 2) {
        // Use MongoDB text search for better performance
        query.$text = { $search: sanitizedSearch }
      } else {
        // Fallback to regex for short terms
        query.$or = [
          { name: { $regex: sanitizedSearch, $options: 'i' } },
          { email: { $regex: sanitizedSearch, $options: 'i' } }
        ]
      }
    }

    // Apply filters securely
    // Role filter now uses ObjectId directly since frontend sends role._id
    if (role && role !== 'all') {
      // Check if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(role)) {
        query.role = role
      } else {
        // If not a valid ObjectId, set impossible condition to return no results
        query.role = new mongoose.Types.ObjectId()
      }
    }

    if (status) query.status = status

    // For department filter, handle ObjectId lookup if needed
    if (department) {
      const sanitizedDepartment = SecurityUtils.sanitizeString(department)

      // Check if it's already a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(sanitizedDepartment)) {
        query.department = sanitizedDepartment
      } else {
        // Look up department by name
        try {
          const deptDoc = await Department.findOne({
            name: { $regex: sanitizedDepartment, $options: 'i' }
          }).select('_id').lean()

          if (deptDoc) {
            query.department = (deptDoc as any)._id
          } else {
            // If department not found, set impossible condition
            query.department = new mongoose.Types.ObjectId()
          }
        } catch (error) {
          console.log('Department lookup error:', error)
          query.department = new mongoose.Types.ObjectId()
        }
      }
    }

    // Optimized sort with compound index support
    const sort: any = {}
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1

    console.log('🔥 Users API: About to apply filters:', {
      originalQuery: query,
      isSuperAdmin,
      userEmail: userEmail,
      applyFiltersType: typeof applyFilters
    })

    // 🔥 Apply permission-based filters - THIS IS THE KEY CHANGE
    const filteredQuery = await applyFilters(query)

    console.log('🔥 Users API: Query filtering applied:', {
      isSuperAdmin,
      originalQuery: query,
      filteredQuery,
      wasFiltered: JSON.stringify(filteredQuery) !== JSON.stringify(query),
      userPermissions: user.role?.permissions?.map((p: any) => ({ 
        resource: p.resource, 
        conditions: p.conditions 
      })) || user.permissions?.map((p: any) => ({ 
        resource: p.resource, 
        conditions: p.conditions 
      }))
    })

    // Parallel execution with optimized projections and population
    const [users, total, stats] = await Promise.all([
      User.find(filteredQuery) // 🔥 Using filtered query
        .select('name email role status department position avatar emailVerified lastLogin createdAt updatedAt')
        .populate({
          path: 'role',
          select: 'name displayName hierarchyLevel permissions'
        })
        .populate({
          path: 'department',
          select: 'name description status'
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      User.countDocuments(filteredQuery).exec(), // 🔥 Using filtered query
      User.aggregate([
        { $match: filteredQuery }, // 🔥 Using filtered query for stats too
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'roleInfo'
          }
        },
        { $unwind: { path: '$roleInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            inactiveUsers: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
            suspendedUsers: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
            // Group by role hierarchy levels instead of hardcoded roles
            adminUsers: { $sum: { $cond: [{ $gte: ['$roleInfo.hierarchyLevel', 9] }, 1, 0] } },
            managerUsers: { $sum: { $cond: [{ $and: [{ $gte: ['$roleInfo.hierarchyLevel', 6] }, { $lt: ['$roleInfo.hierarchyLevel', 9] }] }, 1, 0] } },
            regularUsers: { $sum: { $cond: [{ $lt: ['$roleInfo.hierarchyLevel', 6] }, 1, 0] } }
          }
        }
      ])
    ])

    const responseData = {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: stats[0] || {
        total: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        suspendedUsers: 0,
        adminUsers: 0,
        managerUsers: 0,
        regularUsers: 0
      }
    }

    // Cache result
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    })

    // Log successful access
    console.log('Users list accessed:', {
      userId: session.user.email,
      page,
      limit,
      search: search || 'none',
      resultCount: users.length,
      filters: { role, status, department },
      ip: getClientInfo(request).ipAddress
    })

    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'Users retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in GET /api/users:', error)
    
    // Handle middleware errors (like permission denied)
    if (error instanceof Response) {
      return error
    }
    
    return createAPIErrorResponse("Internal server error", 500)
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user: currentUser, userEmail } = await genericApiRoutesMiddleware(request, 'users', 'create')

    // Parse and validate request body
    const body = await request.json()

    const validation = createUserSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse("Validation failed", 400, {
        errors: validation.error.errors
      })
    }

    const validatedData = validation.data

    // Additional security checks
    const dataString = JSON.stringify(validatedData)
    if (SecurityUtils.containsSQLInjection && SecurityUtils.containsXSS) {
      if (SecurityUtils.containsSQLInjection(dataString) ||
        SecurityUtils.containsXSS(dataString)) {
        console.log('Malicious user creation attempt:', {
          userId: session.user.email,
          ip: getClientInfo(request).ipAddress,
          attemptedData: 'REDACTED_FOR_SECURITY'
        })
        return createErrorResponse("Invalid data detected", 400)
      }
    }

    await connectDB()

    // Check if user already exists
    const existingUser = await User.findOne({
      email: validatedData.email,
      status: 'active'
    }).lean()

    if (existingUser) {
      console.log('Duplicate user creation attempt:', {
        userId: session.user.email,
        attemptedEmail: validatedData.email,
        ip: getClientInfo(request).ipAddress
      })
      return createErrorResponse("User with this email already exists", 409)
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

    // Create user with audit trail
    const { ipAddress: ip, userAgent } = getClientInfo(request)

    // Clean and format phone number if provided
    let cleanPhone = validatedData.phone
    if (cleanPhone) {
      // Remove all non-digit characters except + at the beginning
      cleanPhone = cleanPhone.replace(/[^\d+]/g, '')
      // If it starts with +, keep it, otherwise remove any + in the middle
      if (cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone.substring(1).replace(/\+/g, '')
      } else {
        cleanPhone = cleanPhone.replace(/\+/g, '')
      }
      // Ensure it's empty if invalid or just set to undefined if empty
      if (!cleanPhone || cleanPhone === '+') {
        cleanPhone = undefined
      }
    }

    const userData = {
      ...validatedData,
      phone: cleanPhone,
      password: hashedPassword,
      emailVerified: false,
      phoneVerified: false,
      twoFactorEnabled: false,
      status: 'active',
      metadata: {
        createdBy: session.user.email || 'unknown',
        updatedBy: session.user.email || 'unknown',
      }
    }

    console.log('Creating user with cleaned phone:', {
      originalPhone: validatedData.phone,
      cleanedPhone: cleanPhone,
      userData: { ...userData, password: '[REDACTED]' }
    })

    const user = new User(userData)
    await user.save()

    // Clear relevant caches
    cache.clear()

    // Prepare response (exclude sensitive data)
    const { password, ...userResponse } = user.toObject()

    // Log successful user creation
    console.log('User created successfully:', {
      createdBy: session.user.email,
      createdUserEmail: user.email,
      createdUserRole: user.role,
      createdUserName: user.name,
      ip: getClientInfo(request).ipAddress
    })

    return NextResponse.json({
      success: true,
      data: userResponse,
      message: 'User created successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error in POST /api/users:', error)

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return createErrorResponse("User with this email already exists", 409)
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors: any = {}
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message
      }

      console.log('Validation error details:', validationErrors)

      return createErrorResponse("Validation failed", 400, {
        validationErrors
      })
    }

    return createErrorResponse("Failed to create user", 500)
  }
}