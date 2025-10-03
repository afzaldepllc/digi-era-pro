import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ClientPermissionManager, 
  getStoredPermissions, 
  storePermissions, 
  clearStoredPermissions 
} from '@/lib/permissions/client'
import type { Permission } from '@/types'

interface UsePermissionsReturn {
  permissions: Permission[]
  loading: boolean
  hasPermission: (resource: string, action: string, condition?: string) => boolean
  canAccess: (resource: string, actions?: string[]) => boolean
  canCreate: (resource: string) => boolean
  canRead: (resource: string) => boolean
  canUpdate: (resource: string) => boolean
  canDelete: (resource: string) => boolean
  canAssign: (resource: string) => boolean
}

export function usePermissions(): UsePermissionsReturn {
  const { data: session, status } = useSession()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true) // Start with loading true
  const [permissionManager, setPermissionManager] = useState<ClientPermissionManager | null>(null)
  
  // Get user info from session
  const user = session?.user as any
  const userRole = user?.role
  const isSuperAdmin = user?.role === 'super_admin'
  // Load permissions from session or localStorage immediately when available
  useEffect(() => {
    if (status === 'loading') {
      setLoading(true)
      return
    }

    if (session?.user) {
      let userPermissions: Permission[] = []

      // Try to get permissions from session first
      if (user?.permissions && Array.isArray(user.permissions)) {
        userPermissions = user.permissions
        storePermissions(userPermissions)
      } else {
        // Fallback to localStorage if session doesn't have permissions
        userPermissions = getStoredPermissions()
      }
      
      setPermissions(userPermissions)
      setPermissionManager(new ClientPermissionManager(userPermissions, userRole))
      
      // Add a small delay to ensure everything is properly set
      setTimeout(() => {
        setLoading(false)
      }, 100)
    } else if (status === 'unauthenticated') {
      // Clear permissions when no session
      setPermissions([])
      setPermissionManager(null)
      clearStoredPermissions()
      setLoading(false)
    }
  }, [session, user?.permissions, userRole, status])

  const hasPermission = useCallback((resource: string, action: string, condition?: string): boolean => {
    // If still loading or no permission manager, deny access
    if (loading || !permissionManager) return false
    return permissionManager.hasPermission(resource, action, condition)
  }, [permissionManager, loading])

  const canAccess = useCallback((resource: string, actions: string[] = ['read']): boolean => {
    if (!permissionManager) return false
    return permissionManager.canAccess(resource, actions)
  }, [permissionManager])

  const canCreate = useCallback((resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canCreate(resource)
  }, [permissionManager])

  const canRead = useCallback((resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canRead(resource)
  }, [permissionManager])

  const canUpdate = useCallback((resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canUpdate(resource)
  }, [permissionManager])

  const canDelete = useCallback((resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canDelete(resource)
  }, [permissionManager])

  const canAssign = useCallback((resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canAssign(resource)
  }, [permissionManager])

  return {
    permissions,
    loading,
    hasPermission,
    canAccess,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canAssign,
  }
}