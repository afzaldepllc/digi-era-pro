"use client"

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Performance monitoring hook for navigation
export function usePerformanceMonitor() {
  const pathname = usePathname()
  const navigationStartRef = useRef<number>()

  useEffect(() => {
    // Mark navigation start
    navigationStartRef.current = performance.now()

    // Measure when navigation completes
    const timer = setTimeout(() => {
      const navigationEnd = performance.now()
      const navigationTime = navigationEnd - (navigationStartRef.current || navigationEnd)
      
      if (navigationTime > 100) {
        console.warn(`Slow navigation to ${pathname}: ${navigationTime.toFixed(2)}ms`)
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [pathname])
}

// Performance optimization component
export function PerformanceOptimizer() {
  usePerformanceMonitor()

  useEffect(() => {
    // Prefetch critical resources
    const criticalResources = [
      '/api/auth/session',
      '/api/settings/themes',
    ]

    criticalResources.forEach(resource => {
      if (typeof window !== 'undefined') {
        // Use link prefetch for API routes
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = resource
        document.head.appendChild(link)
      }
    })

    // Cleanup function
    return () => {
      if (typeof window !== 'undefined') {
        document.querySelectorAll('link[rel="prefetch"]').forEach(link => {
          if (criticalResources.some(resource => link.getAttribute('href')?.includes(resource))) {
            link.remove()
          }
        })
      }
    }
  }, [])

  return null
}