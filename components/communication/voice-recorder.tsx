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
  Trash2
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
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    resetRecording,
    formatDuration
  } = useVoiceRecorder()

  const [isSending, setIsSending] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    await startRecording()
  }, [startRecording])

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    await stopRecording()
  }, [stopRecording])

  // Handle toggle pause
  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resumeRecording()
    } else {
      pauseRecording()
    }
  }, [isPaused, pauseRecording, resumeRecording])

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

  // Recording state - show recording controls
  if (isRecording) {
    const progressPercent = (duration / maxDuration) * 100

    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20",
        className
      )}>
        {/* Recording indicator */}
        <div className="relative">
          <div className={cn(
            "h-3 w-3 rounded-full bg-red-500",
            !isPaused && "animate-pulse"
          )} />
        </div>

        {/* Duration and progress */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-red-500">
              {isPaused ? 'Paused' : 'Recording...'}
            </span>
            <span className="tabular-nums">{formatDuration(duration)}</span>
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Pause/Resume button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleTogglePause}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>

        {/* Stop button */}
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8"
          onClick={handleStopRecording}
        >
          <Square className="h-4 w-4" />
        </Button>

        {/* Cancel button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Preview state - show recorded audio
  if (audioBlob && audioUrl) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-primary/5 border",
        className
      )}>
        {/* Hidden audio element */}
        <audio ref={audioRef} src={audioUrl} />

        {/* Play/Pause button */}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={handleTogglePlayback}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>

        {/* Duration info */}
        <div className="flex-1">
          <p className="text-sm font-medium">Voice Message</p>
          <p className="text-xs text-muted-foreground">{formatDuration(duration)}</p>
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isSending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        {/* Send button */}
        <Button
          size="sm"
          onClick={handleSend}
          disabled={isSending || disabled}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send
        </Button>
      </div>
    )
  }

  // Default state - show record button
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9", className)}
      onClick={handleStartRecording}
      disabled={disabled}
      title="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </Button>
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
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9", className)}
      onClick={() => setIsExpanded(true)}
      disabled={disabled}
      title="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </Button>
  )
}

export default VoiceRecorder
