"use client"

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useDispatch } from 'react-redux'
import { setAuth, clearAuth } from '@/store/slices/authSlice'
import { SessionUtils } from '@/lib/utils/session-utils'

export function useAuthSync() {
  const { data: session, status } = useSession()
  const dispatch = useDispatch()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (session?.user) {
      // User is authenticated - sync with Redux
      const user = session.user as any // Type assertion for extended user properties
      dispatch(setAuth({
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'user',
        avatar: user.avatar,
      }))
      setIsInitialized(true)
    } else {
      // No session - clear everything
      dispatch(clearAuth())
      SessionUtils.clearAllAuthData()
      setIsInitialized(true)
    }
  }, [session, status, dispatch])

  // Validate session periodically
  useEffect(() => {
    if (!isInitialized) return

    const validateSession = () => {
      if (status === 'authenticated' && session) {
        // Validate localStorage consistency
        if (!SessionUtils.validateAndCleanSession()) {
          console.warn('Session validation failed, signing out...')
          signOut({ callbackUrl: '/auth/login' })
        }
      }
    }

    // Validate immediately
    validateSession()

    // Set up periodic validation (every 2 minutes)
    const interval = setInterval(validateSession, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isInitialized, session, status])

  return {
    session,
    status,
    isInitialized,
    isAuthenticated: status === 'authenticated' && !!session?.user,
  }
}

export default useAuthSync