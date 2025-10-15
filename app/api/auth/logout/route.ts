import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-config"
import { AuditLogger } from "@/lib/security/audit-logger"

export async function POST(req: NextRequest) {
  try {
    // Get current session before destroying it
    const session = await getServerSession(authOptions)
    
    if (session?.user) {
      // Log logout event
      await AuditLogger.logUserLogout({
        userId: session.user.id,
        userEmail: session.user.email,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || "unknown",
        userAgent: req.headers.get('user-agent') || "unknown",
      })
    }

    // Create response with cache clearing headers
    const response = NextResponse.json(
      { 
        success: true, 
        message: "Logged out successfully",
        redirect: "/auth/login"
      },
      { status: 200 }
    )

    // Clear all NextAuth cookies
    const cookiesToClear = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
      'next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
    ]

    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
    })

    // Add cache control headers
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error: any) {
    console.error("Logout error:", error.message)
    
    // Even if audit logging fails, still attempt to clear session
    const response = NextResponse.json(
      { 
        success: false, 
        message: "Logout failed", 
        error: error.message 
      },
      { status: 500 }
    )

    // Still clear cookies on error
    const cookiesToClear = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
      'next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
    ]

    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
    })

    return response
  }
}