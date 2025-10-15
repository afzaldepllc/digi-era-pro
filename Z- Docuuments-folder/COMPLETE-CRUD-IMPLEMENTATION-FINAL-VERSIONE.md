# Complete CRUD Implementation Guide - DepLLC CRM

This comprehensive guide documents the complete CRUD implementation pattern used in the Department module, serving as a blueprint for creating new CRUD operations with security, validation, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Database Layer](#database-layer)
4. [Validation Layer](#validation-layer)
5. [API Layer](#api-layer)
6. [State Management](#state-management)
7. [Frontend Components](#frontend-components)
8. [Security & Middleware](#security--middleware)
9. [Best Practices](#best-practices)
10. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

The CRUD implementation follows a multi-layered architecture:

```
Frontend (React/Next.js)
├── UI Components (Pages, Forms, Tables)
├── Custom Hooks (useDepartments)
├── State Management (Redux Toolkit)
└── API Calls (RTK Query/Fetch)

API Layer (Next.js API Routes)
├── Route Handlers (GET, POST, PUT, DELETE)
├── Middleware Integration
├── Validation (Zod Schemas)
└── Error Handling

Database Layer
├── Mongoose Models
├── Schema Validation
├── Indexes & Performance
└── Database Connections
```

---

## File Structure

### Core Files Required for Each CRUD Module

```
📁 models/
  └── Department.ts                    # Mongoose model & schema

📁 lib/validations/
  └── department.ts                    # Zod validation schemas

📁 app/api/
  ├── departments/
  │   ├── route.ts                     # List (GET) & Create (POST)
  │   └── [id]/
  │       └── route.ts                 # Get by ID, Update, Delete

📁 store/slices/
  └── departmentSlice.ts               # Redux state management

📁 hooks/
  └── use-departments.ts               # Custom hook for CRUD operations

📁 app/departments/
  ├── page.tsx                         # List/Index page
  ├── add/
  │   └── page.tsx                     # Create form page
  └── edit/[id]/
      └── page.tsx                     # Edit form page

📁 types/
  └── index.ts                         # TypeScript type definitions
```

---

## Database Layer

### 1. Mongoose Model (`models/Department.ts`)

```typescript
import mongoose, { Document, Schema } from 'mongoose'

export interface IDepartment extends Document {
  name: string
  description?: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

const DepartmentSchema = new Schema<IDepartment>({
  name: {
    type: String,
    required: [true, "Department name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
    unique: true,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"],
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  },
}, {
  timestamps: true,           // Auto createdAt/updatedAt
  toJSON: { virtuals: true }, // Include virtuals in JSON
  toObject: { virtuals: true },
})

// Performance indexes
DepartmentSchema.index({ status: 1, createdAt: -1 })
DepartmentSchema.index({ 
  name: 'text', 
  description: 'text'
}, {
  weights: { name: 10, description: 5 },
  name: 'department_search_index'
})

// Pre-save validation
DepartmentSchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const existingDept = await mongoose.model('Department').findOne({
      name: { $regex: new RegExp(`^${this.name}$`, 'i') },
      _id: { $ne: this._id }
    })
    
    if (existingDept) {
      const error = new Error('Department name already exists')
      return next(error)
    }
  }
  next()
})

export default mongoose.models.Department || mongoose.model<IDepartment>("Department", DepartmentSchema)
```

### Key Database Features:

- **Unique Constraints**: Case-insensitive name uniqueness
- **Indexes**: Performance optimization for queries
- **Text Search**: Full-text search capability
- **Soft Delete**: Status-based filtering instead of hard deletion
- **Timestamps**: Automatic createdAt/updatedAt tracking
- **Validation**: Schema-level validation with custom error messages

---

## Validation Layer

### 2. Zod Schemas (`lib/validations/department.ts`)

```typescript
import { z } from 'zod'

// Constants for validation
export const DEPARTMENT_CONSTANTS = {
  NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  DESCRIPTION: { MAX_LENGTH: 500 },
  STATUS: { VALUES: ['active', 'inactive'] as const, DEFAULT: 'active' as const },
  PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 100, MIN_PAGE: 1 },
  SORT: { ALLOWED_FIELDS: ['name', 'status', 'createdAt', 'updatedAt'] as const }
} as const

// MongoDB ObjectId validation
export const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  'Invalid ID format'
)

// Base department schema
export const baseDepartmentSchema = z.object({
  name: z.string()
    .min(DEPARTMENT_CONSTANTS.NAME.MIN_LENGTH, 'Name too short')
    .max(DEPARTMENT_CONSTANTS.NAME.MAX_LENGTH, 'Name too long')
    .transform(val => val.trim())
    .refine(name => name.length > 0, 'Department name is required'),

  description: z.string()
    .max(DEPARTMENT_CONSTANTS.DESCRIPTION.MAX_LENGTH, 'Description too long')
    .nullable()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  status: z.enum(DEPARTMENT_CONSTANTS.STATUS.VALUES)
    .default(DEPARTMENT_CONSTANTS.STATUS.DEFAULT),
})

// Operation-specific schemas
export const createDepartmentSchema = baseDepartmentSchema.strict()

export const updateDepartmentSchema = baseDepartmentSchema.partial().strict()
  .refine(data => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  ), { message: 'At least one field must be provided for update' })

// Query parameter schemas
export const departmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional().transform(val => val?.trim() || ''),
  status: z.enum(['active', 'inactive', '']).optional(),
  sortBy: z.enum(['name', 'status', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Type exports
export type Department = z.infer<typeof departmentWithIdSchema>
export type CreateDepartmentData = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentData = z.infer<typeof updateDepartmentSchema>
export type DepartmentQueryParams = z.infer<typeof departmentQuerySchema>
```

### Validation Features:

- **Type Safety**: Full TypeScript integration
- **Transform**: Data cleaning and normalization
- **Refinement**: Custom validation logic
- **Constants**: Centralized validation rules
- **Coercion**: Automatic type conversion for executeGenericDbQuery params

---

## API Layer

### 3. List & Create API (`app/api/departments/route.ts`)

```typescript
import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Department from "@/models/Department"
import { createDepartmentSchema, departmentQuerySchema } from "@/lib/validations/department"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/departments - List with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Security & Authentication
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'read')

    // Parse & validate executeGenericDbQuery parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }

    const validatedParams = departmentQuerySchema.parse(queryParams)

    // Build MongoDB filter (renamed from 'executeGenericDbQuery' to avoid shadowing)
    const filter: any = {}
    
    if (validatedParams.search) {
      filter.$or = [
        { name: { $regex: validatedParams.search, $options: 'i' } },
        { description: { $regex: validatedParams.search, $options: 'i' } }
      ]
    }
    
    if (validatedParams.status) {
      filter.status = validatedParams.status
    }

    // Build sort
    const sort: any = {}
    sort[validatedParams.sortBy] = validatedParams.sortOrder === 'asc' ? 1 : -1

    // Execute parallel queries with automatic connection management and caching
    const [departments, total, stats] = await Promise.all([
      executeGenericDbQuery(async () => {
        return await Department.find(filter)
          .sort(sort)
          .skip((validatedParams.page - 1) * validatedParams.limit)
          .limit(validatedParams.limit)
          .lean()
      }, `departments-${JSON.stringify(validatedParams)}`, 60000), // 1-minute cache

      executeGenericDbQuery(async () => {
        return await Department.countDocuments(filter)
      }, `departments-count-${JSON.stringify(filter)}`, 60000),

      executeGenericDbQuery(async () => {
        return await Department.aggregate([
          {
            $group: {
              _id: null,
              totalDepartments: { $sum: 1 },
              activeDepartments: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              inactiveDepartments: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } }
            }
          }
        ])
      }, `departments-stats`, 300000) // 5-minute cache for stats
    ])

    return NextResponse.json({
      success: true,
      data: {
        departments,
        pagination: {
          page: validatedParams.page,
          limit: validatedParams.limit,
          total,
          pages: Math.ceil(total / validatedParams.limit)
        },
        stats: stats[0] || { totalDepartments: 0, activeDepartments: 0, inactiveDepartments: 0 }
      },
      message: 'Departments retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching departments:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch departments'
    }, { status: 500 })
  }
}

// POST /api/departments - Create new department
export async function POST(request: NextRequest) {
  try {
    // Security & Authentication
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'create')

    // Parse & validate request body
    const body = await request.json()
    const validatedData = createDepartmentSchema.parse(body)

    // Create department with automatic connection management
    const department = await executeGenericDbQuery(async () => {
      // Check for duplicates
      const existingDepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${validatedData.name}$`, 'i') },
        status: 'active'
      })

      if (existingDepartment) {
        throw new Error("Department name already exists")
      }

      // Create and save department
      const newDepartment = new Department(validatedData)
      return await newDepartment.save()
    })

    // Clear relevant cache patterns after creation
    clearCache('departments')

    return NextResponse.json({
      success: true,
      data: { department },
      message: 'Department created successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating department:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create department'
    }, { status: 500 })
  }
}
```

### 4. Individual Operations API (`app/api/departments/[id]/route.ts`)

```typescript
import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Department from "@/models/Department"
import { updateDepartmentSchema, departmentIdSchema } from "@/lib/validations/department"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

interface RouteParams {
  params: { id: string }
}

// GET /api/departments/[id] - Get department by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'read')
    
    const validatedParams = departmentIdSchema.parse({ id: params.id })

    // Fetch department with automatic connection management and caching
    const department = await executeGenericDbQuery(async () => {
      return await Department.findOne({
        _id: validatedParams.id,
        status: 'active'
      }).lean()
    }, `department-${validatedParams.id}`, 300000) // 5-minute cache

    if (!department) {
      return NextResponse.json({ 
        success: false, 
        error: "Department not found" 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { department },
      message: 'Department retrieved successfully'
    })

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Invalid department ID'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch department'
    }, { status: 500 })
  }
}

// PUT /api/departments/[id] - Update department
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'update')
    
    const validatedParams = departmentIdSchema.parse({ id: params.id })
    const body = await request.json()
    const validatedData = updateDepartmentSchema.parse(body)

    // Update department with automatic connection management
    const updatedDepartment = await executeGenericDbQuery(async () => {
      // Check existence
      const existingDepartment = await Department.findOne({
        _id: validatedParams.id,
        status: 'active'
      })

      if (!existingDepartment) {
        throw new Error("Department not found")
      }

      // Check for name conflicts
      if (validatedData.name && validatedData.name !== existingDepartment.name) {
        const duplicateDepartment = await Department.findOne({
          name: { $regex: new RegExp(`^${validatedData.name}$`, 'i') },
          _id: { $ne: validatedParams.id },
          status: 'active'
        })

        if (duplicateDepartment) {
          throw new Error("Department name already exists")
        }
      }

      // Update department
      return await Department.findByIdAndUpdate(
        validatedParams.id,
        { ...validatedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean()
    })

    // Clear relevant cache patterns after update
    clearCache('departments')
    clearCache(`department-${validatedParams.id}`)

    return NextResponse.json({
      success: true,
      data: { department: updatedDepartment },
      message: 'Department updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating department:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update department'
    }, { status: 500 })
  }
}

// DELETE /api/departments/[id] - Soft delete department
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'delete')
    
    const validatedParams = departmentIdSchema.parse({ id: params.id })

    // Soft delete with automatic connection management
    await executeGenericDbQuery(async () => {
      const existingDepartment = await Department.findOne({
        _id: validatedParams.id,
      })

      if (!existingDepartment) {
        throw new Error("Department not found")
      }

      // Soft delete - set status to inactive
      return await Department.findByIdAndUpdate(
        validatedParams.id,
        { status: 'inactive', updatedAt: new Date() }
      )
    })

    // Clear relevant cache patterns after deletion
    clearCache('departments')
    clearCache(`department-${validatedParams.id}`)

    return NextResponse.json({
      success: true,
      message: 'Department deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting department:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete department'
    }, { status: 500 })
  }
}
```

### API Layer Features:

- **Security**: Integrated authentication and authorization
- **Validation**: Request/response validation with Zod
- **Error Handling**: Consistent error responses with throw-based error handling
- **Performance**: Parallel queries where possible with intelligent caching
- **Soft Deletes**: Status-based deletion instead of hard delete
- **Conflict Prevention**: Duplicate checking within executeGenericDbQuery transactions
- **Logging**: Comprehensive error logging
- **Automatic Connection Management**: No manual `connectDB()` calls needed
- **Smart Caching**: Configurable TTL-based caching with pattern-based cache invalidation
- **Cache Invalidation**: Automatic cache clearing after mutations

---

## Database Connection System

### Enhanced MongoDB Connection (`lib/mongodb.ts`)

The system uses an optimized MongoDB connection system with automatic connection management and intelligent caching:

```typescript
import mongoose from 'mongoose'

// Import all models to ensure they're registered
import '@/models/User'
import '@/models/Role'
import '@/models/Department'
import '@/models/SystemPermission'

// Connection caching for Next.js environment
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

// Simple cache for executeGenericDbQuery results
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

/**
 * Enhanced executeGenericDbQuery function with optional caching
 */
async function executeGenericDbQuery<T>(
  queryFn: () => Promise<T>, 
  cacheKey?: string, 
  cacheTtl: number = 30000
): Promise<T> {
  // Check cache first
  if (cacheKey && queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey)!
    if (Date.now() - cached.timestamp < cached.ttl) {
      return cached.data
    }
    queryCache.delete(cacheKey)
  }

  // Ensure connection
  await connectDB()

  // Execute executeGenericDbQuery
  const result = await queryFn()

  // Cache result
  if (cacheKey) {
    queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl: cacheTtl
    })
  }

  return result
}

/**
 * Clear cache by pattern
 */
function clearCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear()
    return
  }

  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key)
    }
  }
}

export default connectDB
export { executeGenericDbQuery, clearCache }
```

### Key Features:

- **Automatic Connection Management**: No need to manually call `connectDB()`
- **Singleton Pattern**: Ensures only one connection per application lifecycle  
- **Intelligent Caching**: TTL-based caching with configurable cache times
- **Cache Invalidation**: Pattern-based cache clearing after mutations
- **Error Handling**: Proper error propagation using throw statements
- **Performance Optimization**: Reduces database load and improves response times

### Usage Patterns:

#### Simple Query (No Caching)
```typescript
const departments = await executeGenericDbQuery(async () => {
  return await Department.find({ status: 'active' }).lean()
})
```

#### Cached Query (With TTL)
```typescript
const departments = await executeGenericDbQuery(async () => {
  return await Department.find({ status: 'active' }).lean()
}, 'departments-active', 60000) // 1-minute cache
```

#### Query with Cache Invalidation
```typescript
// After mutation, clear related cache
await executeGenericDbQuery(async () => {
  const department = new Department(data)
  return await department.save()
})

// Clear all department-related cache entries
clearCache('departments')
```

### Cache Strategy:

- **Read Operations**: Cache for 1-5 minutes based on data volatility
- **List Queries**: Include parameters in cache key for accurate caching
- **Individual Items**: Longer cache times (5-15 minutes) for specific records
- **Statistics**: Longer cache times (5-30 minutes) for computed data
- **Mutation Operations**: Always clear related cache patterns

### Important Notes:

- **Variable Naming**: Always use `filter` instead of `executeGenericDbQuery` for MongoDB executeGenericDbQuery objects to avoid shadowing the imported `executeGenericDbQuery` function
- **Error Handling**: Use `throw new Error()` inside executeGenericDbQuery functions, not `return NextResponse.json()`
- **Cache Keys**: Use descriptive, parameter-specific cache keys for accuracy
- **Cache Clearing**: Clear relevant cache patterns after CREATE, UPDATE, DELETE operations

---

## State Management

### 5. Redux Slice (`store/slices/departmentSlice.ts`)

```typescript
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
      
      const searchValue = params.filters?.search || ''
      queryParams.append('search', searchValue)
      
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

// State interface
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
      state.pagination.page = 1 // Reset to first page when filtering
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
        
        // Update stats
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
```

### 6. Custom Hook (`hooks/use-departments.ts`)

```typescript
import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  setFilters,
  setSort,
  setPagination,
  setSelectedDepartment,
  clearError,
  resetState,
} from '@/store/slices/departmentSlice'
import type {
  FetchDepartmentsParams,
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentFilters,
  DepartmentSort,
} from '@/types'

export function useDepartments() {
  const dispatch = useAppDispatch()

  const {
    departments,
    selectedDepartment,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
  } = useAppSelector((state) => state.departments)

  // CRUD operations
  const handleFetchDepartments = useCallback((params?: FetchDepartmentsParams) => {
    return dispatch(fetchDepartments(params || {
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort
    }))
  }, [dispatch, pagination.page, pagination.limit, JSON.stringify(filters), JSON.stringify(sort)])

  const handleCreateDepartment = useCallback((departmentData: CreateDepartmentData) => {
    return dispatch(createDepartment(departmentData))
  }, [dispatch])

  const handleUpdateDepartment = useCallback((id: string, data: UpdateDepartmentData) => {
    return dispatch(updateDepartment({ id, data }))
  }, [dispatch])

  const handleDeleteDepartment = useCallback((departmentId: string) => {
    return dispatch(deleteDepartment(departmentId))
  }, [dispatch])

  // Filter and sort operations
  const handleSetFilters = useCallback((newFilters: Partial<DepartmentFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: DepartmentSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  // Utility operations
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const refreshDepartments = useCallback(() => {
    return handleFetchDepartments()
  }, [handleFetchDepartments])

  // Computed values
  const hasDepartments = departments.length > 0
  const isFirstPage = pagination.page === 1
  const isLastPage = pagination.page >= pagination.pages
  const totalPages = pagination.pages
  const totalItems = pagination.total

  return {
    // State
    departments,
    selectedDepartment,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,

    // Actions
    fetchDepartments: handleFetchDepartments,
    createDepartment: handleCreateDepartment,
    updateDepartment: handleUpdateDepartment,
    deleteDepartment: handleDeleteDepartment,

    // Filters and pagination
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,
    setSelectedDepartment: handleSetSelectedDepartment,

    // Utilities
    clearError: handleClearError,
    refreshDepartments,

    // Computed values
    hasDepartments,
    isFirstPage,
    isLastPage,
    totalPages,
    totalItems,
  }
}
```

---

## Frontend Components

### 7. List Page (`app/departments/page.tsx`)

```typescript
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/redux";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounceSearch } from "@/hooks/use-debounced-search";
import { Department, DepartmentFilters, FilterConfig } from "@/types";
import PageHeader from "@/components/ui/page-header";
import DataTable, { ColumnDef } from "@/components/ui/data-table";
import GenericFilter from "@/components/ui/generic-filter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Building2, AlertTriangle } from "lucide-react";
import Swal from "sweetalert2";
import { handleAPIError } from "@/lib/utils/api-client";
import { useDepartments } from "@/hooks/use-departments";

export default function DepartmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { canCreate, canDelete } = usePermissions();

  // Local state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const { fetchDepartments, deleteDepartment, setFilters, setSort, setPagination, clearError, setSelectedDepartment } = useDepartments();

  // Redux state
  const {
    departments,
    loading,
    actionLoading,
    error,
    filters,
    sort,
    pagination,
    stats,
  } = useAppSelector((state) => state.departments);

  // Debounced search functionality
  const handleDebouncedSearch = useCallback((searchTerm: string) => {
    setFilters({
      search: searchTerm,
      status: filters.status,
    });
  }, [setFilters]);

  const { searchTerm, setSearchTerm, isSearching } = useDebounceSearch({
    onSearch: handleDebouncedSearch,
    delay: 500,
  });

  // Filter configuration
  const filterConfig: FilterConfig = useMemo(() => ({
    fields: [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        placeholder: 'Search departments...',
        cols: 12,
        mdCols: 6,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        placeholder: 'All Statuses',
        cols: 12,
        mdCols: 6,
        options: [
          { value: 'all', label: 'All Statuses' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
    ],
    defaultValues: {
      search: '',
      status: 'all',
    },
  }), []);

  // Table columns configuration
  const columns: ColumnDef<Department>[] = [
    {
      key: 'name',
      label: 'Department Name',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{value}</span>
            <span className="text-sm text-muted-foreground">
              ID: {row._id?.slice(-8) || 'N/A'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      sortable: false,
      render: (value) => (
        <div className="max-w-xs">
          {value ? (
            <span className="text-sm text-muted-foreground line-clamp-2">
              {value}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              No description
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors = {
          active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800',
          inactive: 'bg-muted text-muted-foreground border-border',
        };

        return (
          <Badge className={`${statusColors[value as keyof typeof statusColors]} border`}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
    },
  ];

  // Event handlers
  const handleSort = useCallback((field: keyof Department, direction: "asc" | "desc") => {
    setSort({ field, direction });
  }, [setSort]);

  const handlePageChange = useCallback((page: number) => {
    setPagination({ page });
  }, [setPagination]);

  const handleDeleteDepartment = useCallback(async (department: Department) => {
    const result = await Swal.fire({
      title: `Delete ${department.name}?`,
      text: "Are you sure you want to delete this department?",
      icon: "error",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "No",
      confirmButtonColor: "#dc2626",
    });

    if (result.isConfirmed) {
      try {
        await deleteDepartment(department._id as string).unwrap();
        toast({
          title: "Success",
          description: "Department deleted successfully.",
          variant: "default",
        });
        fetchDepartments();
      } catch (error: any) {
        handleAPIError(error, "Failed to delete department. Please try again.");
      }
    }
  }, [deleteDepartment, toast]);

  // Fetch departments effect
  useEffect(() => {
    fetchDepartments({
      page: pagination.page,
      limit: pagination.limit,
      filters,
      sort,
    });
  }, [pagination.page, pagination.limit, filters, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational departments"
        onAddClick={() => router.push("/departments/add")}
        addButtonText="Add Department"
        showFilterButton={true}
        isFilterExpanded={isFilterExpanded}
        onFilterToggle={() => setIsFilterExpanded(!isFilterExpanded)}
      >
        {isFilterExpanded && (
          <GenericFilter
            config={filterConfig}
            values={uiFilters}
            onFilterChange={handleFilterChange}
            onReset={handleFilterReset}
            collapsible={false}
            title="Filter Departments"
            className="bg-card"
            loading={isSearching}
            onSearchChange={setSearchTerm}
          />
        )}
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DataTable
        data={departments}
        columns={columns}
        loading={loading}
        totalCount={pagination.total}
        pageSize={pagination.limit}
        currentPage={pagination.page}
        onPageChange={handlePageChange}
        onSort={handleSort}
        sortColumn={sort.field}
        sortDirection={sort.direction}
        emptyMessage="No departments found"
        resourceName="departments"
        onDelete={handleDeleteDepartment}
        enablePermissionChecking={true}
      />
    </div>
  );
}
```

### 8. Create Form (`app/departments/add/page.tsx`)

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/hooks/redux";
import { createDepartment } from "@/store/slices/departmentSlice";
import PageHeader from "@/components/ui/page-header";
import GenericForm from "@/components/ui/generic-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigationLoading } from "@/hooks/use-navigation-loading";
import { CreateDepartmentData, createDepartmentSchema } from '@/lib/validations/department'

export default function AddDepartmentPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateDepartmentData>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    },
  });

  const handleSubmit = async (data: CreateDepartmentData) => {
    setLoading(true);
    try {
      const cleanedData: CreateDepartmentData = {
        ...data,
        description: data.description?.trim() || undefined,
      };

      await dispatch(createDepartment(cleanedData)).unwrap();

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      router.push("/departments");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error || "Failed to create department",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { isNavigating, handleNavigation } = useNavigationLoading();

  const handleCancel = () => {
    handleNavigation("/departments");
  };

  const formFields = [
    {
      fields: [
    {
      name: "name",
      label: "Department Name",
      type: "text" as const,
      required: true,
      placeholder: "Enter department name",
      description: "A unique name for the department",
      cols: 12,
      mdCols: 8,
    },
    {
      name: "status",
      label: "Status",
      type: "select" as const,
      required: true,
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
      cols: 12,
      mdCols: 4,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea" as const,
      placeholder: "Enter department description (optional)",
      description: "Brief description of the department's purpose and responsibilities",
      cols: 12,
      rows: 4,
    },
    ]}
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Department"
        subtitle="Create a new department in your organization"
        showAddButton={false}
        actions={
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isNavigating}
          >
            <ArrowLeft className={`h-4 w-4 mr-2 ${isNavigating ? 'animate-spin' : ''}`} />
            {isNavigating ? 'Going back...' : 'Back to Departments'}
          </Button>
        }
      />

      <div>
        <GenericForm
          form={form}
          fields={formFields}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
          submitText="Create Department"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}
```

---

## Security & Middleware

### 9. Route Middleware (`lib/middleware/route-middleware.ts`)

The `genericApiRoutesMiddleware` function provides comprehensive security:

```typescript
// Usage in API routes
const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'departments', 'read')
```

**What it handles:**

1. **Rate Limiting**
   - API operations: 100 requests/minute
   - Sensitive operations (create/update/delete): 20 requests/minute
   - Authentication operations: 5 requests/minute

2. **Authentication**
   - Validates NextAuth.js session
   - Checks JWT token validity
   - Fetches user data from database

3. **Authorization**
   - Checks user permissions for resource+action
   - Handles super admin bypass
   - Logs security events

4. **Request Filtering**
   - Applies data filtering based on user permissions
   - Handles department-scoped data access
   - Manages hierarchical data visibility

### Security Features:

- **Input Sanitization**: XSS and injection prevention
- **CSRF Protection**: Built into Next.js
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Permission-Based Access**: Fine-grained authorization
- **Audit Logging**: Complete request tracking
- **Error Handling**: Secure error messages (no data leakage)

---

## Best Practices

### 1. **Database Design**
- Use indexes for frequently queried fields
- Implement soft deletes with status fields
- Add text search indexes for search functionality
- Use compound indexes for complex queries
- Implement schema validation at database level

### 2. **Database Connection & Caching**
- Always use the `executeGenericDbQuery()` wrapper instead of manual `connectDB()` calls
- Use descriptive cache keys that include relevant parameters
- Implement appropriate TTL based on data volatility:
  - **Fast-changing data** (user sessions, real-time stats): 30 seconds - 2 minutes
  - **Medium-changing data** (departments, roles): 1-5 minutes  
  - **Slow-changing data** (settings, permissions): 5-30 minutes
- Always clear relevant cache patterns after mutations using `clearCache()`
- Use `filter` instead of `executeGenericDbQuery` for MongoDB executeGenericDbQuery objects to avoid variable shadowing
- Handle errors with `throw new Error()` inside executeGenericDbQuery functions, not response returns

### 3. **API Design**
- Always validate input with Zod schemas
- Use consistent response formats
- Implement proper HTTP status codes
- Add comprehensive error handling with throw statements
- Use middleware for cross-cutting concerns
- Wrap all database operations in `executeGenericDbQuery()` functions

### 4. **State Management**
- Use Redux Toolkit for complex state
- Implement optimistic updates where appropriate
- Handle loading states consistently
- Provide error recovery mechanisms
- Leverage server-side caching to reduce client-side cache complexity

### 5. **Frontend Architecture**
- Use custom hooks for business logic
- Implement debounced search
- Add proper loading states
- Handle errors gracefully
- Use TypeScript for type safety

### 6. **Security**
- Always authenticate and authorize API requests
- Validate all inputs on both client and server
- Use rate limiting to prevent abuse
- Implement proper error handling
- Log security-relevant events

### 7. **Performance**
- Use pagination for large datasets
- Implement search and filtering
- Use database indexes effectively
- Leverage intelligent caching with the `executeGenericDbQuery()` system
- Clear cache patterns appropriately after mutations
- Optimize bundle sizes

---

## Implementation Checklist

When creating a new CRUD module, follow this checklist:

### Database Layer
- [ ] Create Mongoose model with proper validation
- [ ] Add appropriate indexes for performance
- [ ] Implement soft delete with status field
- [ ] Add text search indexes if needed
- [ ] Create database migration if required

### Validation Layer
- [ ] Define Zod schemas for all operations
- [ ] Create constants for validation rules
- [ ] Implement input sanitization
- [ ] Add custom validation logic
- [ ] Export TypeScript types

### API Layer
- [ ] Create list endpoint (GET /api/resource) using `executeGenericDbQuery()` wrapper
- [ ] Create individual resource endpoints (GET/PUT/DELETE /api/resource/[id]) with caching
- [ ] Create creation endpoint (POST /api/resource) with cache invalidation
- [ ] Import `executeGenericDbQuery` and `clearCache` from `@/lib/mongodb`
- [ ] Use `filter` variable names instead of `executeGenericDbQuery` to avoid shadowing
- [ ] Integrate security middleware
- [ ] Add comprehensive error handling with throw statements inside executeGenericDbQuery functions
- [ ] Implement appropriate cache TTL for different operation types
- [ ] Add cache clearing patterns after mutations

### State Management
- [ ] Create Redux slice with async thunks
- [ ] Implement all CRUD operations
- [ ] Add filters, sorting, and pagination
- [ ] Handle loading and error states
- [ ] Create custom hook wrapper

### Frontend Components
- [ ] Create list/index page with DataTable
- [ ] Create add/create form page
- [ ] Create edit form page
- [ ] Implement search and filtering
- [ ] Add permission-based UI controls

### Security & Testing
- [ ] Verify all endpoints are protected
- [ ] Test input validation
- [ ] Test error scenarios
- [ ] Verify permission enforcement
- [ ] Test rate limiting

### Documentation
- [ ] Document API endpoints
- [ ] Add code comments
- [ ] Update type definitions
- [ ] Create usage examples
- [ ] Update this guide if needed

---

## Conclusion

This guide provides a comprehensive blueprint for implementing secure, scalable CRUD operations in the DepLLC CRM system. By following these patterns and practices, you ensure consistency, security, and maintainability across all modules.

The enhanced database connection system with the `executeGenericDbQuery()` wrapper provides:
- **Automatic connection management** - No manual database connection handling needed
- **Intelligent caching** - Configurable TTL-based caching for improved performance
- **Smart cache invalidation** - Pattern-based cache clearing after data mutations
- **Error handling consistency** - Standardized error propagation using throw statements
- **Performance optimization** - Reduced database load and faster response times

The department module serves as the reference implementation, demonstrating how all the pieces work together to create a robust, production-ready CRUD system with enterprise-level security, performance characteristics, and modern database connection management.