import { NextRequest, NextResponse } from "next/server"
import { genericApiRoutesMiddleware } from "@/lib/middleware/route-middleware"
import { createAPIErrorResponse } from "@/lib/utils/api-responses"
import { AuditLogger } from "@/lib/security/audit-logger"
import Settings from "@/models/Settings"
import { updateThemeSchema } from "@/lib/validations/settings"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"

// Define theme variants with their color schemes
export const THEME_VARIANTS = {
  default: {
    name: 'Default',
    description: 'Pink primary with modern design',
    light: {
      primary: '326 100% 50%',
      'primary-foreground': '0 0% 100%',
      secondary: '240 4.8% 95.9%',
      'secondary-foreground': '240 5.9% 10%',
      accent: '326 100% 50%',
      'accent-foreground': '0 0% 100%',
      muted: '240 4.8% 95.9%',
      'muted-foreground': '240 3.8% 46.1%',
      background: '0 0% 100%',
      foreground: '240 10% 3.9%',
      card: '0 0% 100%',
      'card-foreground': '240 10% 3.9%',
      border: '240 5.9% 90%',
      input: '240 5.9% 90%',
      ring: '326 100% 50%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '0 0% 98%',
      'sidebar-foreground': '240 10% 3.9%',
      'sidebar-primary': '326 100% 50%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '240 4.8% 95.9%',
      'sidebar-accent-foreground': '240 5.9% 10%',
      'sidebar-border': '240 5.9% 90%',
      'sidebar-ring': '326 100% 50%'
    },
    dark: {
      primary: '326 100% 50%',
      'primary-foreground': '0 0% 98%',
      secondary: '240 3.7% 15.9%',
      'secondary-foreground': '0 0% 98%',
      accent: '326 100% 50%',
      'accent-foreground': '0 0% 98%',
      muted: '240 3.7% 15.9%',
      'muted-foreground': '240 5% 64.9%',
      background: '240 10% 3.9%',
      foreground: '0 0% 98%',
      card: '240 10% 3.9%',
      'card-foreground': '0 0% 98%',
      border: '240 3.7% 15.9%',
      input: '240 3.7% 15.9%',
      ring: '326 100% 50%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '0 0% 98%',
      'sidebar-background': '240 10% 3.9%',
      'sidebar-foreground': '0 0% 98%',
      'sidebar-primary': '326 100% 50%',
      'sidebar-primary-foreground': '0 0% 98%',
      'sidebar-accent': '240 3.7% 15.9%',
      'sidebar-accent-foreground': '0 0% 98%',
      'sidebar-border': '240 3.7% 15.9%',
      'sidebar-ring': '326 100% 50%'
    }
  },
   coral: {
    name: 'Coral Red',
    description: 'Vibrant coral and red tones with professional dark styling',
    light: {
      primary: '0 72% 58%',
      'primary-foreground': '0 0% 100%',
      secondary: '0 20% 90%',
      'secondary-foreground': '0 20% 15%',
      accent: '0 80% 60%',
      'accent-foreground': '0 0% 100%',
      muted: '0 15% 92%',
      'muted-foreground': '0 10% 45%',
      background: '0 0% 98%',
      foreground: '0 20% 8%',
      card: '0 0% 100%',
      'card-foreground': '0 20% 8%',
      border: '0 15% 88%',
      input: '0 15% 88%',
      ring: '0 72% 58%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '0 10% 96%',
      'sidebar-foreground': '0 20% 8%',
      'sidebar-primary': '0 72% 58%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '0 15% 92%',
      'sidebar-accent-foreground': '0 20% 15%',
      'sidebar-border': '0 15% 88%',
      'sidebar-ring': '0 72% 58%'
    },
    dark: {
      primary: '0 72% 58%',
      'primary-foreground': '0 0% 100%',
      secondary: '220 25% 20%',
      'secondary-foreground': '0 20% 85%',
      accent: '0 80% 60%',
      'accent-foreground': '0 0% 100%',
      muted: '220 25% 18%',
      'muted-foreground': '0 15% 65%',
      background: '220 40% 8%',
      foreground: '0 10% 95%',
      card: '220 35% 12%',
      'card-foreground': '0 10% 95%',
      border: '220 25% 18%',
      input: '220 25% 18%',
      ring: '0 72% 58%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '220 40% 8%',
      'sidebar-foreground': '0 10% 95%',
      'sidebar-primary': '0 72% 58%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '220 25% 18%',
      'sidebar-accent-foreground': '0 20% 85%',
      'sidebar-border': '220 25% 15%',
      'sidebar-ring': '0 72% 58%'
    }
  },
  ocean: {
    name: 'Ocean Blue',
    description: 'Cool blue tones with ocean-inspired palette',
    light: {
      primary: '207 89% 54%',
      'primary-foreground': '0 0% 100%',
      secondary: '213 27% 84%',
      'secondary-foreground': '213 27% 20%',
      accent: '199 89% 48%',
      'accent-foreground': '0 0% 100%',
      muted: '213 27% 84%',
      'muted-foreground': '213 17% 46%',
      background: '0 0% 100%',
      foreground: '213 27% 8%',
      card: '0 0% 100%',
      'card-foreground': '213 27% 8%',
      border: '213 27% 84%',
      input: '213 27% 84%',
      ring: '207 89% 54%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '213 100% 97%',
      'sidebar-foreground': '213 27% 8%',
      'sidebar-primary': '207 89% 54%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '213 27% 90%',
      'sidebar-accent-foreground': '213 27% 20%',
      'sidebar-border': '213 27% 84%',
      'sidebar-ring': '207 89% 54%'
    },
    dark: {
      primary: '207 89% 54%',
      'primary-foreground': '213 27% 8%',
      secondary: '213 27% 16%',
      'secondary-foreground': '213 27% 84%',
      accent: '199 89% 48%',
      'accent-foreground': '213 27% 8%',
      muted: '213 27% 16%',
      'muted-foreground': '213 17% 60%',
      background: '213 50% 5%',
      foreground: '213 27% 94%',
      card: '213 50% 5%',
      'card-foreground': '213 27% 94%',
      border: '213 27% 16%',
      input: '213 27% 16%',
      ring: '207 89% 54%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '213 50% 5%',
      'sidebar-foreground': '213 27% 94%',
      'sidebar-primary': '207 89% 54%',
      'sidebar-primary-foreground': '213 27% 8%',
      'sidebar-accent': '213 27% 16%',
      'sidebar-accent-foreground': '213 27% 84%',
      'sidebar-border': '213 27% 16%',
      'sidebar-ring': '207 89% 54%'
    }
  },
  forest: {
    name: 'Forest Green',
    description: 'Natural green tones with earthy accents',
    light: {
      primary: '142 76% 36%',
      'primary-foreground': '0 0% 100%',
      secondary: '138 23% 85%',
      'secondary-foreground': '138 23% 20%',
      accent: '134 76% 31%',
      'accent-foreground': '0 0% 100%',
      muted: '138 23% 85%',
      'muted-foreground': '138 13% 46%',
      background: '0 0% 100%',
      foreground: '138 23% 8%',
      card: '0 0% 100%',
      'card-foreground': '138 23% 8%',
      border: '138 23% 85%',
      input: '138 23% 85%',
      ring: '142 76% 36%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '138 40% 97%',
      'sidebar-foreground': '138 23% 8%',
      'sidebar-primary': '142 76% 36%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '138 23% 90%',
      'sidebar-accent-foreground': '138 23% 20%',
      'sidebar-border': '138 23% 85%',
      'sidebar-ring': '142 76% 36%'
    },
    dark: {
      primary: '142 76% 36%',
      'primary-foreground': '138 23% 8%',
      secondary: '138 23% 16%',
      'secondary-foreground': '138 23% 85%',
      accent: '134 76% 31%',
      'accent-foreground': '138 23% 8%',
      muted: '138 23% 16%',
      'muted-foreground': '138 13% 60%',
      background: '138 40% 4%',
      foreground: '138 23% 94%',
      card: '138 40% 4%',
      'card-foreground': '138 23% 94%',
      border: '138 23% 16%',
      input: '138 23% 16%',
      ring: '142 76% 36%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '138 40% 4%',
      'sidebar-foreground': '138 23% 94%',
      'sidebar-primary': '142 76% 36%',
      'sidebar-primary-foreground': '138 23% 8%',
      'sidebar-accent': '138 23% 16%',
      'sidebar-accent-foreground': '138 23% 85%',
      'sidebar-border': '138 23% 16%',
      'sidebar-ring': '142 76% 36%'
    }
  },
  sunset: {
    name: 'Sunset Orange',
    description: 'Warm orange and red tones inspired by sunset',
    light: {
      primary: '25 95% 53%',
      'primary-foreground': '0 0% 100%',
      secondary: '25 25% 85%',
      'secondary-foreground': '25 25% 20%',
      accent: '20 95% 48%',
      'accent-foreground': '0 0% 100%',
      muted: '25 25% 85%',
      'muted-foreground': '25 15% 46%',
      background: '0 0% 100%',
      foreground: '25 25% 8%',
      card: '0 0% 100%',
      'card-foreground': '25 25% 8%',
      border: '25 25% 85%',
      input: '25 25% 85%',
      ring: '25 95% 53%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '25 50% 97%',
      'sidebar-foreground': '25 25% 8%',
      'sidebar-primary': '25 95% 53%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '25 25% 90%',
      'sidebar-accent-foreground': '25 25% 20%',
      'sidebar-border': '25 25% 85%',
      'sidebar-ring': '25 95% 53%'
    },
    dark: {
      primary: '25 95% 53%',
      'primary-foreground': '25 25% 8%',
      secondary: '25 25% 16%',
      'secondary-foreground': '25 25% 85%',
      accent: '20 95% 48%',
      'accent-foreground': '25 25% 8%',
      muted: '25 25% 16%',
      'muted-foreground': '25 15% 60%',
      background: '25 40% 4%',
      foreground: '25 25% 94%',
      card: '25 40% 4%',
      'card-foreground': '25 25% 94%',
      border: '25 25% 16%',
      input: '25 25% 16%',
      ring: '25 95% 53%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '25 40% 4%',
      'sidebar-foreground': '25 25% 94%',
      'sidebar-primary': '25 95% 53%',
      'sidebar-primary-foreground': '25 25% 8%',
      'sidebar-accent': '25 25% 16%',
      'sidebar-accent-foreground': '25 25% 85%',
      'sidebar-border': '25 25% 16%',
      'sidebar-ring': '25 95% 53%'
    }
  },
  amber: {
    name: 'Amber Dashboard',
    description: 'Warm amber and orange tones inspired by professional dashboards',
    light: {
      primary: '43 96% 56%',
      'primary-foreground': '0 0% 100%',
      secondary: '43 30% 85%',
      'secondary-foreground': '43 30% 20%',
      accent: '38 92% 50%',
      'accent-foreground': '0 0% 100%',
      muted: '43 30% 85%',
      'muted-foreground': '43 20% 46%',
      background: '0 0% 100%',
      foreground: '43 30% 8%',
      card: '0 0% 100%',
      'card-foreground': '43 30% 8%',
      border: '43 30% 85%',
      input: '43 30% 85%',
      ring: '43 96% 56%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '43 50% 97%',
      'sidebar-foreground': '43 30% 8%',
      'sidebar-primary': '43 96% 56%',
      'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '43 30% 90%',
      'sidebar-accent-foreground': '43 30% 20%',
      'sidebar-border': '43 30% 85%',
      'sidebar-ring': '43 96% 56%'
    },
    dark: {
      primary: '43 96% 56%',
      'primary-foreground': '220 26% 14%',
      secondary: '220 26% 18%',
      'secondary-foreground': '43 30% 85%',
      accent: '38 92% 50%',
      'accent-foreground': '220 26% 14%',
      muted: '220 26% 18%',
      'muted-foreground': '43 20% 60%',
      background: '220 26% 14%',
      foreground: '43 30% 94%',
      card: '220 26% 18%',
      'card-foreground': '43 30% 94%',
      border: '220 26% 25%',
      input: '220 26% 25%',
      ring: '43 96% 56%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      'sidebar-background': '220 26% 14%',
      'sidebar-foreground': '43 30% 94%',
      'sidebar-primary': '43 96% 56%',
      'sidebar-primary-foreground': '220 26% 14%',
      'sidebar-accent': '220 26% 18%',
      'sidebar-accent-foreground': '43 30% 85%',
      'sidebar-border': '220 26% 25%',
      'sidebar-ring': '43 96% 56%'
    }
  }
}

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/settings/themes - Get available theme variants and current theme (Admin only for management)
export async function GET(request: NextRequest) {
  try {
    // Apply middleware - Only admins and super admins can access theme management
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(
      request, 
      'settings', 
      'read'
    )

    // Check if user is admin or super admin (hierarchy level >= 9)
    const userHierarchyLevel = user.role?.hierarchyLevel || 0
    if (!isSuperAdmin && userHierarchyLevel < 9) {
      return createErrorResponse("Access denied. Admin privileges required.", 403)
    }


    // Get current theme setting from database
    const currentThemeSetting = await executeGenericDbQuery(async () => {
      return await Settings.findOne({ 
        key: 'theme_variant',
        category: 'appearance' 
      }).lean()
    })

    const currentTheme = currentThemeSetting?.value || 'default'

    // Validate that the current theme exists in THEME_VARIANTS
    const validTheme = THEME_VARIANTS[currentTheme as keyof typeof THEME_VARIANTS] 
      ? currentTheme 
      : 'default'

    // Return available themes and current theme with full management data
    return NextResponse.json({
      success: true,
      data: {
        variants: THEME_VARIANTS,
        currentTheme: validTheme,
        availableThemes: Object.keys(THEME_VARIANTS),
        themeConfig: THEME_VARIANTS[validTheme as keyof typeof THEME_VARIANTS],
        setting: currentThemeSetting,
        timestamp: new Date().toISOString()
      },
      message: 'Theme variants retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in GET /api/settings/themes:', error)
    
    if (error instanceof Response) {
      return error
    }
    
    return createAPIErrorResponse("Internal server error", 500)
  }
}

// PUT /api/settings/themes - Update current theme variant
export async function PUT(request: NextRequest) {
  try {
    // Apply middleware - Only admins and super admins can change theme
    // Use 'api' rate limit instead of 'sensitive' for theme changes (more lenient)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(
      request, 
      'settings', 
      'update',
      {
        rateLimitType: 'api' // 100 requests per 15 minutes instead of 10
      }
    )

    // Check if user is admin or super admin (hierarchy level >= 9)
    const userHierarchyLevel = user.role?.hierarchyLevel || 0
    if (!isSuperAdmin && userHierarchyLevel < 9) {
      return createErrorResponse("Access denied. Admin privileges required.", 403)
    }

    const body = await request.json()
    
    // Validate request body
    const validation = updateThemeSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse("Validation failed", 400, {
        errors: validation.error.errors,
        availableThemes: Object.keys(THEME_VARIANTS)
      })
    }

    const { theme } = validation.data


    // Update theme setting
    const updatedSetting = await executeGenericDbQuery(async () => {
      return await Settings.findOneAndUpdate(
      { key: 'theme_variant' },
      {
        key: 'theme_variant',
        value: theme,
        description: `Current theme variant: ${THEME_VARIANTS[theme as keyof typeof THEME_VARIANTS].name}`,
        category: 'appearance',
        isPublic: true, // Theme is public so all users can see it
        'metadata.updatedBy': userEmail,
        'metadata.updatedAt': new Date()
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    )
  })

    // Set createdBy for new documents
    if (!updatedSetting.metadata?.createdBy) {
      updatedSetting.metadata = {
        ...updatedSetting.metadata,
        createdBy: userEmail,
        updatedBy: userEmail,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      await updatedSetting.save()
    }

    // Clear theme-related cache to ensure fresh data
    clearCache('settings')
    clearCache('themes')
    
    // Log theme change
    await AuditLogger.logUserAction({
      userId: session.user.id,
      action: 'theme_change',
      resource: 'settings',
      details: {
        message: `Theme changed to ${THEME_VARIANTS[theme as keyof typeof THEME_VARIANTS].name}`,
        newTheme: theme,
        themeName: THEME_VARIANTS[theme as keyof typeof THEME_VARIANTS].name,
        userEmail,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        theme: theme,
        themeConfig: THEME_VARIANTS[theme as keyof typeof THEME_VARIANTS],
        setting: updatedSetting
      },
      message: `Theme changed to ${THEME_VARIANTS[theme as keyof typeof THEME_VARIANTS].name}`
    })

  } catch (error: any) {
    console.error('Error in PUT /api/settings/themes:', error)
    
    // Handle middleware errors (like rate limiting or permission denied)
    if (error instanceof Response) {
      return error
    }
    
    // Handle rate limiting specifically
    if (error?.message?.includes('Rate limit')) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      }, { status: 429 })
    }
    
    return createAPIErrorResponse("Failed to update theme", 500)
  }
}