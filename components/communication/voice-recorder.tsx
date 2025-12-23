"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  X, 
  Send, 
  Loader2,
  MicOff,
  Trash2,
  Lock
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

interface VoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, duration: number) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
  className?: string
  maxDuration?: number // in seconds
}

export function VoiceRecorder({
  onSendVoice,
  onCancel,
  disabled = false,
  className,
  maxDuration = 300 // 5 minutes default
}: VoiceRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
    isSupported,
    permissionStatus,
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
  } = useVoiceRecorder()

  const [isSending, setIsSending] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const startYRef = useRef<number>(0)

  // Enhanced permission request with production guidance
  const handlePermissionRequest = useCallback(async () => {
    const isProduction = window.location.hostname !== 'localhost' && 
                       !window.location.hostname.includes('127.0.0.1') &&
                       !window.location.hostname.includes('192.168.') &&
                       !window.location.hostname.includes('10.') &&
                       !window.location.hostname.includes('172.')
    
    if (permissionStatus === 'denied') {
      // Provide specific guidance for both development and production
      if (isProduction) {
        toast({
          title: "Microphone Access Required",
          description: "🔒 Click the lock icon in your browser's address bar → Click 'Allow' for microphone → Refresh the page. This is required for voice messages to work.",
          duration: 15000,
          action: <ToastAction altText="Try Again" onClick={() => requestPermission()}>Try Again</ToastAction>
        })
      } else {
        toast({
          title: "Microphone Access Required",
          description: "Please click 'Allow' when your browser asks for microphone permission. You may need to refresh the page after granting permission.",
          duration: 10000,
          action: <ToastAction altText="Try Again" onClick={() => requestPermission()}>Try Again</ToastAction>
        })
      }
      return
    }
    
    // For production, add a small delay to ensure user interaction is registered
    if (isProduction) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    const granted = await requestPermission()
    if (!granted && permissionStatus === 'denied') {  
      // Additional guidance for production failures
      setTimeout(() => {
        toast({
          title: "Permission Still Blocked",
          description: "If the microphone permission is still blocked, try these steps: 1) Click the lock 🔒 icon in the address bar, 2) Change microphone to 'Allow', 3) Refresh the page.",
          duration: 15000,
          action: <ToastAction altText="Refresh Page" onClick={() => window.location.reload()}>Refresh Page</ToastAction>
        })
      }, 3000)
    }
  }, [permissionStatus, requestPermission])

  // Check permissions on mount and when component becomes visible
  useEffect(() => {
    // Only check permissions if we're not currently recording
    if (!isRecording) {
      checkPermission()
    }
  }, [checkPermission, isRecording])

  // Periodic permission check for production environments (permissions can be lost)
  useEffect(() => {
    const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')
    
    if (!isProduction) return // Only needed for production

    const interval = setInterval(async () => {
      if (!isRecording && document.visibilityState === 'visible') {
        try {
          await checkPermission()
        } catch (error) {
          // Silently handle permission check failures
          console.debug('Periodic permission check failed:', error)
        }
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [checkPermission, isRecording])

  // Show error toast with production-specific guidance
  useEffect(() => {
    if (error) {
      const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')
      
      toast({
        title: "Recording Error",
        description: isProduction 
          ? `${error} If the issue persists, try refreshing the page or using a different browser.`
          : error,
        variant: "destructive",
        duration: 8000 // Longer duration for production errors
      })
    }
  }, [error])

  // Handle audio playback ended
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      const handleEnded = () => setIsPlaying(false)
      audio.addEventListener('ended', handleEnded)
      return () => audio.removeEventListener('ended', handleEnded)
    }
  }, [audioUrl])

  // Handle touch/mouse events for WhatsApp-style recording
  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    if (disabled || isRecording) return

    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startYRef.current = e.clientY
    setIsDragging(true)
    setDragOffset(0)

    // Request permission if not granted
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission()
      if (!granted) {
        setIsDragging(false)
        return
      }
    }

    // Start recording
    try {
      await startRecording()
    } catch (error) {
      console.error('Failed to start recording:', error)
      setIsDragging(false)
    }
  }, [disabled, isRecording, permissionStatus, requestPermission, startRecording])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !isRecording) return

    const deltaY = startYRef.current - e.clientY
    const clampedOffset = Math.max(-100, Math.min(100, deltaY))
    setDragOffset(clampedOffset)

    // Lock recording if dragged up enough
    if (deltaY > 50 && !isLocked) {
      setIsLocked(true)
    } else if (deltaY < 30 && isLocked) {
      setIsLocked(false)
    }
  }, [isDragging, isRecording, isLocked])

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!isDragging) return

    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)

    if (isLocked) {
      // Keep recording, just unlock the drag
      setIsLocked(false)
      return
    }

    const cancelThreshold = 80
    if (dragOffset > cancelThreshold) {
      // Cancel recording if dragged too far down
      await cancelRecording()
      setDragOffset(0)
    } else {
      // Stop recording and prepare to send
      await stopRecording()
      setDragOffset(0)
    }
  }, [isDragging, isLocked, dragOffset, cancelRecording, stopRecording])

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    await stopRecording()
  }, [stopRecording])

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelRecording()
    onCancel?.()
  }, [cancelRecording, onCancel])

  // Handle playback toggle
  const handleTogglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [audioUrl, isPlaying])

  // Handle send voice message
  const handleSend = useCallback(async () => {
    if (!audioBlob) return

    setIsSending(true)
    try {
      await onSendVoice(audioBlob, duration)
      resetRecording()
    } catch (error) {
      console.error('Failed to send voice message:', error)
      toast({
        title: "Send failed",
        description: "Failed to send voice message. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSending(false)
    }
  }, [audioBlob, duration, onSendVoice, resetRecording])

  // Handle delete recording
  const handleDelete = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlaying(false)
    resetRecording()
  }, [resetRecording])

  // Not supported
  if (!isSupported) {
    return (
      <div className={cn("flex items-center gap-2 p-2 rounded-lg bg-muted/50", className)}>
        <MicOff className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Voice recording not supported in this browser
        </span>
      </div>
    )
  }

  // Recording state - WhatsApp style
  if (isRecording) {
    const progressPercent = (duration / maxDuration) * 100
    const cancelThreshold = 80
    const lockThreshold = 50
    const isNearCancel = dragOffset > cancelThreshold
    const isNearLock = dragOffset < -lockThreshold

    return (
      <div 
        ref={containerRef}
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center",
          "bg-black/60 backdrop-blur-sm",
          className
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex flex-col items-center gap-8 p-8">
          {/* Recording indicator - WhatsApp style */}
          <div className="relative flex flex-col items-center gap-4">
            {/* Main recording circle */}
            <div className={cn(
              "relative h-24 w-24 rounded-full flex items-center justify-center transition-all duration-200",
              isNearCancel ? "bg-red-600 scale-110" : 
              isLocked ? "bg-blue-500" : "bg-red-500"
            )}>
              {/* Pulsing rings */}
              {!isPaused && !isNearCancel && !isLocked && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-red-500/20 animate-ping" style={{ animationDelay: '0.5s' }} />
                </>
              )}
              
              {/* Icon */}
              {isLocked ? (
                <Lock className="h-10 w-10 text-white" />
              ) : isNearCancel ? (
                <X className="h-10 w-10 text-white" />
              ) : (
                <Mic className={cn(
                  "h-10 w-10 text-white",
                  !isPaused && "animate-pulse"
                )} />
              )}
            </div>

            {/* Drag indicators */}
            {isDragging && !isLocked && (
              <>
                {/* Lock indicator (slide up) */}
                <div className={cn(
                  "absolute -top-16 left-1/2 transform -translate-x-1/2 transition-all duration-200 flex flex-col items-center gap-1",
                  dragOffset < -20 ? "opacity-100 scale-100" : "opacity-50 scale-75"
                )}>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-xs text-white/60">Lock</div>
                </div>

                {/* Cancel indicator (slide down) */}
                <div className={cn(
                  "absolute -bottom-16 left-1/2 transform -translate-x-1/2 transition-all duration-200 flex flex-col items-center gap-1",
                  dragOffset > 20 ? "opacity-100 scale-100" : "opacity-50 scale-75"
                )}>
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <X className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-xs text-white/60">Cancel</div>
                </div>
              </>
            )}

            {/* Unlock indicator (when locked, slide down to unlock) */}
            {isDragging && isLocked && (
              <div className={cn(
                "absolute -bottom-16 left-1/2 transform -translate-x-1/2 transition-all duration-200 flex flex-col items-center gap-1",
                dragOffset > 20 ? "opacity-100 scale-100" : "opacity-50 scale-75"
              )}>
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div className="text-xs text-white/60">Unlock</div>
              </div>
            )}
          </div>

          {/* Duration and status */}
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-white mb-2 drop-shadow-lg">
              {formatDuration(duration)}
            </div>
            <div className="text-white/80 text-sm drop-shadow">
              {isLocked ? 'Slide down to unlock' : 
               isNearCancel ? 'Release to cancel' : 
               isNearLock ? 'Release to lock' :
               isPaused ? 'Recording paused' : 'Recording...'}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-64">
            <Progress 
              value={progressPercent} 
              className="h-1 bg-white/20 [&>div]:bg-white" 
            />
          </div>

          {/* Instructions */}
          {!isLocked && (
            <div className="text-center text-xs text-white/60 drop-shadow">
              <div>Slide up to lock • Slide down to cancel</div>
            </div>
          )}
          {isLocked && (
            <div className="text-center text-xs text-white/60 drop-shadow">
              <div>Slide down to unlock and stop</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Preview state - show recorded audio (WhatsApp style)
  if (audioBlob && audioUrl) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20",
        className
      )}>
        {/* Hidden audio element */}
        <audio ref={audioRef} src={audioUrl} />

        {/* Play/Pause button */}
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-2 hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={handleTogglePlayback}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </Button>

        {/* Waveform visualization */}
        <div className="flex-1 flex items-center gap-0.5 px-2 min-w-0">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 bg-primary/60 rounded-full transition-all duration-200",
                isPlaying && "animate-pulse"
              )}
              style={{
                height: `${Math.sin(i * 0.5) * 8 + 12}px`,
                minHeight: '4px',
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>

        {/* Duration */}
        <div className="text-sm font-medium min-w-[40px] text-center text-muted-foreground">
          {formatDuration(duration)}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={isSending}
            title="Delete recording"
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          {/* Send button */}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isSending || disabled}
            className="rounded-full px-6 bg-primary hover:bg-primary/90"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send
          </Button>
        </div>
      </div>
    )
  }

  // Default state - WhatsApp style mic button
  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-12 w-12 rounded-full transition-all duration-200",
          permissionStatus === 'granted' 
            ? "hover:bg-red-500/10 active:bg-red-500/20" 
            : "hover:bg-muted active:bg-muted/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onPointerDown={permissionStatus === 'granted' ? handlePointerDown : undefined}
        onClick={permissionStatus !== 'granted' ? handlePermissionRequest : undefined}
        disabled={disabled}
        title={
          permissionStatus === 'denied' 
            ? "Microphone access denied. Click to retry." 
            : permissionStatus === 'granted' 
              ? "Hold to record voice message" 
              : "Click to enable microphone"
        }
      >
        <Mic className={cn(
          "h-6 w-6 transition-colors",
          permissionStatus === 'granted' && "text-red-500",
          permissionStatus === 'denied' && "text-muted-foreground"
        )} />
      </Button>
      
      {/* Permission status indicator */}
      {permissionStatus === 'denied' && (
        <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-destructive text-destructive-foreground text-xs px-4 py-3 rounded-lg shadow-lg whitespace-nowrap max-w-xs text-center border">
          <MicOff className="h-4 w-4 inline mr-2" />
          <div className="font-semibold mb-1">Microphone Blocked</div>
          <div className="text-xs opacity-90 leading-tight">
            Click the 🔒 lock icon in your browser's address bar and allow microphone access, then refresh the page
          </div>
          <div className="mt-2 flex gap-2 justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                forcePermissionCheck()
              }}
              className="text-xs underline hover:no-underline"
            >
              Try Again
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                localStorage.removeItem('voice-recorder-permission')
                window.location.reload()
              }}
              className="text-xs underline hover:no-underline"
            >
              Reset
            </button>
          </div>
        </div>
      )}
      
      {permissionStatus === 'unknown' && (
        <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-muted text-muted-foreground text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
          <Mic className="h-3 w-3 inline mr-1" />
          Click to enable microphone
        </div>
      )}
    </div>
  )
}

// Compact voice recorder for inline use (just the mic button that expands)
interface CompactVoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, duration: number) => Promise<void>
  disabled?: boolean
  className?: string
}

export function CompactVoiceRecorder({
  onSendVoice,
  disabled = false,
  className
}: CompactVoiceRecorderProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleCancel = useCallback(() => {
    setIsExpanded(false)
  }, [])

  const handleSendVoice = useCallback(async (audioBlob: Blob, duration: number) => {
    await onSendVoice(audioBlob, duration)
    setIsExpanded(false)
  }, [onSendVoice])

  if (isExpanded) {
    return (
      <VoiceRecorder
        onSendVoice={handleSendVoice}
        onCancel={handleCancel}
        disabled={disabled}
        className={className}
      />
    )
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
        onClick={() => setIsExpanded(true)}
        disabled={disabled}
        title="Record voice message"
      >
        <Mic className="h-5 w-5" />
      </Button>
    </div>
  )
}

export default VoiceRecorder
