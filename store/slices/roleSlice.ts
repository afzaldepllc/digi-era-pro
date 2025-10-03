import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { Role, Permission, ApiResponse, PaginatedResponse } from "@/types"

// Role-specific interfaces
export interface RoleFilters {
  search?: string;
  department?: string;
  hierarchyLevel?: number;
  isSystemRole?: boolean;
  status?: "active" | "inactive" | "archived" | "";
}

export interface RoleSort {
  field: keyof Role;
  direction: 'asc' | 'desc';
}

export interface FetchRolesParams {
  page?: number;
  limit?: number;
  filters?: RoleFilters;
  sort?: RoleSort;
}

export interface CreateRoleData {
  name: string;
  displayName: string;
  description?: string;
  department: string;
  permissions: Permission[];
  hierarchyLevel: number;
  maxUsers?: number;
  validityPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  metadata?: {
    notes?: string;
    tags?: string[];
  };
}

export interface UpdateRoleData extends Partial<CreateRoleData> {
  _id: string;
  status?: "active" | "inactive" | "archived";
}

interface RoleState {
  roles: Role[]
  selectedRole: Role | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  filters: RoleFilters
  sort: RoleSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: {
    totalRoles: number
    systemRoles: number
    departmentRoles: number
    activeRoles: number
    inactiveRoles: number
    archivedRoles: number
  } | null
}

const initialState: RoleState = {
  roles: [],
  selectedRole: null,
  loading: false,
  actionLoading: false,
  error: null,
  filters: {
    search: '',
    department: '',
    status: '',
  },
  sort: {
    field: 'createdAt',
    direction: 'desc',
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  stats: null,
}

// Async thunks
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (params: FetchRolesParams = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();

      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      // queryParams.append('limit', params?.limit?.toString() || '100');

      // Always send filter parameters, even if empty
      queryParams.append('search', params.filters?.search || '');
      queryParams.append('department', params.filters?.department || '');
      queryParams.append('status', params.filters?.status || '');
      if (params.filters?.hierarchyLevel !== undefined) queryParams.append('hierarchyLevel', params.filters.hierarchyLevel.toString());
      if (params.filters?.isSystemRole !== undefined) queryParams.append('isSystemRole', params.filters.isSystemRole.toString());

      if (params.sort) {
        queryParams.append('sortBy', params.sort.field.toString());
        queryParams.append('sortOrder', params.sort.direction);
      }

      const response = await fetch(`/api/roles?${queryParams.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch roles');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

export const fetchRoleById = createAsyncThunk(
  'roles/fetchRoleById',
  async (roleId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/roles/${roleId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch role');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

export const fetchRolesByDepartment = createAsyncThunk(
  'roles/fetchRolesByDepartment',
  async (departmentId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/departments/${departmentId}/roles`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch department roles');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

export const createRole = createAsyncThunk(
  'roles/createRole',
  async (roleData: CreateRoleData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create role');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async (roleData: UpdateRoleData, { rejectWithValue }) => {
    try {
      const { _id, ...updateData } = roleData;
      const response = await fetch(`/api/roles/${_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update role');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (roleId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete role');
      }

      return roleId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

export const updateRolePermissions = createAsyncThunk(
  'roles/updateRolePermissions',
  async (data: { roleId: string; permissions: Permission[] }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/roles/${data.roleId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: data.permissions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update role permissions');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
)

// Role slice
const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<RoleFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1 // Reset to first page when filters change
    },

    setSort: (state, action: PayloadAction<RoleSort>) => {
      state.sort = action.payload
      state.pagination.page = 1 // Reset to first page when sort changes
    },

    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      if (action.payload.page !== undefined) {
        state.pagination.page = action.payload.page
      }
      if (action.payload.limit !== undefined) {
        state.pagination.limit = action.payload.limit
        state.pagination.page = 1 // Reset to first page when limit changes
      }
    },

    setSelectedRole: (state, action: PayloadAction<Role | null>) => {
      state.selectedRole = action.payload
    },

    clearError: (state) => {
      state.error = null
    },

    resetRoles: (state) => {
      return initialState
    },
  },

  extraReducers: (builder) => {
    // Fetch roles
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false

        // Handle the API response structure: { success: true, data: { roles, pagination, stats } }
        const responseData = action.payload.data || action.payload

        state.roles = responseData.roles || []

        // Handle pagination
        if (responseData.pagination) {
          state.pagination = {
            page: responseData.pagination.page || 1,
            limit: responseData.pagination.limit || 10,
            total: responseData.pagination.total || 0,
            pages: responseData.pagination.pages || 0,
          }
        }

        // Handle stats
        if (responseData.stats) {
          state.stats = {
            totalRoles: responseData.stats.totalRoles || 0,
            systemRoles: responseData.stats.systemRoles || 0,
            departmentRoles: responseData.stats.departmentRoles || 0,
            activeRoles: (state.roles || []).filter((role: any) => role.status === 'active').length,
            inactiveRoles: (state.roles || []).filter((role: any) => role.status === 'inactive').length,
            archivedRoles: (state.roles || []).filter((role: any) => role.status === 'archived').length,
          }
        }
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string || 'Failed to fetch roles'
      })

    // Fetch role by ID
    builder
      .addCase(fetchRoleById.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(fetchRoleById.fulfilled, (state, action) => {
        state.actionLoading = false
        state.selectedRole = action.payload
      })
      .addCase(fetchRoleById.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string || 'Failed to fetch role'
      })

    // Create role
    builder
      .addCase(createRole.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.actionLoading = false
        // Handle the API response structure
        const newRole = action.payload.data || action.payload
        state.roles.unshift(newRole) // Add to beginning of list
        if (state.pagination) {
          state.pagination.total += 1
        }
      })
      .addCase(createRole.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string || 'Failed to create role'
      })

    // Update role
    builder
      .addCase(updateRole.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.actionLoading = false
        // Handle the API response structure
        const updatedRole = action.payload.data || action.payload
        const index = state.roles.findIndex(role => role._id === updatedRole._id)
        if (index !== -1) {
          state.roles[index] = updatedRole
        }
        if (state.selectedRole?._id === updatedRole._id) {
          state.selectedRole = updatedRole
        }
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string || 'Failed to update role'
      })

    // Delete role
    builder
      .addCase(deleteRole.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.actionLoading = false
        state.roles = state.roles.filter(role => role._id !== action.payload)
        state.pagination.total -= 1
        if (state.selectedRole?._id === action.payload) {
          state.selectedRole = null
        }
      })
      .addCase(deleteRole.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string || 'Failed to delete role'
      })

    // Update role permissions
    builder
      .addCase(updateRolePermissions.pending, (state) => {
        state.actionLoading = true
        state.error = null
      })
      .addCase(updateRolePermissions.fulfilled, (state, action) => {
        state.actionLoading = false
        // Handle the API response structure
        const updatedRole = action.payload.data || action.payload
        const index = state.roles.findIndex(role => role._id === updatedRole._id)
        if (index !== -1) {
          state.roles[index] = updatedRole
        }
        if (state.selectedRole?._id === updatedRole._id) {
          state.selectedRole = updatedRole
        }
      })
      .addCase(updateRolePermissions.rejected, (state, action) => {
        state.actionLoading = false
        state.error = action.payload as string || 'Failed to update role permissions'
      })
  },
})

export const {
  setFilters,
  setSort,
  setPagination,
  setSelectedRole,
  clearError,
  resetRoles,
} = roleSlice.actions

export default roleSlice.reducer