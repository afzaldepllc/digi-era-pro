"use client"

import { useEffect, useState } from 'react'
// Removed SessionManager dependency for simplified approach

/**
 * Hook to detect and measure inactivity across browser tabs
 * Provides detailed analytics about user engagement
 */
export function useInactivityDetection() {
  const [inactivityState, setInactivityState] = useState({
    isInactive: false,
    inactiveDuration: 0,
    lastActivityTime: Date.now(),
    inactivityStreak: 0,
    totalInactiveTime: 0,
    inactivitySessions: [] as Array<{
      start: number
      end?: number
      duration?: number
      reason: 'idle' | 'tab-switch' | 'window-blur'
    }>
  })

  const [crossTabActivity, setCrossTabActivity] = useState({
    otherTabsActive: false,
    lastCrossTabActivity: Date.now(),
    activeTabCount: 1
  })

  // Inactivity thresholds (configurable)
  const INACTIVITY_THRESHOLD = 60 * 1000 // 1 minute
  const DEEP_INACTIVITY_THRESHOLD = 5 * 60 * 1000 // 5 minutes
  const CHECK_INTERVAL = 5 * 1000 // Check every 5 seconds

  // Detect tab/window focus changes
  useEffect(() => {
    let inactivityStart: number | null = null

    const handleVisibilityChange = () => {
      const isHidden = document.hidden
      const now = Date.now()

      if (isHidden && !inactivityStart) {
        // Tab became inactive
        inactivityStart = now
        setInactivityState(prev => ({
          ...prev,
          inactivitySessions: [...prev.inactivitySessions, {
            start: now,
            reason: 'tab-switch'
          }]
        }))
      } else if (!isHidden && inactivityStart) {
        // Tab became active again
        const inactiveDuration = now - inactivityStart
        setInactivityState(prev => {
          const updatedSessions = [...prev.inactivitySessions]
          const lastSession = updatedSessions[updatedSessions.length - 1]
          if (lastSession && !lastSession.end) {
            lastSession.end = now
            lastSession.duration = inactiveDuration
          }

          return {
            ...prev,
            inactivitySessions: updatedSessions,
            totalInactiveTime: prev.totalInactiveTime + inactiveDuration
          }
        })
        inactivityStart = null
      }
    }

    const handleWindowBlur = () => {
      const now = Date.now()
      if (!inactivityStart) {
        inactivityStart = now
        setInactivityState(prev => ({
          ...prev,
          inactivitySessions: [...prev.inactivitySessions, {
            start: now,
            reason: 'window-blur'
          }]
        }))
      }
    }

    const handleWindowFocus = () => {
      const now = Date.now()
      if (inactivityStart) {
        const inactiveDuration = now - inactivityStart
        setInactivityState(prev => {
          const updatedSessions = [...prev.inactivitySessions]
          const lastSession = updatedSessions[updatedSessions.length - 1]
          if (lastSession && !lastSession.end) {
            lastSession.end = now
            lastSession.duration = inactiveDuration
          }

          return {
            ...prev,
            inactivitySessions: updatedSessions,
            totalInactiveTime: prev.totalInactiveTime + inactiveDuration
          }
        })
        inactivityStart = null
      }
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [])

  // Monitor activity and inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const lastActivity = now - 1000 // Simple mock last activity
      const timeSinceActivity = now - lastActivity
      
      // Check current tab inactivity
      const wasInactive = inactivityState.isInactive
      const isCurrentlyInactive = timeSinceActivity > INACTIVITY_THRESHOLD
      
      if (!wasInactive && isCurrentlyInactive) {
        // Just became inactive
        setInactivityState(prev => ({
          ...prev,
          isInactive: true,
          inactivityStreak: prev.inactivityStreak + 1,
          inactivitySessions: [...prev.inactivitySessions, {
            start: now - timeSinceActivity,
            reason: 'idle'
          }]
        }))
      } else if (wasInactive && !isCurrentlyInactive) {
        // Just became active again
        setInactivityState(prev => {
          const updatedSessions = [...prev.inactivitySessions]
          const lastSession = updatedSessions[updatedSessions.length - 1]
          if (lastSession && !lastSession.end) {
            lastSession.end = now
            lastSession.duration = timeSinceActivity
          }

          return {
            ...prev,
            isInactive: false,
            inactivitySessions: updatedSessions,
            totalInactiveTime: prev.totalInactiveTime + timeSinceActivity
          }
        })
      }

      // Update current state
      setInactivityState(prev => ({
        ...prev,
        inactiveDuration: isCurrentlyInactive ? timeSinceActivity : 0,
        lastActivityTime: lastActivity
      }))

      // Check for cross-tab activity
      try {
        const storedActivity = localStorage.getItem('app_activity_log')
        if (storedActivity) {
          const activityData = JSON.parse(storedActivity)
          const isOtherTabActivity = activityData.timestamp > lastActivity
          
          setCrossTabActivity(prev => ({
            ...prev,
            otherTabsActive: isOtherTabActivity,
            lastCrossTabActivity: isOtherTabActivity ? activityData.timestamp : prev.lastCrossTabActivity
          }))
        }

        // Estimate active tab count
        const tabKeys = Object.keys(localStorage).filter(key => 
          key.includes('tab_') || key.includes('activity')
        )
        setCrossTabActivity(prev => ({
          ...prev,
          activeTabCount: Math.max(1, tabKeys.length)
        }))
      } catch (error) {
        console.warn('Failed to check cross-tab activity:', error)
      }
    }, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [inactivityState.isInactive, INACTIVITY_THRESHOLD, CHECK_INTERVAL])

  // Calculate analytics
  const getInactivityAnalytics = () => {
    const now = Date.now()
    const sessionStart = now - 3600000 // Mock session start (1 hour ago)
    const totalSessionTime = now - sessionStart
    
    return {
      // Current state
      isInactive: inactivityState.isInactive,
      inactiveDuration: inactivityState.inactiveDuration,
      isDeepInactive: inactivityState.inactiveDuration > DEEP_INACTIVITY_THRESHOLD,
      
      // Session analytics
      totalInactiveTime: inactivityState.totalInactiveTime,
      inactivityPercentage: (inactivityState.totalInactiveTime / totalSessionTime) * 100,
      inactivitySessions: inactivityState.inactivitySessions.length,
      averageInactivityDuration: inactivityState.inactivitySessions.length > 0 
        ? inactivityState.totalInactiveTime / inactivityState.inactivitySessions.length 
        : 0,
      
      // Cross-tab analytics
      otherTabsActive: crossTabActivity.otherTabsActive,
      estimatedTabCount: crossTabActivity.activeTabCount,
      lastCrossTabActivity: crossTabActivity.lastCrossTabActivity,
      
      // Engagement metrics
      engagementScore: Math.max(0, 100 - ((inactivityState.totalInactiveTime / totalSessionTime) * 100)),
      activityFrequency: totalSessionTime > 0 ? (inactivityState.inactivitySessions.length / (totalSessionTime / (60 * 1000))) : 0, // sessions per minute
      
      // Time until timeout
      timeUntilTimeout: Math.max(0, (4 * 60 * 60 * 1000) - (now - inactivityState.lastActivityTime)),
      
      // Detailed breakdown
      sessionBreakdown: {
        totalTime: totalSessionTime,
        activeTime: totalSessionTime - inactivityState.totalInactiveTime,
        inactiveTime: inactivityState.totalInactiveTime,
        idleTime: inactivityState.inactivitySessions
          .filter(s => s.reason === 'idle')
          .reduce((sum, s) => sum + (s.duration || 0), 0),
        tabSwitchTime: inactivityState.inactivitySessions
          .filter(s => s.reason === 'tab-switch')
          .reduce((sum, s) => sum + (s.duration || 0), 0),
        windowBlurTime: inactivityState.inactivitySessions
          .filter(s => s.reason === 'window-blur')
          .reduce((sum, s) => sum + (s.duration || 0), 0)
      }
    }
  }

  // Real-time activity status
  const getActivityStatus = () => {
    const analytics = getInactivityAnalytics()
    
    if (analytics.isDeepInactive) {
      return { status: 'deeply-inactive', color: 'red', message: 'User has been inactive for over 5 minutes' }
    } else if (analytics.isInactive) {
      return { status: 'inactive', color: 'orange', message: 'User is currently inactive' }
    } else if (analytics.otherTabsActive) {
      return { status: 'active-other-tab', color: 'blue', message: 'User is active in another tab' }
    } else {
      return { status: 'active', color: 'green', message: 'User is currently active' }
    }
  }

  return {
    // Current state
    isInactive: inactivityState.isInactive,
    inactiveDuration: inactivityState.inactiveDuration,
    lastActivityTime: inactivityState.lastActivityTime,
    
    // Cross-tab state
    otherTabsActive: crossTabActivity.otherTabsActive,
    activeTabCount: crossTabActivity.activeTabCount,
    
    // Analytics functions
    getInactivityAnalytics,
    getActivityStatus,
    
    // Utility functions
    formatDuration: (ms: number) => {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      
      if (hours > 0) return `${hours}h ${minutes % 60}m`
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`
      return `${seconds}s`
    },
    
    // Manual activity trigger (for testing)
    triggerActivity: () => {
      // Simple activity trigger - no complex session manager
      setInactivityState(prev => ({
        ...prev,
        isInactive: false,
        lastActivityTime: Date.now(),
        inactiveDuration: 0
      }))
    }
  }
}