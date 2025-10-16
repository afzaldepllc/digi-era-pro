import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Client, ClientFilters, ClientSort, FetchClientsParams, ClientResponse } from '@/types'
import { CreateClientData, UpdateClientData } from '@/lib/validations/client'

// Async Thunks
export const fetchClients = createAsyncThunk(
  'clients/fetchClients',
  async (params: FetchClientsParams = {}, { rejectWithValue }) => {
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
      
      // Client-specific filters
      if (params.filters?.clientStatus) queryParams.append('clientStatus', params.filters.clientStatus)
      if (params.filters?.company) queryParams.append('company', params.filters.company)
      if (params.filters?.hasLead !== undefined) queryParams.append('hasLead', params.filters.hasLead.toString())
      if (params.filters?.qualifiedAfter) queryParams.append('qualifiedAfter', params.filters.qualifiedAfter.toISOString())
      if (params.filters?.qualifiedBefore) queryParams.append('qualifiedBefore', params.filters.qualifiedBefore.toISOString())
      
      if (params.sort) {
        queryParams.append('sortBy', params.sort.field)
        queryParams.append('sortOrder', params.sort.direction)
      }

      const response = await fetch(`/api/clients?${queryParams.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch clients')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const fetchClientById = createAsyncThunk<ClientResponse, string>(
  'clients/fetchClientById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/clients/${id}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch client')
      }
      
      return await response.json() as ClientResponse
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const createClient = createAsyncThunk(
  'clients/createClient',
  async (data: CreateClientData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create client')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateClient = createAsyncThunk(
  'clients/updateClient',
  async ({ id, data }: { id: string; data: UpdateClientData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update client')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const updateClientStatus = createAsyncThunk(
  'clients/updateClientStatus',
  async ({ id, clientStatus, reason }: { id: string; clientStatus: string; reason?: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientStatus, reason }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update client status')
      }
      
      return await response.json()
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

export const deleteClient = createAsyncThunk(
  'clients/deleteClient',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete client')
      }
      
      return { id, ...(await response.json()) }
    } catch (error: any) {
      return rejectWithValue(error.message)
    }
  }
)

interface ClientState {
  clients: Client[]
  selectedClient: Client | null
  loading: boolean
  actionLoading: boolean
  statusLoading: boolean // For status updates
  error: string | null
  filters: ClientFilters
  sort: ClientSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: {
    totalClients: number
    qualifiedClients: number
    unqualifiedClients: number
    activeClients: number
    inactiveClients: number
  } | null
}

const initialState: ClientState = {
  clients: [],
  selectedClient: null,
  loading: false,
  actionLoading: false,
  statusLoading: false,
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' },
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  stats: null,
}

const clientSlice = createSlice({
  name: "clients",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<ClientFilters>) => {
      state.filters = { ...state.filters, ...action.payload }
      // Reset pagination when filters change
      if (JSON.stringify(state.filters) !== JSON.stringify(action.payload)) {
        state.pagination.page = 1
      }
    },
    
    setSort: (state, action: PayloadAction<ClientSort>) => {
      state.sort = action.payload
    },
    
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    
    setSelectedClient: (state, action: PayloadAction<Client | null>) => {
      state.selectedClient = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    resetState: (state) => {
      return initialState
    },
    
    // Optimistic update for status changes
    optimisticStatusUpdate: (state, action: PayloadAction<{ id: string; clientStatus: string }>) => {
      const client = state.clients.find(client => client._id === action.payload.id)
      if (client) {
        client.clientStatus = action.payload.clientStatus as any
      }
    }
  },
  extraReducers: (builder) => {
    // Fetch Clients
    builder
      .addCase(fetchClients.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false
        const { data } = action.payload
        state.clients = data.clients
        state.pagination = data.pagination
        state.stats = data.stats
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Fetch Client by ID
    builder
      .addCase(fetchClientById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchClientById.fulfilled, (state, action) => {
        state.loading = false
        state.selectedClient = action.payload.data
      })
      .addCase(fetchClientById.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })

    // Create Client
    builder
      .addCase(createClient.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(createClient.fulfilled, (state, action) => {
        state.actionLoading = false
        state.clients.unshift(action.payload.data) // Add to beginning of list
        state.pagination.total += 1 // Update total count
      })
      .addCase(createClient.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Client
    builder
      .addCase(updateClient.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        state.actionLoading = false
        const updatedClient = action.payload.data
        const index = state.clients.findIndex(client => client._id === updatedClient._id)
        if (index !== -1) {
          state.clients[index] = updatedClient
        }
        if (state.selectedClient?._id === updatedClient._id) {
          state.selectedClient = updatedClient
        }
      })
      .addCase(updateClient.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })

    // Update Client Status
    builder
      .addCase(updateClientStatus.pending, (state) => {
        state.statusLoading = true
        state.error = null
      })
      .addCase(updateClientStatus.fulfilled, (state, action) => {
        state.statusLoading = false
        const updatedClient = action.payload.data
        const index = state.clients.findIndex(client => client._id === updatedClient._id)
        if (index !== -1) {
          state.clients[index] = updatedClient
        }
        if (state.selectedClient?._id === updatedClient._id) {
          state.selectedClient = updatedClient
        }
      })
      .addCase(updateClientStatus.rejected, (state, action) => {
        state.statusLoading = false
        state.error = action.payload as string
        // Revert optimistic update if the request failed
        // This would require storing the previous status, but for now we'll let the UI handle it
      })

    // Delete Client
    builder
      .addCase(deleteClient.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(deleteClient.fulfilled, (state, action) => {
        state.actionLoading = false
        const deletedId = action.payload.id
        state.clients = state.clients.filter(client => client._id !== deletedId)
        if (state.selectedClient?._id === deletedId) {
          state.selectedClient = null
        }
        state.pagination.total -= 1
      })
      .addCase(deleteClient.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string
      })
  },
})

export const { 
  setFilters, 
  setSort, 
  setPagination, 
  setSelectedClient, 
  clearError, 
  resetState,
  optimisticStatusUpdate
} = clientSlice.actions

export default clientSlice.reducer