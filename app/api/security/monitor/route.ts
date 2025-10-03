import { type NextRequest, NextResponse } from "next/server"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { MiddlewareLogger } from '@/lib/middleware/middleware-logger'

/**
 * Security Monitoring Dashboard API
 * Provides insights into API endpoint protection and security events
 */

// GET /api/security/monitor - Get security monitoring data
export async function GET(request: NextRequest) {
  try {
    // Apply middleware - only admins can access security monitoring
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'system-monitoring', 'read')

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    
    // Get monitoring data
    const recentLogs = MiddlewareLogger.getRecentLogs(limit)
    const securityStats = MiddlewareLogger.getSecurityStats()

    // Additional security insights
    const insights = {
      // Recent activity patterns
      lastHour: recentLogs.filter(log => 
        Date.now() - new Date(log.timestamp).getTime() < 60 * 60 * 1000
      ).length,
      
      // Failed authentication attempts in last 24 hours
      recentAuthFailures: recentLogs.filter(log => 
        log.errorType === 'authentication' && 
        Date.now() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000
      ).length,

      // Rate limit violations in last hour
      recentRateLimitViolations: recentLogs.filter(log => 
        log.errorType === 'rate_limit' && 
        Date.now() - new Date(log.timestamp).getTime() < 60 * 60 * 1000
      ).length,

      // Most active IPs
      topIPs: getTopIPs(recentLogs),
      
      // Security risk score (0-100)
      riskScore: calculateRiskScore(recentLogs, securityStats)
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: recentLogs,
        stats: securityStats,
        insights,
        timestamp: new Date().toISOString()
      },
      message: 'Security monitoring data retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in security monitoring API:', error)
    
    if (error instanceof Response) {
      return error
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve security monitoring data'
    }, { status: 500 })
  }
}

// POST /api/security/monitor - Clear logs or perform security actions
export async function POST(request: NextRequest) {
  try {
    // Apply middleware - only super admins can perform security actions
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'system-administration', 'manage')

    const body = await request.json()
    const { action, ...params } = body

    let result = {}

    switch (action) {
      case 'clear_logs':
        MiddlewareLogger.clearLogs()
        result = { message: 'Security logs cleared successfully' }
        break

      case 'export_logs':
        const logs = MiddlewareLogger.exportLogs()
        result = { 
          message: 'Logs exported successfully',
          data: logs,
          count: logs.length
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action specified'
        }, { status: 400 })
    }

    // Log the security action
    console.log('Security action performed:', {
      action,
      performedBy: userEmail,
      timestamp: new Date().toISOString(),
      params
    })

    return NextResponse.json({
      success: true,
      ...result
    })

  } catch (error: any) {
    console.error('Error in security monitoring POST:', error)
    
    if (error instanceof Response) {
      return error
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to perform security action'
    }, { status: 500 })
  }
}

/**
 * Helper function to get top IPs by request count
 */
function getTopIPs(logs: any[]): Array<{ ip: string; count: number; successRate: number }> {
  const ipStats: Record<string, { total: number; successful: number }> = {}

  logs.forEach(log => {
    if (!ipStats[log.ip]) {
      ipStats[log.ip] = { total: 0, successful: 0 }
    }
    ipStats[log.ip].total++
    if (log.success) {
      ipStats[log.ip].successful++
    }
  })

  return Object.entries(ipStats)
    .map(([ip, stats]) => ({
      ip,
      count: stats.total,
      successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 IPs
}

/**
 * Calculate risk score based on recent activity
 */
function calculateRiskScore(logs: any[], stats: any): number {
  let riskScore = 0

  // Base risk factors
  const totalRequests = stats.totalRequests || 1
  const blockedPercentage = (stats.blockedRequests / totalRequests) * 100

  // High blocked request percentage increases risk
  if (blockedPercentage > 50) riskScore += 40
  else if (blockedPercentage > 25) riskScore += 20
  else if (blockedPercentage > 10) riskScore += 10

  // Recent authentication failures
  const recentAuthFailures = logs.filter(log => 
    log.errorType === 'authentication' && 
    Date.now() - new Date(log.timestamp).getTime() < 60 * 60 * 1000
  ).length

  if (recentAuthFailures > 20) riskScore += 30
  else if (recentAuthFailures > 10) riskScore += 15
  else if (recentAuthFailures > 5) riskScore += 5

  // Rate limit violations
  const rateLimitViolations = stats.rateLimitBlocks || 0
  if (rateLimitViolations > 100) riskScore += 20
  else if (rateLimitViolations > 50) riskScore += 10
  else if (rateLimitViolations > 20) riskScore += 5

  // Suspicious IP activity
  const topIPs = getTopIPs(logs)
  const suspiciousIPs = topIPs.filter(ip => ip.successRate < 30).length
  if (suspiciousIPs > 5) riskScore += 15
  else if (suspiciousIPs > 2) riskScore += 8

  return Math.min(100, Math.max(0, riskScore))
}