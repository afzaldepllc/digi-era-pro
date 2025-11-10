import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Analytics data interfaces
export interface AnalyticsOverview {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  pendingProjects: number
  totalBudget: number
  completionRate: number
}

export interface AnalyticsTaskMetrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  pendingTasks: number
  onHoldTasks: number
  overdueTasks: number
  totalEstimatedHours: number
  totalActualHours: number
  completionRate: number
  efficiencyRate: number
  recentTasksCreated: number
}

export interface AnalyticsPhaseMetrics {
  totalPhases: number
  completedPhases: number
  activePhases: number
  plannedPhases: number
  overduePhases: number
  averageProgress: number
  totalBudget: number
  totalActualCost: number
  budgetVariance: number
  completionRate: number
  recentPhasesCreated: number
}

export interface AnalyticsMilestoneMetrics {
  totalMilestones: number
  completedMilestones: number
  inProgressMilestones: number
  pendingMilestones: number
  overdueMilestones: number
  onTimeMilestones: number
  averageProgress: number
  completionRate: number
  onTimeRate: number
  recentMilestonesCreated: number
}

export interface AnalyticsPerformance {
  velocity: number
  averageTaskDuration: number
  productivity: number
  activeTeamMembers: number
}

export interface AnalyticsTrends {
  tasks: Array<{ _id: string; completed: number; totalHours: number }>
  milestones: Array<{ _id: string; completed: number }>
}

export interface AnalyticsRisk {
  type: 'budget' | 'timeline' | 'quality' | 'resource'
  level: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  mitigation: string
}

export interface AnalyticsMeta {
  dateRange: string
  startDate: string
  endDate: string
  projectId?: string
  generatedAt: string
}

export interface AnalyticsData {
  overview: AnalyticsOverview
  tasks: AnalyticsTaskMetrics
  phases: AnalyticsPhaseMetrics
  milestones: AnalyticsMilestoneMetrics
  performance: AnalyticsPerformance
  trends: AnalyticsTrends
  risks: AnalyticsRisk[]
  meta: AnalyticsMeta
}

// Filter interface for analytics queries
export interface AnalyticsFilters {
  projectId?: string
  dateRange?: '7d' | '30d' | '90d' | '1y' | 'custom'
  startDate?: Date
  endDate?: Date
  includeCompleted?: boolean
  departmentId?: string
  userId?: string
  taskStatus?: string[]
  phaseStatus?: string[]
  milestoneStatus?: string[]
}

// Sort configuration for analytics (mainly for risks)
export interface AnalyticsSort {
  field: 'level' | 'type' | 'description'
  direction: 'asc' | 'desc'
}

// Pagination interface for analytics (mainly for risks)
export interface AnalyticsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Insight interface for analytics insights
export interface AnalyticsInsight {
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high'
  actionable?: boolean
  recommendedAction?: string
}

// Analytics slice state interface
export interface AnalyticsState {
  data: AnalyticsData | null
  insights: AnalyticsInsight[]
  loading: boolean
  actionLoading: boolean
  error: string | null
  filters: AnalyticsFilters
  sort: AnalyticsSort
  pagination: AnalyticsPagination
  lastUpdated: Date | null
  refreshInterval: number // in milliseconds
}

// Initial state following Department pattern
const initialState: AnalyticsState = {
  data: null,
  insights: [],
  loading: false,
  actionLoading: false,
  error: null,
  filters: {
    projectId: undefined,
    dateRange: '30d',
    startDate: undefined,
    endDate: undefined,
    includeCompleted: true,
    departmentId: undefined,
    userId: undefined,
    taskStatus: [],
    phaseStatus: [],
    milestoneStatus: [],
  },
  sort: {
    field: 'level',
    direction: 'desc',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  lastUpdated: null,
  refreshInterval: 5 * 60 * 1000, // 5 minutes default
}

// Analytics slice with reducers following Department pattern
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    // Data management
    setAnalyticsData: (state, action: PayloadAction<AnalyticsData>) => {
      state.data = action.payload
      state.loading = false
      state.error = null
      state.lastUpdated = new Date()
    },

    setAnalyticsInsights: (state, action: PayloadAction<AnalyticsInsight[]>) => {
      state.insights = action.payload
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
      if (action.payload) {
        state.error = null
      }
    },

    setActionLoading: (state, action: PayloadAction<boolean>) => {
      state.actionLoading = action.payload
    },

    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.loading = false
      state.actionLoading = false
    },

    clearError: (state) => {
      state.error = null
    },

    // Filters and sorting
    setFilters: (state, action: PayloadAction<Partial<AnalyticsFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      // Clear data when filters change to trigger refresh
      if (Object.keys(action.payload).length > 0) {
        state.data = null
        state.lastUpdated = null
      }
    },

    clearFilters: (state) => {
      state.filters = initialState.filters
      state.data = null
      state.lastUpdated = null
    },

    setSort: (state, action: PayloadAction<AnalyticsSort>) => {
      state.sort = action.payload
    },

    // Pagination (mainly for risks)
    setPagination: (state, action: PayloadAction<Partial<AnalyticsPagination>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },

    // Refresh management
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload
    },

    setLastUpdated: (state, action: PayloadAction<Date | null>) => {
      state.lastUpdated = action.payload
    },

    // Quick metric updates (for real-time updates)
    updateOverviewMetrics: (state, action: PayloadAction<Partial<AnalyticsOverview>>) => {
      if (state.data) {
        state.data.overview = { ...state.data.overview, ...action.payload }
      }
    },

    updateTaskMetrics: (state, action: PayloadAction<Partial<AnalyticsTaskMetrics>>) => {
      if (state.data) {
        state.data.tasks = { ...state.data.tasks, ...action.payload }
      }
    },

    updatePhaseMetrics: (state, action: PayloadAction<Partial<AnalyticsPhaseMetrics>>) => {
      if (state.data) {
        state.data.phases = { ...state.data.phases, ...action.payload }
      }
    },

    updateMilestoneMetrics: (state, action: PayloadAction<Partial<AnalyticsMilestoneMetrics>>) => {
      if (state.data) {
        state.data.milestones = { ...state.data.milestones, ...action.payload }
      }
    },

    updatePerformanceMetrics: (state, action: PayloadAction<Partial<AnalyticsPerformance>>) => {
      if (state.data) {
        state.data.performance = { ...state.data.performance, ...action.payload }
      }
    },

    // Risk management
    addRisk: (state, action: PayloadAction<AnalyticsRisk>) => {
      if (state.data) {
        state.data.risks.push(action.payload)
      }
    },

    updateRisk: (state, action: PayloadAction<{ index: number; updates: Partial<AnalyticsRisk> }>) => {
      if (state.data && state.data.risks[action.payload.index]) {
        state.data.risks[action.payload.index] = {
          ...state.data.risks[action.payload.index],
          ...action.payload.updates
        }
      }
    },

    removeRisk: (state, action: PayloadAction<number>) => {
      if (state.data) {
        state.data.risks.splice(action.payload, 1)
      }
    },

    setRisks: (state, action: PayloadAction<AnalyticsRisk[]>) => {
      if (state.data) {
        state.data.risks = action.payload
      }
    },

    // Trend data updates
    updateTrendData: (state, action: PayloadAction<Partial<AnalyticsTrends>>) => {
      if (state.data) {
        state.data.trends = { ...state.data.trends, ...action.payload }
      }
    },

    // Reset state
    resetState: (state) => {
      return initialState
    },

    // Cache management
    invalidateCache: (state) => {
      state.data = null
      state.insights = []
      state.lastUpdated = null
    },

    // Date range presets
    setDateRangePreset: (state, action: PayloadAction<'7d' | '30d' | '90d' | '1y'>) => {
      const now = new Date()
      const dateRange = action.payload
      
      state.filters.dateRange = dateRange
      state.filters.endDate = now

      switch (dateRange) {
        case '7d':
          state.filters.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          state.filters.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '90d':
          state.filters.startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case '1y':
          state.filters.startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
      }

      state.data = null
      state.lastUpdated = null
    },

    setCustomDateRange: (state, action: PayloadAction<{ startDate: Date; endDate: Date }>) => {
      state.filters.dateRange = 'custom'
      state.filters.startDate = action.payload.startDate
      state.filters.endDate = action.payload.endDate
      state.data = null
      state.lastUpdated = null
    },
  },
})

// Export actions
export const {
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
  updateOverviewMetrics,
  updateTaskMetrics,
  updatePhaseMetrics,
  updateMilestoneMetrics,
  updatePerformanceMetrics,
  addRisk,
  updateRisk,
  removeRisk,
  setRisks,
  updateTrendData,
  resetState,
  invalidateCache,
  setDateRangePreset,
  setCustomDateRange,
} = analyticsSlice.actions

// Export reducer
export default analyticsSlice.reducer

// Selector helpers for derived state
export const selectAnalyticsOverview = (analytics: AnalyticsData | null) =>
  analytics?.overview || null

export const selectAnalyticsTaskMetrics = (analytics: AnalyticsData | null) =>
  analytics?.tasks || null

export const selectAnalyticsPhaseMetrics = (analytics: AnalyticsData | null) =>
  analytics?.phases || null

export const selectAnalyticsMilestoneMetrics = (analytics: AnalyticsData | null) =>
  analytics?.milestones || null

export const selectAnalyticsPerformanceMetrics = (analytics: AnalyticsData | null) =>
  analytics?.performance || null

export const selectAnalyticsRisks = (analytics: AnalyticsData | null) =>
  analytics?.risks || []

export const selectHighPriorityRisks = (analytics: AnalyticsData | null) =>
  analytics?.risks?.filter(risk => risk.level === 'high' || risk.level === 'critical') || []

export const selectAnalyticsTrends = (analytics: AnalyticsData | null) =>
  analytics?.trends || null

export const selectIsDataStale = (lastUpdated: Date | null, refreshInterval: number) => {
  if (!lastUpdated) return true
  return Date.now() - lastUpdated.getTime() > refreshInterval
}