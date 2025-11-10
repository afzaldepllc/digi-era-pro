# Complete CRUD Implementation Guide - DepLLC CRM

This comprehensive guide documents the complete CRUD implementation pattern used in the Department module, serving as a blueprint for creating new CRUD operations with security, validation, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Error Handling System](#error-handling-system)
3. [API Client System](#api-client-system)
4. [File Structure](#file-structure)
5. [Database Layer](#database-layer)
6. [Validation Layer](#validation-layer)
7. [API Layer](#api-layer)
8. [State Management](#state-management)
9. [Frontend Components](#frontend-components)
10. [Caching System](#caching-system)
11. [Security & Middleware](#security--middleware)
12. [Database Connection System](#database-connection-system)
13. [Best Practices](#best-practices)
14. [Recent Updates & Fixes](#recent-updates--fixes)
15. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

The CRUD implementation follows a multi-layered architecture:

```
Frontend (React/Next.js)
├── UI Components (Pages, Forms, Tables)
├── Generic Hooks (useGenericQuery, useGenericCreate, etc.)
├── State Management (TanStack Query + Minimal Redux)
└── API Calls (Centralized API Client)

API Layer (Next.js API Routes)
├── Route Handlers (GET, POST, PUT, DELETE)
├── Middleware Integration
├── Validation (Zod Schemas)
├── Error Handling (Centralized)
└── Caching (executeGenericDbQuery)

Database Layer
├── Mongoose Models
├── Schema Validation
├── Indexes & Performance
└── Database Connections
```

---

## Error Handling System

### Core Files:
- `lib/utils/error-handler.ts` - Generic error parsing and handling
- `lib/utils/api-client.ts` - API client with error handling integration

### Key Features:
- **Validation Error Handling**: Automatically parses Zod validation errors from backend
- **Generic Error Parsing**: Handles different error formats (API errors, network errors, etc.)
- **User-Friendly Messages**: Converts technical errors to user-readable messages
- **Toast Integration**: Automatic error display with appropriate toast variants

### Usage:
```typescript
import { handleAPIError } from '@/lib/utils/api-client'

// In components
try {
  await someAsyncOperation()
} catch (error) {
  handleAPIError(error, 'Operation failed')
}
```

---

## API Client System

### Features:
- **Centralized API Calls**: All API requests go through a single client
- **Automatic Error Handling**: Consistent error processing
- **Request/Response Interception**: Can add auth headers, logging, etc.
- **Type Safety**: Full TypeScript support

### Generic API Methods:
```typescript
import { apiRequest } from '@/lib/utils/api-client'

const response = await apiRequest('/api/departments')
const data = await apiRequest.post('/api/departments', payload)
```

---

## File Structure

### Core Files Required for Each CRUD Module

```
📁 models/
  └── Entity.ts                        # Mongoose model & schema

📁 lib/validations/
  └── entity.ts                        # Zod validation schemas

📁 app/api/
  ├── entities/
  │   ├── route.ts                     # List (GET) & Create (POST)
  │   └── [id]/
  │       └── route.ts                 # Get by ID, Update, Delete

📁 store/slices/
  └── entitySlice.ts                   # Minimal Redux slice for client state

📁 hooks/
  ├── use-generic-query.ts             # Generic CRUD hooks (TanStack Query)
  └── use-entities.ts                  # Entity-specific wrapper hook

📁 app/entities/
  ├── page.tsx                         # List/Index page
  ├── add/
  │   └── page.tsx                     # Create form page
  └── edit/[id]/
      └── page.tsx                     # Edit form page

📁 types/
  └── index.ts                         # TypeScript type definitions
```

### Shared Generic Files

```
📁 hooks/
  └── use-generic-query.ts             # Reusable for all entities

📁 lib/utils/
  ├── api-client.ts                    # Centralized API requests
  └── error-handler.ts                 # Error handling utilities

📁 lib/mongodb.ts                      # Database connection & caching
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

### 5. Generic Query Hooks with TanStack Query

The application uses generic hooks from `@/hooks/use-generic-query` for all CRUD operations. These hooks integrate TanStack Query with Redux for optimal caching and state management.

#### Generic Hook Pattern:
```typescript
import { useGenericQuery, useGenericCreate, useGenericUpdate, useGenericDelete } from '@/hooks/use-generic-query'

// For fetching lists
const { data: entities, isLoading, error, refetch } = useGenericQuery<Entity>({
  entityName: 'entities',
  baseUrl: '/api/entities',
  reduxDispatchers: {
    setEntities: (entities) => dispatch(setEntities(entities)),
    setPagination: (pagination) => dispatch(setPagination(pagination)),
    setLoading: (loading) => dispatch(setLoading(loading)),
    setError: (error) => dispatch(setError(error))
  }
}, params)

// For mutations
const createMutation = useGenericCreate<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers: { ... } })
const updateMutation = useGenericUpdate<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers: { ... } })
const deleteMutation = useGenericDelete<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers: { ... } })
```

#### Key Features:
- **Automatic Caching**: TanStack Query handles caching, background refetching
- **Redux Integration**: Syncs with Redux for global state management
- **Error Handling**: Consistent error processing with `handleAPIError`
- **Loading States**: Separate loading states for queries and mutations

#### API Data Extraction:
```typescript
// In the hooks, API responses are handled as:
const apiData = response || response.data
// This accommodates APIs that return data directly or wrapped in { data: ... }
```

### 6. Minimal Redux Slice (`store/slices/entitySlice.ts`)

```typescript
import { createSlice } from '@reduxjs/toolkit'

const entitySlice = createSlice({
  name: 'entities',
  initialState: {
    entities: [],
    selectedEntity: null,
    loading: false,
    actionLoading: false,
    error: null,
    pagination: { page: 1, limit: 10, total: 0, pages: 0 }
  },
  reducers: {
    setEntities: (state, action) => { state.entities = action.payload },
    setEntity: (state, action) => { state.selectedEntity = action.payload },
    setPagination: (state, action) => { state.pagination = action.payload },
    setLoading: (state, action) => { state.loading = action.payload },
    setActionLoading: (state, action) => { state.actionLoading = action.payload },
    setError: (state, action) => { state.error = action.payload },
    clearError: (state) => { state.error = null }
  }
})

export const { setEntities, setEntity, setPagination, setLoading, setActionLoading, setError, clearError } = entitySlice.actions
export default entitySlice.reducer
```

### 7. Custom Hook using Generic Hooks (`hooks/use-entities.ts`)

```typescript
import { useGenericQuery, useGenericCreate, useGenericUpdate, useGenericDelete } from '@/hooks/use-generic-query'
import { useAppDispatch } from '@/hooks/redux'
import { setEntities, setEntity, setPagination, setLoading, setActionLoading, setError, clearError } from '@/store/slices/entitySlice'

export function useEntities(params: FetchParams = {}) {
  const dispatch = useAppDispatch()

  const reduxDispatchers = {
    setEntities, setEntity, setPagination, setLoading, setActionLoading, setError, clearError
  }

  const query = useGenericQuery<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers }, params)
  const createMutation = useGenericCreate<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers })
  const updateMutation = useGenericUpdate<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers })
  const deleteMutation = useGenericDelete<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers })

  return {
    entities: query.data,
    isLoading: query.isLoading,
    error: query.error,
    createEntity: createMutation.mutateAsync,
    updateEntity: updateMutation.mutateAsync,
    deleteEntity: deleteMutation.mutateAsync,
    refetch: query.refetch
  }
}
```

---

## Frontend Components

### 8. List Page (`app/entities/page.tsx`)

```tsx
"use client"

import { useEffect } from 'react'
import { useEntities } from '@/hooks/use-entities'
import { handleAPIError } from '@/lib/utils/api-client'

export default function EntitiesPage() {
  const { entities, isLoading, error, refetch } = useEntities()

  useEffect(() => {
    if (error) {
      handleAPIError(error, 'Failed to load entities')
    }
  }, [error])

  useEffect(() => {
    refetch()
  }, [refetch])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading entities</div>

  return (
    <div>
      {entities?.map(entity => (
        <div key={entity._id}>{entity.name}</div>
      ))}
    </div>
  )
}
```

### 9. Create Form (`app/entities/add/page.tsx`)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEntities } from '@/hooks/use-entities'
import { createEntitySchema, CreateEntityData } from '@/lib/validations/entity'
import { handleAPIError } from '@/lib/utils/api-client'

export default function AddEntityPage() {
  const { createEntity } = useEntities()
  const router = useRouter()

  const form = useForm<CreateEntityData>({
    resolver: zodResolver(createEntitySchema),
    defaultValues: { name: '', description: '', status: 'active' }
  })

  const onSubmit = async (data: CreateEntityData) => {
    try {
      await createEntity(data)
      toast({ title: 'Success', description: 'Entity created successfully' })
      router.push('/entities')
    } catch (error) {
      handleAPIError(error, 'Failed to create entity')
    }
  }

  // Render form...
}
```

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
searchable: true,
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
       customClass: {
        popup: 'swal-bg',
        title: 'swal-title',
        htmlContainer: 'swal-content',
      },
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

  // Keep filters in a ref for debounced search
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Memoized values to prevent unnecessary re-renders
  const memoizedFilters = useMemo(() => ({ ...filters }), [filters.search, filters.status])
  const memoizedSort = useMemo(() => ({ ...sort }), [sort.field, sort.direction])
  const memoizedPagination = useMemo(() => ({ ...pagination }), [pagination.page, pagination.limit])

  // Smart fetching - only when parameters change
  const prevParamsRef = useRef<string>('')
  useEffect(() => {
    const paramsKey = JSON.stringify({
      ...memoizedFilters,
      ...memoizedSort,
      ...memoizedPagination
    })

    if (paramsKey !== prevParamsRef.current) {
      prevParamsRef.current = paramsKey
      const fetchParams = {
        page: memoizedPagination.page,
        limit: memoizedPagination.limit,
        filters: memoizedFilters,
        sort: memoizedSort,
      }
      fetchDepartments(fetchParams)
    }
  }, [memoizedFilters, memoizedSort, memoizedPagination, fetchDepartments])

  // Error handling
  useEffect(() => {
    if (error) {
      handleAPIError(error, 'Failed to load departments')
      clearError()
    }
  }, [error, clearError])

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
          searchable: true,
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

## Caching System

### Frontend Caching with TanStack Query:
TanStack Query provides automatic caching, background refetching, and synchronization for all CRUD operations.

#### Key Features:
- **Automatic Cache Management**: No manual cache handling needed
- **Background Refetching**: Data stays fresh automatically
- **Optimistic Updates**: UI updates immediately on mutations
- **Cache Invalidation**: Automatic invalidation on successful mutations

#### Usage:
```typescript
// Queries are automatically cached
const { data, isLoading } = useGenericQuery<Entity>(options, params)

// Mutations invalidate related queries automatically
const createMutation = useGenericCreate<Entity>(options)
```

### Backend Caching:
```typescript
// lib/utils/db-cache.ts - Still used for database-level caching
export async function executeGenericDbQuery<T>(
  queryFn: () => Promise<T>,
  cacheKey?: string,
  ttl: number = 60000
): Promise<T> {
  // Database-level caching logic...
}
```
 */
export function clearCache(pattern: string): void {
  for (const key of dbCache.keys()) {
    if (key.includes(pattern)) {
      dbCache.delete(key)
    }
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  dbCache.clear()
}
```

### Usage in API Routes:
```typescript
// In API routes
const result = await executeGenericDbQuery(async () => {
  // Database operations here
  return await Model.find(query).populate('relations')
}, `cache-key-${params}`, CACHE_TTL)
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

### 1. **Error Handling System**
- **Use `handleAPIError()`**: Always use the centralized error handler for consistent error display
- **Flexible Error Types**: Use `any` type for error parameters to handle different error formats
- **Toast Integration**: Errors automatically display user-friendly messages via toast notifications
- **Validation Error Parsing**: Zod validation errors are automatically parsed and displayed

### 2. **API Client System**
- **Centralized Requests**: All API calls go through `apiRequest()` for consistency
- **Automatic Error Handling**: Built-in error processing and user feedback
- **Type Safety**: Full TypeScript support with proper error typing
- **Request Interception**: Easy to add auth headers, logging, or other middleware

### 3. **Generic Query Hooks with TanStack Query**
- **Use Generic Hooks**: Leverage `useGenericQuery`, `useGenericCreate`, etc. for all CRUD operations
- **Automatic Caching**: TanStack Query handles caching, background refetching automatically
- **Redux Integration**: Sync server state with Redux for global state management
- **API Data Extraction**: Handle responses with `response || response.data` pattern

### 4. **Database Connection & Caching**
- Always use the `executeGenericDbQuery()` wrapper for database operations
- Use descriptive cache keys that include relevant parameters
- Implement appropriate TTL based on data volatility
- Clear relevant cache patterns after mutations using `clearCache()`
- Handle errors with `throw new Error()` inside executeGenericDbQuery functions

### 5. **Smart Fetching Pattern**
- **Automatic with TanStack Query**: Queries automatically refetch when needed
- **Parameter-based Queries**: Pass parameters to generic hooks for automatic dependency tracking
- **Background Updates**: Data stays fresh without manual intervention

### 6. **Minimal Redux State Management**
- **Client State Only**: Use Redux for UI state (filters, selected items, etc.)
- **Server State in TanStack Query**: Let TanStack Query manage server state
- **Simple Slices**: Create minimal slices with basic reducers for Redux integration

### 7. **Custom Hooks**
- **Generic Hook Integration**: Wrap generic hooks for entity-specific logic
- **Redux Dispatchers**: Pass Redux actions to generic hooks for state sync
- **Stable Functions**: Generic hooks provide stable function references automatically

### 8. **API Design**
- Always validate input with Zod schemas
- Use consistent response formats
- Implement proper HTTP status codes
- Add comprehensive error handling with throw statements
- Use middleware for cross-cutting concerns
- Wrap all database operations in `executeGenericDbQuery()` functions

### 9. **Component Architecture**
- **Smart Fetching**: Implement parameter-based fetching to prevent unnecessary API calls
- **Error Boundaries**: Use `handleAPIError` for consistent error handling
- **Loading States**: Proper loading state management
- **Form Validation**: Integrate Zod schemas with React Hook Form

### 10. **Security**
- Always authenticate and authorize API requests
- Validate all inputs on both client and server
- Use rate limiting to prevent abuse
- Implement proper error handling
- Log security-relevant events

### 11. **Performance**
- Use pagination for large datasets
- Implement search and filtering
- Use database indexes effectively
- Leverage intelligent caching with the `executeGenericDbQuery()` system
- Clear cache patterns appropriately after mutations
- Optimize bundle sizes

---

## Implementation Checklist

When creating a new CRUD module, follow this checklist:

### Generic Setup
- [ ] Use generic hooks from `@/hooks/use-generic-query` for all CRUD operations
- [ ] Create minimal Redux slice with basic reducers
- [ ] Wrap generic hooks in entity-specific custom hook
- [ ] Handle API responses with `response || response.data` pattern

### Database Layer
- [ ] Create Mongoose model with proper validation
- [ ] Add appropriate indexes for performance
- [ ] Implement soft delete with status field
- [ ] Add text search indexes if needed

### Validation Layer
- [ ] Define Zod schemas for all operations
- [ ] Create constants for validation rules
- [ ] Implement input sanitization

### API Layer
- [ ] Create endpoints using `executeGenericDbQuery()` wrapper
- [ ] Implement appropriate cache TTL
- [ ] Add cache clearing patterns after mutations
- [ ] Integrate security middleware

### State Management
- [ ] Create minimal Redux slice with basic reducers
- [ ] Use generic hooks for server state management
- [ ] Sync with Redux for global state

### Frontend Components
- [ ] Use generic hooks in components
- [ ] Implement error handling with `handleAPIError`
- [ ] Create list and form pages
- [ ] Add permission-based UI controls

### Testing
- [ ] Test all CRUD operations
- [ ] Test error scenarios
- [ ] Verify permission enforcement

---

## Implementation Steps for New CRUD

### Step 1: Create Database Model
```typescript
// models/Entity.ts
import mongoose from 'mongoose'

export interface IEntity extends Document {
  name: string
  description?: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

const EntitySchema = new Schema<IEntity>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true })

// Add indexes and middleware
EntitySchema.index({ status: 1, createdAt: -1 })
EntitySchema.index({ name: 'text', description: 'text' })

export default mongoose.models.Entity || mongoose.model<IEntity>('Entity', EntitySchema)
```

### Step 2: Create Validation Schemas
```typescript
// lib/validations/entity.ts
export const ENTITY_CONSTANTS = {
  NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  DESCRIPTION: { MAX_LENGTH: 500 },
  STATUS: { VALUES: ['active', 'inactive'] as const, DEFAULT: 'active' as const }
} as const

export const baseEntitySchema = z.object({
  name: z.string().min(ENTITY_CONSTANTS.NAME.MIN_LENGTH).max(ENTITY_CONSTANTS.NAME.MAX_LENGTH),
  description: z.string().max(ENTITY_CONSTANTS.DESCRIPTION.MAX_LENGTH).optional(),
  status: z.enum(ENTITY_CONSTANTS.STATUS.VALUES).default(ENTITY_CONSTANTS.STATUS.DEFAULT)
})

export const createEntitySchema = baseEntitySchema.strict()
export const updateEntitySchema = baseEntitySchema.partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
)
```

### Step 3: Create API Routes
```typescript
// app/api/entities/route.ts
export async function GET(request: NextRequest) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'entities', 'read')
    const { page, limit, search, status, sortBy, sortOrder } = // parse query params
    
    const result = await executeGenericDbQuery(async () => {
      const filter: any = { status: 'active' }
      if (search) filter.$text = { $search: search }
      if (status) filter.status = status
      
      const sort: any = {}
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1
      
      const [entities, total] = await Promise.all([
        Entity.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
        Entity.countDocuments(filter)
      ])
      
      return { entities, total, page, limit }
    }, `entities-list-${page}-${limit}-${search}-${status}-${sortBy}-${sortOrder}`)
    
    return createAPISuccessResponse(result, 'Entities retrieved successfully')
  } catch (error: any) {
    return createAPIErrorResponse("Failed to fetch entities", 500, "FETCH_ERROR")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, user } = await genericApiRoutesMiddleware(request, 'entities', 'create')
    const body = await request.json()
    
    const validation = createEntitySchema.safeParse(body)
    if (!validation.success) {
      return createAPIErrorResponse("Validation failed", 400, "VALIDATION_ERROR", {
        errors: validation.error.errors
      })
    }
    
    const createdEntity = await executeGenericDbQuery(async () => {
      const entity = new Entity(validation.data)
      return await entity.save()
    }, `entity-create-${validation.data.name}`)
    
    clearCache('entities-list')
    return createAPISuccessResponse({ entity: createdEntity }, 'Entity created successfully', 201)
  } catch (error: any) {
    return createAPIErrorResponse("Failed to create entity", 500, "CREATE_ERROR")
  }
}
```

### Step 4: Create Minimal Redux Slice
```typescript
// store/slices/entitySlice.ts
import { createSlice } from '@reduxjs/toolkit'

const entitySlice = createSlice({
  name: 'entities',
  initialState: {
    entities: [],
    selectedEntity: null,
    loading: false,
    actionLoading: false,
    error: null,
    pagination: { page: 1, limit: 10, total: 0, pages: 0 }
  },
  reducers: {
    setEntities: (state, action) => { state.entities = action.payload },
    setEntity: (state, action) => { state.selectedEntity = action.payload },
    setPagination: (state, action) => { state.pagination = action.payload },
    setLoading: (state, action) => { state.loading = action.payload },
    setActionLoading: (state, action) => { state.actionLoading = action.payload },
    setError: (state, action) => { state.error = action.payload },
    clearError: (state) => { state.error = null }
  }
})

export const { setEntities, setEntity, setPagination, setLoading, setActionLoading, setError, clearError } = entitySlice.actions
export default entitySlice.reducer
```

### Step 5: Create Custom Hook using Generic Hooks
```typescript
// hooks/use-entities.ts
import { useGenericQuery, useGenericCreate, useGenericUpdate, useGenericDelete } from '@/hooks/use-generic-query'
import { useAppDispatch } from '@/hooks/redux'
import { setEntities, setEntity, setPagination, setLoading, setActionLoading, setError, clearError } from '@/store/slices/entitySlice'

export function useEntities(params: FetchParams = {}) {
  const dispatch = useAppDispatch()

  const reduxDispatchers = {
    setEntities, setEntity, setPagination, setLoading, setActionLoading, setError, clearError
  }

  const query = useGenericQuery<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers }, params)
  const createMutation = useGenericCreate<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers })
  const updateMutation = useGenericUpdate<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers })
  const deleteMutation = useGenericDelete<Entity>({ entityName: 'entities', baseUrl: '/api/entities', reduxDispatchers })

  return {
    entities: query.data,
    isLoading: query.isLoading,
    error: query.error,
    createEntity: createMutation.mutateAsync,
    updateEntity: updateMutation.mutateAsync,
    deleteEntity: deleteMutation.mutateAsync,
    refetch: query.refetch
  }
}
```

### Step 6: Create Page Components
```tsx
// app/entities/page.tsx
export default function EntitiesPage() {
  const { entities, isLoading, error, refetch } = useEntities()

  useEffect(() => {
    if (error) {
      handleAPIError(error, 'Failed to load entities')
    }
  }, [error])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading entities</div>

  return (
    <div>
      {entities?.map(entity => (
        <div key={entity._id}>{entity.name}</div>
      ))}
    </div>
  )
}
```

---

## Recent Updates & Fixes

### Generic CRUD Implementation
- **TanStack Query Integration**: Replaced custom Redux thunks with TanStack Query for server state management
- **Generic Hooks**: Implemented reusable `useGenericQuery`, `useGenericCreate`, etc. for all entities
- **API Response Handling**: Updated to handle `response || response.data` for flexible API responses
- **Minimal Redux**: Simplified Redux slices to focus on client/UI state only
- **Automatic Caching**: TanStack Query provides automatic caching and invalidation

### Error Handling System Implementation
- **Centralized Error Handler**: Implemented `handleAPIError()` for consistent error display across all components
- **Toast Integration**: Automatic error display with user-friendly messages
- **Validation Error Parsing**: Zod validation errors automatically parsed and displayed

### API Client System
- **Centralized API Requests**: All API calls now go through `apiRequest()` for consistency
- **Automatic Error Processing**: Built-in error handling and user feedback
- **Type Safety**: Full TypeScript support with proper error typing

### Database Connection System
- **executeGenericDbQuery Wrapper**: All database operations wrapped for automatic caching
- **Smart Cache Invalidation**: Pattern-based cache clearing after mutations
- **Performance Optimization**: Reduced database load and faster response times

---

This guide provides a comprehensive blueprint for implementing secure, scalable CRUD operations in the DepLLC CRM system using TanStack Query and generic hooks. By following these patterns and practices, you ensure consistency, security, and maintainability across all modules.

The generic CRUD implementation with TanStack Query provides:
- **Automatic Caching**: No manual cache management needed
- **Background Refetching**: Data stays fresh automatically
- **Optimistic Updates**: UI updates immediately on mutations
- **Error Handling**: Consistent error processing with `handleAPIError`
- **Type Safety**: Full TypeScript support with generic hooks
- **Performance**: Reduced API calls and improved user experience

The department module serves as the reference implementation, demonstrating how the generic hooks work together with Redux to create a robust, production-ready CRUD system with enterprise-level security and performance characteristics.

## Recent Updates & Fixes

### Users CRUD Migration (October 2025)
- **Migration Completed**: Successfully migrated Users CRUD to TanStack Query generic approach, following the Department blueprint.
- **Key Changes**:
  - Updated `use-users.ts` to use `useGenericQuery`, `useGenericQueryById`, `useGenericCreate`, `useGenericUpdate`, `useGenericDelete`.
  - Simplified `userSlice.ts` to handle only UI state (filters, pagination, selected user).
  - Updated components (`users/page.tsx`, `users/edit/[id]/page.tsx`, `users/add/page.tsx`) to leverage TanStack Query's automatic fetching and caching.
  - Integrated flexible API response handling (`response || response.data`) for consistent data extraction.
  - Added memoization for query params to prevent infinite re-renders.
  - Fixed loading states to combine TanStack Query and Redux states.

### Errors Faced & Solutions

1. **API Parameter Formatting Issues**:
   - **Error**: API calls failed due to incorrect parameter transformation (e.g., `sortBy`/`sortOrder` vs. `sort.field`/`sort.direction`).
   - **Solution**: Updated `useGenericQuery` to properly transform params: `apiParams.sortBy = params.sort.field; apiParams.sortOrder = params.sort.direction;`.

2. **Infinite Re-renders**:
   - **Error**: Components re-rendered infinitely due to non-memoized query keys and params.
   - **Solution**: Used `useMemo` for query keys and params in `useGenericQuery` and custom hooks. Disabled stale time for fresh data.

3. **Loading State Inconsistencies**:
   - **Error**: Loading states didn't reflect actual data fetching, causing UI issues.
   - **Solution**: Combined TanStack Query loading states (`isLoading`, `userByIdLoading`) with Redux states. Updated components to use combined loading.

4. **Role Fetching Errors in Add/Edit Pages**:
   - **Error**: `fetchRolesByDepartment` failed with "undefined" or incorrect response handling.
   - **Solution**: Added ObjectId validation before API calls. Updated response handling to check for arrays or success/data structures. Used `form.setValue` after roles load to ensure role selection.

5. **User Data Not Loading in Edit Page**:
   - **Error**: Form fields remained empty; `selectedUser` not set properly.
   - **Solution**: Ensured `useGenericQueryById` correctly extracts entity from API response. Added logging and error handling. Used combined loading to prevent premature rendering.

6. **React Warning: Uncontrolled to Controlled Input**:
   - **Error**: Warning about input changing from uncontrolled to controlled.
   - **Solution**: Provided valid default values for all form fields to ensure controlled state from start.

7. **Department/Role Not Selected in Edit Form**:
   - **Error**: Saved department and role not displayed in edit form.
   - **Solution**: Set form values after roles are fetched using `form.setValue`. Ensured roles API returns data in expected format.

### Best Practices from Migration
- Always memoize query params and keys to prevent infinite loops.
- Use combined loading states for accurate UI feedback.
- Validate API responses and handle different formats flexibly.
- Test form population and selection after data loading.
- Integrate error handling with existing `handleAPIError` system.
- Ensure stable callbacks and avoid unnecessary re-renders.






