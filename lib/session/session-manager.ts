/**
 * Professional Session Manager for NextJS Application
 * Handles cross-tab synchronization, automatic logout, and session state management
 * Following NextJS and NextAuth best practices
 */

interface SessionData {
  userId: string
  email: string
  name: string
  role: string
  avatar?: string
  lastActivity: number
  sessionStart: number
}

export class SessionManager {
  private static readonly STORAGE_KEYS = {
    SESSION_DATA: 'app_session_data',
    LAST_ACTIVITY: 'app_last_activity',
    LOGOUT_SIGNAL: 'app_logout_signal',
    LOGIN_SIGNAL: 'app_login_signal'
  } as const

  private static readonly SESSION_TIMEOUT = 1 * 60 * 60 * 1000 // session time out after 1 hour if user inactive 
  private static readonly ACTIVITY_EVENTS = [
    'mousedown', 'mousemove', 'keypress', 'scroll', 
    'touchstart', 'click', 'focus', 'keydown'
  ]

  /**
   * Initialize session management for the current tab
   */
  static initialize(sessionData: SessionData): void {
    if (typeof window === 'undefined') return

    try {
      // Store session data
      localStorage.setItem(
        this.STORAGE_KEYS.SESSION_DATA, 
        JSON.stringify(sessionData)
      )
      
      // Record initial activity
      this.updateActivity()
      
      // Signal login to other tabs
      localStorage.setItem(
        this.STORAGE_KEYS.LOGIN_SIGNAL, 
        Date.now().toString()
      )
      
      // Start activity monitoring
      this.startActivityMonitoring()
      
      console.log('Session initialized successfully')
    } catch (error) {
      console.error('Failed to initialize session:', error)
    }
  }

  /**
   * Update user activity timestamp
   */
  static updateActivity(): void {
    if (typeof window === 'undefined') return

    try {
      const now = Date.now()
      localStorage.setItem(this.STORAGE_KEYS.LAST_ACTIVITY, now.toString())
    } catch (error) {
      console.warn('Failed to update activity:', error)
    }
  }

  /**
   * Get current session data
   */
  static getSessionData(): SessionData | null {
    if (typeof window === 'undefined') return null

    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.SESSION_DATA)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.warn('Failed to get session data:', error)
      return null
    }
  }

  /**
   * Check if session is expired
   */
  static isSessionExpired(): boolean {
    if (typeof window === 'undefined') return true

    try {
      const lastActivity = localStorage.getItem(this.STORAGE_KEYS.LAST_ACTIVITY)
      if (!lastActivity) return true

      const timeSinceActivity = Date.now() - parseInt(lastActivity)
      return timeSinceActivity > this.SESSION_TIMEOUT
    } catch (error) {
      console.warn('Failed to check session expiry:', error)
      return true
    }
  }

  /**
   * Get time until session expires (in milliseconds)
   */
  static getTimeUntilExpiry(): number {
    if (typeof window === 'undefined') return 0

    try {
      const lastActivity = localStorage.getItem(this.STORAGE_KEYS.LAST_ACTIVITY)
      if (!lastActivity) return 0

      const timeSinceActivity = Date.now() - parseInt(lastActivity)
      const timeRemaining = this.SESSION_TIMEOUT - timeSinceActivity
      return Math.max(0, timeRemaining)
    } catch (error) {
      console.warn('Failed to get time until expiry:', error)
      return 0
    }
  }

  /**
   * Clear session data (logout)
   */
  static clearSession(): void {
    if (typeof window === 'undefined') return

    try {
      // Clear session storage
      localStorage.removeItem(this.STORAGE_KEYS.SESSION_DATA)
      localStorage.removeItem(this.STORAGE_KEYS.LAST_ACTIVITY)
      
      // Signal logout to other tabs
      localStorage.setItem(
        this.STORAGE_KEYS.LOGOUT_SIGNAL, 
        Date.now().toString()
      )

      // Stop activity monitoring
      this.stopActivityMonitoring()

      // Clear legacy data
      this.clearLegacyData()
      
      console.log('Session cleared successfully')
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  }

  /**
   * Start monitoring user activity
   */
  private static startActivityMonitoring(): void {
    if (typeof window === 'undefined') return

    // Remove existing listeners first
    this.stopActivityMonitoring()

    // Add activity event listeners
    this.ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, this.handleActivity, { passive: true })
    })
  }

  /**
   * Stop monitoring user activity
   */
  private static stopActivityMonitoring(): void {
    if (typeof window === 'undefined') return

    this.ACTIVITY_EVENTS.forEach(event => {
      document.removeEventListener(event, this.handleActivity)
    })
  }

  /**
   * Handle user activity
   */
  private static handleActivity = (): void => {
    this.updateActivity()
  }

  /**
   * Clear legacy session data
   */
  private static clearLegacyData(): void {
    if (typeof window === 'undefined') return

    try {
      const legacyKeys = [
        'logged_in_user',
        'user_permissions', 
        'user_role',
        'user_department',
        'lastActivity',
        'app_activity_log',
        'sessionWarning',
        'force_logout'
      ]

      legacyKeys.forEach(key => {
        localStorage.removeItem(key)
      })

      // Clear sessionStorage
      sessionStorage.clear()
    } catch (error) {
      console.warn('Failed to clear legacy data:', error)
    }
  }

  /**
   * Setup cross-tab event listeners
   */
  static setupCrossTabSync(callbacks: {
    onLogin?: () => void
    onLogout?: () => void
    onSessionExpired?: () => void
  }): () => void {
    if (typeof window === 'undefined') return () => {}

    const handleStorageChange = (event: StorageEvent) => {
      try {
        if (event.key === this.STORAGE_KEYS.LOGIN_SIGNAL && event.newValue) {
          callbacks.onLogin?.()
        }
        
        if (event.key === this.STORAGE_KEYS.LOGOUT_SIGNAL && event.newValue) {
          callbacks.onLogout?.()
        }
      } catch (error) {
        console.warn('Failed to handle storage change:', error)
      }
    }

    // Check for session expiry periodically
    const expiryCheckInterval = setInterval(() => {
      if (this.isSessionExpired() && this.getSessionData()) {
        callbacks.onSessionExpired?.()
      }
    }, 30000) // Check every 30 seconds

    window.addEventListener('storage', handleStorageChange)

    // Return cleanup function
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(expiryCheckInterval)
    }
  }
}

export default SessionManager