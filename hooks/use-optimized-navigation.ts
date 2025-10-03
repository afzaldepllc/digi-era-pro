"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useOptimizedNavigation() {
  const router = useRouter();

  // Optimized navigation with prefetching
  const navigateTo = useCallback((path: string) => {
    // Start prefetching the route
    router.prefetch(path);
    
    // Navigate immediately
    router.push(path);
  }, [router]);

  // Prefetch common routes on component mount
  const prefetchCommonRoutes = useCallback(() => {
    const commonRoutes = [
      '/dashboard',
      '/users',
      '/projects',
      '/departments'
    ];
    
    commonRoutes.forEach(route => {
      router.prefetch(route);
    });
  }, [router]);

  return {
    navigateTo,
    prefetchCommonRoutes,
    router
  };
}

// Custom hook for navigation loading state
export function useNavigationLoading() {
  return {
    isLoading: false // We'll manage this more efficiently
  };
}