"use client"

import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { useThemeVariant } from '@/components/theme-variant-provider'

/**
 * Hook to sync theme variant colors with next-themes mode changes
 * This ensures proper color application when toggling between light and dark modes
 */
export function useThemeSync() {
  const { theme, systemTheme, resolvedTheme } = useTheme()
  const { syncTheme, currentVariant } = useThemeVariant()

  useEffect(() => {
    // Sync theme colors whenever the resolved theme changes
    if (resolvedTheme) {      
      // Small delay to ensure the DOM classes are updated
      setTimeout(() => {
        syncTheme()
      }, 50)
    }
  }, [resolvedTheme, syncTheme])

  useEffect(() => {
    // Also sync when the theme variant changes
    if (currentVariant) {      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        syncTheme()
      }, 50)
    }
  }, [currentVariant, syncTheme])

  // Return current theme info for debugging
  return {
    theme,
    systemTheme,
    resolvedTheme,
    currentVariant,
    isDark: resolvedTheme === 'dark'
  }
}