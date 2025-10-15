import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchClients,
  fetchClientById,
  createClient,
  updateClient,
  updateClientStatus,
  deleteClient,
  setFilters,
  setSort,
  setPagination,
  setSelectedClient,
  clearError,
  resetState,
  optimisticStatusUpdate,
} from '@/store/slices/clientSlice'
import type {
  FetchClientsParams,
  UpdateClientData,
  ClientFilters,
  ClientSort,
} from '@/types'

export function useClients() {
  const dispatch = useAppDispatch()

  const {
    clients,
    selectedClient,
    loading,
    actionLoading,
    statusLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.clients)

  // Fetch operations
  const handleFetchClients = useCallback((params?: FetchClientsParams) => {
    return dispatch(fetchClients(params || {
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort
    }))
  }, [dispatch, pagination.page, pagination.limit, JSON.stringify(filters), JSON.stringify(sort)])

  const handleFetchClientById = useCallback((id: string) => {
    return dispatch(fetchClientById(id))
  }, [dispatch])

  // Create operations
  const handleCreateClient = useCallback((data: any) => {
    return dispatch(createClient(data))
  }, [dispatch])

  // Update operations (Note: Clients are created automatically from lead qualification)
  const handleUpdateClient = useCallback((id: string, data: UpdateClientData) => {
    return dispatch(updateClient({ id, data }))
  }, [dispatch])

  const handleDeleteClient = useCallback((clientId: string) => {
    return dispatch(deleteClient(clientId))
  }, [dispatch])

  // Status operations with business logic
  const handleUpdateClientStatus = useCallback(async (id: string, clientStatus: string, reason?: string) => {
    // Optimistic update for better UX
    dispatch(optimisticStatusUpdate({ id, clientStatus }))
    
    try {
      const result = await dispatch(updateClientStatus({ id, clientStatus, reason }))
      return result
    } catch (error) {
      // The slice will handle reverting the optimistic update on failure
      throw error
    }
  }, [dispatch])

  const handleQualifyClient = useCallback((id: string) => {
    return handleUpdateClientStatus(id, 'qualified')
  }, [handleUpdateClientStatus])

  const handleUnqualifyClient = useCallback((id: string, reason: string) => {
    return handleUpdateClientStatus(id, 'unqualified', reason)
  }, [handleUpdateClientStatus])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<ClientFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: ClientSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  const handleSetSelectedClient = useCallback((client: any) => {
    dispatch(setSelectedClient(client))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshClients = useCallback(() => {
    return handleFetchClients()
  }, [handleFetchClients])

  // Computed values
  const hasClients = clients.length > 0
  const isFirstPage = pagination.page === 1
  const isLastPage = pagination.page >= pagination.pages
  const totalPages = pagination.pages
  const totalItems = pagination.total

  // Business logic helpers
  const canUnqualifyClient = useCallback((client: any) => {
    return client.clientStatus === 'qualified'
  }, [])

  const canEditClient = useCallback((client: any) => {
    // Clients can always be edited (unlike leads which have status restrictions)
    return true
  }, [])

  const canDeleteClient = useCallback((client: any) => {
    // Only support department can delete clients (will be enforced on API level)
    return client.clientStatus !== 'qualified' || client.status === 'inactive'
  }, [])

  const getClientStatusBadgeColor = useCallback((status: string) => {
    switch (status) {
      case 'qualified': return 'success'
      case 'unqualified': return 'destructive'
      default: return 'secondary'
    }
  }, [])

  const getStatusBadgeColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'secondary'
      case 'suspended': return 'warning'
      default: return 'secondary'
    }
  }, [])

  const getClientsByStatus = useCallback((clientStatus: string) => {
    return clients.filter(client => client.clientStatus === clientStatus)
  }, [clients])

  const getClientsWithLeads = useCallback(() => {
    return clients.filter(client => client.leadId)
  }, [clients])

  const getClientsWithoutLeads = useCallback(() => {
    return clients.filter(client => !client.leadId)
  }, [clients])

  const getClientsByCompany = useCallback((company: string) => {
    return clients.filter(client => 
      client.company?.toLowerCase().includes(company.toLowerCase())
    )
  }, [clients])

  // Lead-related helpers
  const navigateToLead = useCallback((client: any) => {
    if (client.leadId) {
      return `/leads/edit/${client.leadId}`
    }
    return null
  }, [])

  const hasLinkedLead = useCallback((client: any) => {
    return Boolean(client.leadId)
  }, [])

  return {
    // State
    clients,
    selectedClient,
    loading,
    actionLoading,
    statusLoading,
    error,
    filters,
    sort,
    pagination,
    stats,

    // CRUD operations
    fetchClients: handleFetchClients,
    fetchClientById: handleFetchClientById,
    createClient: handleCreateClient,
    updateClient: handleUpdateClient,
    deleteClient: handleDeleteClient,

    // Status operations
    updateClientStatus: handleUpdateClientStatus,
    qualifyClient: handleQualifyClient,
    unqualifyClient: handleUnqualifyClient,

    // Filter and sort operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedClient: handleSetSelectedClient,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshClients,

    // Computed values
    hasClients,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,

    // Business logic helpers
    canUnqualifyClient,
    canEditClient,
    canDeleteClient,
    getClientStatusBadgeColor,
    getStatusBadgeColor,
    getClientsByStatus,
    getClientsWithLeads,
    getClientsWithoutLeads,
    getClientsByCompany,

    // Lead-related helpers
    navigateToLead,
    hasLinkedLead,
  }
}