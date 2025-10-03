/**
 * Generic Route Middleware
 * Combines rate limiting, authentication, and permission checking in one function
 */

import { type NextRequest } from "next/server"
import { applyRateLimit } from "@/lib/security/rate-limiter"
import { validateRouteAccess, type PermissionOptions } from "@/lib/permissions/server"
import { MiddlewareLogger, createLogData } from "./middleware-logger"
import { handleMiddlewareError } from "@/lib/utils/api-responses"
import { QueryFilters, type FilterContext } from "@/lib/permissions/query-filters"

export interface RouteMiddlewareOptions extends PermissionOptions {
  rateLimitType?: "api" | "sensitive" | "auth"
  skipRateLimit?: boolean
  skipAuth?: boolean
}

export interface RouteMiddlewareResult {
  session: any
  user: any
  userEmail: string
  filterContext?: any
  isSuperAdmin?: boolean
  applyFilters: (baseQuery: any) => Promise<any>
}

/**
 * Universal route middleware that handles:
 * 1. Rate limiting
 * 2. Authentication
 * 3. Permission checking
 * 
 * Usage: const { session, user, userEmail } = await routeMiddleware(request, 'users', 'read')
 */
export async function routeMiddleware(
  request: NextRequest,
  resource: string,
  action: string,
  options: RouteMiddlewareOptions = {}
): Promise<RouteMiddlewareResult> {
  const {
    rateLimitType = "api",
    skipRateLimit = false,
    skipAuth = false,
    enableLogging = true,
    ...permissionOptions
  } = options

  const startTime = Date.now()

  try {
    // 1. Apply rate limiting (if not skipped)
    if (!skipRateLimit) {
      const rateLimitResponse = await applyRateLimit(request, rateLimitType)
      if (rateLimitResponse) {
        // Log rate limit exceeded
        if (enableLogging) {
          MiddlewareLogger.log(createLogData(request, resource, action, startTime, false, {
            rateLimitType,
            errorType: 'rate_limit',
            errorMessage: 'Rate limit exceeded',
            statusCode: 429
          }))
        }
        throw rateLimitResponse
      }
    }

    // 2. Skip auth entirely if requested (for public routes)
    if (skipAuth) {
      // Provide a no-op applyFilters function for public routes
      const applyFilters = async (baseQuery: any) => baseQuery
      
      if (enableLogging) {
        MiddlewareLogger.log(createLogData(request, resource, action, startTime, true, {
          userEmail: 'anonymous',
          rateLimitType
        }))
      }
      return {
        session: null,
        user: null,
        userEmail: 'anonymous',
        filterContext: undefined,
        isSuperAdmin: false,
        applyFilters
      }
    }

    // 3. Check authentication and permissions
    const { session, user } = await validateRouteAccess(request, resource, action, {
      ...permissionOptions,
      enableLogging
    })

    // 4. Extract user email for convenience
    const sessionUser = session.user as any
    const userEmail = sessionUser?.email || sessionUser?.user?.email || 'unknown'
    const userId = user?._id || user?.id || sessionUser?.id

    console.log('Middleware: Authenticated user:102', { 
      loggedIn: user,
      sessionUser: sessionUser,

    });

    // 5. Create permission-based filtering context
    const isSuperAdmin = QueryFilters.isSuperAdmin(user)
    
    console.log('Middleware: 🔍 Superadmin detection result:', {
      userId: userId,
      userEmail: userEmail,
      isSuperAdmin: isSuperAdmin,
      userRole: user.role,
      userRoleName: user.role?.name,
      hierarchyLevel: user.role?.hierarchyLevel
    })
    
    // Get subordinate IDs with error handling
    let subordinateIds: string[] = []
    try {
      subordinateIds = await QueryFilters.getSubordinateIds(userId)
    } catch (error) {
      console.error('Failed to get subordinate IDs, continuing without:', error)
    }
    
    // Enhanced department extraction - handle both object and string formats
    let userDepartment: string | undefined
    
    // Try multiple sources for department information
    if (user.department?._id) {
      // MongoDB populated object format
      userDepartment = user.department._id.toString()
    } else if (user.department && typeof user.department === 'string') {
      // Direct string format from session
      userDepartment = user.department
    } else if (sessionUser.department && typeof sessionUser.department === 'string') {
      // Session user department (string format)
      userDepartment = sessionUser.department
    }
    
    console.log('Middleware: Department extraction debug:', {
      userId: userId,
      userEmail: userEmail,
      'user.department': user.department,
      'sessionUser.department': sessionUser.department,
      extractedDepartment: userDepartment,
      departmentType: typeof userDepartment
    })
    
    const filterContext: FilterContext = {
      userId: userId,
      userEmail: userEmail,
      userDepartment: userDepartment,
      userRole: user.role,
      subordinateIds,
      isSuperAdmin
    }

    // 6. Create the applyFilters function
    const applyFilters = async (baseQuery: any) => {
      // Extract permissions from user object - handle multiple possible structures
      let permissions = []
      
      // Check if permissions are directly on user object (from session)
      if (user.permissions && Array.isArray(user.permissions)) {
        permissions = user.permissions
      }
      // Check if permissions are on user.role
      else if (user.role?.permissions && Array.isArray(user.role.permissions)) {
        permissions = user.role.permissions
      }
      
      console.log('🔍 Middleware: Extracted permissions for filtering:', {
        resource: resource,
        userId: userId,
        userEmail: userEmail,
        userDepartment: filterContext.userDepartment,
        permissionsFound: permissions.length,
        permissionSources: {
          userDirectPermissions: !!user.permissions,
          rolePermissions: !!user.role?.permissions
        },
        allPermissions: JSON.stringify(permissions, null, 2),
        samplePermissions: permissions.slice(0, 2),
        relevantPermissions: permissions.filter((p: any) => p.resource === resource),
        relevantPermissionsCount: permissions.filter((p: any) => p.resource === resource).length
      })
      
      return await QueryFilters.applyPermissionFilters(
        baseQuery,
        resource,
        permissions,
        filterContext
      )
    }

    // 7. Log successful access
    if (enableLogging) {
      MiddlewareLogger.log(createLogData(request, resource, action, startTime, true, {
        userEmail,
        userId,
        rateLimitType,
        statusCode: 200
      }))
    }

    return {
      session,
      user,
      userEmail,
      filterContext,
      isSuperAdmin,
      applyFilters
    }

  } catch (error: any) {
    // Determine error type and status code
    let errorType: 'rate_limit' | 'authentication' | 'authorization' | 'validation' | 'server_error' = 'server_error'
    let statusCode = 500
    let errorMessage = error.message || 'Unknown error'

    if (error instanceof Response) {
      statusCode = error.status
      
      // Try to extract error details from response
      try {
        const errorData = await error.clone().json()
        errorMessage = errorData.error || errorMessage
        
        // Determine error type based on status code and message
        if (statusCode === 429) {
          errorType = 'rate_limit'
        } else if (statusCode === 401) {
          errorType = 'authentication'
        } else if (statusCode === 403) {
          errorType = 'authorization'
        } else if (statusCode === 400) {
          errorType = 'validation'
        }
      } catch {
        // If we can't parse the response, check the error message for clues
        if (errorMessage.includes('Rate limit')) {
          errorType = 'rate_limit'
          statusCode = 429
        } else if (errorMessage.includes('Authentication required') || errorMessage.includes('login')) {
          errorType = 'authentication'
          statusCode = 401
        } else if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
          errorType = 'authorization'
          statusCode = 403
        }
      }
    }

    // Log the error
    if (enableLogging) {
      MiddlewareLogger.log(createLogData(request, resource, action, startTime, false, {
        errorType,
        errorMessage,
        statusCode
      }))
    }

    // Use the standardized error handler
    throw handleMiddlewareError(error, resource, action)
  }
}

/**
 * Convenience wrappers for common scenarios
 */

// For standard API routes (GET, etc.)
export async function apiMiddleware(
  request: NextRequest,
  resource: string,
  action: string,
  options: Omit<RouteMiddlewareOptions, 'rateLimitType'> = {}
): Promise<RouteMiddlewareResult> {
  return routeMiddleware(request, resource, action, {
    ...options,
    rateLimitType: "api"
  })
}

// For sensitive operations (POST, PUT, DELETE)
export async function sensitiveMiddleware(
  request: NextRequest,
  resource: string,
  action: string,
  options: Omit<RouteMiddlewareOptions, 'rateLimitType'> = {}
): Promise<RouteMiddlewareResult> {
  return routeMiddleware(request, resource, action, {
    ...options,
    rateLimitType: "sensitive"
  })
}

// For authentication routes
export async function authMiddleware(
  request: NextRequest,
  resource: string,
  action: string,
  options: Omit<RouteMiddlewareOptions, 'rateLimitType'> = {}
): Promise<RouteMiddlewareResult> {
  return routeMiddleware(request, resource, action, {
    ...options,
    rateLimitType: "auth"
  })
}

// For public routes (no auth required)
export async function publicMiddleware(
  request: NextRequest,
  options: Omit<RouteMiddlewareOptions, 'skipAuth'> = {}
): Promise<RouteMiddlewareResult> {
  return routeMiddleware(request, '', '', {
    ...options,
    skipAuth: true
  })
}

/**
 * Generic middleware function that handles everything in one call
 * This is the main function you'll use in your routes
 * 
 * Usage examples:
 * - GET: const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'users', 'read')
 * - POST: const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'users', 'create')
 * - PUT: const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'roles', 'update')
 * - DELETE: const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'roles', 'delete')
 */
export async function genericApiRoutesMiddleware(
  request: NextRequest,
  resource: string,
  action: string,
  options: RouteMiddlewareOptions = {}
): Promise<RouteMiddlewareResult> {
  // Automatically determine rate limit type based on action
  const sensitiveActions = ['create', 'update', 'delete', 'manage', 'configure', 'assign', 'approve', 'reject']
  const authActions = ['login', 'register', 'logout', 'refresh']
  
  let defaultRateLimitType: "api" | "sensitive" | "auth" = "api"
  
  if (authActions.includes(action)) {
    defaultRateLimitType = "auth"
  } else if (sensitiveActions.includes(action)) {
    defaultRateLimitType = "sensitive"
  }

  // Use provided rate limit type or auto-detected one
  const rateLimitType = options.rateLimitType || defaultRateLimitType

  return routeMiddleware(request, resource, action, {
    ...options,
    rateLimitType
  })
}