"use client"

import { useAuthUser } from "@/hooks/use-auth-user"
import { getUserData, clearUserData } from "@/lib/utils/local-storage"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function UserDataDebug() {
  const { user, loading, clearUser, refreshFromSession } = useAuthUser()
  const [rawData, setRawData] = useState<any>(null)

  const handleShowRawData = () => {
    const data = getUserData()
    setRawData(data)
  }

  const handleClearData = () => {
    clearUserData()
    clearUser()
    setRawData(null)
  }

  if (loading) {
    return <div>Loading user data...</div>
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>User Data Debug</CardTitle>
        <CardDescription>View and manage localStorage user data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Current User (from hook):</h3>
          {user ? (
            <div className="bg-gray-100 p-3 rounded text-sm">
              <pre>{JSON.stringify(user, null, 2)}</pre>
            </div>
          ) : (
            <p className="text-gray-500">No user data found</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleShowRawData} variant="outline">
            Show Raw localStorage Data
          </Button>
          <Button onClick={refreshFromSession} variant="outline">
            Refresh from Session
          </Button>
          <Button onClick={handleClearData} variant="destructive">
            Clear localStorage Data
          </Button>
        </div>

        {rawData && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Raw localStorage Data:</h3>
            <div className="bg-gray-100 p-3 rounded text-sm">
              <pre>{JSON.stringify(rawData, null, 2)}</pre>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
          <p><strong>Name:</strong> {user?.name || 'N/A'}</p>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Role:</strong> {user?.role || 'N/A'}</p>
          <p><strong>Role Display:</strong> {user?.roleDisplayName || 'N/A'}</p>
          <p><strong>Department:</strong> {user?.department || 'N/A'}</p>
          <p><strong>Permissions Count:</strong> {user?.permissions?.length || 0}</p>
        </div>
      </CardContent>
    </Card>
  )
}