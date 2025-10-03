import connectDB from "@/lib/mongodb"
import { Schema, model, models } from "mongoose"

// Audit log schema
export interface IAuditLog {
  userId?: string
  userEmail?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
  success: boolean
  errorMessage?: string
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: String, index: true },
  userEmail: { type: String, index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  resourceId: { type: String, index: true },
  details: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
  success: { type: Boolean, required: true, index: true },
  errorMessage: { type: String },
})

// TTL index to automatically delete logs after 1 year
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 })

export const AuditLog = models.AuditLog || model<IAuditLog>("AuditLog", AuditLogSchema)

export class AuditLogger {
  static async log(params: {
    userId?: string
    userEmail?: string
    action: string
    resource: string
    resourceId?: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
  }) {
    try {
      await connectDB()
      
      await AuditLog.create({
        ...params,
        timestamp: new Date(),
      })
    } catch (error) {
      // Log to console if database logging fails
      console.error("Failed to create audit log:", error)
      console.log("Audit log data:", params)
    }
  }

  // User-related audit methods
  static async logUserCreation(params: {
    adminId: string
    adminEmail: string
    targetUserId: string
    targetUserEmail: string
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
  }) {
    await this.log({
      userId: params.adminId,
      userEmail: params.adminEmail,
      action: "CREATE_USER",
      resource: "USER",
      resourceId: params.targetUserId,
      details: {
        targetUserEmail: params.targetUserEmail,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      errorMessage: params.errorMessage,
    })
  }

  static async logUserUpdate(params: {
    adminId: string
    adminEmail: string
    targetUserId: string
    targetUserEmail: string
    changes: Record<string, any>
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
  }) {
    await this.log({
      userId: params.adminId,
      userEmail: params.adminEmail,
      action: "UPDATE_USER",
      resource: "USER",
      resourceId: params.targetUserId,
      details: {
        targetUserEmail: params.targetUserEmail,
        changes: params.changes,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      errorMessage: params.errorMessage,
    })
  }

  static async logUserDeletion(params: {
    adminId: string
    adminEmail: string
    targetUserId: string
    targetUserEmail: string
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
  }) {
    await this.log({
      userId: params.adminId,
      userEmail: params.adminEmail,
      action: "DELETE_USER",
      resource: "USER",
      resourceId: params.targetUserId,
      details: {
        targetUserEmail: params.targetUserEmail,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      errorMessage: params.errorMessage,
    })
  }

  static async logUserLogin(params: {
    userId: string
    userEmail: string
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
  }) {
    await this.log({
      userId: params.userId,
      userEmail: params.userEmail,
      action: "LOGIN",
      resource: "AUTH",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success,
      errorMessage: params.errorMessage,
    })
  }

  static async logUserLogout(params: {
    userId: string
    userEmail: string
    ipAddress?: string
    userAgent?: string
  }) {
    await this.log({
      userId: params.userId,
      userEmail: params.userEmail,
      action: "LOGOUT",
      resource: "AUTH",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
    })
  }

  static async logFailedLogin(params: {
    email: string
    ipAddress?: string
    userAgent?: string
    errorMessage: string
  }) {
    await this.log({
      userEmail: params.email,
      action: "LOGIN_FAILED",
      resource: "AUTH",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: false,
      errorMessage: params.errorMessage,
    })
  }

  // Query methods for audit logs
  static async getUserAuditLogs(userId: string, limit: number = 50) {
    try {
      await connectDB()
      
      return await AuditLog.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean()
    } catch (error) {
      console.error("Failed to retrieve user audit logs:", error)
      return []
    }
  }

  static async getResourceAuditLogs(resource: string, resourceId: string, limit: number = 50) {
    try {
      await connectDB()
      
      return await AuditLog.find({ resource, resourceId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean()
    } catch (error) {
      console.error("Failed to retrieve resource audit logs:", error)
      return []
    }
  }

  static async getFailedLogins(timeframe: Date, limit: number = 100) {
    try {
      await connectDB()
      
      return await AuditLog.find({
        action: "LOGIN_FAILED",
        timestamp: { $gte: timeframe },
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean()
    } catch (error) {
      console.error("Failed to retrieve failed login attempts:", error)
      return []
    }
  }

  // Additional convenience methods for user actions
  static async logUserAction(params: {
    userId: string
    action: string
    resource: string
    resourceId?: string
    details?: Record<string, any>
  }) {
    return this.log({
      ...params,
      success: true
    })
  }

  static async logDataAccess(params: {
    userId: string
    action: string
    resource: string
    resourceId?: string
    query?: any
    resultCount?: number
  }) {
    return this.log({
      ...params,
      success: true,
      details: {
        query: params.query,
        resultCount: params.resultCount
      }
    })
  }
}
