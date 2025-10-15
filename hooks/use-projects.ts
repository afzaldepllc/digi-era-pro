import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchProjects,
  fetchProjectById,
  createProject,
  updateProject,
  categorizeProject,
  approveProject,
  deleteProject,
  setFilters,
  setSort,
  setPagination,
  setSelectedProject,
  clearError,
  resetState,
} from '@/store/slices/projectSlice'
import type {
  FetchProjectsParams,
  CreateProjectData,
  CreateProjectFormData,
  UpdateProjectData,
  ProjectFilters,
  ProjectSort,
} from '@/types'

export function useProjects() {
  const dispatch = useAppDispatch()

  const {
    projects,
    selectedProject,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.projects)

  // CRUD operations
  const handleFetchProjects = useCallback((params?: FetchProjectsParams) => {
    return dispatch(fetchProjects(params || {
      page: pagination.page,
      limit: pagination.limit,
      ...filters,
    }))
  }, [dispatch, pagination.page, pagination.limit, JSON.stringify(filters), JSON.stringify(sort)])

  const handleFetchProjectById = useCallback((id: string) => {
    return dispatch(fetchProjectById(id))
  }, [dispatch])

  const handleCreateProject = useCallback((projectData: CreateProjectFormData) => {
    return dispatch(createProject(projectData))
  }, [dispatch])

  const handleUpdateProject = useCallback((id: string, data: UpdateProjectData) => {
    return dispatch(updateProject({ id, data }))
  }, [dispatch])

  const handleCategorizeProject = useCallback((id: string, departmentIds: string[]) => {
    return dispatch(categorizeProject({ id, departmentIds }))
  }, [dispatch])

  const handleApproveProject = useCallback((id: string) => {
    return dispatch(approveProject(id))
  }, [dispatch])

  const handleDeleteProject = useCallback((projectId: string) => {
    return dispatch(deleteProject(projectId))
  }, [dispatch])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<ProjectFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: ProjectSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  const handleSetSelectedProject = useCallback((project: typeof selectedProject) => {
    dispatch(setSelectedProject(project))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshProjects = useCallback(() => {
    return handleFetchProjects()
  }, [handleFetchProjects])

  // Computed values
  const hasProjects = projects.length > 0
  const isFirstPage = pagination.page === 1
  const isLastPage = pagination.page >= pagination.pages
  const totalPages = pagination.pages
  const totalItems = pagination.total

  // Status-based getters
  const pendingProjects = projects.filter((p: any) => p.status === 'pending')
  const activeProjects = projects.filter((p: any) => p.status === 'active')
  const approvedProjects = projects.filter((p: any) => p.status === 'approved')
  const completedProjects = projects.filter((p: any) => p.status === 'completed')

  // Priority-based getters
  const urgentProjects = projects.filter((p: any) => p.priority === 'urgent')
  const highPriorityProjects = projects.filter((p: any) => p.priority === 'high')

  // Helper functions
  const getProjectsByStatus = useCallback((status: string) => {
    return projects.filter((p: any) => p.status === status)
  }, [projects])

  const getProjectsByPriority = useCallback((priority: string) => {
    return projects.filter((p: any) => p.priority === priority)
  }, [projects])

  const getProjectsByClient = useCallback((clientId: string) => {
    return projects.filter((p: any) => p.clientId === clientId)
  }, [projects])

  const getProjectsByDepartment = useCallback((departmentId: string) => {
    return projects.filter((p: any) => p.departmentIds.includes(departmentId))
  }, [projects])

  const canCreateProject = useCallback(() => {
    // Logic to determine if user can create projects
    // This would typically check user permissions
    return true // Simplified for now
  }, [])

  const canEditProject = useCallback((project: typeof selectedProject) => {
    // Logic to determine if user can edit a specific project
    // This would typically check user permissions and project status
    return project && project.status !== 'completed'
  }, [])

  const canDeleteProject = useCallback((project: typeof selectedProject) => {
    // Logic to determine if user can delete a specific project
    // This would typically check user permissions and project status
    return project && ['pending', 'inactive'].includes(project.status)
  }, [])

  const canCategorizeProject = useCallback((project: typeof selectedProject) => {
    // Logic to determine if user can categorize a project
    return project && project.status === 'pending'
  }, [])

  const canApproveProject = useCallback((project: typeof selectedProject) => {
    // Logic to determine if user can approve a project
    return project && project.status === 'pending' && project.departmentIds.length > 0
  }, [])

  return {
    // State
    projects,
    selectedProject,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,

    // CRUD operations
    fetchProjects: handleFetchProjects,
    fetchProjectById: handleFetchProjectById,
    createProject: handleCreateProject,
    updateProject: handleUpdateProject,
    categorizeProject: handleCategorizeProject,
    approveProject: handleApproveProject,
    deleteProject: handleDeleteProject,

    // Filter and sort operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedProject: handleSetSelectedProject,

    // Utility operations
    clearError: handleClearError,
    resetState: handleResetState,
    refreshProjects,

    // Computed values
    hasProjects,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,

    // Status-based data
    pendingProjects,
    activeProjects,
    approvedProjects,
    completedProjects,
    urgentProjects,
    highPriorityProjects,

    // Helper functions
    getProjectsByStatus,
    getProjectsByPriority,
    getProjectsByClient,
    getProjectsByDepartment,

    // Permission checks
    canCreateProject,
    canEditProject,
    canDeleteProject,
    canCategorizeProject,
    canApproveProject,
  }
}