/**
 * Client-Side Permission Utilities
 * Pure client-side permission checking without server dependencies
 */

import type { Permission } from '@/types'

export interface ClientPermissionChecker {
  hasPermission: (resource: string, action: string, condition?: string) => boolean
  canAccess: (resource: string, actions?: string[]) => boolean
  canCreate: (resource: string) => boolean
  canRead: (resource: string) => boolean
  canUpdate: (resource: string) => boolean
  canDelete: (resource: string) => boolean
  canAssign: (resource: string) => boolean
}

/**
 * Client-side permission checker that works with stored permissions
 */
export class ClientPermissionManager {
  private permissions: Permission[]
  private isSuperAdmin: boolean

  constructor(permissions: Permission[] = [], userRole?: string) {
    this.permissions = permissions
    this.isSuperAdmin = userRole === 'super_admin'
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(resource: string, action: string, condition?: string): boolean {
    // Super admin has all permissions
    if (this.isSuperAdmin) {
      return true
    }

    // Check if user has the specific permission
    return this.permissions.some(permission => {
      if (permission.resource !== resource) {
        return false
      }

      if (!permission.actions.includes(action)) {
        return false
      }

      // If condition is specified, check if it matches
      if (condition && permission.conditions) {
        return Boolean(permission.conditions[condition as keyof typeof permission.conditions])
      }

      return true
    })
  }

  /**
   * Check if user can access a resource with any of the given actions
   */
  canAccess(resource: string, actions: string[] = ['read']): boolean {
    return actions.some(action => this.hasPermission(resource, action))
  }

  /**
   * Convenience methods for common actions
   */
  canCreate(resource: string): boolean {
    return this.hasPermission(resource, 'create')
  }

  canRead(resource: string): boolean {
    return this.hasPermission(resource, 'read')
  }

  canUpdate(resource: string): boolean {
    return this.hasPermission(resource, 'update')
  }

  canDelete(resource: string): boolean {
    return this.hasPermission(resource, 'delete')
  }

  canAssign(resource: string): boolean {
    return this.hasPermission(resource, 'assign')
  }

  /**
   * Get all permissions
   */
  getPermissions(): Permission[] {
    return this.permissions
  }

  /**
   * Update permissions
   */
  updatePermissions(newPermissions: Permission[]): void {
    this.permissions = newPermissions
  }
}

/**
 * Helper function to get permissions from session or localStorage
 */
export function getStoredPermissions(): Permission[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = localStorage.getItem('userPermissions')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('Failed to parse stored permissions:', error)
    return []
  }
}

/**
 * Helper function to store permissions in localStorage
 */
export function storePermissions(permissions: Permission[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem('userPermissions', JSON.stringify(permissions))
  } catch (error) {
    console.warn('Failed to store permissions:', error)
  }
}

/**
 * Helper function to clear stored permissions
 */
export function clearStoredPermissions(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem('userPermissions')
  } catch (error) {
    console.warn('Failed to clear stored permissions:', error)
  }
}