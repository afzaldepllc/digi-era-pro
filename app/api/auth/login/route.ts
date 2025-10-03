import { NextRequest, NextResponse } from "next/server"
import { applySecurityHeaders } from "@/lib/security/helmet-adapter"
import { AuditLogger } from "@/lib/security/audit-logger"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { loginSchema } from "@/lib/validations/auth"
import { applyRateLimit } from "@/lib/security/rate-limiter"
import { getClientInfo } from "@/lib/security/error-handler"


export async function POST(request: NextRequest) {
  // Apply rate limiting for auth endpoint
  const rateLimitResponse = await applyRateLimit(request, "auth")
  if (rateLimitResponse) return rateLimitResponse


  //   // Parse and validate request body
  const body = await request.json()
  const clientIP = getClientInfo(request).ipAddress

  console.log(`Login attempt for email: ${body.email}`) // Debug log

  //   // Validate with Zod schema (protects against NoSQL injection)
  const validatedFields = loginSchema.safeParse(body)
  if (!validatedFields.success) {
    await AuditLogger.logFailedLogin({
      email: body.email || 'unknown',
      ipAddress: clientIP,
      userAgent: request.headers.get('user-agent') || 'unknown',
      errorMessage: 'Schema validation failed',
    })

    const response = NextResponse.json(
      {
        success: false,
        error: 'Invalid credentials format',
        details: validatedFields.error.flatten().fieldErrors
      },
      { status: 400 }
    )
    return response
  }

  try {
    const { email, password } = validatedFields.data!

    // Additional NoSQL injection protection
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.log(`NoSQL injection attempt detected from IP: ${clientIP}`) // Debug log

      const response = NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    // Connect to database
    await connectDB()

    // Find user with password field (MongoDB query is safe due to Zod validation)
    const user = await User.findOne({
      email: (email as string).toLowerCase() // This is safe because email is validated as string
    }).select("+password")

    if (!user) {
      // Log failed login attempt
      await AuditLogger.logFailedLogin({
        email: email,
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent') || 'unknown',
        errorMessage: 'User not found',
      })

      console.log(`Failed login - user not found: ${email}`) // Debug log

      const response = NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials'
        },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    if (user.status !== 'active') {
      // Log failed login attempt for deactivated user
      await AuditLogger.logFailedLogin({
        email: email,
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent') || 'unknown',
        errorMessage: 'Account deactivated',
      })

      console.log(`Failed login - account deactivated: ${email}`) // Debug log

      const response = NextResponse.json(
        {
          success: false,
          error: 'Account is deactivated'
        },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)

    if (!isPasswordValid) {
      // Log failed login attempt
      await AuditLogger.logFailedLogin({
        email: email,
        ipAddress: clientIP,
        userAgent: request.headers.get('user-agent') || 'unknown',
        errorMessage: 'Invalid password',
      })

      console.log(`Failed login - invalid password: ${email}`) // Debug log

      const response = NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials'
        },
        { status: 401 }
      )
      return response
    }

    // Reset rate limit on successful login (optional optimization)

    // Update last login timestamp
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      'metadata.updatedBy': (user._id as string).toString(),
    })

    // Log successful login
    await AuditLogger.logUserLogin({
      userId: (user._id as string).toString(),
      userEmail: user.email,
      ipAddress: clientIP,
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    console.log(`Successful login: ${email}`) // Debug log

    // Return success response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: (user._id as string).toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      }
    })
    return response
  } catch (error: any) {
    console.error('Login error:', error)

    const response = NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )

    return response
  }
}

// GET method not allowed
export async function GET(request: NextRequest) {
  const response = NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )

  response.headers.set('Allow', 'POST')
  return applySecurityHeaders(response)
}