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
  }, [])

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
        // Permissions API not supported, assume unknown
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
          error: 'Voice recording requires HTTPS or localhost. Please use a secure connection.',
          permissionStatus: 'denied'
        }))
        return false
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted - stop the stream immediately
      stream.getTracks().forEach(track => track.stop())
      setState(prev => ({ ...prev, permissionStatus: 'granted', error: null }))
      return true
    } catch (error: any) {
      let errorMessage = 'Microphone permission denied'
      let permissionStatus: 'denied' | 'prompt' = 'denied'
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings and refresh the page.'
        permissionStatus = 'denied'
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.'
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is being used by another application. Please close other apps and try again.'
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Voice recording is not allowed due to security restrictions. Please use HTTPS.'
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
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      streamRef.current = stream
      audioChunksRef.current = []

      // Determine the best supported audio format
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
        setState(prev => ({ ...prev, error: 'Recording error occurred', isRecording: false }))
      }

      // Start recording with small time slices for better streaming
      mediaRecorder.start(100)
      startTimeRef.current = Date.now()
      pausedDurationRef.current = 0

      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000)
        
        // Check max duration
        if (elapsed >= MAX_RECORDING_DURATION) {
          stopRecording()
          return
        }

        setState(prev => ({ ...prev, duration: elapsed }))
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
        errorMessage = 'Microphone permission denied. Please allow microphone access.'
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.'
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is in use by another application.'
      }

      setState(prev => ({ ...prev, error: errorMessage }))
    }
  }, [state.isSupported])

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
    formatDuration
  }
}

export default useVoiceRecorder
