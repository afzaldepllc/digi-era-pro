import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { User } from "@/types"

export interface UserFilters {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'suspended' | '';
  department?: string;
}

export interface UserSort {
  field: keyof User;
  direction: 'asc' | 'desc';
}

export interface FetchUsersParams {
  page?: number;
  limit?: number;
  filters?: UserFilters;
  sort?: UserSort;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: string; // Role ID reference
  department: string; // Department ID reference  
  phone?: string;
  position?: string;
  status?: 'active' | 'inactive' | 'suspended';
  bio?: string;
}

export interface UpdateUserData extends Partial<Omit<CreateUserData, 'password'>> {
  _id: string;
}

interface UserState {
  users: User[]
  selectedUser: User | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  filters: UserFilters
  sort: UserSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: {
    totalUsers: number
    activeUsers: number
    inactiveUsers: number
    suspendedUsers: number
  } | null
}

const initialState: UserState = {
  users: [],
  selectedUser: null,
  loading: false,
  actionLoading: false,
  error: null,
  filters: {},
  sort: {
    field: 'createdAt',
    direction: 'desc'
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },
  stats: null,
}

// Async Thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params: FetchUsersParams = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      
      // Always send filter parameters, even if empty
      queryParams.append('search', params.filters?.search || '');
      queryParams.append('role', params.filters?.role || '');
      queryParams.append('status', params.filters?.status || '');
      queryParams.append('department', params.filters?.department || '');
      if (params.sort) {
        queryParams.append('sortBy', params.sort.field.toString());
        queryParams.append('sortOrder', params.sort.direction);
      }

      const response = await fetch(`/api/users?${queryParams.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch users');
      }
      
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'users/fetchUserById',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch user');
      }
      
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: CreateUserData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async (userData: UpdateUserData, { rejectWithValue }) => {
    try {
      const { _id, ...updateData } = userData;
      const response = await fetch(`/api/users/${_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      
      return userId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<UserFilters>) => {
      state.filters = action.payload;
      state.pagination.page = 1; // Reset to first page when filters change
    },
    setSort: (state, action: PayloadAction<UserSort>) => {
      state.sort = action.payload;
    },
    setPagination: (state, action: PayloadAction<Partial<UserState["pagination"]>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setSelectedUser: (state, action: PayloadAction<User | null>) => {
      state.selectedUser = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetState: (state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Fetch Users
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        
        // Handle the API response structure: { success: true, data: { users, pagination, stats } }
        const responseData = action.payload.data || action.payload;
        
        state.users = responseData.users || [];
        
        // Handle pagination
        if (responseData.pagination) {
          state.pagination = {
            page: responseData.pagination.page,
            limit: responseData.pagination.limit,
            total: responseData.pagination.total,
            pages: responseData.pagination.pages,
          };
        }
        
        // Handle stats
        if (responseData.stats) {
          state.stats = {
            totalUsers: responseData.stats.total || responseData.stats.totalUsers || 0,
            activeUsers: responseData.stats.activeUsers || 0,
            inactiveUsers: responseData.stats.inactiveUsers || 0,
            suspendedUsers: responseData.stats.suspendedUsers || 0,
          };
        }
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch User By ID
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.actionLoading = false;
        // Handle the API response structure: { success: true, data: { user } } or { user }
        const responseData = action.payload.data || action.payload;
        state.selectedUser = responseData.user || responseData;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });

    // Create User
    builder
      .addCase(createUser.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.actionLoading = false;
        // Handle the API response structure
        const responseData = action.payload.data || action.payload;
        const newUser = responseData.user || responseData;
        state.users.unshift(newUser);
        state.pagination.total += 1;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });

    // Update User
    builder
      .addCase(updateUser.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.actionLoading = false;
        // Handle the API response structure
        const responseData = action.payload.data || action.payload;
        const updatedUser = responseData.user || responseData;
        
        const index = state.users.findIndex((user) => user._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
        if (state.selectedUser?._id === updatedUser._id) {
          state.selectedUser = updatedUser;
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });

    // Delete User
    builder
      .addCase(deleteUser.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.users = state.users.filter((user) => user._id !== action.payload);
        state.pagination.total -= 1;
        if (state.selectedUser?._id === action.payload) {
          state.selectedUser = null;
        }
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { 
  setFilters, 
  setSort, 
  setPagination, 
  setSelectedUser, 
  clearError, 
  resetState 
} = userSlice.actions;

export default userSlice.reducer;
