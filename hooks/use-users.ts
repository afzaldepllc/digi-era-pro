import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import type { User } from '@/types'
import {
    fetchUsers,
    fetchUserById,
    createUser,
    updateUser,
    deleteUser,
    setFilters,
    setSort,
    setPagination,
    setSelectedUser,
    clearError,
    resetState,
    type FetchUsersParams,
    type CreateUserData,
    type UpdateUserData,
    type UserFilters,
    type UserSort,
} from '@/store/slices/userSlice'

export function useUsers() {
    const dispatch = useAppDispatch()

    const {
        users,
        selectedUser,
        loading,
        actionLoading,
        error,
        filters,
        sort,
        pagination,
        stats,
    } = useAppSelector((state) => state.users)

    // Fetch operations
    const handleFetchUsers = useCallback((params?: FetchUsersParams) => {
        const defaultParams = {
            page: pagination?.page || 1,
            limit: pagination?.limit || 10,
            filters: filters || {},
            sort: sort || { field: 'createdAt' as keyof User, direction: 'desc' as const }
        }
        return dispatch(fetchUsers(params || defaultParams))
    }, [dispatch, pagination?.page, pagination?.limit, filters, sort])

    const handleFetchUserById = useCallback((userId: string) => {
        return dispatch(fetchUserById(userId))
    }, [dispatch])

    // CRUD operations
    const handleCreateUser = useCallback((userData: CreateUserData) => {
        return dispatch(createUser(userData))
    }, [dispatch])

    const handleUpdateUser = useCallback((userData: UpdateUserData) => {
        return dispatch(updateUser(userData))
    }, [dispatch])

    const handleDeleteUser = useCallback((userId: string) => {
        return dispatch(deleteUser(userId))
    }, [dispatch])

    // Filter and sort operations
    const handleSetFilters = useCallback((newFilters: Partial<UserFilters>) => {
        dispatch(setFilters(newFilters))
    }, [dispatch])

    const handleSetSort = useCallback((newSort: UserSort) => {
        dispatch(setSort(newSort))
    }, [dispatch])

    const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
        dispatch(setPagination(newPagination))
    }, [dispatch])

    const handleSetSelectedUser = useCallback((user: User | null) => {
        dispatch(setSelectedUser(user))
    }, [dispatch])

    // Utility operations
    const handleClearError = useCallback(() => {
        dispatch(clearError())
    }, [dispatch])

    const handleResetUsers = useCallback(() => {
        dispatch(resetState())
    }, [dispatch])

    const refreshUsers = useCallback(() => {
        return handleFetchUsers()
    }, [handleFetchUsers])

    // Computed values
    const hasUsers = Array.isArray(users) && users.length > 0
    const isFirstPage = pagination?.page === 1
    const isLastPage = pagination ? pagination.page >= pagination.pages : false
    const totalPages = pagination?.pages || 0
    const totalItems = pagination?.total || 0

    // User utilities
    const getUserById = useCallback((userId: string) => {
        return Array.isArray(users) ? users.find(user => user._id === userId) : undefined
    }, [users])

    const getUsersByRole = useCallback((roleId: string) => {
        if (!Array.isArray(users)) return []
        return users.filter(user => user.role === roleId ||
            (typeof user.role === 'object' && user.role?._id === roleId))
    }, [users])

    const getUsersByDepartment = useCallback((departmentId: string) => {
        if (!Array.isArray(users)) return []
        return users.filter(user => user.department === departmentId ||
            (typeof user.department === 'object' && user.department?._id === departmentId))
    }, [users])

    const getActiveUsers = useCallback(() => {
        return Array.isArray(users) ? users.filter(user => user.status === 'active') : []
    }, [users])

    const getInactiveUsers = useCallback(() => {
        return Array.isArray(users) ? users.filter(user => user.status === 'inactive') : []
    }, [users])

    const getSuspendedUsers = useCallback(() => {
        return Array.isArray(users) ? users.filter(user => user.status === 'suspended') : []
    }, [users])

    const getUsersByStatus = useCallback((status: 'active' | 'inactive' | 'suspended') => {
        return Array.isArray(users) ? users.filter(user => user.status === status) : []
    }, [users])

    return {
        // State
        users,
        selectedUser,
        loading,
        actionLoading,
        error,
        filters,
        sort,
        pagination,
        stats,

        // Actions
        fetchUsers: handleFetchUsers,
        fetchUserById: handleFetchUserById,
        createUser: handleCreateUser,
        updateUser: handleUpdateUser,
        deleteUser: handleDeleteUser,

        // Filters and pagination
        setFilters: handleSetFilters,
        setSort: handleSetSort,
        setPagination: handleSetPagination,
        setSelectedUser: handleSetSelectedUser,

        // Utilities
        clearError: handleClearError,
        resetUsers: handleResetUsers,
        refreshUsers,

        // Computed values
        hasUsers,
        isFirstPage,
        isLastPage,
        totalPages,
        totalItems,

        // User utilities
        getUserById,
        getUsersByRole,
        getUsersByDepartment,
        getActiveUsers,
        getInactiveUsers,
        getSuspendedUsers,
        getUsersByStatus,
    }
}