import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabase'

/**
 * Hook to sync Next-Auth session with Supabase auth
 * This is required for Supabase Realtime to work with RLS policies
 */
export function useSupabaseAuth() {
  const { data: session, status } = useSession()

  useEffect(() => {
    const syncAuth = async () => {
      if (status === 'loading') return

      if (session?.user) {
        // Get or create a Supabase session using the user's ID
        // For now, we'll use anonymous auth since we're using Next-Auth
        console.log('🔐 Syncing Next-Auth session with Supabase')
        
        // Check current Supabase session
        const { data: supabaseSession } = await supabase.auth.getSession()
        console.log('🔐 Current Supabase session:', supabaseSession)
        
        // If no Supabase session, we need to authenticate
        // Option 1: Use anonymous sign-in (simple but less secure)
        if (!supabaseSession.session) {
          console.log('🔐 No Supabase session, signing in anonymously')
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) {
            console.error('❌ Supabase auth error:', error)
          } else {
            console.log('✅ Supabase anonymous auth successful:', data)
          }
        } else {
          console.log('✅ Supabase session already exists')
        }
      } else if (!session) {
        // Sign out from Supabase when Next-Auth session ends
        console.log('🔐 No Next-Auth session, signing out from Supabase')
        await supabase.auth.signOut()
      }
    }

    syncAuth()
  }, [session, status])

  return { session, status }
}
