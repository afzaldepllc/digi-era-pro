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
  checkPermission: () => Promise<PermissionState | null>
  requestPermission: () => Promise<boolean>
}

const MAX_RECORDING_DURATION = 300 // 5 minutes max

/**
 * Check if microphone is available in the permissions policy
 */
function checkMicrophonePolicy(): boolean {
  if (typeof document === 'undefined') return true

  // Check if we're in a secure context (HTTPS or localhost)
  if (!window.isSecureContext) {
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

  // Check permission status on mount
  useEffect(() => {
    checkPermission()
  }, [])

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

  // Check microphone permission status
  const checkPermission = useCallback(async (): Promise<PermissionState | null> => {
    try {
      if (!navigator.permissions) {
        // Permissions API not supported (common on mobile Safari, some older browsers)
        console.debug('Permissions API not supported, will request on first use')
        setState(prev => ({ ...prev, permissionStatus: 'unknown' }))
        return null
      }

      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setState(prev => ({ ...prev, permissionStatus: result.state as 'prompt' | 'granted' | 'denied' }))

      // Listen for permission changes
      result.onchange = () => {
        setState(prev => ({ ...prev, permissionStatus: result.state as 'prompt' | 'granted' | 'denied' }))
      }

      return result.state
    } catch (error) {
      // Some browsers don't support microphone permission query
      console.debug('Permission query not supported:', error)
      setState(prev => ({ ...prev, permissionStatus: 'unknown' }))
      return null
    }
  }, [])

  // Request microphone permission without starting recording
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check permissions policy first
      if (!checkMicrophonePolicy()) {
        setState(prev => ({
          ...prev,
          error: 'Voice recording requires HTTPS or localhost. Please ensure you are using a secure connection.',
          permissionStatus: 'denied'
        }))
        return false
      }

      // Check if we can query permissions first
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
              error: 'Microphone permission was previously denied. Please enable it in your browser settings and refresh the page.',
              permissionStatus: 'denied'
            }))
            return false
          }
        } catch (permError) {
          console.debug('Permission query failed, proceeding with getUserMedia:', permError)
        }
      }

      // Request microphone access with optimized constraints for better compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      // Permission granted - stop the stream immediately
      stream.getTracks().forEach(track => track.stop())
      setState(prev => ({ ...prev, permissionStatus: 'granted', error: null }))
      return true
    } catch (error: any) {
      console.error('Microphone permission error:', error)
      let errorMessage = 'Unable to access microphone'
      let permissionStatus: 'denied' | 'prompt' = 'denied'

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access was denied. Please click "Allow" when prompted, or enable microphone access in your browser settings.'
        permissionStatus = 'denied'
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.'
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is being used by another application. Please close other apps using the microphone and try again.'
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the required audio format. Trying with basic settings...'
        // Retry with minimal constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          fallbackStream.getTracks().forEach(track => track.stop())
          setState(prev => ({ ...prev, permissionStatus: 'granted', error: null }))
          return true
        } catch (fallbackError) {
          errorMessage = 'Microphone setup failed. Please try a different browser or device.'
        }
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Voice recording requires a secure connection (HTTPS). Please ensure you are on a secure website.'
        permissionStatus = 'denied'
      } else if (error.name === 'AbortError') {
        errorMessage = 'Microphone access was interrupted. Please try again.'
        permissionStatus = 'prompt'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Voice recording is not supported in this browser. Please try a different browser.'
        permissionStatus = 'denied'
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
    requestPermission
  }
}

export default useVoiceRecorder
