import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchTasks,
  fetchTaskHierarchy,
  fetchTaskById,
  createTask,
  updateTask,
  assignTask,
  updateTaskStatus,
  deleteTask,
  setFilters,
  setSort,
  setPagination,
  setSelectedTask,
  setCurrentProjectId,
  clearError,
  resetState,
} from '@/store/slices/taskSlice'
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
    taskHierarchy,
    selectedTask,
    loading,
    hierarchyLoading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
    currentProjectId,
  } = useAppSelector((state) => state.tasks)

  // CRUD operations
  const handleFetchTasks = useCallback((params?: FetchTasksParams) => {
    return dispatch(fetchTasks(params || {
      page: pagination.page,
      limit: pagination.limit,
      ...filters,
      sortBy: sort.field,
      sortOrder: sort.direction
    }))
  }, [dispatch, pagination.page, pagination.limit, JSON.stringify(filters), JSON.stringify(sort)])

  const handleFetchTaskHierarchy = useCallback((projectId: string, departmentId?: string) => {
    dispatch(setCurrentProjectId(projectId))
    return dispatch(fetchTaskHierarchy({ projectId, departmentId }))
  }, [dispatch])

  const handleFetchTaskById = useCallback((id: string) => {
    return dispatch(fetchTaskById(id))
  }, [dispatch])

  const handleCreateTask = useCallback((taskData: CreateTaskData) => {
    return dispatch(createTask(taskData))
  }, [dispatch])

  const handleUpdateTask = useCallback((id: string, data: UpdateTaskData) => {
    return dispatch(updateTask({ id, data }))
  }, [dispatch])

  const handleAssignTask = useCallback((id: string, assigneeId: string) => {
    return dispatch(assignTask({ id, assigneeId }))
  }, [dispatch])

  const handleUpdateTaskStatus = useCallback((id: string, status: string, actualHours?: number) => {
    return dispatch(updateTaskStatus({ id, status, actualHours }))
  }, [dispatch])

  const handleDeleteTask = useCallback((taskId: string) => {
    return dispatch(deleteTask(taskId))
  }, [dispatch])

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

  const handleSetCurrentProjectId = useCallback((projectId: string | null) => {
    dispatch(setCurrentProjectId(projectId))
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

  const refreshTaskHierarchy = useCallback(() => {
    if (currentProjectId) {
      return handleFetchTaskHierarchy(currentProjectId)
    }
  }, [currentProjectId, handleFetchTaskHierarchy])

  // Computed values
  const hasTasks = tasks.length > 0
  const hasTaskHierarchy = taskHierarchy.length > 0
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
    tasks,
    taskHierarchy,
    selectedTask,
    loading,
    hierarchyLoading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
    currentProjectId,

    // CRUD operations
    fetchTasks: handleFetchTasks,
    fetchTaskHierarchy: handleFetchTaskHierarchy,
    fetchTaskById: handleFetchTaskById,
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
    setCurrentProjectId: handleSetCurrentProjectId,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshTasks,
    refreshTaskHierarchy,

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