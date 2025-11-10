/**
 * Utility functions for managing session and cache cleanup
 */

export const SessionUtils = {
  /**
   * Clear all authentication-related data from browser storage
   */
  clearAllAuthData(): void {
    if (typeof window === 'undefined') return

    try {
      // Clear localStorage
      localStorage.removeItem('logged_in_user')
      localStorage.removeItem('user_permissions')
      localStorage.removeItem('user_role')
      localStorage.removeItem('user_department')
      
      // Clear any other cached user data
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('user_') || 
        key.startsWith('auth_') || 
        key.startsWith('session_') ||
        key.startsWith('next-auth.')
      )
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // Clear sessionStorage
      sessionStorage.clear()

      console.log('✅ All authentication data cleared from browser storage')
    } catch (error) {
      console.error('❌ Error clearing authentication data:', error)
    }
  },

  /**
   * Validate current session and clear invalid data
   */
  validateAndCleanSession(): boolean {
    if (typeof window === 'undefined') return false

    try {
      const storedUser = localStorage.getItem('logged_in_user')
      const storedPermissions = localStorage.getItem('user_permissions')

      // If we have user data but no session, clear everything
      if (storedUser && !document.cookie.includes('next-auth.session-token')) {
        console.warn('⚠️ Found stored user data but no valid session token, cleaning up...')
        this.clearAllAuthData()
        return false
      }

      // Validate stored user data structure
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        if (!userData.id || !userData.email) {
          console.warn('⚠️ Invalid user data structure, cleaning up...')
          this.clearAllAuthData()
          return false
        }
      }

      return true
    } catch (error) {
      console.error('❌ Error validating session:', error)
      this.clearAllAuthData()
      return false
    }
  },


  /**
   * Initialize session validation on app start
   */
  initializeSessionValidation(): void {
    if (typeof window === 'undefined') return

    // Validate session on page load
    this.validateAndCleanSession()

    // Listen for storage changes (logout in other tabs)
    window.addEventListener('storage', (event) => {
      if (event.key === 'logged_in_user' && event.newValue === null) {
        // User logged out in another tab
        console.log('🔄 Logout detected in another tab, syncing...')
        this.clearAllAuthData()
        window.location.href = '/auth/login'
      }
    })

    // Periodic session validation (every 5 minutes)
    setInterval(() => {
      if (!this.validateAndCleanSession()) {
        window.location.href = '/auth/login'
      }
    }, 5 * 60 * 1000) // 5 minutes
  }
}

export default SessionUtils