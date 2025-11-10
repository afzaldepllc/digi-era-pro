import { useCallback, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  setAnalyticsData,
  setAnalyticsInsights,
  setLoading,
  setActionLoading,
  setError,
  clearError,
  setFilters,
  clearFilters,
  setSort,
  setPagination,
  setRefreshInterval,
  setLastUpdated,
  resetState,
  invalidateCache,
  setDateRangePreset,
  setCustomDateRange,
  selectIsDataStale,
} from '@/store/slices/analyticsSlice'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/utils/api-client'
import type {
  AnalyticsData,
  AnalyticsFilters,
  AnalyticsInsight,
} from '@/store/slices/analyticsSlice'

export function useAnalytics() {
  const dispatch = useAppDispatch()

  const {
    data,
    insights,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    lastUpdated,
    refreshInterval,
  } = useAppSelector((state) => state.analytics)

  // Memoize query params to prevent unnecessary re-renders
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    
    if (filters.projectId) params.append('projectId', filters.projectId)
    if (filters.dateRange) params.append('dateRange', filters.dateRange)
    if (filters.startDate) params.append('startDate', filters.startDate.toISOString())
    if (filters.endDate) params.append('endDate', filters.endDate.toISOString())
    if (filters.includeCompleted !== undefined) params.append('includeCompleted', filters.includeCompleted.toString())
    if (filters.departmentId) params.append('departmentId', filters.departmentId)
    if (filters.userId) params.append('userId', filters.userId)
    if (filters.taskStatus?.length) params.append('taskStatus', filters.taskStatus.join(','))
    if (filters.phaseStatus?.length) params.append('phaseStatus', filters.phaseStatus.join(','))
    if (filters.milestoneStatus?.length) params.append('milestoneStatus', filters.milestoneStatus.join(','))
    
    return params.toString()
  }, [filters])

  // Check if data is stale
  const isDataStale = useMemo(() => 
    selectIsDataStale(lastUpdated, refreshInterval), 
    [lastUpdated, refreshInterval]
  )

  // Use TanStack Query directly for analytics data
  const { data: fetchedData, isLoading: queryLoading, error: queryError, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics', queryParams],
    queryFn: async () => {
      dispatch(setLoading(true))
      try {
        const url = `/api/analytics${queryParams ? `?${queryParams}` : ''}`
        const response = await apiRequest(url)
        const analyticsData = (response as any)?.data as AnalyticsData
        dispatch(setAnalyticsData(analyticsData))
        dispatch(setLastUpdated(new Date()))
        return analyticsData
      } catch (error: any) {
        dispatch(setError(error.message || 'Failed to fetch analytics'))
        throw error
      } finally {
        dispatch(setLoading(false))
      }
    },
    staleTime: refreshInterval,
    gcTime: refreshInterval * 2,
    enabled: true,
  })

  // Analytics operations following Department pattern
  const handleFetchAnalytics = useCallback((params: Partial<AnalyticsFilters> = {}) => {
    if (Object.keys(params).length > 0) {
      dispatch(setFilters(params))
    }
    return refetchAnalytics()
  }, [dispatch, refetchAnalytics])

  const handleRefreshAnalytics = useCallback(() => {
    dispatch(invalidateCache())
    return refetchAnalytics()
  }, [dispatch, refetchAnalytics])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<AnalyticsFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleClearFilters = useCallback(() => {
    dispatch(clearFilters())
  }, [dispatch])

  const handleSetSort = useCallback((newSort: any) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: any) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  // Date range helpers
  const handleSetDateRange = useCallback((range: '7d' | '30d' | '90d' | '1y') => {
    dispatch(setDateRangePreset(range))
  }, [dispatch])

  const handleSetCustomDateRange = useCallback((startDate: Date, endDate: Date) => {
    dispatch(setCustomDateRange({ startDate, endDate }))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const handleSetRefreshInterval = useCallback((interval: number) => {
    dispatch(setRefreshInterval(interval))
  }, [dispatch])

  // Analytics insights generation
  const generateInsights = useCallback((analyticsData: AnalyticsData): AnalyticsInsight[] => {
    const insights: AnalyticsInsight[] = []
    const { overview, tasks, phases, milestones, performance, risks } = analyticsData

    // Project completion insights
    if (overview.completionRate > 90) {
      insights.push({
        type: 'success',
        title: 'Excellent Progress',
        message: `${overview.completionRate}% of projects completed`,
        priority: 'low'
      })
    } else if (overview.completionRate < 50) {
      insights.push({
        type: 'warning',
        title: 'Low Completion Rate',
        message: `Only ${overview.completionRate}% of projects completed`,
        priority: 'high',
        actionable: true,
        recommendedAction: 'Review project workflows and identify bottlenecks'
      })
    }

    // Task efficiency insights
    if (tasks.efficiencyRate > 100) {
      insights.push({
        type: 'success',
        title: 'Ahead of Schedule',
        message: `Tasks are completing ${tasks.efficiencyRate - 100}% faster than estimated`,
        priority: 'low'
      })
    } else if (tasks.efficiencyRate < 80) {
      insights.push({
        type: 'warning',
        title: 'Behind Schedule',
        message: `Tasks are taking ${100 - tasks.efficiencyRate}% longer than estimated`,
        priority: 'medium',
        actionable: true,
        recommendedAction: 'Review time estimates and task complexity'
      })
    }

    // Overdue items insights
    const totalOverdue = tasks.overdueTasks + phases.overduePhases + milestones.overdueMilestones
    if (totalOverdue > 0) {
      insights.push({
        type: 'error',
        title: 'Overdue Items',
        message: `${totalOverdue} items are overdue and need immediate attention`,
        priority: 'high',
        actionable: true,
        recommendedAction: 'Prioritize overdue items and reassign resources if needed'
      })
    }

    // Budget insights
    if (phases.budgetVariance > 20) {
      insights.push({
        type: 'error',
        title: 'Budget Overrun',
        message: `Budget is ${phases.budgetVariance}% over allocated amount`,
        priority: 'high',
        actionable: true,
        recommendedAction: 'Review spending and implement cost controls'
      })
    } else if (phases.budgetVariance > 10) {
      insights.push({
        type: 'warning',
        title: 'Budget Alert',
        message: `Budget is ${phases.budgetVariance}% over allocated amount`,
        priority: 'medium',
        actionable: true,
        recommendedAction: 'Monitor spending closely'
      })
    }

    // Team productivity insights
    if (performance.productivity > 5) {
      insights.push({
        type: 'success',
        title: 'High Productivity',
        message: `Team is completing ${performance.productivity.toFixed(1)} tasks per member`,
        priority: 'low'
      })
    } else if (performance.productivity < 2) {
      insights.push({
        type: 'info',
        title: 'Low Productivity',
        message: 'Consider reviewing task assignments and workload distribution',
        priority: 'medium',
        actionable: true,
        recommendedAction: 'Analyze workload distribution and team capacity'
      })
    }

    // Risk-based insights
    const highRisks = risks.filter(r => r.level === 'high' || r.level === 'critical')
    if (highRisks.length > 0) {
      insights.push({
        type: 'error',
        title: 'High Risk Alert',
        message: `${highRisks.length} high-priority risks identified`,
        priority: 'high',
        actionable: true,
        recommendedAction: 'Review risk mitigation strategies immediately'
      })
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
    })
  }, [])

  // Update insights when data changes
  useMemo(() => {
    if (fetchedData || data) {
      const analyticsData = fetchedData || data
      if (analyticsData && !Array.isArray(analyticsData)) {
        const newInsights = generateInsights(analyticsData as AnalyticsData)
        dispatch(setAnalyticsInsights(newInsights))
      }
    }
  }, [fetchedData, data, generateInsights, dispatch])

  // Computed values
  const hasData = !!(fetchedData || data)
  const currentData = fetchedData || data
  
  return {
    // State
    analytics: currentData,
    insights,
    loading: queryLoading || loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    lastUpdated,
    refreshInterval,
    isDataStale,

    // Computed values
    hasData,

    // Analytics operations
    fetchAnalytics: handleFetchAnalytics,
    refreshAnalytics: handleRefreshAnalytics,

    // Filter and sort operations
    setFilters: handleSetFilters,
    clearFilters: handleClearFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,

    // Date range operations
    setDateRange: handleSetDateRange,
    setCustomDateRange: handleSetCustomDateRange,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    setRefreshInterval: handleSetRefreshInterval,
    refetch: refetchAnalytics,
  }
}

// Project-specific analytics hook
export function useProjectAnalytics(projectId: string, dateRange: '7d' | '30d' | '90d' | '1y' = '30d') {
  const { 
    analytics,
    setFilters,
    setDateRange,
    refreshAnalytics,
    ...rest 
  } = useAnalytics()

  // Set project and date range filters automatically
  useMemo(() => {
    if (projectId !== rest.filters.projectId || dateRange !== rest.filters.dateRange) {
      setFilters({ projectId, includeCompleted: true })
      setDateRange(dateRange)
    }
  }, [projectId, dateRange, rest.filters.projectId, rest.filters.dateRange, setFilters, setDateRange])

  return {
    analytics,
    ...rest,
    refreshAnalytics: () => refreshAnalytics(),
  }
}

// Dashboard analytics hook (all projects)
export function useDashboardAnalytics(dateRange: '7d' | '30d' | '90d' | '1y' = '30d') {
  const { 
    analytics,
    setFilters,
    setDateRange,
    refreshAnalytics,
    ...rest 
  } = useAnalytics()

  // Set date range filter automatically and clear project filter
  useMemo(() => {
    if (dateRange !== rest.filters.dateRange || rest.filters.projectId) {
      setFilters({ projectId: undefined, includeCompleted: true })
      setDateRange(dateRange)
    }
  }, [dateRange, rest.filters.dateRange, rest.filters.projectId, setFilters, setDateRange])

  return {
    analytics,
    ...rest,
    refreshAnalytics: () => refreshAnalytics(),
  }
}

// Specific metric hooks for easier access
export function useTaskMetrics(projectId?: string) {
  const { analytics, loading, error } = projectId 
    ? useProjectAnalytics(projectId)
    : useDashboardAnalytics()
  
  return {
    metrics: (analytics && !Array.isArray(analytics)) ? analytics.tasks : null,
    loading,
    error,
  }
}

export function usePhaseMetrics(projectId?: string) {
  const { analytics, loading, error } = projectId 
    ? useProjectAnalytics(projectId)
    : useDashboardAnalytics()
  
  return {
    metrics: (analytics && !Array.isArray(analytics)) ? analytics.phases : null,
    loading,
    error,
  }
}

export function useMilestoneMetrics(projectId?: string) {
  const { analytics, loading, error } = projectId 
    ? useProjectAnalytics(projectId)
    : useDashboardAnalytics()
  
  return {
    metrics: (analytics && !Array.isArray(analytics)) ? analytics.milestones : null,
    loading,
    error,
  }
}

export function usePerformanceMetrics(projectId?: string) {
  const { analytics, loading, error } = projectId 
    ? useProjectAnalytics(projectId)
    : useDashboardAnalytics()
  
  return {
    metrics: (analytics && !Array.isArray(analytics)) ? analytics.performance : null,
    loading,
    error,
  }
}

export function useRiskAssessment(projectId?: string) {
  const { analytics, loading, error } = projectId 
    ? useProjectAnalytics(projectId)
    : useDashboardAnalytics()
  
  return {
    risks: (analytics && !Array.isArray(analytics)) ? analytics.risks || [] : [],
    loading,
    error,
  }
}

// Helper hooks for computed values - now using Redux insights
export function useAnalyticsInsights(projectId?: string) {
  const { insights, loading, error } = projectId 
    ? useProjectAnalytics(projectId)
    : useDashboardAnalytics()

  return {
    insights,
    loading,
    error,
  }
}