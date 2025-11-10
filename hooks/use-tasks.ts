import { useCallback, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  setTasks,
  setSelectedTask,
  setLoading,
  setActionLoading,
  setError,
  clearError,
  setFilters,
  setSort,
  setPagination,
  setHierarchy,
  resetState,
} from '@/store/slices/taskSlice'
import {
  useGenericQuery,
  useGenericCreate,
  useGenericUpdate,
  useGenericDelete,
  type UseGenericQueryOptions,
} from './use-generic-query'
import { useQueryClient } from "@tanstack/react-query"
import { apiRequest, handleAPIError } from '@/lib/utils/api-client'
import type {
  FetchTasksParams,
  CreateTaskData,
  UpdateTaskData,
  TaskFilters,
  TaskSort,
} from '@/types'

export function useTasks() {
  const dispatch = useAppDispatch()

  const {
    tasks,
    selectedTask,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
    hierarchy,
  } = useAppSelector((state) => state.tasks)

  // Define options for generic hooks
  const taskOptions: UseGenericQueryOptions<any> = {
    entityName: 'tasks',
    baseUrl: '/api/tasks',
    reduxDispatchers: {
      setEntities: (entities) => dispatch(setTasks(entities)),
      setEntity: (entity) => dispatch(setSelectedTask(entity)),
      setPagination: (pagination) => dispatch(setPagination(pagination)),
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
  const { data: fetchedTasks, isLoading: queryLoading, refetch: refetchTasks } = useGenericQuery(
    taskOptions,
    queryParams,
    true
  )

  const createMutation = useGenericCreate(taskOptions)
  const updateMutation = useGenericUpdate(taskOptions)
  const deleteMutation = useGenericDelete(taskOptions)

  const queryClient = useQueryClient()

  // Fetch operations - Stable function that doesn't change on re-renders
  const handleFetchTasks = useCallback((params?: FetchTasksParams) => {
    refetchTasks()
  }, [refetchTasks])

  // CRUD operations
  const handleCreateTask = useCallback((taskData: CreateTaskData) => {
    return createMutation.mutateAsync(taskData)
  }, [createMutation])

  const handleUpdateTask = useCallback((id: string, data: UpdateTaskData) => {
    return updateMutation.mutateAsync({ id, data })
  }, [updateMutation])

  const handleDeleteTask = useCallback((taskId: string) => {
    return deleteMutation.mutateAsync(taskId)
  }, [deleteMutation])

  // Special operations that require direct API calls
  const handleAssignTask = useCallback(async (id: string, assigneeId: string) => {
    try {
      await apiRequest(`${taskOptions.baseUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ operation: 'assign', assigneeId })
      })
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [taskOptions.entityName] })
      queryClient.invalidateQueries({ queryKey: [taskOptions.entityName, id] })
    } catch (error) {
      handleAPIError(error, `Failed to assign task`)
      throw error
    }
  }, [taskOptions.baseUrl, taskOptions.entityName, queryClient])

  const handleUpdateTaskStatus = useCallback(async (id: string, status: string, actualHours?: number) => {
    try {
      await apiRequest(`${taskOptions.baseUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ operation: 'updateStatus', status, actualHours })
      })
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [taskOptions.entityName] })
      queryClient.invalidateQueries({ queryKey: [taskOptions.entityName, id] })
    } catch (error) {
      handleAPIError(error, `Failed to update task status`)
      throw error
    }
  }, [taskOptions.baseUrl, taskOptions.entityName, queryClient])

  // Fetch task hierarchy for a project
  const fetchTaskHierarchy = useCallback(async (projectId: string) => {
    try {
      const response = await apiRequest(`${taskOptions.baseUrl}?hierarchy=true&projectId=${projectId}`)
      dispatch(setHierarchy(response))
      return response
    } catch (error) {
      handleAPIError(error, `Failed to fetch task hierarchy`)
      throw error
    }
  }, [taskOptions.baseUrl, dispatch])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<TaskFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: TaskSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  const handleSetSelectedTask = useCallback((task: typeof selectedTask) => {
    dispatch(setSelectedTask(task))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshTasks = useCallback(() => {
    return handleFetchTasks()
  }, [handleFetchTasks])

  // Computed values
  const hasTasks = tasks.length > 0
  const hasTaskHierarchy = hierarchy ? true : false
  const isFirstPage = pagination.page === 1
  const isLastPage = pagination.page >= pagination.pages
  const totalPages = pagination.pages
  const totalItems = pagination.total

  // Status-based getters
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending')
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in-progress')
  const completedTasks = tasks.filter((t: any) => t.status === 'completed')
  const onHoldTasks = tasks.filter((t: any) => t.status === 'on-hold')
  const cancelledTasks = tasks.filter((t: any) => t.status === 'cancelled')

  // Type-based getters
  const mainTasks = tasks.filter((t: any) => t.type === 'task')
  const subTasks = tasks.filter((t: any) => t.type === 'sub-task')

  // Priority-based getters
  const urgentTasks = tasks.filter((t: any) => t.priority === 'urgent')
  const highPriorityTasks = tasks.filter((t: any) => t.priority === 'high')

  // Helper functions
  const getTasksByStatus = useCallback((status: string) => {
    return tasks.filter((t: any) => t.status === status)
  }, [tasks])

  const getTasksByPriority = useCallback((priority: string) => {
    return tasks.filter((t: any) => t.priority === priority)
  }, [tasks])

  const getTasksByProject = useCallback((projectId: string) => {
    return tasks.filter((t: any) => t.projectId === projectId)
  }, [tasks])

  const getTasksByDepartment = useCallback((departmentId: string) => {
    return tasks.filter((t: any) => t.departmentId === departmentId)
  }, [tasks])

  const getTasksByAssignee = useCallback((assigneeId: string) => {
    return tasks.filter((t: any) => t.assigneeId === assigneeId)
  }, [tasks])

  const getSubTasksByParent = useCallback((parentTaskId: string) => {
    return tasks.filter((t: any) => t.parentTaskId === parentTaskId)
  }, [tasks])

  const getMyTasks = useCallback((userId: string) => {
    return tasks.filter((t: any) => t.assigneeId === userId || t.createdBy === userId)
  }, [tasks])

  const getOverdueTasks = useCallback(() => {
    const now = new Date()
    return tasks.filter((t: any) => {
      if (!t.dueDate || t.status === 'completed' || t.status === 'cancelled') return false
      return new Date(t.dueDate) < now
    })
  }, [tasks])

  const getTasksCompletionRate = useCallback(() => {
    if (tasks.length === 0) return 0
    const completedCount = tasks.filter((t: any) => t.status === 'completed').length
    return Math.round((completedCount / tasks.length) * 100)
  }, [tasks])

  // Permission checks
  const canCreateTask = useCallback(() => {
    // Logic to determine if user can create tasks
    // This would typically check user permissions and role
    return true // Simplified for now
  }, [])

  const canEditTask = useCallback((task: typeof selectedTask) => {
    // Logic to determine if user can edit a specific task
    // This would typically check user permissions, role, and task status
    return task && task.status !== 'completed' && task.status !== 'cancelled'
  }, [])

  const canDeleteTask = useCallback((task: typeof selectedTask) => {
    // Logic to determine if user can delete a specific task
    // This would typically check user permissions and task status
    return task && task.status !== 'completed' && task.status !== 'cancelled'
  }, [])

  const canAssignTask = useCallback((task: typeof selectedTask) => {
    // Logic to determine if user can assign a task
    return task && task.status !== 'completed' && task.status !== 'cancelled'
  }, [])

  const canUpdateTaskStatus = useCallback((task: typeof selectedTask) => {
    // Logic to determine if user can update task status
    return task && task.status !== 'cancelled'
  }, [])

  const canCreateSubTask = useCallback((parentTask: typeof selectedTask) => {
    // Logic to determine if user can create sub-tasks for a parent task
    return parentTask && parentTask.type === 'task' && parentTask.status !== 'completed' && parentTask.status !== 'cancelled'
  }, [])

  return {
    // State
    tasks: fetchedTasks || tasks,
    selectedTask,
    loading: queryLoading || loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
    hierarchy,

    // CRUD operations
    fetchTasks: handleFetchTasks,
    fetchTaskHierarchy,
    createTask: handleCreateTask,
    updateTask: handleUpdateTask,
    assignTask: handleAssignTask,
    updateTaskStatus: handleUpdateTaskStatus,
    deleteTask: handleDeleteTask,

    // Filter and sort operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedTask: handleSetSelectedTask,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshTasks,

    // Computed values
    hasTasks,
    hasTaskHierarchy,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,

    // Status-based data
    pendingTasks,
    inProgressTasks,
    completedTasks,
    onHoldTasks,
    cancelledTasks,
    mainTasks,
    subTasks,
    urgentTasks,
    highPriorityTasks,

    // Helper functions
    getTasksByStatus,
    getTasksByPriority,
    getTasksByProject,
    getTasksByDepartment,
    getTasksByAssignee,
    getSubTasksByParent,
    getMyTasks,
    getOverdueTasks,
    getTasksCompletionRate,

    // Permission checks
    canCreateTask,
    canEditTask,
    canDeleteTask,
    canAssignTask,
    canUpdateTaskStatus,
    canCreateSubTask,
  }
}