"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useSettings, type ThemeVariant } from "@/hooks/use-settings"
import { useTheme } from "next-themes"
import PageHeader from "@/components/ui/page-header"
import { FormLoader } from "@/components/ui/loader"
import {
  Settings as SettingsIcon,
  Palette,
  Shield,
  Bell,
  Monitor,
  Check,
  Crown,
  Sparkles,
  Waves,
  Leaf,
  Sun
} from "lucide-react"

const themeIcons = {
  default: Crown,
  ocean: Waves,
  forest: Leaf,
  sunset: Sun
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { theme: currentMode, setTheme } = useTheme()
  const {
    settings,
    themeData,
    loading,
    error,
    fetchSettings,
    fetchThemeData,
    updateTheme
  } = useSettings()

  const [selectedTheme, setSelectedTheme] = useState<string>('default')
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false)

  // Initialize data
  useEffect(() => {
    fetchSettings()
    fetchThemeData()
  }, [fetchSettings, fetchThemeData])

  // Update selected theme when theme data loads
  useEffect(() => {
    if (themeData?.currentTheme) {
      setSelectedTheme(themeData.currentTheme)
    }
  }, [themeData])

  // Handle theme variant change
  const handleThemeChange = async (themeVariant: string) => {
    if (themeVariant === selectedTheme) return

    setIsUpdatingTheme(true)
    try {
      const success = await updateTheme(themeVariant)
      if (success) {
        setSelectedTheme(themeVariant)
      }
    } catch (error) {
      console.error('Error updating theme:', error)
    } finally {
      setIsUpdatingTheme(false)
    }
  }

  // Preview theme colors
  const previewTheme = (variant: ThemeVariant, isDark: boolean = false) => {
    const colors = isDark ? variant.dark : variant.light
    return (
      <div className="flex space-x-1">
        <div 
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: `hsl(${colors.primary})` }}
        />
        <div 
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: `hsl(${colors.secondary})` }}
        />
        <div 
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: `hsl(${colors.accent})` }}
        />
        <div 
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: `hsl(${colors.muted})` }}
        />
      </div>
    )
  }

  if (loading && !themeData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="System Settings"
          subtitle="Manage system-wide settings and preferences"
          showAddButton={false}
        />
        <FormLoader/>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        subtitle="Manage system-wide settings and theme preferences"
        showAddButton={false}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span>Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center space-x-2">
            <Monitor className="w-4 h-4" />
            <span>System</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="w-5 h-5" />
                <span>Theme Variants</span>
              </CardTitle>
              <CardDescription>
                Choose a theme variant that will be applied to all users of the system.
                Only administrators can change the system theme.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {themeData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(themeData.variants).map(([key, variant]) => {
                    const Icon = themeIcons[key as keyof typeof themeIcons] || Sparkles
                    const isSelected = selectedTheme === key
                    const isDarkMode = currentMode === 'dark'

                    return (
                      <Card
                        key={key}
                        className={`relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                          isSelected 
                            ? 'ring-2 ring-primary shadow-lg' 
                            : 'hover:ring-1 hover:ring-border'
                        }`}
                        onClick={() => handleThemeChange(key)}
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${
                                isSelected 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <CardTitle className="text-lg">{variant.name}</CardTitle>
                                <CardDescription className="text-sm">
                                  {variant.description}
                                </CardDescription>
                              </div>
                            </div>
                            {isSelected && (
                              <Badge variant="default" className="flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Active</span>
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-2">Light Mode</div>
                              {previewTheme(variant, false)}
                            </div>
                            <div>
                              <div className="text-sm font-medium mb-2">Dark Mode</div>
                              {previewTheme(variant, true)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Palette className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No theme variants available</p>
                </div>
              )}

              {isUpdatingTheme && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary border-r-transparent rounded-full animate-spin" />
                    <span>Applying theme variant...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Theme Information</CardTitle>
              <CardDescription>
                Information about the currently active theme variant
              </CardDescription>
            </CardHeader>
            <CardContent>
              {themeData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Active Theme:</span>
                    <Badge variant="outline">
                      {themeData.variants[selectedTheme]?.name || selectedTheme}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Mode:</span>
                    <Badge variant="outline" className="capitalize">
                      {currentMode}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Available Variants:</span>
                    <span className="text-sm text-muted-foreground">
                      {themeData.availableThemes.length} themes
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Security Settings</span>
              </CardTitle>
              <CardDescription>
                Manage system security configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Security settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notification Settings</span>
              </CardTitle>
              <CardDescription>
                Configure system-wide notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Notification settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="w-5 h-5" />
                <span>System Settings</span>
              </CardTitle>
              <CardDescription>
                General system configuration options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">System settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}