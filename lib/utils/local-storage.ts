/**
 * Client-side utilities for managing user data in localStorage
 */

export interface StoredUser {
  id: string
  name: string
  email: string
  role: string
  roleDisplayName?: string
  department?: string
  avatar?: string
  permissions?: any[]
  sessionStartTime?: number
}

/**
 * Store user data in localStorage
 */
export function storeUserData(userData: StoredUser): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('logged_in_user', JSON.stringify(userData))
    console.log('User data stored in localStorage:', userData)
  } catch (error) {
    console.error('Error storing user data in localStorage:', error)
  }
}

/**
 * Get user data from localStorage
 */
export function getUserData(): StoredUser | null {
  if (typeof window === 'undefined') return null
  
  try {
    const storedUser = localStorage.getItem('logged_in_user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      return userData
    }
  } catch (error) {
    console.error('Error retrieving user data from localStorage:', error)
  }
  
  return null
}

/**
 * Update specific user data fields in localStorage
 */
export function updateUserData(updates: Partial<StoredUser>): StoredUser | null {
  if (typeof window === 'undefined') return null
  
  try {
    const currentUser = getUserData()
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates }
      storeUserData(updatedUser)
      return updatedUser
    }
  } catch (error) {
    console.error('Error updating user data in localStorage:', error)
  }
  
  return null
}

/**
 * Clear user data from localStorage
 */
export function clearUserData(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('logged_in_user')
    localStorage.removeItem('user_permissions')
    console.log('User data cleared from localStorage')
  } catch (error) {
    console.error('Error clearing user data from localStorage:', error)
  }
}

/**
 * Check if user data exists in localStorage
 */
export function hasUserData(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const storedUser = localStorage.getItem('logged_in_user')
    return !!storedUser
  } catch (error) {
    console.error('Error checking user data in localStorage:', error)
    return false
  }
}