import { type NextRequest, NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import SystemPermission from "@/models/SystemPermission"
import { z } from "zod"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'




// Cache for permissions - updated
const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (permissions don't change often)

function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// Query validation
const permissionQuerySchema = z.object({
  category: z.string().optional(),
  resource: z.string().optional(),
  includeInactive: z.string().optional().default('false').transform(val => val === 'true'),
})

// GET /api/system-permissions - Get all available system permissions
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'system-permissions', 'read')

    await connectDB()
    console.log('System permissions API: Database connected')

    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    console.log('System permissions API: Query params:', queryParams)

    const validation = permissionQuerySchema.safeParse(queryParams)
    if (!validation.success) {
      console.log('System permissions API: Validation failed:', validation.error.errors)
      return createErrorResponse("Invalid query parameters", 400, {
        errors: validation.error.errors
      })
    }

    const { category, resource, includeInactive } = validation.data
    console.log('System permissions API: Validated params:', { category, resource, includeInactive })

    // Generate cache key
    const cacheKey = `system_permissions:${category}:${resource}:${includeInactive}`

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        ...cached.data,
        message: 'System permissions retrieved successfully (cached)'
      })
    }

    // Build query
    const query: any = {}
    if (!includeInactive) {
      query.status = 'active'
    }
    if (category) {
      query.category = category.toLowerCase()
    }
    if (resource) {
      query.resource = resource.toLowerCase()
    }

    // Get permissions grouped by category
    const permissions = await SystemPermission.find(query)
      .sort({ category: 1, displayName: 1 })
      .lean()
      .exec()

    console.log('System permissions API: Found permissions:', permissions.length)
    console.log('System permissions API: Permission categories:', [...new Set(permissions.map(p => p.category))])

    // Group permissions by category
    const groupedPermissions = permissions.reduce((acc: any, permission: any) => {
      if (!acc[permission.category]) {
        acc[permission.category] = []
      }
      acc[permission.category].push(permission)
      return acc
    }, {})

    console.log('System permissions API: Grouped permissions keys:', Object.keys(groupedPermissions))

    // Get statistics
    const stats = await SystemPermission.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          coreCount: { $sum: { $cond: ['$isCore', 1, 0] } }
        }
      },
      {
        $group: {
          _id: null,
          totalCategories: { $sum: 1 },
          totalPermissions: { $sum: '$count' },
          totalCorePermissions: { $sum: '$coreCount' },
          categoriesStats: { $push: { category: '$_id', count: '$count', coreCount: '$coreCount' } }
        }
      }
    ])

    const responseData = {
      permissions: groupedPermissions,
      categories: Object.keys(groupedPermissions),
      statistics: stats[0] || {
        totalCategories: 0,
        totalPermissions: 0,
        totalCorePermissions: 0,
        categoriesStats: []
      }
    }

    // Cache result
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    })

    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'System permissions retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in GET /api/system-permissions:', error)
    return createErrorResponse("Internal server error", 500)
  }
}