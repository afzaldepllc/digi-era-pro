# Performance Analysis and Optimization Guide - DepLLC CRM

## Current Performance Issues Analysis

Based on the network requests and code analysis, here are the main performance bottlenecks:

### 1. **Multiple API Requests on Page Load**
**Issue**: The departments page is making multiple simultaneous requests:
- `departments?page=1&limit=100&sortBy=name&sortOrder=asc` (for dropdown/filters)
- `departments?page=1&limit=10&sortBy=createdAt&sortOrder=desc` (for table data)
- Multiple polling requests (`ioEIO=4&transport=polling`)
- Dashboard and other component requests

**Impact**: 5+ seconds total load time due to waterfall requests and duplicate API calls.

### 2. **Client-Side Rendering Issues**
**Issue**: All pages are using `"use client"` directive, causing:
- Large JavaScript bundles
- Client-side data fetching
- No SSR benefits
- Poor Core Web Vitals

### 3. **Inefficient State Management**
**Issue**: Mixing TanStack Query with Redux causing:
- Duplicate state management
- Unnecessary re-renders
- Complex state synchronization
- Memory leaks

### 4. **Database Query Inefficiencies**
**Issue**: Multiple database queries per request:
- Departments query
- Count query  
- Stats query
- No proper aggregation

### 5. **No Caching Strategy**
**Issue**: 
- No HTTP caching headers
- Client-side cache invalidation issues
- No CDN optimization
- Repeated API calls

---

## Complete Optimization Strategy

### Phase 1: Server-Side Rendering (SSR) Implementation

#### 1.1 Convert Pages to Server Components

**Before (Client Component):**
```typescript
"use client";
export default function DepartmentsPage() {
  // Client-side data fetching
}
```

**After (Server Component):**
```typescript
// app/departments/page.tsx
import { getDepartments, getDepartmentStats } from '@/lib/data/departments'
import DepartmentsClient from './departments-client'

interface PageProps {
  searchParams: {
    page?: string
    limit?: string
    search?: string
    status?: string
    sortBy?: string
    sortOrder?: string
  }
}

export default async function DepartmentsPage({ searchParams }: PageProps) {
  // Server-side data fetching
  const params = {
    page: parseInt(searchParams.page || '1'),
    limit: parseInt(searchParams.limit || '10'),
    search: searchParams.search || '',
    status: searchParams.status || '',
    sortBy: searchParams.sortBy || 'createdAt',
    sortOrder: searchParams.sortOrder || 'desc'
  }

  // Parallel data fetching
  const [departmentsData, stats] = await Promise.all([
    getDepartments(params),
    getDepartmentStats()
  ])

  return (
    <DepartmentsClient 
      initialData={departmentsData}
      initialStats={stats}
      initialParams={params}
    />
  )
}

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Departments | DepLLC CRM',
    description: 'Manage departments in your organization'
  }
}
```

#### 1.2 Create Server-Side Data Fetching Functions

```typescript
// lib/data/departments.ts
import { connectDB } from '@/lib/mongodb'
import Department from '@/models/Department'
import { unstable_cache } from 'next/cache'

export const getDepartments = unstable_cache(
  async (params: any) => {
    await connectDB()
    
    const { page, limit, search, status, sortBy, sortOrder } = params
    
    // Single aggregation query instead of multiple queries
    const pipeline = [
      // Match stage
      {
        $match: {
          status: { $ne: 'deleted' },
          ...(status && status !== 'all' && { status }),
          ...(search && {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } }
            ]
          })
        }
      },
      // Facet stage for pagination and stats
      {
        $facet: {
          departments: [
            { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          totalCount: [{ $count: 'count' }],
          stats: [
            {
              $group: {
                _id: null,
                totalDepartments: { $sum: 1 },
                activeDepartments: {
                  $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                inactiveDepartments: {
                  $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
                }
              }
            }
          ]
        }
      }
    ]

    const [result] = await Department.aggregate(pipeline)
    
    const total = result.totalCount[0]?.count || 0
    const pages = Math.ceil(total / limit)
    
    return {
      departments: result.departments,
      pagination: { page, limit, total, pages },
      stats: result.stats[0] || {
        totalDepartments: 0,
        activeDepartments: 0,
        inactiveDepartments: 0
      }
    }
  },
  ['departments'],
  {
    revalidate: 60, // Cache for 1 minute
    tags: ['departments']
  }
)

export const getDepartmentStats = unstable_cache(
  async () => {
    await connectDB()
    
    const stats = await Department.aggregate([
      {
        $match: { status: { $ne: 'deleted' } }
      },
      {
        $group: {
          _id: null,
          totalDepartments: { $sum: 1 },
          activeDepartments: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          inactiveDepartments: {
            $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
          }
        }
      }
    ])
    
    return stats[0] || {
      totalDepartments: 0,
      activeDepartments: 0,
      inactiveDepartments: 0
    }
  },
  ['department-stats'],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['departments', 'stats']
  }
)
```

#### 1.3 Client Component for Interactivity

```typescript
// app/departments/departments-client.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Department } from '@/types'

interface Props {
  initialData: any
  initialStats: any
  initialParams: any
}

export default function DepartmentsClient({ 
  initialData, 
  initialStats, 
  initialParams 
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  // Use initial data immediately, no loading state
  const [data, setData] = useState(initialData)
  const [stats, setStats] = useState(initialStats)

  // Optimistic updates for filters
  const updateFilters = (newParams: Record<string, string>) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      
      // Reset page when filters change
      if (newParams.page === undefined) {
        params.delete('page')
      }
      
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - No loading state needed */}
      <StatsCards stats={stats} />
      
      {/* Filters - Immediate response */}
      <FiltersSection 
        onFilterChange={updateFilters}
        isPending={isPending}
      />
      
      {/* Table - Shows initial data, updates via navigation */}
      <DataTable 
        data={data.departments}
        pagination={data.pagination}
        onPageChange={(page) => updateFilters({ page: page.toString() })}
        isPending={isPending}
      />
    </div>
  )
}
```

### Phase 2: API Route Optimization

#### 2.1 Optimize Database Queries

```typescript
// app/api/departments/route.ts
export async function GET(request: NextRequest) {
  try {
    // Use server-side caching
    return NextResponse.json(
      await getDepartments(parsedParams),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'CDN-Cache-Control': 'public, s-maxage=300',
        }
      }
    )
  } catch (error) {
    return handleAPIError(error)
  }
}
```

#### 2.2 Implement Proper HTTP Caching

```typescript
// lib/cache-headers.ts
export const getCacheHeaders = (type: 'static' | 'dynamic' | 'user-specific') => {
  switch (type) {
    case 'static':
      return {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000'
      }
    case 'dynamic':
      return {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'CDN-Cache-Control': 'public, s-maxage=300'
      }
    case 'user-specific':
      return {
        'Cache-Control': 'private, max-age=60',
        'Vary': 'Authorization'
      }
  }
}
```

### Phase 3: State Management Optimization

#### 3.1 Simplify State Management (Remove Redux for Simple Cases)

```typescript
// hooks/use-departments-optimized.ts
'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { revalidateTag } from 'next/cache'

export function useDepartments(initialData: any) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [optimisticData, addOptimistic] = useOptimistic(
    data.departments,
    (state, optimisticValue: any) => {
      switch (optimisticValue.type) {
        case 'CREATE':
          return [optimisticValue.department, ...state]
        case 'UPDATE':
          return state.map(item => 
            item._id === optimisticValue.department._id 
              ? optimisticValue.department 
              : item
          )
        case 'DELETE':
          return state.filter(item => item._id !== optimisticValue.id)
        default:
          return state
      }
    }
  )

  const createDepartment = async (departmentData: any) => {
    // Optimistic update
    addOptimistic({ 
      type: 'CREATE', 
      department: { 
        ...departmentData, 
        _id: 'temp-' + Date.now(),
        createdAt: new Date(),
        updatedAt: new Date()
      } 
    })

    startTransition(async () => {
      try {
        const response = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(departmentData)
        })

        if (!response.ok) throw new Error('Failed to create')

        // Revalidate server cache
        revalidateTag('departments')
        
        // Refresh page data
        window.location.reload()
      } catch (error) {
        // Revert optimistic update on error
        setData(data) 
        throw error
      }
    })
  }

  return {
    departments: optimisticData,
    createDepartment,
    isPending
  }
}
```

### Phase 4: Bundle Optimization

#### 4.1 Code Splitting and Lazy Loading

```typescript
// app/departments/page.tsx
import { lazy, Suspense } from 'react'
import DepartmentsSkeleton from './loading'

const DepartmentsClient = lazy(() => import('./departments-client'))
const CreateDepartmentModal = lazy(() => import('./create-department-modal'))

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const data = await getDepartments(searchParams)

  return (
    <div>
      <Suspense fallback={<DepartmentsSkeleton />}>
        <DepartmentsClient initialData={data} />
      </Suspense>
      
      <Suspense fallback={null}>
        <CreateDepartmentModal />
      </Suspense>
    </div>
  )
}
```

#### 4.2 Optimize Bundle Size

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable SWC minification
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000,
  },
  
  // Enable experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'lodash'
    ],
  },
  
  // Bundle analyzer
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks.chunks = 'all'
      config.optimization.splitChunks.cacheGroups = {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        }
      }
    }
    return config
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  }
}

export default nextConfig
```

### Phase 5: Database Optimization

#### 5.1 Connection Pooling

```typescript
// lib/mongodb-optimized.ts
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI environment variable')
}

interface CachedConnection {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongoose: CachedConnection | undefined
}

let cached: CachedConnection = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      compressors: 'zlib', // Enable compression
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB connected successfully')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}
```

#### 5.2 Optimized Database Indexes

```typescript
// models/Department.ts
// Add compound indexes for common queries
DepartmentSchema.index({ status: 1, createdAt: -1 }) // List with status filter
DepartmentSchema.index({ status: 1, name: 1 }) // Search with status
DepartmentSchema.index({ createdAt: -1 }) // Recent first
DepartmentSchema.index({ updatedAt: -1 }) // Recently updated
```

### Phase 6: Frontend Performance

#### 6.1 Optimize React Rendering

```typescript
// components/departments/department-table.tsx
import { memo, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'

const DepartmentRow = memo(({ index, style, data }) => (
  <div style={style} className="flex items-center p-4 border-b">
    {/* Department row content */}
  </div>
))

export const DepartmentTable = memo(({ departments, onSort, onSelect }) => {
  const memoizedColumns = useMemo(() => [
    // Column definitions
  ], [])

  // Virtual scrolling for large datasets
  if (departments.length > 100) {
    return (
      <List
        height={600}
        itemCount={departments.length}
        itemSize={60}
        itemData={departments}
      >
        {DepartmentRow}
      </List>
    )
  }

  // Regular table for smaller datasets
  return (
    <table>
      {/* Table content */}
    </table>
  )
})
```

#### 6.2 Debounced Search

```typescript
// hooks/use-debounced-search.ts
import { useState, useEffect } from 'react'

export function useDebouncedSearch(initialValue: string, delay: number = 300) {
  const [value, setValue] = useState(initialValue)
  const [debouncedValue, setDebouncedValue] = useState(initialValue)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return [debouncedValue, setValue] as const
}
```

---

## Performance Monitoring

### 1. Core Web Vitals Monitoring

```typescript
// lib/performance.ts
export function measurePerformance() {
  if (typeof window !== 'undefined') {
    // Measure LCP
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1]
      console.log('LCP:', lastEntry.startTime)
    }).observe({ entryTypes: ['largest-contentful-paint'] })

    // Measure CLS
    new PerformanceObserver((entryList) => {
      let clsValue = 0
      entryList.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
        }
      })
      console.log('CLS:', clsValue)
    }).observe({ entryTypes: ['layout-shift'] })

    // Measure FID
    new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        console.log('FID:', entry.processingStart - entry.startTime)
      })
    }).observe({ entryTypes: ['first-input'] })
  }
}
```

### 2. Database Query Monitoring

```typescript
// lib/query-monitor.ts
export function monitorQuery(queryName: string, startTime: number) {
  const endTime = Date.now()
  const duration = endTime - startTime
  
  if (duration > 1000) {
    console.warn(`Slow query detected: ${queryName} took ${duration}ms`)
  }
  
  // Log to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to monitoring service (DataDog, New Relic, etc.)
  }
}
```

---

## Implementation Timeline

### Week 1: Core Infrastructure
- [ ] Convert main pages to Server Components
- [ ] Implement server-side data fetching functions
- [ ] Set up proper caching headers
- [ ] Optimize database queries

### Week 2: State Management
- [ ] Remove unnecessary Redux usage
- [ ] Implement optimistic updates
- [ ] Add proper loading states
- [ ] Optimize re-renders

### Week 3: Bundle & Performance
- [ ] Implement code splitting
- [ ] Optimize images and assets
- [ ] Add performance monitoring
- [ ] Database connection pooling

### Week 4: Testing & Monitoring
- [ ] Performance testing
- [ ] Core Web Vitals optimization
- [ ] Production deployment
- [ ] Monitor and fine-tune

---

## Expected Performance Improvements

After implementing these optimizations:

1. **Page Load Time**: 5 seconds → 0.5-1 second
2. **Navigation Speed**: 2-3 seconds → 100-200ms
3. **API Response Time**: 1-2 seconds → 100-300ms
4. **Bundle Size**: Reduced by 40-60%
5. **Core Web Vitals**: All metrics in "Good" range

---

## Maintenance Best Practices

1. **Regular Performance Audits**: Monthly Lighthouse audits
2. **Database Query Monitoring**: Alert on queries > 500ms
3. **Bundle Size Monitoring**: Alert on 10%+ bundle increase
4. **Cache Hit Rate Monitoring**: Target 90%+ cache hit rate
5. **Error Rate Monitoring**: Target <0.1% error rate

This comprehensive optimization will transform your app from a slow, client-heavy application to a fast, server-rendered, production-ready CRM system.