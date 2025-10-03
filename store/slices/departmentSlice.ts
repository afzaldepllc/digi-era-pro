import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Department, DepartmentFilters, DepartmentSort, CreateDepartmentData, UpdateDepartmentData, FetchDepartmentsParams } from '@/types'

// Async Thunks
export const fetchDepartments = createAsyncThunk(
  'departments/fetchDepartments',
  async (params: FetchDepartmentsParams = {}, { rejectWithValue }) => {
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
      if (params.sort) {
        queryParams.append('sortBy', params.sort.field)
        queryParams.append('sortOrder', params.sort.direction)
      }

      const response = await fetch(`/api/departments?${queryParams.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch departments')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchDepartmentById = createAsyncThunk(
  'departments/fetchDepartmentById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/departments/${id}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch department')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const createDepartment = createAsyncThunk(
  'departments/createDepartment',
  async (departmentData: CreateDepartmentData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(departmentData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create department')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateDepartment = createAsyncThunk(
  'departments/updateDepartment',
  async ({ id, data }: { id: string; data: UpdateDepartmentData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update department')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const deleteDepartment = createAsyncThunk(
  'departments/deleteDepartment',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete department')
      }
      
      return { id, ...(await response.json()) }
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

interface DepartmentState {
  departments: Department[]
  selectedDepartment: Department | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  filters: DepartmentFilters
  sort: DepartmentSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: {
    totalDepartments: number
    activeDepartments: number
    inactiveDepartments: number
  } | null
}

const initialState: DepartmentState = {
  departments: [],
  selectedDepartment: null,
  loading: false,
  actionLoading: false,
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' },
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  stats: null,
}

const departmentSlice = createSlice({
  name: "departments",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<DepartmentFilters>) => {
      state.filters = action.payload
      state.pagination.page = 1
    },
    setSort: (state, action: PayloadAction<DepartmentSort>) => {
      state.sort = action.payload
    },
    setPagination: (state, action: PayloadAction<Partial<DepartmentState["pagination"]>>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    setSelectedDepartment: (state, action: PayloadAction<Department | null>) => {
      state.selectedDepartment = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    resetState: (state) => {
      return initialState
    },
  },
  extraReducers: (builder) => {
    // Fetch Departments
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false
        const responseData = action.payload.data || action.payload
        state.departments = responseData.departments || []
        
        if (responseData.pagination) {
          state.pagination = { ...state.pagination, ...responseData.pagination }
        }
        
        if (responseData.stats) {
          state.stats = responseData.stats
        }
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Fetch Department By ID
    builder
      .addCase(fetchDepartmentById.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(fetchDepartmentById.fulfilled, (state, action) => {
        state.actionLoading = false
        const responseData = action.payload.data || action.payload
        state.selectedDepartment = responseData.department || responseData
      })
      .addCase(fetchDepartmentById.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Create Department
    builder
      .addCase(createDepartment.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(createDepartment.fulfilled, (state, action) => {
        state.actionLoading = false
        const responseData = action.payload.data || action.payload
        const newDepartment = responseData.department || responseData
        state.departments.unshift(newDepartment)
        state.pagination.total += 1
        
        // Update stats if available
        if (state.stats) {
          state.stats.totalDepartments += 1
          if (newDepartment.status === 'active') {
            state.stats.activeDepartments += 1
          } else {
            state.stats.inactiveDepartments += 1
          }
        }
      })
      .addCase(createDepartment.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Department
    builder
      .addCase(updateDepartment.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateDepartment.fulfilled, (state, action) => {
        state.actionLoading = false
        const responseData = action.payload.data || action.payload
        const updatedDepartment = responseData.department || responseData
        
        // Update in the departments list
        const index = state.departments.findIndex(dept => dept._id === updatedDepartment._id)
        if (index !== -1) {
          const oldDepartment = state.departments[index]
          state.departments[index] = updatedDepartment
          
          // Update stats if status changed
          if (state.stats && oldDepartment.status !== updatedDepartment.status) {
            if (oldDepartment.status === 'active' && updatedDepartment.status === 'inactive') {
              state.stats.activeDepartments -= 1
              state.stats.inactiveDepartments += 1
            } else if (oldDepartment.status === 'inactive' && updatedDepartment.status === 'active') {
              state.stats.activeDepartments += 1
              state.stats.inactiveDepartments -= 1
            }
          }
        }
        
        // Update selected department if it's the same one
        if (state.selectedDepartment?._id === updatedDepartment._id) {
          state.selectedDepartment = updatedDepartment
        }
      })
      .addCase(updateDepartment.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Delete Department
    builder
      .addCase(deleteDepartment.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(deleteDepartment.fulfilled, (state, action) => {
        state.actionLoading = false
        const deletedId = action.payload.id
        
        // Remove from departments list
        const index = state.departments.findIndex(dept => dept._id === deletedId)
        if (index !== -1) {
          const deletedDepartment = state.departments[index]
          state.departments.splice(index, 1)
          state.pagination.total -= 1
          
          // Update stats
          if (state.stats) {
            state.stats.totalDepartments -= 1
            if (deletedDepartment.status === 'active') {
              state.stats.activeDepartments -= 1
            } else {
              state.stats.inactiveDepartments -= 1
            }
          }
        }
        
        // Clear selected department if it's the deleted one
        if (state.selectedDepartment?._id === deletedId) {
          state.selectedDepartment = null
        }
      })
      .addCase(deleteDepartment.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })
  },
})

export const { 
  setFilters, 
  setSort, 
  setPagination, 
  setSelectedDepartment, 
  clearError, 
  resetState 
} = departmentSlice.actions

export default departmentSlice.reducer