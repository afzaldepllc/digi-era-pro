import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Lead, LeadFilters, LeadSort, FetchLeadsParams } from '@/types'
import { CreateLeadData, UpdateLeadData } from '@/lib/validations/lead'

// Async Thunks
export const fetchLeads = createAsyncThunk(
  'leads/fetchLeads',
  async (params: FetchLeadsParams = {}, { rejectWithValue }) => {
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
      
      // Lead-specific filters
      if (params.filters?.source) queryParams.append('source', params.filters.source)
      if (params.filters?.priority) queryParams.append('priority', params.filters.priority)
      if (params.filters?.createdBy) queryParams.append('createdBy', params.filters.createdBy)
      if (params.filters?.createdAfter) queryParams.append('createdAfter', params.filters.createdAfter.toISOString())
      if (params.filters?.createdBefore) queryParams.append('createdBefore', params.filters.createdBefore.toISOString())
      if (params.filters?.minBudget) queryParams.append('minBudget', params.filters.minBudget.toString())
      if (params.filters?.maxBudget) queryParams.append('maxBudget', params.filters.maxBudget.toString())
      if (params.filters?.hasFollowUp !== undefined) queryParams.append('hasFollowUp', params.filters.hasFollowUp.toString())
      if (params.filters?.followUpOverdue !== undefined) queryParams.append('followUpOverdue', params.filters.followUpOverdue.toString())
      
      if (params.sort) {
        queryParams.append('sortBy', params.sort.field)
        queryParams.append('sortOrder', params.sort.direction)
      }

      const response = await fetch(`/api/leads?${queryParams.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch leads')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchLeadById = createAsyncThunk(
  'leads/fetchLeadById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/leads/${id}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch lead')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const createLead = createAsyncThunk(
  'leads/createLead',
  async (leadData: CreateLeadData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create lead')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateLead = createAsyncThunk(
  'leads/updateLead',
  async ({ id, data }: { id: string; data: UpdateLeadData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update lead')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateLeadStatus = createAsyncThunk(
  'leads/updateLeadStatus',
  async ({ id, status, reason }: { id: string; status: string; reason?: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, reason }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update lead status')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const deleteLead = createAsyncThunk(
  'leads/deleteLead',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete lead')
      }
      
      return { id, ...(await response.json()) }
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

interface LeadState {
  leads: Lead[]
  selectedLead: Lead | null
  loading: boolean
  actionLoading: boolean
  statusLoading: boolean // For status updates
  error: string | null
  filters: LeadFilters
  sort: LeadSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: {
    totalLeads: number
    activeLeads: number
    qualifiedLeads: number
    unqualifiedLeads: number
    inactiveLeads: number
    averageBudget: number
    totalBudget: number
    conversionRate: number
  } | null
}

const initialState: LeadState = {
  leads: [],
  selectedLead: null,
  loading: false,
  actionLoading: false,
  statusLoading: false,
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' },
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  stats: null,
}

const leadSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<LeadFilters>) => {
      state.filters = { ...state.filters, ...action.payload }
      // Reset pagination when filters change
      if (JSON.stringify(state.filters) !== JSON.stringify(action.payload)) {
        state.pagination.page = 1
      }
    },
    
    setSort: (state, action: PayloadAction<LeadSort>) => {
      state.sort = action.payload
    },
    
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    
    setSelectedLead: (state, action: PayloadAction<Lead | null>) => {
      state.selectedLead = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    resetState: (state) => {
      return initialState
    },
    
    // Optimistic update for status changes
    optimisticStatusUpdate: (state, action: PayloadAction<{ id: string; status: string }>) => {
      const lead = state.leads.find(lead => lead._id === action.payload.id)
      if (lead) {
        lead.status = action.payload.status as any
      }
    }
  },
  extraReducers: (builder) => {
    // Fetch Leads
    builder
      .addCase(fetchLeads.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false
        const { data } = action.payload
        state.leads = data.leads
        state.pagination = data.pagination
        state.stats = data.stats
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Fetch Lead by ID
    builder
      .addCase(fetchLeadById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLeadById.fulfilled, (state, action) => {
        state.loading = false
        state.selectedLead = action.payload.data
      })
      .addCase(fetchLeadById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Create Lead
    builder
      .addCase(createLead.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(createLead.fulfilled, (state, action) => {
        state.actionLoading = false
        state.leads.unshift(action.payload.data)
        state.pagination.total += 1
      })
      .addCase(createLead.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Lead
    builder
      .addCase(updateLead.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateLead.fulfilled, (state, action) => {
        state.actionLoading = false
        const updatedLead = action.payload.data
        const index = state.leads.findIndex(lead => lead._id === updatedLead._id)
        if (index !== -1) {
          state.leads[index] = updatedLead
        }
        if (state.selectedLead?._id === updatedLead._id) {
          state.selectedLead = updatedLead
        }
      })
      .addCase(updateLead.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Lead Status
    builder
      .addCase(updateLeadStatus.pending, (state) => {
        state.statusLoading = true
        state.error = null
      })
      .addCase(updateLeadStatus.fulfilled, (state, action) => {
        state.statusLoading = false
        const updatedLead = action.payload.data
        const index = state.leads.findIndex(lead => lead._id === updatedLead._id)
        if (index !== -1) {
          state.leads[index] = updatedLead
        }
        if (state.selectedLead?._id === updatedLead._id) {
          state.selectedLead = updatedLead
        }
      })
      .addCase(updateLeadStatus.rejected, (state, action) => {
        state.statusLoading = false
        state.error = action.payload as string
        // Revert optimistic update if the request failed
        // This would require storing the previous status, but for now we'll let the UI handle it
      })

    // Delete Lead
    builder
      .addCase(deleteLead.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(deleteLead.fulfilled, (state, action) => {
        state.actionLoading = false
        const deletedId = action.payload.id
        state.leads = state.leads.filter(lead => lead._id !== deletedId)
        if (state.selectedLead?._id === deletedId) {
          state.selectedLead = null
        }
        state.pagination.total -= 1
      })
      .addCase(deleteLead.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })
  },
})

export const { 
  setFilters, 
  setSort, 
  setPagination, 
  setSelectedLead, 
  clearError, 
  resetState,
  optimisticStatusUpdate
} = leadSlice.actions

export default leadSlice.reducer