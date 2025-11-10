"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useNavigation } from "@/components/providers/navigation-provider";

export interface NavigationOptions {
  replace?: boolean
  scroll?: boolean
}

export function useOptimizedNavigation() {
  const router = useRouter();
  const pathname = usePathname()
  const { navigateTo: contextNavigateTo } = useNavigation()

  // Memoize current path info
  const pathInfo = useMemo(() => {
    const currentPath = pathname || '/'
    const segments = currentPath.split('/').filter(Boolean)
    return {
      segments,
      isRoot: segments.length === 0,
      current: currentPath,
      parent: segments.length > 1 ? '/' + segments.slice(0, -1).join('/') : '/',
    }
  }, [pathname])

  // Ultra-fast navigation with visual feedback
  const navigateTo = useCallback((
    path: string, 
    options: NavigationOptions = {}
  ) => {
    const { replace = false, scroll = true } = options

    // Don't navigate if already on the same page
    if (path === pathname) return

    // Use context navigation for instant visual feedback
    contextNavigateTo(path)
  }, [pathname, contextNavigateTo])

  // Back navigation with fallback
  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }, [router])

  // Check if path is active (useful for navigation highlights)
  const isActive = useCallback((path: string, exact = false) => {
    const currentPath = pathname || '/'
    if (exact) {
      return currentPath === path
    }
    return currentPath.startsWith(path)
  }, [pathname])

  return {
    navigateTo,
    goBack,
    isActive,
    pathInfo,
    currentPath: pathname,
    router
  };
}