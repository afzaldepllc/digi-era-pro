"use client"

import { AuthDebugPanel } from "@/components/debug/auth-debug-panel"
import { UserDataDebug } from "@/components/debug/user-data-debug"
import { ApiTestPanel } from "@/components/debug/api-test-panel"

export default function AuthDebugPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Authentication Debug</h1>
        <p className="text-muted-foreground">
          Test and debug authentication, permissions, localStorage, and API endpoints
        </p>
      </div>
      
      <div className="space-y-8">
        <ApiTestPanel />
        <AuthDebugPanel />
        <UserDataDebug />
      </div>
    </div>
  )
}