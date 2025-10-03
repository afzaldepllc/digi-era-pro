import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import type { Role } from '@/types'
import {
  fetchRoles,
  fetchRoleById,
  fetchRolesByDepartment,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
  setFilters,
  setSort,
  setPagination,
  setSelectedRole,
  clearError,
  resetRoles,
  type FetchRolesParams,
  type CreateRoleData,
  type UpdateRoleData,
  type RoleFilters,
  type RoleSort,
} from '@/store/slices/roleSlice'

export function useRoles() {
  const dispatch = useAppDispatch()

  const {
    roles,
    selectedRole,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.roles)

  // Fetch operations
  const handleFetchRoles = useCallback((params?: FetchRolesParams) => {
    const defaultParams = {
      page: 1,
      limit: 10,
      filters: {},
      sort: { field: 'createdAt' as keyof Role, direction: 'desc' as const }
    }
    return dispatch(fetchRoles(params || defaultParams))
  }, [dispatch, pagination.page, pagination.limit, filters, sort])

  const handleFetchRoleById = useCallback((roleId: string) => {
    return dispatch(fetchRoleById(roleId))
  }, [dispatch])

  const handleFetchRolesByDepartment = useCallback((departmentId: string) => {
    return dispatch(fetchRolesByDepartment(departmentId))
  }, [dispatch])

  // CRUD operations
  const handleCreateRole = useCallback((roleData: CreateRoleData) => {
    return dispatch(createRole(roleData))
  }, [dispatch])

  const handleUpdateRole = useCallback((roleData: UpdateRoleData) => {
    return dispatch(updateRole(roleData))
  }, [dispatch])

  const handleUpdateRolePermissions = useCallback((roleId: string, permissions: any[]) => {
    return dispatch(updateRolePermissions({ roleId, permissions }))
  }, [dispatch])

  const handleDeleteRole = useCallback((roleId: string) => {
    return dispatch(deleteRole(roleId))
  }, [dispatch])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<RoleFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: RoleSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  const handleSetSelectedRole = useCallback((role: any) => {
    dispatch(setSelectedRole(role))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetRoles = useCallback(() => {
    dispatch(resetRoles())
  }, [dispatch])

  const refreshRoles = useCallback(() => {
    return handleFetchRoles()
  }, [handleFetchRoles])

  // Computed values
  const hasRoles = Array.isArray(roles) && roles.length > 0
  const isFirstPage = pagination?.page === 1
  const isLastPage = pagination ? pagination.page >= pagination.pages : false
  const totalPages = pagination?.pages || 0
  const totalItems = pagination?.total || 0

  // Role utilities
  const getRoleById = useCallback((roleId: string) => {
    return Array.isArray(roles) ? roles.find(role => role._id === roleId) : undefined
  }, [roles])

  const getRolesByDepartment = useCallback((departmentId: string) => {
    if (!Array.isArray(roles)) return []
    return roles.filter(role => role.department === departmentId ||
      (typeof role.department === 'object' && role.department?._id === departmentId))
  }, [roles])

  const getSystemRoles = useCallback(() => {
    return Array.isArray(roles) ? roles.filter(role => role.isSystemRole) : []
  }, [roles])

  const getDepartmentRoles = useCallback(() => {
    return Array.isArray(roles) ? roles.filter(role => !role.isSystemRole) : []
  }, [roles])

  const getActiveRoles = useCallback(() => {
    return Array.isArray(roles) ? roles.filter(role => role.status === 'active') : []
  }, [roles])

  return {
    // State
    roles,
    selectedRole,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,

    // Actions
    fetchRoles: handleFetchRoles,
    fetchRoleById: handleFetchRoleById,
    fetchRolesByDepartment: handleFetchRolesByDepartment,
    createRole: handleCreateRole,
    updateRole: handleUpdateRole,
    updateRolePermissions: handleUpdateRolePermissions,
    deleteRole: handleDeleteRole,

    // Filters and pagination
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedRole: handleSetSelectedRole,

    // Utilities
    clearError: handleClearError,
    resetRoles: handleResetRoles,
    refreshRoles,

    // Computed values
    hasRoles,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,

    // Role utilities
    getRoleById,
    getRolesByDepartment,
    getSystemRoles,
    getDepartmentRoles,
    getActiveRoles,
  }
}