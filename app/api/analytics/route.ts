import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery } from "@/lib/mongodb"
import Project from "@/models/Project"
import Task from "@/models/Task"
import Phase from "@/models/Phase"
import Milestone from "@/models/Milestone"
import mongoose from "mongoose"
import { SecurityUtils } from "@/lib/security/validation"
import { getClientInfo } from "@/lib/security/error-handler"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse, createAPISuccessResponse } from "@/lib/utils/api-responses"
import { analyticsQuerySchema } from "@/lib/validations/analytics"

// Cache TTL for analytics queries
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (analytics can be cached longer)

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/analytics - Get comprehensive project and task analytics
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions) with filtering
    const { session, user, userEmail, isSuperAdmin, applyFilters } = await genericApiRoutesMiddleware(request, 'analytics', 'read')
    console.log("🔍 Analytics API: Authenticated user details:", {
      permissions: JSON.stringify(user.permissions, null, 2),
      isSuperAdmin,
      rolePermissions: user.role?.permissions?.map((p: any) => ({ resource: p.resource, conditions: p.conditions })),
      userRole: user.role?.name,
      userId: user._id || user.id,
      userEmail: user.email,
      userDepartment: user.department,
      hasUserPermissions: !!user.permissions,
      hasRolePermissions: !!user.role?.permissions,
      permissionsCount: user.permissions?.length || user.role?.permissions?.length || 0
    })

    console.log("🔍 Analytics API: Applied filters:", applyFilters)

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validation = analyticsQuerySchema.safeParse(queryParams)
    if (!validation.success) {
      return createErrorResponse("Invalid query parameters", 400, {
        errors: validation.error.errors
      })
    }

    const { projectId, dateRange, includeCompleted, departmentId, userId } = validation.data

    // Generate user-specific cache key to prevent cross-user cache pollution
    const userCacheIdentifier = isSuperAdmin ? 'superadmin' : `user_${user._id || user.id}_${user.role?.name || 'no_role'}_${user.department || 'no_dept'}`
    const cacheKey = `analytics:${userCacheIdentifier}:${projectId}:${dateRange}:${includeCompleted}:${departmentId}:${userId}`

    // Execute database query with optimized connection and caching
    const result = await executeGenericDbQuery(async () => {
      // Ensure models are registered
      if (!mongoose.models.Project) {
        require('@/models/Project')
      }
      if (!mongoose.models.Task) {
        require('@/models/Task')
      }
      if (!mongoose.models.Phase) {
        require('@/models/Phase')
      }
      if (!mongoose.models.Milestone) {
        require('@/models/Milestone')
      }

      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
      }

      // Build base filter
      const baseFilter: any = {
        createdAt: { $gte: startDate, $lte: endDate }
      }

      if (projectId) {
        if (mongoose.Types.ObjectId.isValid(projectId)) {
          baseFilter.projectId = projectId
        } else {
          baseFilter.projectId = new mongoose.Types.ObjectId()
        }
      }

      console.log('🔥 Analytics API: About to apply filters:', {
        originalQuery: baseFilter,
        isSuperAdmin,
        userEmail: userEmail,
        userId: user._id || user.id,
        userDepartment: user.department,
        userRole: user.role?.name,
        applyFiltersType: typeof applyFilters,
        userPermissions: user.permissions?.length || user.role?.permissions?.length || 0
      })

      // 🔥 Apply permission-based filters for each model
      const projectFilter = await applyFilters({ ...baseFilter })
      const taskFilter = await applyFilters({ ...baseFilter })
      const phaseFilter = await applyFilters({ ...baseFilter })  
      const milestoneFilter = await applyFilters({ ...baseFilter })

      console.log('🔥 Analytics API: Query filtering applied:', {
        isSuperAdmin,
        originalQuery: baseFilter,
        projectFilter,
        taskFilter,
        phaseFilter,
        milestoneFilter,
        userPermissions: user.role?.permissions?.map((p: any) => ({
          resource: p.resource,
          conditions: p.conditions
        })) || user.permissions?.map((p: any) => ({
          resource: p.resource,
          conditions: p.conditions
        }))
      })

      // Execute analytics queries in parallel with filtered queries
      const [
        projectOverview,
        taskMetrics,
        phaseMetrics,
        milestoneMetrics
      ] = await Promise.all([
        // Project Overview
        Project.aggregate([
          { $match: projectFilter },
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              activeProjects: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              completedProjects: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              onHoldProjects: { $sum: { $cond: [{ $eq: ['$status', 'on-hold'] }, 1, 0] } },
              averageProgress: { $avg: '$progress' },
              totalBudget: { $sum: '$budget' },
              totalSpent: { $sum: '$actualCost' }
            }
          }
        ]),
        
        // Task Metrics
        Task.aggregate([
          { $match: taskFilter },
          {
            $group: {
              _id: null,
              totalTasks: { $sum: 1 },
              completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
              pendingTasks: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              overdueTasks: { 
                $sum: { 
                  $cond: [
                    { 
                      $and: [
                        { $ne: ['$status', 'completed'] },
                        { $lt: ['$dueDate', new Date()] }
                      ]
                    }, 
                    1, 
                    0
                  ] 
                }
              },
              averageProgress: { $avg: '$progress' }
            }
          }
        ]),
        
        // Phase Metrics
        Phase.aggregate([
          { $match: phaseFilter },
          {
            $group: {
              _id: null,
              totalPhases: { $sum: 1 },
              activePhases: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
              completedPhases: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              plannedPhases: { $sum: { $cond: [{ $eq: ['$status', 'planning'] }, 1, 0] } },
              averageProgress: { $avg: '$progress' }
            }
          }
        ]),
        
        // Milestone Metrics
        Milestone.aggregate([
          { $match: milestoneFilter },
          {
            $group: {
              _id: null,
              totalMilestones: { $sum: 1 },
              completedMilestones: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              inProgressMilestones: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
              pendingMilestones: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              overdueMilestones: { 
                $sum: { 
                  $cond: [
                    { 
                      $and: [
                        { $ne: ['$status', 'completed'] },
                        { $lt: ['$dueDate', new Date()] }
                      ]
                    }, 
                    1, 
                    0
                  ] 
                }
              },
              averageProgress: { $avg: '$progress' }
            }
          }
        ])
      ])

      const responseData = {
        overview: projectOverview[0] || {
          totalProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          onHoldProjects: 0,
          averageProgress: 0,
          totalBudget: 0,
          totalSpent: 0
        },
        tasks: taskMetrics[0] || {
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          averageProgress: 0
        },
        phases: phaseMetrics[0] || {
          totalPhases: 0,
          activePhases: 0,
          completedPhases: 0,
          plannedPhases: 0,
          averageProgress: 0
        },
        milestones: milestoneMetrics[0] || {
          totalMilestones: 0,
          completedMilestones: 0,
          inProgressMilestones: 0,
          pendingMilestones: 0,
          overdueMilestones: 0,
          averageProgress: 0
        },
        meta: {
          dateRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          projectId,
          generatedAt: new Date().toISOString(),
          userRole: user.role?.name,
          userId: user._id || user.id
        }
      }

      // Return result for caching
      return responseData
    }, cacheKey, CACHE_TTL)

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Analytics data retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in GET /api/analytics:', error)

    // Handle middleware errors (like permission denied)
    if (error instanceof Response) {
      return error
    }

    return createAPIErrorResponse("Internal server error", 500)
  }

  } 

// Helper function: Get project overview
async function getProjectOverview(projectId?: string, user?: any) {
  const filter: any = {}
  
  if (projectId) {
    filter._id = projectId
  } else if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
    filter.departmentIds = user.departmentId
  }

  const projects = await Project.find(filter).lean()
  
  if (projectId && projects.length === 0) {
    throw new Error('Project not found')
  }

  const totalProjects = projects.length
  const activeProjects = projects.filter(p => p.status === 'active').length
  const completedProjects = projects.filter(p => p.status === 'completed').length
  const pendingProjects = projects.filter(p => p.status === 'pending').length

  const totalBudget = projects.reduce((sum, p) => {
    const breakdown = p.budgetBreakdown || {}
    return sum + (breakdown.development || 0) + (breakdown.design || 0) + 
           (breakdown.testing || 0) + (breakdown.deployment || 0) + 
           (breakdown.maintenance || 0) + (breakdown.contingency || 0)
  }, 0)

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    pendingProjects,
    totalBudget,
    completionRate: totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0
  }
}

// Helper function: Get task metrics
async function getTaskMetrics(baseFilter: any) {
  const taskFilter = { ...baseFilter }
  delete taskFilter.createdAt // Remove date filter for current status

  const [tasks, recentTasks] = await Promise.all([
    Task.find(taskFilter).lean(),
    Task.find(baseFilter).lean()
  ])

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length
  const pendingTasks = tasks.filter(t => t.status === 'pending').length
  const onHoldTasks = tasks.filter(t => t.status === 'on-hold').length
  
  const overdueTasks = tasks.filter(t => 
    t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
  ).length

  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
  const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    onHoldTasks,
    overdueTasks,
    totalEstimatedHours,
    totalActualHours,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    efficiencyRate: totalEstimatedHours > 0 ? Math.round((totalEstimatedHours / totalActualHours) * 100) : 100,
    recentTasksCreated: recentTasks.length
  }
}

// Helper function: Get phase metrics
async function getPhaseMetrics(baseFilter: any) {
  const phaseFilter = { ...baseFilter, isDeleted: false }
  delete phaseFilter.departmentId // Phases don't have direct department filter
  
  const [phases, recentPhases] = await Promise.all([
    Phase.find({ isDeleted: false }).lean(),
    Phase.find({ ...baseFilter, isDeleted: false }).lean()
  ])

  const totalPhases = phases.length
  const completedPhases = phases.filter(p => p.status === 'completed').length
  const activePhases = phases.filter(p => p.status === 'in-progress').length
  const plannedPhases = phases.filter(p => p.status === 'not-started').length
  
  const overduePhases = phases.filter(p => 
    p.endDate && p.endDate < new Date() && p.status !== 'completed'
  ).length

  const averageProgress = totalPhases > 0 ? 
    Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / totalPhases) : 0

  const totalBudget = phases.reduce((sum, p) => sum + (p.budgetAllocation || 0), 0)
  const totalActualCost = phases.reduce((sum, p) => sum + (p.actualCost || 0), 0)

  return {
    totalPhases,
    completedPhases,
    activePhases,
    plannedPhases,
    overduePhases,
    averageProgress,
    totalBudget,
    totalActualCost,
    budgetVariance: totalBudget > 0 ? Math.round(((totalActualCost - totalBudget) / totalBudget) * 100) : 0,
    completionRate: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
    recentPhasesCreated: recentPhases.length
  }
}

// Helper function: Get milestone metrics
async function getMilestoneMetrics(baseFilter: any) {
  const milestoneFilter = { ...baseFilter, isDeleted: false }
  delete milestoneFilter.departmentId // Milestones don't have direct department filter
  
  const [milestones, recentMilestones] = await Promise.all([
    Milestone.find({ isDeleted: false }).lean(),
    Milestone.find({ ...baseFilter, isDeleted: false }).lean()
  ])

  const totalMilestones = milestones.length
  const completedMilestones = milestones.filter(m => m.status === 'completed').length
  const inProgressMilestones = milestones.filter(m => m.status === 'in-progress').length
  const pendingMilestones = milestones.filter(m => m.status === 'pending').length
  
  const overdueMilestones = milestones.filter(m => 
    m.dueDate && m.dueDate < new Date() && m.status !== 'completed'
  ).length

  const onTimeMilestones = milestones.filter(m => 
    m.status === 'completed' && m.completedDate && m.completedDate <= m.dueDate
  ).length

  const averageProgress = totalMilestones > 0 ? 
    Math.round(milestones.reduce((sum, m) => sum + m.progress, 0) / totalMilestones) : 0

  return {
    totalMilestones,
    completedMilestones,
    inProgressMilestones,
    pendingMilestones,
    overdueMilestones,
    onTimeMilestones,
    averageProgress,
    completionRate: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
    onTimeRate: completedMilestones > 0 ? Math.round((onTimeMilestones / completedMilestones) * 100) : 100,
    recentMilestonesCreated: recentMilestones.length
  }
}

// Helper function: Get performance data
async function getPerformanceData(baseFilter: any, startDate: Date, endDate: Date) {
  // Task completion velocity (tasks completed per day)
  const completedTasks = await Task.find({
    ...baseFilter,
    status: 'completed',
    completedAt: { $gte: startDate, $lte: endDate }
  }).lean()

  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const velocity = completedTasks.length / daysDiff

  // Average task duration
  const tasksWithDuration = completedTasks.filter(t => t.completedAt && t.createdAt)
  const averageTaskDuration = tasksWithDuration.length > 0 ? 
    tasksWithDuration.reduce((sum, t) => {
      const duration = (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return sum + duration
    }, 0) / tasksWithDuration.length : 0

  // Team productivity (tasks per team member)
  const teamMembers = [...new Set(completedTasks.map(t => t.assigneeId?.toString()).filter(Boolean))]
  const productivity = teamMembers.length > 0 ? completedTasks.length / teamMembers.length : 0

  return {
    velocity: Math.round(velocity * 100) / 100,
    averageTaskDuration: Math.round(averageTaskDuration * 100) / 100,
    productivity: Math.round(productivity * 100) / 100,
    activeTeamMembers: teamMembers.length
  }
}

// Helper function: Get trends data
async function getTrendsData(baseFilter: any, startDate: Date, endDate: Date, dateRange: string) {
  // Determine grouping interval based on date range
  const groupInterval = dateRange === '7d' ? 'day' : dateRange === '30d' ? 'day' : 'week'
  
  // Task completion trends
  const taskTrends = await Task.aggregate([
    {
      $match: {
        ...baseFilter,
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupInterval === 'day' ? '%Y-%m-%d' : '%Y-%U',
            date: '$completedAt'
          }
        },
        completed: { $sum: 1 },
        totalHours: { $sum: { $ifNull: ['$actualHours', 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ])

  // Milestone completion trends  
  const milestoneTrends = await Milestone.aggregate([
    {
      $match: {
        isDeleted: false,
        completedDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupInterval === 'day' ? '%Y-%m-%d' : '%Y-%U',
            date: '$completedDate'
          }
        },
        completed: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ])

  return {
    tasks: taskTrends,
    milestones: milestoneTrends
  }
}

// Helper function: Get risk assessment
async function getRiskAssessment(projectId?: string) {
  const filter: any = {}
  if (projectId) {
    filter.projectId = projectId
  }

  const [tasks, phases, milestones] = await Promise.all([
    Task.find(filter).lean(),
    Phase.find({ ...filter, isDeleted: false }).lean(),
    Milestone.find({ ...filter, isDeleted: false }).lean()
  ])

  const risks = []
  const now = new Date()

  // Budget risk
  const phasesWithBudget = phases.filter(p => p.budgetAllocation && p.actualCost)
  const budgetOverrun = phasesWithBudget.filter(p => 
    p.actualCost! > p.budgetAllocation! * 1.1 // 10% threshold
  ).length
  
  if (budgetOverrun > 0) {
    risks.push({
      type: 'budget',
      level: budgetOverrun > phasesWithBudget.length * 0.5 ? 'high' : 'medium',
      description: `${budgetOverrun} phases are over budget`,
      impact: 'Project budget may be exceeded',
      mitigation: 'Review budget allocations and optimize resource usage'
    })
  }

  // Timeline risk
  const overdueItems = [
    ...tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'completed'),
    ...phases.filter(p => p.endDate && p.endDate < now && p.status !== 'completed'),
    ...milestones.filter(m => m.dueDate && m.dueDate < now && m.status !== 'completed')
  ]

  if (overdueItems.length > 0) {
    const totalItems = tasks.length + phases.length + milestones.length
    const overduePercentage = (overdueItems.length / totalItems) * 100
    
    risks.push({
      type: 'timeline',
      level: overduePercentage > 20 ? 'high' : overduePercentage > 10 ? 'medium' : 'low',
      description: `${overdueItems.length} items are overdue`,
      impact: 'Project timeline may be delayed',
      mitigation: 'Prioritize overdue items and reallocate resources'
    })
  }

  // Quality risk (based on task completion rate)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100

  if (completionRate < 70) {
    risks.push({
      type: 'quality',
      level: completionRate < 50 ? 'high' : 'medium',
      description: `Task completion rate is ${Math.round(completionRate)}%`,
      impact: 'Project quality may be compromised due to low completion rate',
      mitigation: 'Focus on completing existing tasks before adding new ones'
    })
  }

  // Resource risk (unassigned tasks)
  const unassignedTasks = tasks.filter(t => !t.assigneeId && t.status !== 'completed').length
  const unassignedPercentage = totalTasks > 0 ? (unassignedTasks / totalTasks) * 100 : 0

  if (unassignedPercentage > 15) {
    risks.push({
      type: 'resource',
      level: unassignedPercentage > 30 ? 'high' : 'medium',
      description: `${unassignedTasks} tasks are unassigned`,
      impact: 'Tasks may not be completed due to lack of assignment',
      mitigation: 'Assign tasks to appropriate team members'
    })
  }

  return risks
}