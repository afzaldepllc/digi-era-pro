import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchLeads,
  fetchLeadById,
  createLead,
  updateLead,
  updateLeadStatus,
  deleteLead,
  setFilters,
  setSort,
  setPagination,
  setSelectedLead,
  clearError,
  resetState,
  optimisticStatusUpdate,
} from '@/store/slices/leadSlice'
import type {
  FetchLeadsParams,
  LeadFilters,
  LeadSort,
} from '@/types'
import type { CreateLeadData, UpdateLeadData } from '@/lib/validations/lead'

export function useLeads() {
  const dispatch = useAppDispatch()

  const {
    leads,
    selectedLead,
    loading,
    actionLoading,
    statusLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.leads)

  // Fetch operations
  const handleFetchLeads = useCallback((params?: FetchLeadsParams) => {
    return dispatch(fetchLeads(params || {
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort
    }))
  }, [dispatch, pagination.page, pagination.limit, JSON.stringify(filters), JSON.stringify(sort)])

  const handleFetchLeadById = useCallback((id: string) => {
    return dispatch(fetchLeadById(id))
  }, [dispatch])

  // CRUD operations
  const handleCreateLead = useCallback((leadData: CreateLeadData) => {
    return dispatch(createLead(leadData))
  }, [dispatch])

  const handleUpdateLead = useCallback((id: string, data: UpdateLeadData) => {
    return dispatch(updateLead({ id, data }))
  }, [dispatch])

  const handleDeleteLead = useCallback((leadId: string) => {
    return dispatch(deleteLead(leadId))
  }, [dispatch])

  // Status operations with business logic
  const handleUpdateLeadStatus = useCallback(async (id: string, status: string, reason?: string) => {
    // Optimistic update for better UX
    dispatch(optimisticStatusUpdate({ id, status }))
    
    try {
      const result = await dispatch(updateLeadStatus({ id, status, reason }))
      return result
    } catch (error) {
      // The slice will handle reverting the optimistic update on failure
      throw error
    }
  }, [dispatch])

  const handleQualifyLead = useCallback((id: string) => {
    return handleUpdateLeadStatus(id, 'qualified')
  }, [handleUpdateLeadStatus])

  const handleUnqualifyLead = useCallback((id: string, reason: string) => {
    return handleUpdateLeadStatus(id, 'unqualified', reason)
  }, [handleUpdateLeadStatus])

  const handleActivateLead = useCallback((id: string) => {
    return handleUpdateLeadStatus(id, 'active')
  }, [handleUpdateLeadStatus])

  const handleDeactivateLead = useCallback((id: string) => {
    return handleUpdateLeadStatus(id, 'inactive')
  }, [handleUpdateLeadStatus])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<LeadFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: LeadSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  const handleSetSelectedLead = useCallback((lead: any) => {
    dispatch(setSelectedLead(lead))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshLeads = useCallback(() => {
    return handleFetchLeads()
  }, [handleFetchLeads])

  // Computed values
  const hasLeads = leads.length > 0
  const isFirstPage = pagination.page === 1
  const isLastPage = pagination.page >= pagination.pages
  const totalPages = pagination.pages
  const totalItems = pagination.total

  // Business logic helpers
  const canQualifyLead = useCallback((lead: any) => {
    return lead.status === 'active' || lead.status === 'inactive'
  }, [])

  const canUnqualifyLead = useCallback((lead: any) => {
    return lead.status === 'qualified'
  }, [])

  const canEditLead = useCallback((lead: any) => {
    return lead.status !== 'qualified' && lead.status !== 'unqualified'
  }, [])

  const canDeleteLead = useCallback((lead: any) => {
    return lead.status !== 'qualified'
  }, [])

  const getStatusBadgeColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'secondary'
      case 'qualified': return 'primary'
      case 'unqualified': return 'destructive'
      default: return 'secondary'
    }
  }, [])

  const getLeadsByStatus = useCallback((status: string) => {
    return leads.filter(lead => lead.status === status)
  }, [leads])

  return {
    // State
    leads,
    selectedLead,
    loading,
    actionLoading,
    statusLoading,
    error,
    filters,
    sort,
    pagination,
    stats,

    // CRUD operations
    fetchLeads: handleFetchLeads,
    fetchLeadById: handleFetchLeadById,
    createLead: handleCreateLead,
    updateLead: handleUpdateLead,
    deleteLead: handleDeleteLead,

    // Status operations
    updateLeadStatus: handleUpdateLeadStatus,
    qualifyLead: handleQualifyLead,
    unqualifyLead: handleUnqualifyLead,
    activateLead: handleActivateLead,
    deactivateLead: handleDeactivateLead,

    // Filter and sort operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedLead: handleSetSelectedLead,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshLeads,

    // Computed values
    hasLeads,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,

    // Business logic helpers
    canQualifyLead,
    canUnqualifyLead,
    canEditLead,
    canDeleteLead,
    getStatusBadgeColor,
    getLeadsByStatus,
  }
}