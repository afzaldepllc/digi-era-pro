import { NextRequest, NextResponse } from "next/server"
import { applySecurityHeaders } from "@/lib/security/helmet-adapter"

// Cache for static route checks
const staticRouteCache = new Map<string, boolean>()
const STATIC_CACHE_SIZE = 1000

function isStaticRoute(pathname: string): boolean {
  // Check cache first
  if (staticRouteCache.has(pathname)) {
    return staticRouteCache.get(pathname)!
  }

  const isStatic = (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  )

  // Cache the result
  staticRouteCache.set(pathname, isStatic)

  // Clean cache if it gets too large
  if (staticRouteCache.size > STATIC_CACHE_SIZE) {
    const firstKey = staticRouteCache.keys().next().value
    staticRouteCache.delete(firstKey as string)
  }

  return isStatic
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // PERFORMANCE: Skip middleware for static assets and API routes
  // API routes handle their own security via genericApiRoutesMiddleware
  if (isStaticRoute(pathname)) {
    return NextResponse.next()
  }

  // Create response with minimal processing
  const response = NextResponse.next()

  // Apply security headers only to dynamic UI routes
  // Removed IP validation for performance - handle in API routes if needed
  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
