import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  Project,
  ProjectFilters,
  ProjectSort,
  CreateProjectData,
  CreateProjectFormData,
  UpdateProjectData,
  FetchProjectsParams,
  ProjectStats,
  CategorizeDepartmentsData
} from '@/types'

// Async Thunks
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (params: FetchProjectsParams = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()

      if (params.page) queryParams.append('page', params.page.toString())
      if (params.limit) queryParams.append('limit', params.limit.toString())

      // Always send search parameter, even if empty
      const searchValue = params.filters?.search || ''
      queryParams.append('search', searchValue)

      // Always send status parameter, even if empty
      const statusValue = params.filters?.status || ''
      queryParams.append('status', statusValue)

      const priorityValue = params.filters?.priority || ''
      if (priorityValue) queryParams.append('priority', priorityValue)

      if (params.sort) {
        queryParams.append('sortBy', params.sort.field)
        queryParams.append('sortOrder', params.sort.direction)
      }

      const response = await fetch(`/api/projects?${queryParams.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch projects')
      }


      const finalResponse = await response.json()
      return finalResponse
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${id}`)
      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch project')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch project')
    }
  }
)

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: CreateProjectFormData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to create project')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create project')
    }
  }
)

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ id, data }: { id: string; data: UpdateProjectData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update project')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update project')
    }
  }
)

export const categorizeProject = createAsyncThunk(
  'projects/categorizeProject',
  async ({ id, departmentIds }: { id: string; departmentIds: string[] }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'categorize',
          departmentIds
        }),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to categorize project')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to categorize project')
    }
  }
)

export const approveProject = createAsyncThunk(
  'projects/approveProject',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation: 'approve' }),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to approve project')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to approve project')
    }
  }
)

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to delete project')
      }

      return { id, data: result.data }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete project')
    }
  }
)

// State interface
interface ProjectState {
  projects: Project[]
  selectedProject: Project | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  filters: ProjectFilters
  sort: ProjectSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: ProjectStats | null
}

const initialState: ProjectState = {
  projects: [],
  selectedProject: null,
  loading: false,
  actionLoading: false,
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' },
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  stats: null,
}

const projectSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<ProjectFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      // Reset page when filters change
      state.pagination.page = 1
    },
    setSort: (state, action: PayloadAction<ProjectSort>) => {
      state.sort = action.payload
      // Reset page when sort changes
      state.pagination.page = 1
    },
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setSelectedProject: (state, action: PayloadAction<Project | null>) => {
      state.selectedProject = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    resetState: (state) => {
      state.projects = []
      state.selectedProject = null
      state.loading = false
      state.actionLoading = false
      state.error = null
      state.filters = {}
      state.sort = { field: 'createdAt', direction: 'desc' }
      state.pagination = { page: 1, limit: 10, total: 0, pages: 0 }
      state.stats = null
    },
  },
  extraReducers: (builder) => {
    // Fetch Projects
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false
        const responseData = action.payload.data || action.payload
        state.projects = action.payload.data || []

        if (responseData.pagination) {
          state.pagination = { ...state.pagination, ...responseData.pagination }
        }

        if (responseData.stats) {
          state.stats = responseData.stats
        }

        // console.log('Fetched projects:', state.projects, 'Stats:', state.stats)
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Fetch Project by ID
    builder
      .addCase(fetchProjectById.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.actionLoading = false
        state.selectedProject = action.payload

        // Update the project in the list if it exists
        const index = state.projects.findIndex((p: Project) => p._id === action.payload._id)
        if (index !== -1) {
          state.projects[index] = action.payload
        }
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Create Project
    builder
      .addCase(createProject.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.actionLoading = false
        // Optimistically add to the beginning of the list
        state.projects.unshift(action.payload)
        state.pagination.total += 1

        // Update stats if available
        if (state.stats) {
          state.stats.totalProjects += 1
          if (action.payload.status === 'pending') {
            state.stats.pendingProjects += 1
          }
        }
      })
      .addCase(createProject.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Project
    builder
      .addCase(updateProject.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.actionLoading = false
        const updatedProject = action.payload

        // Update in the projects list
        const index = state.projects.findIndex((p: Project) => p._id === updatedProject._id)
        if (index !== -1) {
          state.projects[index] = updatedProject
        }

        // Update selected project if it's the same one
        if (state.selectedProject?._id === updatedProject._id) {
          state.selectedProject = updatedProject
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Categorize Project
    builder
      .addCase(categorizeProject.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(categorizeProject.fulfilled, (state, action) => {
        state.actionLoading = false
        const updatedProject = action.payload

        // Update in the projects list
        const index = state.projects.findIndex((p: Project) => p._id === updatedProject._id)
        if (index !== -1) {
          state.projects[index] = updatedProject
        }

        // Update selected project if it's the same one
        if (state.selectedProject?._id === updatedProject._id) {
          state.selectedProject = updatedProject
        }
      })
      .addCase(categorizeProject.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Approve Project
    builder
      .addCase(approveProject.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(approveProject.fulfilled, (state, action) => {
        state.actionLoading = false
        const approvedProject = action.payload

        // Update in the projects list
        const index = state.projects.findIndex((p: Project) => p._id === approvedProject._id)
        if (index !== -1) {
          state.projects[index] = approvedProject
        }

        // Update selected project if it's the same one
        if (state.selectedProject?._id === approvedProject._id) {
          state.selectedProject = approvedProject
        }

        // Update stats
        if (state.stats) {
          state.stats.approvedProjects += 1
          state.stats.pendingProjects = Math.max(0, state.stats.pendingProjects - 1)
        }
      })
      .addCase(approveProject.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Delete Project
    builder
      .addCase(deleteProject.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.actionLoading = false
        const { id } = action.payload

        // Remove from projects list
        state.projects = state.projects.filter((p: Project) => p._id !== id)
        state.pagination.total = Math.max(0, state.pagination.total - 1)

        // Clear selected project if it was deleted
        if (state.selectedProject?._id === id) {
          state.selectedProject = null
        }

        // Update stats
        if (state.stats) {
          state.stats.totalProjects = Math.max(0, state.stats.totalProjects - 1)
          state.stats.inactiveProjects += 1
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })
  },
})

export const {
  setFilters,
  setSort,
  setPagination,
  setSelectedProject,
  clearError,
  resetState
} = projectSlice.actions

export default projectSlice.reducer