import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Department from "@/models/Department"
import { createDepartmentSchema, departmentQuerySchema } from "@/lib/validations/department"
import { SecurityUtils } from '@/lib/security/validation'
import { getClientInfo } from '@/lib/security/error-handler'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from "@/lib/utils/api-responses"


// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/departments - List departments with pagination and filters
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'read')

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters properly
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }

    // Convert and validate parameters
    const parsedParams = {
      page: parseInt(queryParams.page),
      limit: parseInt(queryParams.limit),
      search: queryParams.search.trim(),
      status: queryParams.status.trim(),
      sortBy: queryParams.sortBy,
      sortOrder: queryParams.sortOrder as 'asc' | 'desc',
    }

    const validatedParams = departmentQuerySchema.parse(parsedParams)

    // Build query
    const filter: any = {}

    // Search implementation - use regex for more reliable results
    if (validatedParams.search) {
      const searchTerm = validatedParams.search.trim()
      console.log('Search term:', searchTerm)

      // extra-security: sanitize and validate search input
      const sanitizedSearch = SecurityUtils.sanitizeString(searchTerm)
      // Check for potential security threats
      if (SecurityUtils.containsSQLInjection && SecurityUtils.containsXSS) {
        if (SecurityUtils.containsSQLInjection(sanitizedSearch) ||
          SecurityUtils.containsXSS(sanitizedSearch)) {
          console.log('Malicious input detected in user search:', {
            userId: userEmail || 'unknown',
            searchTerm: 'REDACTED',
            ip: getClientInfo(request).ipAddress
          })
          return createErrorResponse("Invalid search parameter", 400)
        }
      }

      if (searchTerm.length > 0) {
        // Use regex search for more predictable results
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
        console.log('Applied search query:', JSON.stringify(filter.$or, null, 2))
      }
    }

    if (validatedParams.status) {
      filter.status = validatedParams.status
    }

    console.log('Final query before execution:', JSON.stringify(filter, null, 2))

    // Execute queries with automatic connection management and caching
    const [departments, total, stats] = await Promise.all([
      executeGenericDbQuery(async () => {
        // Debug: Check all departments first
        const allDepts = await Department.find({ status: 'active' }).select('name description').lean()
        console.log('All active departments:', allDepts)

        // Build sort
        const sort: any = {}
        sort[validatedParams.sortBy] = validatedParams.sortOrder === 'asc' ? 1 : -1

        return await Department.find(filter)
          .sort(sort)
          .skip((validatedParams.page - 1) * validatedParams.limit)
          .limit(validatedParams.limit)
          .lean()
      }, `departments-${JSON.stringify(validatedParams)}`, 60000), // 1-minute cache

      executeGenericDbQuery(async () => {
        return await Department.countDocuments(filter)
      }, `departments-count-${JSON.stringify(filter)}`, 60000),

      executeGenericDbQuery(async () => {
        return await Department.aggregate([
          {
            $group: {
              _id: null,
              totalDepartments: { $sum: 1 },
              activeDepartments: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              inactiveDepartments: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } }
            }
          }
        ])
      }, 'departments-stats', 300000) // 5-minute cache for stats
    ])

    const pages = Math.ceil(total / validatedParams.limit)
    const pagination = {
      page: validatedParams.page,
      limit: validatedParams.limit,
      total,
      pages
    }

    return NextResponse.json({
      success: true,
      data: {
        departments,
        pagination,
        stats: stats[0] || { totalDepartments: 0, activeDepartments: 0, inactiveDepartments: 0 }
      },
      message: 'Departments retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching departments:', error)
    
    // Handle middleware errors (like permission denied)
    if (error instanceof Response) {
      return error
    }
    
    return createAPIErrorResponse(
      error.message || 'Failed to fetch departments', 
      500, 
      "INTERNAL_ERROR"
    )
  }
}

// POST /api/departments - Create new department
export async function POST(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'create')

    const body = await request.json()
    const validatedData = createDepartmentSchema.parse(body)

    // Create department with automatic connection management
    const department = await executeGenericDbQuery(async () => {
      // Check if department name already exists (case insensitive)
      const existingDepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${validatedData.name}$`, 'i') },
        status: 'active'
      })

      if (existingDepartment) {
        throw new Error("Department name already exists")
      }

      // Create department
      const newDepartment = new Department(validatedData)
      await newDepartment.save()
      return newDepartment
    })

    // Clear department-related caches
    clearCache('departments')


    return NextResponse.json({
      success: true,
      data: { department },
      message: 'Department created successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating department:', error)

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
      error: error.message || 'Failed to create department'
    }, { status: 500 })
  }
}