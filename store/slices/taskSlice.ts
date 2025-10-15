import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { 
  Task, 
  TaskFilters, 
  TaskSort, 
  CreateTaskData, 
  UpdateTaskData, 
  FetchTasksParams,
  TaskStats,
  TaskHierarchy
} from '@/types'

// Async Thunks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (params: FetchTasksParams = {}, { rejectWithValue }) => {
    try {
      const searchParams = new URLSearchParams()
      
      // Add all parameters to search params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/tasks?${searchParams}`)
      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch tasks')
      }

      return result
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch tasks')
    }
  }
)

export const fetchTaskHierarchy = createAsyncThunk(
  'tasks/fetchTaskHierarchy',
  async ({ projectId, departmentId }: { projectId: string; departmentId?: string }, { rejectWithValue }) => {
    try {
      const searchParams = new URLSearchParams({
        hierarchy: 'true',
        projectId
      })
      
      if (departmentId) {
        searchParams.append('departmentId', departmentId)
      }

      const response = await fetch(`/api/tasks?${searchParams}`)
      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch task hierarchy')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch task hierarchy')
    }
  }
)

export const fetchTaskById = createAsyncThunk(
  'tasks/fetchTaskById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`)
      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to fetch task')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch task')
    }
  }
)

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData: CreateTaskData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to create task')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create task')
    }
  }
)

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ id, data }: { id: string; data: UpdateTaskData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update task')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update task')
    }
  }
)

export const assignTask = createAsyncThunk(
  'tasks/assignTask',
  async ({ id, assigneeId }: { id: string; assigneeId: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operation: 'assign',
          assigneeId 
        }),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to assign task')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to assign task')
    }
  }
)

export const updateTaskStatus = createAsyncThunk(
  'tasks/updateTaskStatus',
  async ({ id, status, actualHours }: { id: string; status: string; actualHours?: number }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operation: 'updateStatus',
          status,
          actualHours
        }),
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to update task status')
      }

      return result.data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update task status')
    }
  }
)

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to delete task')
      }

      return { id, data: result.data }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete task')
    }
  }
)

// State interface
interface TaskState {
  tasks: Task[]
  taskHierarchy: TaskHierarchy[]
  selectedTask: Task | null
  loading: boolean
  hierarchyLoading: boolean
  actionLoading: boolean
  error: string | null
  filters: TaskFilters
  sort: TaskSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: TaskStats | null
  
  // Project-specific state
  currentProjectId: string | null
}

const initialState: TaskState = {
  tasks: [],
  taskHierarchy: [],
  selectedTask: null,
  loading: false,
  hierarchyLoading: false,
  actionLoading: false,
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' },
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  stats: null,
  currentProjectId: null,
}

const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<TaskFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      // Reset page when filters change
      state.pagination.page = 1
    },
    setSort: (state, action: PayloadAction<TaskSort>) => {
      state.sort = action.payload
      // Reset page when sort changes
      state.pagination.page = 1
    },
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setSelectedTask: (state, action: PayloadAction<Task | null>) => {
      state.selectedTask = action.payload
    },
    setCurrentProjectId: (state, action: PayloadAction<string | null>) => {
      state.currentProjectId = action.payload
      // Clear hierarchy when project changes
      if (!action.payload) {
        state.taskHierarchy = []
      }
    },
    clearError: (state) => {
      state.error = null
    },
    resetState: (state) => {
      state.tasks = []
      state.taskHierarchy = []
      state.selectedTask = null
      state.loading = false
      state.hierarchyLoading = false
      state.actionLoading = false
      state.error = null
      state.filters = {}
      state.sort = { field: 'createdAt', direction: 'desc' }
      state.pagination = { page: 1, limit: 10, total: 0, pages: 0 }
      state.stats = null
      state.currentProjectId = null
    },
  },
  extraReducers: (builder) => {
    // Fetch Tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false
        state.tasks = action.payload.data
        state.pagination = action.payload.pagination
        state.stats = action.payload.stats
        state.filters = action.payload.filters
        state.sort = action.payload.sort
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Fetch Task Hierarchy
    builder
      .addCase(fetchTaskHierarchy.pending, (state) => {
        state.hierarchyLoading = true
        state.error = null
      })
      .addCase(fetchTaskHierarchy.fulfilled, (state, action) => {
        state.hierarchyLoading = false
        state.taskHierarchy = action.payload
      })
      .addCase(fetchTaskHierarchy.rejected, (state, action) => {
        state.hierarchyLoading = false
        state.error = action.payload as string
      })

    // Fetch Task by ID
    builder
      .addCase(fetchTaskById.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(fetchTaskById.fulfilled, (state, action) => {
        state.actionLoading = false
        state.selectedTask = action.payload
        
        // Update the task in the list if it exists
        const index = state.tasks.findIndex((t: Task) => t._id === action.payload._id)
        if (index !== -1) {
          state.tasks[index] = action.payload
        }
      })
      .addCase(fetchTaskById.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Create Task
    builder
      .addCase(createTask.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.actionLoading = false
        const newTask = action.payload
        
        // Add to the beginning of the list
        state.tasks.unshift(newTask)
        state.pagination.total += 1
        
        // Update stats if available
        if (state.stats) {
          state.stats.totalTasks += 1
          if (newTask.status === 'pending') {
            state.stats.pendingTasks += 1
          }
          if (newTask.type === 'task') {
            state.stats.mainTasks += 1
          } else {
            state.stats.subTasks += 1
          }
        }
      })
      .addCase(createTask.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Task
    builder
      .addCase(updateTask.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.actionLoading = false
        const updatedTask = action.payload
        
        // Update in the tasks list
        const index = state.tasks.findIndex((t: Task) => t._id === updatedTask._id)
        if (index !== -1) {
          state.tasks[index] = updatedTask
        }
        
        // Update selected task if it's the same one
        if (state.selectedTask?._id === updatedTask._id) {
          state.selectedTask = updatedTask
        }
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Assign Task
    builder
      .addCase(assignTask.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(assignTask.fulfilled, (state, action) => {
        state.actionLoading = false
        const assignedTask = action.payload
        
        // Update in the tasks list
        const index = state.tasks.findIndex((t: Task) => t._id === assignedTask._id)
        if (index !== -1) {
          state.tasks[index] = assignedTask
        }
        
        // Update selected task if it's the same one
        if (state.selectedTask?._id === assignedTask._id) {
          state.selectedTask = assignedTask
        }
      })
      .addCase(assignTask.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Task Status
    builder
      .addCase(updateTaskStatus.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateTaskStatus.fulfilled, (state, action) => {
        state.actionLoading = false
        const updatedTask = action.payload
        
        // Update in the tasks list
        const index = state.tasks.findIndex((t: Task) => t._id === updatedTask._id)
        if (index !== -1) {
          const oldStatus = state.tasks[index].status
          state.tasks[index] = updatedTask
          
          // Update stats based on status change
          if (state.stats && oldStatus !== updatedTask.status) {
            // Decrement old status count
            switch (oldStatus) {
              case 'pending':
                state.stats.pendingTasks = Math.max(0, state.stats.pendingTasks - 1)
                break
              case 'in-progress':
                state.stats.inProgressTasks = Math.max(0, state.stats.inProgressTasks - 1)
                break
              case 'completed':
                state.stats.completedTasks = Math.max(0, state.stats.completedTasks - 1)
                break
            }
            
            // Increment new status count
            switch (updatedTask.status) {
              case 'pending':
                state.stats.pendingTasks += 1
                break
              case 'in-progress':
                state.stats.inProgressTasks += 1
                break
              case 'completed':
                state.stats.completedTasks += 1
                break
            }
          }
        }
        
        // Update selected task if it's the same one
        if (state.selectedTask?._id === updatedTask._id) {
          state.selectedTask = updatedTask
        }
      })
      .addCase(updateTaskStatus.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Delete Task (Cancel)
    builder
      .addCase(deleteTask.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.actionLoading = false
        const { id } = action.payload
        
        // Update task status to cancelled instead of removing
        const index = state.tasks.findIndex((t: Task) => t._id === id)
        if (index !== -1) {
          state.tasks[index] = { ...state.tasks[index], status: 'cancelled' as any }
        }
        
        // Clear selected task if it was deleted
        if (state.selectedTask?._id === id) {
          state.selectedTask = null
        }
        
        // Update stats
        if (state.stats) {
          state.stats.cancelledTasks += 1
        }
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })
  },
})

export const { 
  setFilters, 
  setSort, 
  setPagination, 
  setSelectedTask,
  setCurrentProjectId, 
  clearError, 
  resetState 
} = taskSlice.actions

export default taskSlice.reducer