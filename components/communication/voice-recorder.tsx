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
    requestPermission
  } = useVoiceRecorder()

  const [isSending, setIsSending] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const startYRef = useRef<number>(0)

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: "Recording Error",
        description: error,
        variant: "destructive"
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
    startYRef.current = e.clientY
    setIsDragging(true)
    setDragOffset(0)

    // Request permission if not granted
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission()
      if (!granted) return
    }

    // Start recording
    await startRecording()
  }, [disabled, isRecording, permissionStatus, requestPermission, startRecording])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !isRecording) return

    const deltaY = startYRef.current - e.clientY
    setDragOffset(Math.max(0, Math.min(100, deltaY)))

    // Lock recording if dragged up enough
    if (deltaY > 50 && !isLocked) {
      setIsLocked(true)
    }
  }, [isDragging, isRecording, isLocked])

  const handlePointerUp = useCallback(async () => {
    if (!isDragging) return

    setIsDragging(false)

    if (isLocked) {
      // Keep recording, just unlock the drag
      setIsLocked(false)
      return
    }

    if (dragOffset > 80) {
      // Cancel recording if dragged too far
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
    const isNearCancel = dragOffset > cancelThreshold

    return (
      <div 
        ref={containerRef}
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
          className
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex flex-col items-center gap-6 p-8 bg-background rounded-2xl shadow-2xl max-w-sm mx-4">
          {/* Recording indicator */}
          <div className="relative">
            <div className={cn(
              "h-20 w-20 rounded-full bg-red-500 flex items-center justify-center transition-all duration-200",
              isNearCancel && "bg-red-700 scale-110",
              isLocked && "bg-blue-500"
            )}>
              {isLocked ? (
                <Lock className="h-8 w-8 text-white" />
              ) : (
                <Mic className={cn(
                  "h-8 w-8 text-white",
                  !isPaused && "animate-pulse"
                )} />
              )}
            </div>
            
            {/* Drag indicator */}
            {isDragging && !isLocked && (
              <div 
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-8 bg-white rounded-full transition-all"
                style={{ transform: `translateX(-50%) translateY(${dragOffset * 0.5}px)` }}
              />
            )}
          </div>

          {/* Duration and status */}
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-foreground mb-2">
              {formatDuration(duration)}
            </div>
            <div className="text-sm text-muted-foreground">
              {isLocked ? 'Recording locked - release to stop' : 
               isNearCancel ? 'Release to cancel' : 
               isPaused ? 'Recording paused' : 'Recording...'}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Instructions */}
          <div className="text-center text-xs text-muted-foreground">
            {!isLocked && (
              <div>Slide up to lock • Slide down to cancel</div>
            )}
            {isLocked && (
              <div>Tap the mic to stop recording</div>
            )}
          </div>

          {/* Stop button (only when locked) */}
          {isLocked && (
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full h-12 w-12 p-0"
              onClick={handleStopRecording}
            >
              <Square className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Preview state - show recorded audio
  if (audioBlob && audioUrl) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border-2 border-dashed border-primary/20",
        className
      )}>
        {/* Hidden audio element */}
        <audio ref={audioRef} src={audioUrl} />

        {/* Play/Pause button */}
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-2"
          onClick={handleTogglePlayback}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </Button>

        {/* Waveform visualization placeholder */}
        <div className="flex-1 flex items-center gap-1 px-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-1 bg-primary/60 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.1}s`,
                height: `${Math.random() * 20 + 8}px`
              }}
            />
          ))}
        </div>

        {/* Duration */}
        <div className="text-sm font-medium min-w-[40px] text-center">
          {formatDuration(duration)}
        </div>

        {/* Send button */}
        <Button
          size="sm"
          onClick={handleSend}
          disabled={isSending || disabled}
          className="rounded-full px-4"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isSending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
          permissionStatus === 'granted' ? "hover:bg-red-500/10 hover:text-red-500" : "hover:bg-muted",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onPointerDown={handlePointerDown}
        disabled={disabled}
        title={permissionStatus === 'granted' ? "Hold to record voice message" : "Click to enable microphone"}
      >
        <Mic className={cn(
          "h-6 w-6 transition-colors",
          permissionStatus === 'granted' && "text-red-500"
        )} />
      </Button>
      
      {/* Permission hint */}
      {permissionStatus !== 'granted' && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap">
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
