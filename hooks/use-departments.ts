import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  setFilters,
  setSort,
  setPagination,
  setSelectedDepartment,
  clearError,
  resetState,
} from '@/store/slices/departmentSlice'
import type {
  FetchDepartmentsParams,
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentFilters,
  DepartmentSort,
} from '@/types'

export function useDepartments() {
  const dispatch = useAppDispatch()

  const {
    departments,
    selectedDepartment,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
  } = useAppSelector((state) => state.departments)

  // Fetch operations - Fixed dependency array to avoid infinite re-renders
  const handleFetchDepartments = useCallback((params?: FetchDepartmentsParams) => {
    return dispatch(fetchDepartments(params || {
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort
    }))
  }, [dispatch, pagination.page, pagination.limit, JSON.stringify(filters), JSON.stringify(sort)])

  // CRUD operations
  const handleCreateDepartment = useCallback((departmentData: CreateDepartmentData) => {
    return dispatch(createDepartment(departmentData))
  }, [dispatch])

  const handleUpdateDepartment = useCallback((id: string, data: UpdateDepartmentData) => {
    return dispatch(updateDepartment({ id, data }))
  }, [dispatch])

  const handleDeleteDepartment = useCallback((departmentId: string) => {
    return dispatch(deleteDepartment(departmentId))
  }, [dispatch])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<DepartmentFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: DepartmentSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  const handleSetSelectedDepartment = useCallback((department: any) => {
    dispatch(setSelectedDepartment(department))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetDepartments = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshDepartments = useCallback(() => {
    return handleFetchDepartments()
  }, [handleFetchDepartments])

  // Computed values
  const hasDepartments = departments.length > 0
  const isFirstPage = pagination.page === 1
  const isLastPage = pagination.page >= pagination.pages
  const totalPages = pagination.pages
  const totalItems = pagination.total

  // Department utilities
  const getDepartmentById = useCallback((departmentId: string) => {
    return departments.find(dept => dept._id === departmentId)
  }, [departments])

  const getActiveDepartments = useCallback(() => {
    return departments.filter(dept => dept.status === 'active')
  }, [departments])

  return {
    // State
    departments,
    selectedDepartment,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,

    // Actions
    fetchDepartments: handleFetchDepartments,
    createDepartment: handleCreateDepartment,
    updateDepartment: handleUpdateDepartment,
    deleteDepartment: handleDeleteDepartment,

    // Filters and pagination
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedDepartment: handleSetSelectedDepartment,

    // Utilities
    clearError: handleClearError,
    resetDepartments: handleResetDepartments,
    refreshDepartments,

    // Computed values
    hasDepartments,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,

    // Department utilities
    getDepartmentById,
    getActiveDepartments,
  }
}