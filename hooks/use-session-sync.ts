"use client"

import { useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useDispatch } from 'react-redux'
import { setAuth, clearAuth } from '@/store/slices/authSlice'

/**
 * Hook to synchronize session state across browser tabs
 * and ensure consistent behavior when user logs out in another tab
 */
export function useSessionSync() {
  const { data: session, status } = useSession()
  const dispatch = useDispatch()

  // Handle storage events for cross-tab synchronization
  const handleStorageChange = useCallback(
    (event: StorageEvent) => {
      // If logged_in_user is removed in another tab, sign out in this tab
      if (event.key === 'logged_in_user' && !event.newValue && session) {
        console.log('User logged out in another tab, signing out...')
        signOut({ redirect: false })
      }

      // If session warning is cleared in another tab, sync the state
      if (event.key === 'sessionWarning' && !event.newValue) {
        // Session warning was dismissed in another tab
        // This could trigger UI updates if needed
      }

      // If lastActivity is updated in another tab, we don't need to do anything
      // as the activity monitor will pick it up automatically
    },
    [session]
  )

  // Sync Redux state with NextAuth session
  const syncReduxState = useCallback(() => {
    if (status === 'authenticated' && session?.user) {
      dispatch(
        setAuth({
          id: (session.user as any).id,
          name: session.user.name || '',
          email: session.user.email || '',
          role: (session.user as any).role || 'user',
          avatar: (session.user as any).avatar,
        })
      )
    } else if (status === 'unauthenticated') {
      dispatch(clearAuth())
    }
  }, [session, status, dispatch])

  useEffect(() => {
    syncReduxState()
  }, [syncReduxState])

  useEffect(() => {
    // Only add storage listener on client side
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
      }
    }
  }, [handleStorageChange])

  return {
    session,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  }
}