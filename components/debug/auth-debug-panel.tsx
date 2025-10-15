"use client"

import { useSession } from "next-auth/react"
import { useAuthUser } from "@/hooks/use-auth-user"
import { usePermissions } from "@/hooks/use-permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function AuthDebugPanel() {
  const { data: session, status } = useSession()
  const { user: localUser, loading: localLoading } = useAuthUser()
  const { permissions, loading: permissionsLoading, hasPermission } = usePermissions()
  const [testResults, setTestResults] = useState<any>(null)

  const runClientTest = () => {
    const results = {
      localStorage: {
        canWrite: false,
        canRead: false,
        userData: null,
      },
      permissions: {
        count: permissions.length,
        canReadUsers: hasPermission('users', 'read'),
        canCreateUsers: hasPermission('users', 'create'),
      },
      session: {
        status,
        hasUser: !!session?.user,
        userId: (session?.user as any)?.id,
      }
    }

    // Test localStorage
    try {
      const testData = { test: true, timestamp: Date.now() }
      localStorage.setItem('auth_test', JSON.stringify(testData))
      const retrieved = JSON.parse(localStorage.getItem('auth_test') || '{}')
      results.localStorage.canWrite = true
      results.localStorage.canRead = retrieved.test === true
      localStorage.removeItem('auth_test')
      
      // Get actual user data
      const userData = localStorage.getItem('logged_in_user')
      results.localStorage.userData = userData ? JSON.parse(userData) : null
    } catch (error) {
      console.error('localStorage test failed:', error)
    }

    setTestResults(results)
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Debug Panel</CardTitle>
          <CardDescription>Monitor authentication state and permissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runClientTest} variant="outline">
            Run Client-Side Test
          </Button>
        </CardContent>
      </Card>

      {/* Session Status */}
      <Card>
        <CardHeader>
          <CardTitle>Next-Auth Session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Status:</strong> <Badge variant={status === 'authenticated' ? 'default' : 'secondary'}>{status}</Badge>
            </div>
            <div>
              <strong>User ID:</strong> {(session?.user as any)?.id || 'N/A'}
            </div>
            <div>
              <strong>Name:</strong> {session?.user?.name || 'N/A'}
            </div>
            <div>
              <strong>Email:</strong> {session?.user?.email || 'N/A'}
            </div>
            <div>
              <strong>Role:</strong> {(session?.user as any)?.role || 'N/A'}
            </div>
            <div>
              <strong>Permissions Count:</strong> {(session?.user as any)?.permissions?.length || 0}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Local User Data */}
      <Card>
        <CardHeader>
          <CardTitle>localStorage User Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Loading:</strong> <Badge variant={localLoading ? 'destructive' : 'default'}>{localLoading ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <strong>User ID:</strong> {localUser?.id || 'N/A'}
            </div>
            <div>
              <strong>Name:</strong> {localUser?.name || 'N/A'}
            </div>
            <div>
              <strong>Email:</strong> {localUser?.email || 'N/A'}
            </div>
            <div>
              <strong>Role:</strong> {localUser?.role || 'N/A'}
            </div>
            <div>
              <strong>Permissions Count:</strong> {localUser?.permissions?.length || 0}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Loading:</strong> <Badge variant={permissionsLoading ? 'destructive' : 'default'}>{permissionsLoading ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <strong>Total Permissions:</strong> {permissions.length}
            </div>
            <div>
              <strong>Can Read Users:</strong> <Badge variant={hasPermission('users', 'read') ? 'default' : 'secondary'}>{hasPermission('users', 'read') ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <strong>Can Create Users:</strong> <Badge variant={hasPermission('users', 'create') ? 'default' : 'secondary'}>{hasPermission('users', 'create') ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <strong>Can Update Users:</strong> <Badge variant={hasPermission('users', 'update') ? 'default' : 'secondary'}>{hasPermission('users', 'update') ? 'Yes' : 'No'}</Badge>
            </div>
            <div>
              <strong>Can Delete Users:</strong> <Badge variant={hasPermission('users', 'delete') ? 'default' : 'secondary'}>{hasPermission('users', 'delete') ? 'Yes' : 'No'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Raw Data */}
      <Card>
        <CardHeader>
          <CardTitle>Raw Session Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(session, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}