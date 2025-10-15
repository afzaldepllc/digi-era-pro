import { NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery } from "@/lib/mongodb"
import Settings from "@/models/Settings"

// Import theme variants from the main themes route
import { THEME_VARIANTS } from "@/app/api/settings/themes/route"

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/public/themes - Get current theme (accessible to all authenticated users)
export async function GET(request: NextRequest) {
  try {
    // Use cached query with 30-second cache for theme data
    const themeData = await executeGenericDbQuery(async () => {
      // Get current theme setting from database
      const currentThemeSetting = await Settings.findOne({ 
        key: 'theme_variant',
        category: 'appearance',
        isPublic: true // Only get public settings
      }).lean()

      const currentTheme = currentThemeSetting?.value || 'default'

      // Validate that the current theme exists in THEME_VARIANTS
      const validTheme = THEME_VARIANTS[currentTheme as keyof typeof THEME_VARIANTS] 
        ? currentTheme 
        : 'default'

      return { currentTheme: validTheme }
    }, 'public-themes', 30000) // 30 second cache

    const validTheme = themeData.currentTheme

    // Return current theme and variants
    return NextResponse.json({
      success: true,
      data: {
        currentTheme: validTheme,
        themeConfig: THEME_VARIANTS[validTheme as keyof typeof THEME_VARIANTS],
        variants: THEME_VARIANTS,
        availableThemes: Object.keys(THEME_VARIANTS),
        timestamp: new Date().toISOString() // For cache busting
      },
      message: 'Current theme retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in GET /api/public/themes:', error)
    
    // Return default theme in case of error to prevent app breaking
    return NextResponse.json({
      success: true,
      data: {
        currentTheme: 'default',
        themeConfig: THEME_VARIANTS.default,
        variants: THEME_VARIANTS,
        availableThemes: Object.keys(THEME_VARIANTS),
        timestamp: new Date().toISOString()
      },
      message: 'Fallback to default theme due to error'
    })
  }
}