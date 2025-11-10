import { useCallback, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  setPhases,
  setSelectedPhase,
  setLoading,
  setActionLoading,
  setError,
  clearError,
  setFilters,
  setSort,
  setPagination,
  setStats,
  resetState,
} from '@/store/slices/phaseSlice'
import {
  useGenericQuery,
  useGenericQueryById,
  useGenericCreate,
  useGenericUpdate,
  useGenericDelete,
  type UseGenericQueryOptions,
} from './use-generic-query'
import type {
  CreatePhaseData,
  UpdatePhaseData,
} from '@/lib/validations/phase'

export function usePhases() {
  const dispatch = useAppDispatch()

  const {
    phases,
    selectedPhase,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.phases)

  // Define options for generic hooks
  const phaseOptions: UseGenericQueryOptions<any> = {
    entityName: 'phases',
    baseUrl: '/api/phases',
    reduxDispatchers: {
      setEntities: (entities) => dispatch(setPhases(entities)),
      setEntity: (entity) => dispatch(setSelectedPhase(entity)),
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
  const { data: fetchedPhases, isLoading: queryLoading, refetch: refetchPhases } = useGenericQuery(
    phaseOptions,
    queryParams,
    true
  )

  const createMutation = useGenericCreate(phaseOptions)
  const updateMutation = useGenericUpdate(phaseOptions)
  const deleteMutation = useGenericDelete(phaseOptions)

  // CRUD operations following Department pattern
  const handleFetchPhases = useCallback((params: any = {}) => {
    if (params.projectId !== undefined) {
      dispatch(setFilters({ projectId: params.projectId }))
    }
    return refetchPhases()
  }, [dispatch, refetchPhases])

  const handleCreatePhase = useCallback(async (phaseData: CreatePhaseData) => {
    return createMutation.mutateAsync(phaseData)
  }, [createMutation])

  const handleUpdatePhase = useCallback(async (id: string, data: UpdatePhaseData) => {
    return updateMutation.mutateAsync({ id, data })
  }, [updateMutation])

  const handleDeletePhase = useCallback(async (phaseId: string) => {
    return deleteMutation.mutateAsync(phaseId)
  }, [deleteMutation])

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

  const refreshPhases = useCallback(() => {
    return handleFetchPhases({ projectId: filters.projectId })
  }, [handleFetchPhases, filters.projectId])

  // Computed values
  const hasPhases = phases.length > 0
  const completedPhases = phases.filter(p => p.status === 'completed')
  const activePhases = phases.filter(p => p.status === 'in-progress')
  const plannedPhases = phases.filter(p => p.status === 'pending' || p.status === 'planning')
  const overduePhases = phases.filter(p => {
    if (p.status === 'completed') return false
    return new Date(p.endDate) < new Date()
  })

  const overallProgress = useMemo(() => {
    if (phases.length === 0) return 0
    const totalProgress = phases.reduce((sum: number, phase) => sum + (phase.progress || 0), 0)
    return Math.round(totalProgress / phases.length)
  }, [phases])

  return {
    // State
    phases: fetchedPhases || phases,
    selectedPhase,
    loading: queryLoading || loading,
    actionLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,

    // Computed values
    hasPhases,
    completedPhases,
    activePhases,
    plannedPhases,
    overduePhases,
    overallProgress,

    // CRUD operations
    fetchPhases: handleFetchPhases,
    createPhase: handleCreatePhase,
    updatePhase: handleUpdatePhase,
    deletePhase: handleDeletePhase,

    // Filter and sort operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshPhases,
    refetch: refetchPhases,
  }
}

// Single phase query hook using generic approach
export function usePhase(phaseId: string) {
  const dispatch = useAppDispatch()

  const phaseOptions: UseGenericQueryOptions<any> = {
    entityName: 'phases',
    baseUrl: '/api/phases',
    reduxDispatchers: {
      setEntity: (entity) => dispatch(setSelectedPhase(entity)),
      setLoading: (loading) => dispatch(setLoading(loading)),
      setError: (error) => dispatch(setError(error)),
      clearError: () => dispatch(clearError()),
    },
  }

  const { data: phase, isLoading, error, refetch } = useGenericQueryById(
    phaseOptions,
    phaseId,
    !!phaseId
  )

  return {
    phase,
    loading: isLoading,
    error,
    refetch,
  }
}

// Project-specific phases hook
export function useProjectPhases(projectId: string) {
  const { 
    phases, 
    setFilters, 
    refreshPhases,
    ...rest 
  } = usePhases()

  // Filter phases by project automatically
  useMemo(() => {
    if (projectId && projectId !== rest.filters.projectId) {
      setFilters({ projectId })
    }
  }, [projectId, rest.filters.projectId, setFilters])

  const projectPhases = useMemo(() => {
    // Since the API already filters by projectId, no need to filter again
    return phases
  }, [phases, projectId])

  return {
    phases: projectPhases,
    ...rest,
    refreshPhases: () => refreshPhases(),
  }
}

// Combined hook for ease of use (keeping backward compatibility)
export function usePhaseManagement(projectId?: string) {
  return projectId ? useProjectPhases(projectId) : usePhases()
}