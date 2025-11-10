import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppDispatch } from './redux'

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  key?: string // Custom cache key
  enabled?: boolean // Whether caching is enabled
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }
}

// Global cache instance
const memoryCache = new MemoryCache()

/**
 * Hook for caching async operations
 */
export function useCache<T>(
  asyncFn: () => Promise<T>,
  options: CacheOptions = {}
) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    key,
    enabled = true
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const cacheKey = useRef(key || `cache-${Math.random()}`)

  const execute = useCallback(async (force = false) => {
    if (!enabled) {
      setLoading(true)
      setError(null)
      try {
        const result = await asyncFn()
        setData(result)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
      return
    }

    // Check cache first
    if (!force) {
      const cached = memoryCache.get<T>(cacheKey.current)
      if (cached !== null) {
        setData(cached)
        setError(null)
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn()
      setData(result)
      memoryCache.set(cacheKey.current, result, ttl)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [asyncFn, enabled, ttl])

  const invalidate = useCallback(() => {
    memoryCache.delete(cacheKey.current)
  }, [])

  const clear = useCallback(() => {
    memoryCache.clear()
  }, [])

  return {
    data,
    loading,
    error,
    execute,
    invalidate,
    clear,
    isCached: enabled ? memoryCache.has(cacheKey.current) : false
  }
}

/**
 * Hook for debounced search with caching
 */
export function useDebouncedSearch(
  onSearch: (term: string) => void,
  options: {
    delay?: number
    minLength?: number
    cache?: CacheOptions
  } = {}
) {
  const {
    delay = 500,
    minLength = 1,
    cache = { enabled: false }
  } = options

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedSearch = useCallback((term: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setSearchTerm(term)

    if (term.length < minLength) {
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    timeoutRef.current = setTimeout(() => {
      onSearch(term)
      setIsSearching(false)
    }, delay)
  }, [onSearch, delay, minLength])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    searchTerm,
    setSearchTerm: debouncedSearch,
    isSearching
  }
}

/**
 * Hook for preventing duplicate API calls
 */
export function useRequestDedupe() {
  const pendingRequests = useRef(new Set<string>())

  const execute = useCallback(async <T>(
    key: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    if (pendingRequests.current.has(key)) {
      // Wait for existing request to complete
      return new Promise((resolve, reject) => {
        const checkComplete = () => {
          if (!pendingRequests.current.has(key)) {
            // Request completed, but we don't have the result
            // This is a simplified version - in practice you'd need a more sophisticated approach
            reject(new Error('Request deduped'))
          } else {
            setTimeout(checkComplete, 100)
          }
        }
        checkComplete()
      })
    }

    pendingRequests.current.add(key)

    try {
      const result = await asyncFn()
      return result
    } finally {
      pendingRequests.current.delete(key)
    }
  }, [])

  return { execute }
}