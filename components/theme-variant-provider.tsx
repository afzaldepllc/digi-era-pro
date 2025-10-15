import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// TypeScript interfaces for theme system
interface ThemeColors {
  primary: string
  'primary-foreground': string
  secondary: string
  'secondary-foreground': string
  accent: string
  'accent-foreground': string
  muted: string
  'muted-foreground': string
  background: string
  foreground: string
  card: string
  'card-foreground': string
  border: string
  input: string
  ring: string
  destructive: string
  'destructive-foreground': string
  'sidebar-background': string
  'sidebar-foreground': string
  'sidebar-primary': string
  'sidebar-primary-foreground': string
  'sidebar-accent': string
  'sidebar-accent-foreground': string
  'sidebar-border': string
  'sidebar-ring': string
}

interface ThemeVariant {
  name: string
  description: string
  light: ThemeColors
  dark: ThemeColors
}

interface ThemeConfig {
  currentTheme: string
  themeConfig: ThemeVariant
  variants: Record<string, ThemeVariant>
  availableThemes: string[]
  timestamp: string
}

interface ThemeVariantContextType {
  currentVariant: string
  setVariant: (variant: string) => Promise<boolean>
  availableVariants: string[]
  getThemeConfig: (variant?: string) => ThemeVariant | null
  isLoading: boolean
  error: string | null
  refreshTheme: () => Promise<void>
}

const ThemeVariantContext = createContext<ThemeVariantContextType | undefined>(undefined)

export function useThemeVariant() {
  const context = useContext(ThemeVariantContext)
  if (context === undefined) {
    throw new Error('useThemeVariant must be used within a ThemeVariantProvider')
  }
  return context
}

interface ThemeVariantProviderProps {
  children: React.ReactNode
  defaultVariant?: string
}

export function ThemeVariantProvider({ 
  children, 
  defaultVariant = 'default' 
}: ThemeVariantProviderProps) {
  const [currentVariant, setCurrentVariant] = useState(defaultVariant)
  const [themeConfig, setThemeConfig] = useState<Record<string, ThemeVariant> | null>(null)
  const [availableVariants, setAvailableVariants] = useState<string[]>(['default', 'ocean', 'forest', 'sunset', 'coral', 'amber'])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<string>('')
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // Apply CSS custom properties for the current theme variant
  const applyThemeVariant = useCallback((variant: string, config?: ThemeVariant) => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const isDark = root.classList.contains('dark')
    
    let themeColors = config
    if (!themeColors && themeConfig?.[variant]) {
      themeColors = themeConfig[variant]
    }

    if (themeColors) {
      const colors = isDark ? themeColors.dark : themeColors.light
      
      // Apply CSS custom properties
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value as string)
      })

      // Log theme application for debugging
      console.log(`🎨 Applied theme variant: ${variant} (${isDark ? 'dark' : 'light'} mode)`)
    } else {
      console.warn(`⚠️ Theme variant '${variant}' not found, falling back to default`)
      // Apply default theme if variant not found
      if (themeConfig?.['default']) {
        const defaultColors = isDark ? themeConfig['default'].dark : themeConfig['default'].light
        Object.entries(defaultColors).forEach(([key, value]) => {
          root.style.setProperty(`--${key}`, value as string)
        })
      }
    }
  }, [themeConfig])

  // Fetch theme from global API (accessible to all users)
  const fetchTheme = useCallback(async () => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTime
    
    // Rate limit: Don't fetch more than once every 2 seconds
    if (timeSinceLastFetch < 2000) {
      console.log('🚫 Theme fetch rate limited, skipping...')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setLastFetchTime(now)
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const response = await fetch('/api/public/themes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache', // Always fetch fresh data
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const { currentTheme, variants, availableThemes, timestamp } = data.data
          
          // Only update if we have new data and it's not conflicting with recent user changes
          if (timestamp !== lastFetchTimestamp) {
            setThemeConfig(variants)
            setAvailableVariants(availableThemes || ['default'])
            
            // Only update current variant if it's different AND we haven't recently changed it
            if (currentTheme !== currentVariant) {
              setCurrentVariant(currentTheme || defaultVariant)
              // Apply the theme immediately only if it's actually different
              applyThemeVariant(currentTheme || defaultVariant, variants?.[currentTheme || defaultVariant])
              console.log(`✅ Theme updated from server: ${currentTheme}`)
            } else {
              console.log(`🔄 Theme config refreshed, keeping current variant: ${currentVariant}`)
            }
            
            setLastFetchTimestamp(timestamp)
          }
        } else {
          throw new Error(data.error || 'Failed to load theme data')
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      console.warn('⚠️ Failed to fetch theme from API, using fallback:', error.message)
      
      // Don't set error state for network issues, just use fallback
      if (error.name === 'AbortError') {
        console.warn('Theme fetch request timed out')
      } else if (error.message?.includes('fetch')) {
        console.warn('Network error while fetching theme')
      } else {
        setError(error.message || 'Failed to load theme')
      }
      
      // Initialize with default configuration if no theme config exists
      if (!themeConfig) {
        const defaultThemeConfig = {
          default: {
            name: 'Default',
            description: 'Default theme',
            light: {
              primary: '210 40% 98%',
              'primary-foreground': '222.2 84% 4.9%',
              secondary: '210 40% 96%',
              'secondary-foreground': '222.2 47.4% 11.2%',
              accent: '210 40% 96%',
              'accent-foreground': '222.2 47.4% 11.2%',
              muted: '210 40% 96%',
              'muted-foreground': '215.4 16.3% 46.9%',
              background: '0 0% 100%',
              foreground: '222.2 84% 4.9%',
              card: '0 0% 100%',
              'card-foreground': '222.2 84% 4.9%',
              border: '214.3 31.8% 91.4%',
              input: '214.3 31.8% 91.4%',
              ring: '222.2 84% 4.9%',
              destructive: '0 84.2% 60.2%',
              'destructive-foreground': '210 40% 98%',
              'sidebar-background': '0 0% 100%',
              'sidebar-foreground': '222.2 84% 4.9%',
              'sidebar-primary': '222.2 47.4% 11.2%',
              'sidebar-primary-foreground': '210 40% 98%',
              'sidebar-accent': '210 40% 96%',
              'sidebar-accent-foreground': '222.2 47.4% 11.2%',
              'sidebar-border': '214.3 31.8% 91.4%',
              'sidebar-ring': '222.2 84% 4.9%'
            },
            dark: {
              primary: '210 40% 98%',
              'primary-foreground': '222.2 84% 4.9%',
              secondary: '217.2 32.6% 17.5%',
              'secondary-foreground': '210 40% 98%',
              accent: '217.2 32.6% 17.5%',
              'accent-foreground': '210 40% 98%',
              muted: '217.2 32.6% 17.5%',
              'muted-foreground': '215 20.2% 65.1%',
              background: '222.2 84% 4.9%',
              foreground: '210 40% 98%',
              card: '222.2 84% 4.9%',
              'card-foreground': '210 40% 98%',
              border: '217.2 32.6% 17.5%',
              input: '217.2 32.6% 17.5%',
              ring: '212.7 26.8% 83.9%',
              destructive: '0 62.8% 30.6%',
              'destructive-foreground': '210 40% 98%',
              'sidebar-background': '222.2 84% 4.9%',
              'sidebar-foreground': '210 40% 98%',
              'sidebar-primary': '210 40% 98%',
              'sidebar-primary-foreground': '222.2 84% 4.9%',
              'sidebar-accent': '217.2 32.6% 17.5%',
              'sidebar-accent-foreground': '210 40% 98%',
              'sidebar-border': '217.2 32.6% 17.5%',
              'sidebar-ring': '212.7 26.8% 83.9%'
            }
          }
        }
        setThemeConfig(defaultThemeConfig)
        setAvailableVariants(['default'])
        applyThemeVariant(defaultVariant, defaultThemeConfig.default)
      }
      
      // Use default theme as fallback
      if (!currentVariant || currentVariant === defaultVariant) {
        setCurrentVariant(defaultVariant)
      }
    } finally {
      setIsLoading(false)
    }
  }, [defaultVariant, lastFetchTimestamp, applyThemeVariant, lastFetchTime, themeConfig])

  // Initialize theme on mount with error boundary
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        await fetchTheme()
      } catch (error) {
        console.warn('Theme initialization failed, using default theme:', error)
        // Force set default theme if initialization fails completely
        setCurrentVariant(defaultVariant)
        setIsLoading(false)
      }
    }
    
    initializeTheme()
  }, [])

  // Set up Server-Sent Events for real-time theme updates
  useEffect(() => {
    let eventSource: EventSource | null = null
    let pollInterval: NodeJS.Timeout | null = null

    const setupSSE = () => {
      try {
        // Only setup SSE if fetch worked at least once
        if (!themeConfig) {
          console.log('⏳ Skipping SSE setup until initial theme fetch succeeds')
          return
        }
        
        eventSource = new EventSource('/api/public/themes/events')
        
        eventSource.onopen = () => {
          console.log('🔗 SSE connection established for theme updates')
          setError(null)
        }
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if (data.type === 'theme_update') {
              console.log('📡 Received theme update from SSE:', data.theme)
              
              // Only fetch if the theme is actually different and we're not in a recent update
              const timeSinceLastFetch = Date.now() - lastFetchTime
              if (data.theme !== currentVariant && timeSinceLastFetch > 2000) {
                // Small delay to let any ongoing updates finish
                setTimeout(() => {
                  fetchTheme()
                }, 500)
              }
            } else if (data.type === 'connected') {
              console.log('✅ SSE connected for theme updates')
            }
          } catch (error) {
            console.warn('⚠️ Error parsing SSE message:', error)
          }
        }
        
        eventSource.onerror = (error) => {
          console.warn('⚠️ SSE connection error, falling back to polling:', error)
          eventSource?.close()
          
          // Fallback to polling if SSE fails
          if (!pollInterval) {
            pollInterval = setInterval(() => {
              fetchTheme()
            }, 30000) // Poll every 30 seconds as fallback
          }
        }
      } catch (error) {
        console.warn('⚠️ SSE not supported, using polling:', error)
        
        // Fallback to polling if SSE is not supported
        pollInterval = setInterval(() => {
          fetchTheme()
        }, 30000)
      }
    }

    // Set up SSE connection
    setupSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [fetchTheme])

  // Listen for theme variant changes from settings page
  useEffect(() => {
    const handleThemeVariantChange = (event: CustomEvent) => {
      const { theme, themeConfig: newThemeConfig } = event.detail
      console.log('🎨 Theme change event received:', theme)
      
      setCurrentVariant(theme)
      if (newThemeConfig) {
        applyThemeVariant(theme, newThemeConfig)
      }
      
      // Refresh theme data from API to ensure consistency
      fetchTheme()
    }

    const handleVisibilityChange = () => {
      // Refresh theme when tab becomes visible (user might have changed theme in another tab)
      if (!document.hidden) {
        fetchTheme()
      }
    }

    // Listen for custom events
    window.addEventListener('themeVariantChange', handleThemeVariantChange as EventListener)
    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('themeVariantChange', handleThemeVariantChange as EventListener)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchTheme, applyThemeVariant])

  // Apply theme variant when it changes or when dark/light mode changes
  useEffect(() => {
    applyThemeVariant(currentVariant)

    // Listen for dark/light mode changes to reapply colors
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Class change detected (likely dark/light mode), reapply theme
          setTimeout(() => applyThemeVariant(currentVariant), 0)
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [currentVariant, themeConfig])

  // Update theme variant (for admin users only)
  const setVariant = useCallback(async (variant: string): Promise<boolean> => {
    if (!availableVariants.includes(variant)) {
      console.error(`❌ Invalid theme variant: ${variant}. Available: ${availableVariants.join(', ')}`)
      return false
    }

    try {
      // Prevent race conditions by temporarily blocking fetchTheme calls
      const blockUntil = Date.now() + 3000 // Block for 3 seconds
      setLastFetchTime(blockUntil)

      const response = await fetch('/api/settings/themes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: variant }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Update local state immediately
          setCurrentVariant(variant)
          applyThemeVariant(variant, data.data?.themeConfig)
          
          // Update the last fetch timestamp to prevent overwrites
          if (data.data?.setting?.metadata?.updatedAt) {
            setLastFetchTimestamp(data.data.setting.metadata.updatedAt)
          }
          
          // Broadcast change to other components/tabs
          const event = new CustomEvent('themeVariantChange', {
            detail: { 
              theme: variant, 
              themeConfig: data.data?.themeConfig 
            }
          })
          window.dispatchEvent(event)
          
          console.log(`✅ Theme changed successfully to: ${variant}`)
          
          // Refresh theme data after a short delay to sync with server
          setTimeout(() => {
            fetchTheme()
          }, 1500)
          
          return true
        } else {
          throw new Error(data.error || 'Failed to update theme')
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Failed to update theme:', error)
      setError(`Failed to update theme: ${error.message}`)
      return false
    }
  }, [availableVariants, applyThemeVariant, fetchTheme])

  const getThemeConfig = useCallback((variant?: string): ThemeVariant | null => {
    const targetVariant = variant || currentVariant
    return themeConfig?.[targetVariant] || null
  }, [themeConfig, currentVariant])

  // Refresh theme function for manual refresh
  const refreshTheme = useCallback(async () => {
    await fetchTheme()
  }, [fetchTheme])

  return (
    <ThemeVariantContext.Provider
      value={{
        currentVariant,
        setVariant,
        availableVariants,
        getThemeConfig,
        isLoading,
        error,
        refreshTheme
      }}
    >
      {children}
    </ThemeVariantContext.Provider>
  )
}