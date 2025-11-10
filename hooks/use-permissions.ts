import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { 
  ClientPermissionManager, 
  getStoredPermissions, 
  storePermissions, 
  clearStoredPermissions 
} from '@/lib/permissions/client'
import { getUserData } from '@/lib/utils/local-storage'
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
  const [loading, setLoading] = useState(false) // Start false for instant render
  
  // Memoize permission manager to prevent recreation on every render
  const permissionManager = useMemo(() => {
    if (!session?.user) return null
    
    const storedUser = getUserData()
    const sessionUser = session?.user as any
    const user = storedUser || sessionUser
    const userRole = user?.role
    
    return new ClientPermissionManager(permissions, userRole)
  }, [permissions, session?.user])
  
  // Load permissions asynchronously without blocking render
  useEffect(() => {
    if (status === 'loading') return

    // Use queueMicrotask to defer permission loading
    queueMicrotask(() => {
      if (session?.user) {
        // Get user info from localStorage first, then fallback to session
        const storedUser = getUserData()
        const sessionUser = session?.user as any
        const user = storedUser || sessionUser
        
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
      } else if (status === 'unauthenticated') {
        // Clear permissions when no session
        setPermissions([])
        clearStoredPermissions()
      }
    })
  }, [session, status])

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