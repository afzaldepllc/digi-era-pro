import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeVariantContextType {
  currentVariant: string
  setVariant: (variant: string) => void
  availableVariants: string[]
  getThemeConfig: (variant?: string) => any
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
  const [themeConfig, setThemeConfig] = useState<any>(null)

  // Available theme variants (will be populated from API)
  const [availableVariants, setAvailableVariants] = useState<string[]>(['default'])

  // Apply CSS custom properties for the current theme variant
  const applyThemeVariant = (variant: string, config?: any) => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const isDark = root.classList.contains('dark')
    
    let themeColors = config
    if (!themeColors && themeConfig?.variants?.[variant]) {
      themeColors = themeConfig.variants[variant]
    }

    if (themeColors) {
      const colors = isDark ? themeColors.dark : themeColors.light
      
      // Apply CSS custom properties
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value as string)
      })

      // Store current variant in localStorage
      try {
        localStorage.setItem('theme-variant', variant)
      } catch (error) {
        console.warn('Failed to store theme variant:', error)
      }
    }
  }

  // Initialize theme variant from API and localStorage
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Try to get current theme from API first
        const response = await fetch('/api/settings/themes')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setThemeConfig(data.data)
            setAvailableVariants(data.data.availableThemes || ['default'])
            
            // Use theme from API, fallback to localStorage, then default
            const apiTheme = data.data.currentTheme
            const storageTheme = localStorage.getItem('theme-variant')
            const initialVariant = apiTheme || storageTheme || defaultVariant
            
            setCurrentVariant(initialVariant)
            applyThemeVariant(initialVariant, data.data.variants?.[initialVariant])
            return
          }
        }
      } catch (error) {
        console.warn('Failed to fetch theme from API, using localStorage:', error)
      }

      // Fallback to localStorage if API fails
      try {
        const storedVariant = localStorage.getItem('theme-variant')
        if (storedVariant && storedVariant !== currentVariant) {
          setCurrentVariant(storedVariant)
        }
      } catch (error) {
        console.warn('Failed to load theme variant from localStorage:', error)
      }
    }

    initializeTheme()
  }, [defaultVariant])

  // Listen for theme variant changes from settings page
  useEffect(() => {
    const handleThemeVariantChange = (event: CustomEvent) => {
      const { theme, themeConfig: newThemeConfig } = event.detail
      setCurrentVariant(theme)
      if (newThemeConfig) {
        applyThemeVariant(theme, newThemeConfig)
      }
    }

    window.addEventListener('themeVariantChange', handleThemeVariantChange as EventListener)
    return () => {
      window.removeEventListener('themeVariantChange', handleThemeVariantChange as EventListener)
    }
  }, [])

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

  const setVariant = (variant: string) => {
    if (availableVariants.includes(variant)) {
      setCurrentVariant(variant)
      applyThemeVariant(variant)
    }
  }

  const getThemeConfig = (variant?: string) => {
    const targetVariant = variant || currentVariant
    return themeConfig?.variants?.[targetVariant] || null
  }

  return (
    <ThemeVariantContext.Provider
      value={{
        currentVariant,
        setVariant,
        availableVariants,
        getThemeConfig
      }}
    >
      {children}
    </ThemeVariantContext.Provider>
  )
}