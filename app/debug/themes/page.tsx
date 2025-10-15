"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useThemeVariant } from '@/components/theme-variant-provider'
import { useThemeManagement } from '@/hooks/use-theme-management'

export default function ThemeDebugPage() {
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({})
  
  const themeVariant = useThemeVariant()
  const themeManagement = useThemeManagement()

  const checkAPI = async (endpoint: string, name: string) => {
    try {
      const response = await fetch(endpoint)
      const data = await response.json()
      
      setApiStatus(prev => ({
        ...prev,
        [name]: `${response.status} - ${response.ok ? 'OK' : 'Error'}: ${data.message || data.error || 'Unknown'}`
      }))
    } catch (error: any) {
      setApiStatus(prev => ({
        ...prev,
        [name]: `Error: ${error.message}`
      }))
    }
  }

  const testAllAPIs = () => {
    checkAPI('/api/public/themes', 'Public Themes')
    checkAPI('/api/settings/themes', 'Admin Themes') 
    checkAPI('/api/settings', 'Settings')
  }

  useEffect(() => {
    testAllAPIs()
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Theme System Debug</h1>
        <Button onClick={testAllAPIs}>Refresh API Status</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Theme Variant Provider Status */}
        <Card>
          <CardHeader>
            <CardTitle>Theme Variant Provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Current Variant:</span>
              <Badge>{themeVariant.currentVariant}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Available Variants:</span>
              <Badge variant="outline">{themeVariant.availableVariants.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Loading:</span>
              <Badge variant={themeVariant.isLoading ? "destructive" : "default"}>
                {themeVariant.isLoading ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Error:</span>
              <Badge variant={themeVariant.error ? "destructive" : "default"}>
                {themeVariant.error || "None"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Theme Management Status */}
        <Card>
          <CardHeader>
            <CardTitle>Theme Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Current Theme:</span>
              <Badge>{themeManagement.currentTheme}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Can Change Theme:</span>
              <Badge variant={themeManagement.canChangeTheme ? "default" : "destructive"}>
                {themeManagement.canChangeTheme ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Loading:</span>
              <Badge variant={themeManagement.isLoading ? "destructive" : "default"}>
                {themeManagement.isLoading ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Error:</span>
              <Badge variant={themeManagement.error ? "destructive" : "default"}>
                {themeManagement.error || "None"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints Status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>API Endpoints Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(apiStatus).map(([name, status]) => (
                <div key={name} className="space-y-1">
                  <div className="font-medium text-sm">{name}</div>
                  <Badge 
                    variant={status.includes('200') ? "default" : "destructive"}
                    className="text-xs w-full justify-center"
                  >
                    {status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Available Themes */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Available Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {themeVariant.availableVariants.map(theme => (
                <Badge 
                  key={theme}
                  variant={theme === themeVariant.currentVariant ? "default" : "outline"}
                >
                  {theme}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={() => themeVariant.refreshTheme()} className="mr-2">
            Refresh Theme Data
          </Button>
          <Button onClick={() => themeManagement.refreshTheme()} className="mr-2">
            Refresh Theme Management
          </Button>
          <Button onClick={testAllAPIs} variant="outline">
            Test All APIs
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}