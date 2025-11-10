import { useCallback, useMemo, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  setMilestones,
  setSelectedMilestone,
  setLoading,
  setActionLoading,
  setError,
  clearError,
  setFilters,
  setSort,
  setPagination,
  setStats,
  resetState,
  updateMilestoneStatus,
  updateMilestoneProgress,
} from '@/store/slices/milestoneSlice'
import {
  useGenericQuery,
  useGenericQueryById,
  useGenericCreate,
  useGenericUpdate,
  useGenericDelete,
  type UseGenericQueryOptions,
} from './use-generic-query'
import type {
  CreateMilestoneData,
  UpdateMilestoneData,
} from '@/lib/validations/milestone'

export function useMilestones() {
  const dispatch = useAppDispatch()

  const {
    milestones,
    selectedMilestone,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.milestones)

  // Define options for generic hooks
  const milestoneOptions: UseGenericQueryOptions<any> = {
    entityName: 'milestones',
    baseUrl: '/api/milestones',
    reduxDispatchers: {
      setEntities: (entities) => dispatch(setMilestones(entities)),
      setEntity: (entity) => dispatch(setSelectedMilestone(entity)),
      setPagination: (pagination) => dispatch(setPagination(pagination)),
      setStats: (stats) => dispatch(setStats(stats)),
      setLoading: (loading) => dispatch(setLoading(loading)),
      setActionLoading: (loading) => dispatch(setActionLoading(loading)),
      setError: (error) => dispatch(setError(error)),
      clearError: () => dispatch(clearError()),
    },
  }

  // Memoize query params to prevent unnecessary re-renders
  const queryParams = useMemo(() => ({
    page: pagination.page,
    limit: pagination.limit,
    filters,
    sort: {
      field: sort.field,
      direction: sort.direction as 'asc' | 'desc',
    },
  }), [pagination.page, pagination.limit, filters, sort.field, sort.direction])

  // Use generic hooks
  const { data: fetchedMilestones, isLoading: queryLoading, refetch: refetchMilestones } = useGenericQuery(
    milestoneOptions,
    queryParams,
    true
  )

  const createMutation = useGenericCreate(milestoneOptions)
  const updateMutation = useGenericUpdate(milestoneOptions)
  const deleteMutation = useGenericDelete(milestoneOptions)

  // CRUD operations following Department pattern
  const handleFetchMilestones = useCallback((params: any = {}) => {
    if (params.projectId !== undefined) {
      dispatch(setFilters({ projectId: params.projectId }))
    }
    if (params.phaseId !== undefined) {
      dispatch(setFilters({ phaseId: params.phaseId }))
    }
    return refetchMilestones()
  }, [dispatch, refetchMilestones])

  const handleCreateMilestone = useCallback(async (milestoneData: CreateMilestoneData) => {
    return createMutation.mutateAsync(milestoneData)
  }, [createMutation])

  const handleUpdateMilestone = useCallback(async (id: string, data: UpdateMilestoneData) => {
    return updateMutation.mutateAsync({ id, data })
  }, [updateMutation])

  const handleDeleteMilestone = useCallback(async (milestoneId: string) => {
    return deleteMutation.mutateAsync(milestoneId)
  }, [deleteMutation])

  // Quick status and progress updates
  const handleUpdateMilestoneStatus = useCallback((id: string, status: any) => {
    dispatch(updateMilestoneStatus({ id, status }))
  }, [dispatch])

  const handleUpdateMilestoneProgress = useCallback((id: string, progress: number) => {
    dispatch(updateMilestoneProgress({ id, progress }))
  }, [dispatch])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: any) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: any) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: any) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshMilestones = useCallback(() => {
    return handleFetchMilestones({ 
      projectId: filters.projectId, 
      phaseId: filters.phaseId 
    })
  }, [handleFetchMilestones, filters.projectId, filters.phaseId])

  // Computed values
  const hasMilestones = milestones.length > 0
  const completedMilestones = milestones.filter((m: any) => m.status === 'completed')
  const pendingMilestones = milestones.filter((m: any) => m.status === 'pending')
  const inProgressMilestones = milestones.filter((m: any) => m.status === 'in-progress')
  const blockedMilestones = milestones.filter((m: any) => m.status === 'blocked')
  const overdueMilestones = milestones.filter((m: any) => {
    if (m.status === 'completed') return false
    return new Date(m.dueDate) < new Date()
  })

  const overallProgress = useMemo(() => {
    if (milestones.length === 0) return 0
    const totalProgress = milestones.reduce((sum: number, milestone: any) => sum + (milestone.progress || 0), 0)
    return Math.round(totalProgress / milestones.length)
  }, [milestones])

  const completionRate = useMemo(() => {
    if (milestones.length === 0) return 0
    return Math.round((completedMilestones.length / milestones.length) * 100)
  }, [milestones.length, completedMilestones.length])

  return {
    // State
    milestones: fetchedMilestones || milestones,
    selectedMilestone,
    loading: queryLoading || loading,
    actionLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,

    // Computed values
    hasMilestones,
    completedMilestones,
    pendingMilestones,
    inProgressMilestones,
    blockedMilestones,
    overdueMilestones,
    overallProgress,
    completionRate,

    // CRUD operations
    fetchMilestones: handleFetchMilestones,
    createMilestone: handleCreateMilestone,
    updateMilestone: handleUpdateMilestone,
    deleteMilestone: handleDeleteMilestone,

    // Quick updates
    updateMilestoneStatus: handleUpdateMilestoneStatus,
    updateMilestoneProgress: handleUpdateMilestoneProgress,

    // Filter and sort operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshMilestones,
    refetch: refetchMilestones,
  }
}

// Single milestone query hook using generic approach
export function useMilestone(milestoneId: string) {
  const dispatch = useAppDispatch()

  const milestoneOptions: UseGenericQueryOptions<any> = {
    entityName: 'milestones',
    baseUrl: '/api/milestones',
    reduxDispatchers: {
      setEntity: (entity) => dispatch(setSelectedMilestone(entity)),
      setLoading: (loading) => dispatch(setLoading(loading)),
      setError: (error) => dispatch(setError(error)),
      clearError: () => dispatch(clearError()),
    },
  }

  const { data: milestone, isLoading, error, refetch } = useGenericQueryById(
    milestoneOptions,
    milestoneId,
    !!milestoneId
  )

  return {
    milestone,
    loading: isLoading,
    error,
    refetch,
  }
}

// Project-specific milestones hook
export function useProjectMilestones(projectId: string) {
  const { 
    milestones, 
    setFilters, 
    refreshMilestones,
    ...rest 
  } = useMilestones()

  // Filter milestones by project automatically using useEffect
  useEffect(() => {
    if (projectId && projectId !== rest.filters.projectId) {
      setFilters({ projectId })
    }
  }, [projectId, rest.filters.projectId, setFilters])

  // Don't filter client-side since we're filtering server-side via API
  const projectMilestones = useMemo(() => {
    // Return all milestones since they should already be filtered by the API
    return milestones
  }, [milestones, rest.filters])

  return {
    milestones: projectMilestones,
    ...rest,
    refreshMilestones: () => refreshMilestones(),
  }
}

// Phase-specific milestones hook
export function usePhaseMilestones(phaseId: string) {
  const { 
    milestones, 
    setFilters, 
    refreshMilestones,
    ...rest 
  } = useMilestones()

  // Filter milestones by phase automatically
  useMemo(() => {
    if (phaseId && phaseId !== rest.filters.phaseId) {
      setFilters({ phaseId })
    }
  }, [phaseId, rest.filters.phaseId, setFilters])

  const phaseMilestones = useMemo(() => {
    return milestones.filter((milestone: any) => milestone.phaseId === phaseId)
  }, [milestones, phaseId])

  return {
    milestones: phaseMilestones,
    ...rest,
    refreshMilestones: () => refreshMilestones(),
  }
}

// Combined hook for ease of use (keeping backward compatibility)
export function useMilestoneManagement(projectId?: string, phaseId?: string) {
  if (phaseId) {
    return usePhaseMilestones(phaseId)
  } else if (projectId) {
    return useProjectMilestones(projectId)
  } else {
    return useMilestones()
  }
}