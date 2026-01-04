"use client"

import { useState, useRef, useCallback, useEffect } from 'react'

export interface VoiceRecorderState {
  isRecording: boolean
  isPaused: boolean
  duration: number // in seconds
  audioBlob: Blob | null
  audioUrl: string | null
  error: string | null
  isSupported: boolean
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown'
}

export interface UseVoiceRecorderReturn extends VoiceRecorderState {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void
  resetRecording: () => void
  formatDuration: (seconds: number) => string
  checkPermission: () => Promise<'prompt' | 'granted' | 'denied' | 'unknown' | null>
  requestPermission: () => Promise<boolean>
  forcePermissionCheck: () => Promise<void>
}

const MAX_RECORDING_DURATION = 300 // 5 minutes max

/**
 * Check if microphone is available in the permissions policy
 */
function checkMicrophonePolicy(): boolean {
  if (typeof document === 'undefined') return true

  // Check if we're in a secure context (HTTPS or localhost)
  // Note: Vercel serves over HTTPS, so this should pass in production
  if (!window.isSecureContext && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    console.warn('Voice recording requires a secure context (HTTPS or localhost)')
    return false
  }

  return true
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
    isSupported: typeof window !== 'undefined' && 'MediaRecorder' in window && 'mediaDevices' in navigator,
    permissionStatus: 'unknown'
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)

  // Load permission status from localStorage on mount
  useEffect(() => {
    const savedPermission = localStorage.getItem('voice-recorder-permission')
    if (savedPermission && ['granted', 'denied'].includes(savedPermission)) {
      setState(prev => ({ ...prev, permissionStatus: savedPermission as 'granted' | 'denied' }))
    } else {
      // Only check permissions if we don't have a saved state
      checkPermission()
    }
  }, [])

  // Save permission status to localStorage whenever it changes
  useEffect(() => {
    if (state.permissionStatus !== 'unknown') {
      localStorage.setItem('voice-recorder-permission', state.permissionStatus)
    }
  }, [state.permissionStatus])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl)
      }
    }
  }, [state.audioUrl])

  // Format duration as MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Check microphone permission status with better production support
  const checkPermission = useCallback(async (): Promise<'prompt' | 'granted' | 'denied' | 'unknown' | null> => {
    try {
      // First check if we have a saved permission state
      const savedPermission = localStorage.getItem('voice-recorder-permission')
      if (savedPermission === 'granted') {
        setState(prev => ({ ...prev, permissionStatus: 'granted' }))
        return 'granted'
      }
      if (savedPermission === 'denied') {
        setState(prev => ({ ...prev, permissionStatus: 'denied' }))
        return 'denied'
      }

      // Check Permissions API if available
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })

          // Update state based on permission result
          const permissionState = result.state as 'prompt' | 'granted' | 'denied'
          setState(prev => ({ ...prev, permissionStatus: permissionState }))

          // Save to localStorage for persistence
          if (permissionState !== 'prompt') {
            localStorage.setItem('voice-recorder-permission', permissionState)
          }

          // Listen for permission changes
          result.onchange = () => {
            const newState = result.state as 'prompt' | 'granted' | 'denied'
            setState(prev => ({ ...prev, permissionStatus: newState }))
            if (newState !== 'prompt') {
              localStorage.setItem('voice-recorder-permission', newState)
            }
          }

          return result.state
        } catch (permError) {
          // Permissions API failed - common in production, try getUserMedia test
          console.debug('Permissions API failed, testing with getUserMedia:', permError)

          // Try a quick permission test (this will trigger permission prompt if needed)
          try {
            const testStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
            })
            testStream.getTracks().forEach(track => track.stop())

            setState(prev => ({ ...prev, permissionStatus: 'granted' }))
            localStorage.setItem('voice-recorder-permission', 'granted')
            return 'granted'
          } catch (testError: any) {
            if (testError.name === 'NotAllowedError' || testError.name === 'PermissionDeniedError') {
              setState(prev => ({ ...prev, permissionStatus: 'denied' }))
              localStorage.setItem('voice-recorder-permission', 'denied')
              return 'denied'
            }
            // Other errors - assume prompt state
            setState(prev => ({ ...prev, permissionStatus: 'prompt' }))
            return 'prompt'
          }
        }
      } else {
        // Permissions API not supported - try getUserMedia test
        console.debug('Permissions API not supported, testing with getUserMedia')

        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
          })
          testStream.getTracks().forEach(track => track.stop())

          setState(prev => ({ ...prev, permissionStatus: 'granted' }))
          localStorage.setItem('voice-recorder-permission', 'granted')
          return 'granted'
        } catch (testError: any) {
          if (testError.name === 'NotAllowedError' || testError.name === 'PermissionDeniedError') {
            setState(prev => ({ ...prev, permissionStatus: 'denied' }))
            localStorage.setItem('voice-recorder-permission', 'denied')
            return 'denied'
          }
          // Other errors - assume prompt state
          setState(prev => ({ ...prev, permissionStatus: 'prompt' }))
          return 'prompt'
        }
      }
    } catch (error) {
      console.error('Permission check failed:', error)
      setState(prev => ({ ...prev, permissionStatus: 'unknown' }))
      return null
    }
  }, [])

  // Request microphone permission without starting recording
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check permissions policy first (relaxed for production)
      if (!checkMicrophonePolicy()) {
        setState(prev => ({
          ...prev,
          error: 'Voice recording requires HTTPS. Please ensure you are using a secure connection.',
          permissionStatus: 'denied'
        }))
        return false
      }

      // Check if we can query permissions first (with better error handling for production)
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (result.state === 'granted') {
            setState(prev => ({ ...prev, permissionStatus: 'granted', error: null }))
            return true
          }
          if (result.state === 'denied') {
            setState(prev => ({
              ...prev,
              error: 'Microphone access was denied. Please click the lock icon in your browser address bar and allow microphone access, then refresh the page.',
              permissionStatus: 'denied'
            }))
            return false
          }
          // result.state === 'prompt' - continue to request access
        } catch (permError) {
          // Permission query failed - this is common in production, continue with getUserMedia
          console.debug('Permission query failed (normal in production):', permError)
        }
      }

      // Request microphone access with optimized constraints for better compatibility
      // Use more conservative constraints for production environments
      const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')
      const audioConstraints = isProduction ? {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Use more conservative settings for production
          sampleRate: 16000,
          channelCount: 1
        }
      } : {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints)

      // Permission granted - stop the stream immediately
      stream.getTracks().forEach(track => track.stop())
      setState(prev => ({ ...prev, permissionStatus: 'granted', error: null }))
      localStorage.setItem('voice-recorder-permission', 'granted')
      return true
    } catch (error: any) {
      console.error('Microphone permission error:', error)
      let errorMessage = 'Unable to access microphone'
      let permissionStatus: 'denied' | 'prompt' = 'denied'

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access was denied. Please click "Allow" when prompted by your browser, or check your browser settings to enable microphone access for this site.'
        permissionStatus = 'denied'
        localStorage.setItem('voice-recorder-permission', 'denied')
        permissionStatus = 'denied'
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.'
        permissionStatus = 'prompt'
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is being used by another application. Please close other apps using the microphone and try again.'
        permissionStatus = 'prompt'
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the required audio format. Trying with basic settings...'
        // Retry with minimal constraints (more aggressive fallback for production)
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          })
          fallbackStream.getTracks().forEach(track => track.stop())
          setState(prev => ({ ...prev, permissionStatus: 'granted', error: null }))
          return true
        } catch (fallbackError: any) {
          console.error('Fallback microphone access failed:', fallbackError)
          errorMessage = 'Microphone setup failed. Please try refreshing the page or using a different browser.'
        }
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Voice recording requires a secure connection. This may be a browser security restriction.'
        permissionStatus = 'denied'
      } else if (error.name === 'AbortError') {
        errorMessage = 'Microphone access was interrupted. Please try again.'
        permissionStatus = 'prompt'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Voice recording is not supported in this browser. Please try using Chrome, Firefox, or Safari.'
        permissionStatus = 'denied'
      } else {
        // Generic error for production - provide helpful guidance
        errorMessage = 'Unable to access microphone. Please ensure you have a microphone connected and try refreshing the page.'
      }

      setState(prev => ({ ...prev, error: errorMessage, permissionStatus }))
      return false
    }
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Voice recording is not supported in this browser' }))
      return
    }

    try {
      // Ensure we have permission before starting
      if (state.permissionStatus !== 'granted') {
        const hasPermission = await requestPermission()
        if (!hasPermission) {
          return
        }
      }

      // Get microphone access with optimized settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus'
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4'
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = '' // Let browser choose
            }
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        let errorMessage = 'Recording failed'

        if (event.error?.name === 'NotAllowedError') {
          errorMessage = 'Microphone access was revoked during recording'
        } else if (event.error?.name === 'NotReadableError') {
          errorMessage = 'Microphone became unavailable during recording'
        }

        setState(prev => ({ ...prev, error: errorMessage, isRecording: false }))
      }

      // Start recording with small time slices for better streaming
      mediaRecorder.start(100)
      startTimeRef.current = Date.now()
      pausedDurationRef.current = 0

      // Start timer with error handling
      timerRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          const elapsed = (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000
          setState(prev => {
            if (elapsed >= MAX_RECORDING_DURATION) {
              // Auto-stop recording at max duration
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop()
              }
              return { ...prev, duration: MAX_RECORDING_DURATION }
            }
            return { ...prev, duration: elapsed }
          })
        }
      }, 100)

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        error: null
      }))
    } catch (error: any) {
      console.error('Failed to start recording:', error)
      let errorMessage = 'Failed to start recording'

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission is required. Please allow access and try again.'
        setState(prev => ({ ...prev, permissionStatus: 'denied' }))
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone detected. Please connect a microphone.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone is busy. Please close other applications using the microphone.'
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support required audio settings.'
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Recording blocked by security policy. Please use HTTPS.'
      }

      setState(prev => ({ ...prev, error: errorMessage }))
    }
  }, [state.isSupported, state.permissionStatus, requestPermission])

  // Stop recording and return the audio blob
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      const mediaRecorder = mediaRecorderRef.current
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setState(prev => ({ ...prev, isRecording: false, isPaused: false }))
        resolve(null)
        return
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const audioUrl = URL.createObjectURL(audioBlob)

        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioBlob,
          audioUrl
        }))

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        resolve(audioBlob)
      }

      mediaRecorder.stop()
    })
  }, [])

  // Pause recording
  const pauseRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause()
      pausedDurationRef.current = Date.now() - startTimeRef.current - (state.duration * 1000)
      setState(prev => ({ ...prev, isPaused: true }))
    }
  }, [state.duration])

  // Resume recording
  const resumeRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume()
      startTimeRef.current = Date.now() - (state.duration * 1000)
      setState(prev => ({ ...prev, isPaused: false }))
    }
  }, [state.duration])

  // Cancel recording without saving
  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    audioChunksRef.current = []

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null
    }))
  }, [])

  // Reset to initial state
  const resetRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl)
    }

    setState(prev => ({
      ...prev,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null
    }))
  }, [state.audioUrl])

  // Force re-check permissions (useful for production troubleshooting)
  const forcePermissionCheck = useCallback(async () => {
    // Clear saved permission state
    localStorage.removeItem('voice-recorder-permission')
    // Re-check permissions
    await checkPermission()
  }, [checkPermission])

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    resetRecording,
    formatDuration,
    checkPermission,
    requestPermission,
    forcePermissionCheck
  }
}

export default useVoiceRecorder
