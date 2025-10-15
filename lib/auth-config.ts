import CredentialsProvider from "next-auth/providers/credentials"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import { MongoClient } from "mongodb"
import { executeGenericDbQuery } from "@/lib/mongodb"
import User from "@/models/User"
import Role from "@/models/Role"
import { loginSchema } from "@/lib/validations/auth"
import { AuditLogger } from "@/lib/security/audit-logger"
import { SecurityUtils } from "@/lib/security/validation"

const client = new MongoClient(process.env.MONGODB_URI!)
const clientPromise = Promise.resolve(client)

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required")
          }

          // Apply rate limiting (if applyRateLimit is available)
          try {
            const { applyRateLimit } = await import("@/lib/security/rate-limiter")
            const mockRequest = {
              ip: req?.headers?.['x-forwarded-for'] as string || "unknown",
              headers: req?.headers || {},
            } as any

            const rateLimitResponse = await applyRateLimit(mockRequest, "auth")
            if (rateLimitResponse) {
              // Rate limit exceeded - extract error message from response
              const errorBody = await rateLimitResponse.json().catch(() => ({ error: "Too many login attempts" }))
              throw new Error(errorBody.error || "Too many login attempts. Please wait before trying again.")
            }
          } catch (rateLimitError: any) {
            // If it's a rate limit error, re-throw it
            if (rateLimitError.message && rateLimitError.message.includes("Too many")) {
              throw rateLimitError
            }
            // If rate limiting fails for other reasons, continue with authentication but log the error
            console.warn("Rate limiting check failed:", rateLimitError)
          }

          // Validate input with security checks
          const validatedFields = loginSchema.safeParse(credentials)
          if (!validatedFields.success) {
            throw new Error("Invalid credentials format")
          }

          // Additional input validation
          const emailValidation = SecurityUtils.validateInput(credentials.email, 'email')
          if (!emailValidation.isValid) {
            throw new Error("Invalid email format")
          }

          // Find user with password field and populate role WITH PERMISSIONS
          const user = await executeGenericDbQuery(async () => {
            return await User.findOne({ email: credentials.email.toLowerCase() })
            .select("+password")
            .populate({
              path: 'role',
              select: 'name displayName hierarchyLevel permissions',
              populate: {
                path: 'permissions',
                model: 'SystemPermission',
                select: 'resource actions conditions displayName category'
              }
            })
            .populate('department', 'name')
          })

          if (!user) {
            // Log failed login attempt
            await AuditLogger.logFailedLogin({
              email: credentials.email,
              ipAddress: req?.headers?.['x-forwarded-for'] as string || "unknown",
              userAgent: req?.headers?.['user-agent'] as string || "unknown",
              errorMessage: "User not found",
            })
            throw new Error("Invalid credentials")
          }

          // Ensure role is populated - fallback if needed
          if (!user.role) {
            console.warn(`User ${user.email} has no role assigned, using default`)
          }

          if (!user.status || user.status !== 'active') {
            // Log failed login attempt for deactivated user
            await AuditLogger.logFailedLogin({
              email: credentials.email,
              ipAddress: req?.headers?.['x-forwarded-for'] as string || "unknown",
              userAgent: req?.headers?.['user-agent'] as string || "unknown",
              errorMessage: "Account deactivated",
            })
            throw new Error("Account is deactivated")
          }

          // Check password
          const isPasswordValid = await user.comparePassword(credentials.password)

          if (!isPasswordValid) {
            // Log failed login attempt
            await AuditLogger.logFailedLogin({
              email: credentials.email,
              ipAddress: req?.headers?.['x-forwarded-for'] as string || "unknown",
              userAgent: req?.headers?.['user-agent'] as string || "unknown",
              errorMessage: "Invalid password",
            })
            throw new Error("Invalid credentials")
          }

          // Log successful login
          await AuditLogger.logUserLogin({
            userId: (user._id as any).toString(),
            userEmail: user.email,
            ipAddress: req?.headers?.['x-forwarded-for'] as string || "unknown",
            userAgent: req?.headers?.['user-agent'] as string || "unknown",
            success: true,
          })

          // Extract permissions from populated role during login
          let userPermissions: any[] = []
          if (user.role && (user.role as any).permissions) {
            userPermissions = (user.role as any).permissions.map((permission: any) => ({
              resource: permission.resource,
              actions: permission.actions || [],
              conditions: permission.conditions || {},
              displayName: permission.displayName,
              category: permission.category
            }))
          }

          return {
            id: (user._id as any).toString(),
            name: user.name,
            email: user.email,
            role: user.role ? (user.role as any).name : 'user',
            roleDisplayName: user.role ? (user.role as any).displayName : 'User',
            department: user.department ? (user.department as any).name : null,
            avatar: user.avatar,
            permissions: userPermissions, // Add permissions to the user object
          }
        } catch (error: any) {
          console.error("Auth error:", error.message)
          throw new Error(error.message || "Authentication failed")
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  events: {
    async signOut(message: any) {
      // Clear localStorage when user signs out
      if (typeof window !== 'undefined') {
        localStorage.removeItem('logged_in_user')
        localStorage.removeItem('user_permissions')
        localStorage.removeItem('user_role')
        localStorage.removeItem('user_department')
        
        // Clear any other cached user data
        const keysToRemove = Object.keys(localStorage).filter(key => 
          key.startsWith('user_') || 
          key.startsWith('auth_') || 
          key.startsWith('session_')
        )
        keysToRemove.forEach(key => localStorage.removeItem(key))
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }: any) {
      // Handle session updates (including avatar changes)
      if (trigger === "update" && session) {
        console.log('JWT callback - updating session with:', session)

        // Update specific fields from session update
        if (session.avatar !== undefined) {
          token.avatar = session.avatar
          console.log('JWT callback - avatar updated to:', session.avatar)
        }

        // Merge any other user data updates
        if (session.user) {
          token.user = { ...token.user, ...session.user }
        }

        return token
      }

      if (user) {
        token.role = user.role
        token.roleDisplayName = user.roleDisplayName
        token.department = user.department
        token.avatar = user.avatar
        token.permissions = user.permissions
        token.sessionStartTime = Date.now()
      }
      return token
    },

    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.roleDisplayName = token.roleDisplayName as string
        session.user.department = token.department as string
        session.user.avatar = token.avatar as string  // This will now be updated properly
        session.user.permissions = token.permissions || []
        session.user.sessionStartTime = token.sessionStartTime
        session.user.iat = token.iat

        // Store permissions in localStorage for faster access
        if (typeof window !== 'undefined' && token.permissions) {
          try {
            localStorage.setItem('user_permissions', JSON.stringify(token.permissions));
          } catch (error) {
            // Silently handle localStorage errors
          }
        }
      }

      // Store complete user data in localStorage for dashboard access
      if (typeof window !== 'undefined') {
        try {
          const currentStoredUser = localStorage.getItem('logged_in_user');
          const newUserData = JSON.stringify(session.user);

          if (currentStoredUser !== newUserData) {
            localStorage.setItem('logged_in_user', newUserData);
          }
        } catch (error) {
          console.error('Error storing user in localStorage:', error);
        }
      }

      return session
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
