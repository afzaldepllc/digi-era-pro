import { NextRequest, NextResponse } from "next/server"
import { applySecurityHeaders, validateClientIP, SecurityEventType, logSecurityEvent } from "@/lib/security/helmet-adapter"

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  // Skip middleware for:
  // 1. Static assets (performance)
  // 2. API routes (they handle their own security via genericApiRoutesMiddleware)
  // 3. NextAuth routes (they handle their own security)
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') || // All API routes handle their own middleware
    pathname.includes('.') || // Static files (images, css, js, etc.)
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }
  
  // Create response with security headers
  const response = NextResponse.next()
  
  // Enhanced security checks for UI routes only
  // (API routes handle their own security through genericApiRoutesMiddleware)
  
  // IP validation for sensitive UI routes
  if (pathname.includes('/auth/') || pathname.includes('/admin/') || pathname.includes('/dashboard/')) {
    const ipValidation = validateClientIP(req)
    if (ipValidation.isSuspicious) {
      logSecurityEvent(SecurityEventType.SUSPICIOUS_IP, {
        ip: ipValidation.ip,
        userAgent: req.headers.get('user-agent') || 'unknown',
        url: req.url,
        severity: 'medium',
        message: `Suspicious IP detected on UI route: ${ipValidation.reason}`,
      })
    }
  }
  
  // Apply security headers to all UI routes
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
