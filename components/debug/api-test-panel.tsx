"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function ApiTestPanel() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testApiEndpoints = async () => {
    setLoading(true)
    const testResults: any = {
      authNextAuth: { status: 'unknown', error: null },
      themesPublic: { status: 'unknown', error: null, data: null },
      themesEvents: { status: 'unknown', error: null },
    }

    // Test Next-Auth endpoint
    try {
      const authResponse = await fetch('/api/auth/session', { method: 'GET' })
      testResults.authNextAuth.status = authResponse.ok ? 'success' : 'error'
      if (!authResponse.ok) {
        testResults.authNextAuth.error = `${authResponse.status}: ${authResponse.statusText}`
      }
    } catch (error: any) {
      testResults.authNextAuth.status = 'error'
      testResults.authNextAuth.error = error.message
    }

    // Test themes public endpoint
    try {
      const themesResponse = await fetch('/api/public/themes', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      testResults.themesPublic.status = themesResponse.ok ? 'success' : 'error'
      if (themesResponse.ok) {
        testResults.themesPublic.data = await themesResponse.json()
      } else {
        testResults.themesPublic.error = `${themesResponse.status}: ${themesResponse.statusText}`
        testResults.themesPublic.data = await themesResponse.text()
      }
    } catch (error: any) {
      testResults.themesPublic.status = 'error'
      testResults.themesPublic.error = error.message
    }

    // Test SSE endpoint (we can't really test this properly in a simple fetch, but we can check if it exists)
    try {
      const sseResponse = await fetch('/api/public/themes/events', { 
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      })
      testResults.themesEvents.status = sseResponse.ok ? 'success' : 'error'
      if (!sseResponse.ok) {
        testResults.themesEvents.error = `${sseResponse.status}: ${sseResponse.statusText}`
      }
    } catch (error: any) {
      testResults.themesEvents.status = 'error'
      testResults.themesEvents.error = error.message
    }

    setResults(testResults)
    setLoading(false)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Endpoints Test</CardTitle>
        <CardDescription>Test the availability of key API endpoints</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testApiEndpoints} disabled={loading}>
          {loading ? 'Testing...' : 'Test API Endpoints'}
        </Button>

        {results && (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">/api/auth/session</span>
                <Badge variant={results.authNextAuth.status === 'success' ? 'default' : 'destructive'}>
                  {results.authNextAuth.status}
                </Badge>
              </div>
              {results.authNextAuth.error && (
                <div className="text-sm text-red-600 ml-4">
                  Error: {results.authNextAuth.error}
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">/api/public/themes</span>
                <Badge variant={results.themesPublic.status === 'success' ? 'default' : 'destructive'}>
                  {results.themesPublic.status}
                </Badge>
              </div>
              {results.themesPublic.error && (
                <div className="text-sm text-red-600 ml-4">
                  Error: {results.themesPublic.error}
                </div>
              )}

              <div className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">/api/public/themes/events</span>
                <Badge variant={results.themesEvents.status === 'success' ? 'default' : 'destructive'}>
                  {results.themesEvents.status}
                </Badge>
              </div>
              {results.themesEvents.error && (
                <div className="text-sm text-red-600 ml-4">
                  Error: {results.themesEvents.error}
                </div>
              )}
            </div>

            {results.themesPublic.data && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Themes API Response:</h4>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(results.themesPublic.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}