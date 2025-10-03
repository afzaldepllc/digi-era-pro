'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/use-permissions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RouteDebugProps {
  resource: string
  action: string
}

export function RouteDebug({ resource, action }: RouteDebugProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { permissions, hasPermission, loading } = usePermissions()
  const user = session?.user as any

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const hasRequiredPermission = hasPermission(resource, action)

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-background/95 backdrop-blur-sm border-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Route Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <strong>Path:</strong> {pathname}
        </div>
        <div className="flex items-center gap-2">
          <strong>Session Status:</strong>
          <Badge variant={status === 'authenticated' ? 'default' : 'secondary'}>
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <strong>User Role:</strong>
          <Badge variant="outline">{user?.role || 'None'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <strong>Resource:</strong> 
          <Badge variant="outline">{resource}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <strong>Action:</strong> 
          <Badge variant="outline">{action}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <strong>Permissions Loading:</strong>
          <Badge variant={loading ? "secondary" : "default"}>
            {loading ? "Yes" : "No"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <strong>Permission Check:</strong>
          <Badge variant={hasRequiredPermission ? "default" : "destructive"}>
            {loading ? "Loading..." : hasRequiredPermission ? "Granted" : "Denied"}
          </Badge>
        </div>
        <div>
          <strong>User Permissions ({permissions.length}):</strong>
          <div className="max-h-20 overflow-y-auto mt-1 space-y-1">
            {permissions.map((perm, idx) => (
              <div key={idx} className="text-xs p-1 bg-muted rounded">
                {perm.resource}: {perm.actions.join(', ')}
                {perm.conditions && (
                  <div className="text-muted-foreground mt-1">
                    Conditions: {JSON.stringify(perm.conditions)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}