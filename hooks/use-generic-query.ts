import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { apiRequest, handleAPIError } from "@/lib/utils/api-client"
import { useAppDispatch } from "@/hooks/redux"

// Generic types for entities
export interface GenericEntity {
  _id?: string
  [key: string]: any
}

export interface FetchParams {
  page?: number
  limit?: number
  filters?: Record<string, any>
  sort?: { field: string; direction: 'asc' | 'desc' }
}

export interface MutationData {
  [key: string]: any
}

// Generic hook options
export interface UseGenericQueryOptions<T extends GenericEntity> {
  entityName: string
  baseUrl: string
  reduxDispatchers?: {
    setEntities?: (entities: T[]) => void
    setEntity?: (entity: T | null) => void
    setPagination?: (pagination: any) => void
    setStats?: (stats: any) => void
    setLoading?: (loading: boolean) => void
    setActionLoading?: (loading: boolean) => void
    setError?: (error: any) => void
    clearError?: () => void
  }
}

// Generic query hook for fetching lists
export function useGenericQuery<T extends GenericEntity>(
  options: UseGenericQueryOptions<T>,
  params: FetchParams = {},
  enabled: boolean = true
) {
  const dispatch = useAppDispatch()
  const { entityName, baseUrl, reduxDispatchers } = options

  // Create a stable query key that properly differentiates between different param combinations
  const queryKey = useMemo(() => [
    entityName,
    params.page || 1,
    params.limit || 10,
    params.filters || {},
    params.sort || {}
  ], [entityName, params.page, params.limit, params.filters, params.sort])

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        reduxDispatchers?.setLoading?.(true)

        // Transform params to match API expectations
        const apiParams: Record<string, string> = {
          page: params.page?.toString() || '1',
          limit: params.limit?.toString() || '10',
        }

        // Add filters
        if (params.filters) {
          Object.entries(params.filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              apiParams[key] = value.toString()
            }
          })
        }

        // Transform sort parameter
        if (params.sort) {
          apiParams.sortBy = params.sort.field
          apiParams.sortOrder = params.sort.direction
        }

        const response = await apiRequest(`${baseUrl}?${new URLSearchParams(apiParams).toString()}`)
        const apiData = response || response?.data


        // Handle null/undefined responses
        if (!apiData) {
          reduxDispatchers?.setEntities?.([])
          reduxDispatchers?.setLoading?.(false)
          return []
        }

        // Handle different response structures
        let entities = []
        let pagination = null
        let stats = null

        if (apiData && typeof apiData === 'object' && !Array.isArray(apiData)) {
          // Check if data is nested (users/projects pattern)
          if (apiData.data && typeof apiData.data === 'object') {
            const nestedData = apiData.data
            // Look for entity array in nested data
            entities = nestedData[entityName] || nestedData.users || nestedData.projects || nestedData.departments || []
            pagination = nestedData.pagination || apiData.pagination
            stats = nestedData.stats || apiData.stats
          } else {
            // Direct structure (legacy)
            entities = apiData.departments || apiData[entityName] || apiData || []
            pagination = apiData.pagination
            stats = apiData.stats
          }
        } else if (Array.isArray(apiData)) {
          entities = apiData
        }

        const finalEntities = Array.isArray(entities) ? entities : [entities].filter(Boolean)
        reduxDispatchers?.setEntities?.(finalEntities)

        // Set pagination if available
        if (pagination) {
          reduxDispatchers?.setPagination?.(pagination)
        }

        // Set stats if available
        if (stats) {
          reduxDispatchers?.setStats?.(stats)
        }

        reduxDispatchers?.setLoading?.(false)
        return finalEntities
      } catch (error) {
        console.error(`Error fetching ${entityName}:`, error)
        reduxDispatchers?.setError?.(error)
        reduxDispatchers?.setLoading?.(false)
        handleAPIError(error, `Failed to fetch ${entityName}`)
        throw error
      }
    },
    enabled,
    staleTime: 0, // Disable stale time to always fetch fresh data
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    retry: false, // Disable retries to prevent infinite loops
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: true, // Always refetch on mount
  })

  return {
    ...query,
    data: query.data as T[] | undefined,
    refetch: useCallback(() => query.refetch(), [query]),
  }
}

// Generic query hook for fetching single entity
export function useGenericQueryById<T extends GenericEntity>(
  options: UseGenericQueryOptions<T>,
  id: string | undefined,
  enabled: boolean = true
) {
  const dispatch = useAppDispatch()
  const { entityName, baseUrl, reduxDispatchers } = options

  const queryKey = [entityName, id]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) throw new Error('ID is required')
      try {
        reduxDispatchers?.setLoading?.(true)
        const response = await apiRequest(`${baseUrl}/${id}`)
        const apiData = response || response.data



        console.log('API Data for single response:162', response);
        console.log('API Data for single entity:163', apiData);
        // Handle different response structures
        let entity = apiData
        if (apiData && typeof apiData === 'object' && !Array.isArray(apiData)) {
          // For single entity responses, check if it's wrapped in a success/data structure
          if (apiData.success && apiData.data) {
            entity = apiData.data
          }
          // Otherwise, assume apiData is already the entity
        }

        reduxDispatchers?.setEntity?.(entity)
        reduxDispatchers?.setLoading?.(false)
        return entity
      } catch (error) {
        reduxDispatchers?.setError?.(error)
        reduxDispatchers?.setLoading?.(false)
        handleAPIError(error, `Failed to fetch ${entityName}`)
        throw error
      }
    },
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5,
  })

  return {
    ...query,
    data: query.data as T | undefined,
  }
}

// Generic mutation hook for create
export function useGenericCreate<T extends GenericEntity>(
  options: UseGenericQueryOptions<T>
) {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const { entityName, baseUrl, reduxDispatchers } = options

  return useMutation({
    mutationFn: async (data: MutationData) => {
      try {
        reduxDispatchers?.setActionLoading?.(true)
        const response = await apiRequest(baseUrl, {
          method: 'POST',
          body: JSON.stringify(data)
        })
        reduxDispatchers?.setActionLoading?.(false)
        return response.data?.data || response.data
      } catch (error) {
        reduxDispatchers?.setError?.(error)
        reduxDispatchers?.setActionLoading?.(false)
        handleAPIError(error, `Failed to create ${entityName}`)
        throw error
      }
    },
    onSuccess: () => {
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: [entityName] })
      reduxDispatchers?.clearError?.()
    },
  })
}

// Generic mutation hook for update
export function useGenericUpdate<T extends GenericEntity>(
  options: UseGenericQueryOptions<T>
) {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const { entityName, baseUrl, reduxDispatchers } = options

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MutationData }) => {
      try {
        reduxDispatchers?.setActionLoading?.(true)
        const response = await apiRequest(`${baseUrl}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        })
        reduxDispatchers?.setActionLoading?.(false)
        return response.data?.data || response.data
      } catch (error) {
        reduxDispatchers?.setError?.(error)
        reduxDispatchers?.setActionLoading?.(false)
        handleAPIError(error, `Failed to update ${entityName}`)
        throw error
      }
    },
    onSuccess: (_, { id }) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [entityName] })
      queryClient.invalidateQueries({ queryKey: [entityName, id] })
      reduxDispatchers?.clearError?.()
    },
  })
}

// Generic mutation hook for delete
export function useGenericDelete<T extends GenericEntity>(
  options: UseGenericQueryOptions<T>
) {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const { entityName, baseUrl, reduxDispatchers } = options

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        reduxDispatchers?.setActionLoading?.(true)
        await apiRequest(`${baseUrl}/${id}`, {
          method: 'DELETE'
        })
        reduxDispatchers?.setActionLoading?.(false)
      } catch (error) {
        reduxDispatchers?.setError?.(error)
        reduxDispatchers?.setActionLoading?.(false)
        handleAPIError(error, `Failed to delete ${entityName}`)
        throw error
      }
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [entityName] })
      reduxDispatchers?.clearError?.()
    },
  })
}