import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface LocalUser {
  id: string
  name: string
  email: string
  role: string
  roleDisplayName?: string
  department?: string
  avatar?: string
  image?: string
  permissions?: any[]
  sessionStartTime?: number
  iat?: number
}

interface UseLocalUserReturn {
  user: LocalUser | null
  loading: boolean
  updateUser: (userData: Partial<LocalUser>) => void
  clearUser: () => void
  refreshFromSession: () => void
}

export function useAuthUser(): UseLocalUserReturn {
  const { data: session } = useSession()
  const [user, setUser] = useState<LocalUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Load user data from localStorage on mount
  useEffect(() => {
    const loadUserData = () => {
      try {
        const storedUser = localStorage.getItem('logged_in_user')
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          setUser(userData)
        } else if (session?.user) {
          // Fallback to session if localStorage is empty
          const sessionUser = session.user as any
          setUser(sessionUser)
          // Store in localStorage for future use
          localStorage.setItem('logged_in_user', JSON.stringify(sessionUser))
        }
      } catch (error) {
        console.error('Error loading user data from localStorage:', error)
        // Fallback to session on error
        if (session?.user) {
          setUser(session.user as any)
        }
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [(session?.user as any)?.id]) // Only re-run when user ID changes, not on every session change

  // Update user data in both state and localStorage
  const updateUser = (userData: Partial<LocalUser>) => {
    try {
      const updatedUser = { ...user, ...userData } as LocalUser
      setUser(updatedUser)
      localStorage.setItem('logged_in_user', JSON.stringify(updatedUser))
      console.log('Updated user data:', updatedUser)
    } catch (error) {
      console.error('Error updating user data:', error)
    }
  }

  // Clear user data from both state and localStorage
  const clearUser = () => {
    try {
      setUser(null)
      localStorage.removeItem('logged_in_user')
      console.log('Cleared user data from localStorage')
    } catch (error) {
      console.error('Error clearing user data:', error)
    }
  }

  // Refresh user data from session
  const refreshFromSession = () => {
    if (session?.user) {
      const sessionUser = session.user as any
      setUser(sessionUser)
      localStorage.setItem('logged_in_user', JSON.stringify(sessionUser))
      console.log('Refreshed user data from session:', sessionUser)
    }
  }

  return {
    user,
    loading,
    updateUser,
    clearUser,
    refreshFromSession,
  }
}