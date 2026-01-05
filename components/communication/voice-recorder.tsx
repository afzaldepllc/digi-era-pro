"use client"

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
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
  AlertCircle
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import useVoiceRecorder from '@/hooks/use-voice-recorder'

interface VoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, duration: number) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
  className?: string
  maxDuration?: number // in seconds
}

/**
 * Professional Voice Recorder Component - WhatsApp Web Style
 * 
 * Features:
 * - Click to start, click to stop (simpler than hold-to-record)
 * - Visual audio level indicator
 * - Playback preview before sending
 * - Pause/Resume support
 * - Professional error handling with user guidance
 */
export const VoiceRecorder = memo(function VoiceRecorder({
  onSendVoice,
  onCancel,
  disabled = false,
  className,
  maxDuration = 300
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
    audioLevel,
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
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Handle permission request with toast feedback
  const handleRequestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermission()
    
    if (!granted) {
      toast({
        title: "Microphone Access Required",
        description: permissionStatus === 'denied' 
          ? "Click the lock icon (🔒) in your browser's address bar, allow microphone access, then refresh the page."
          : "Please allow microphone access when prompted by your browser.",
        variant: "destructive",
        duration: 10000
      })
    }
    return granted
  }, [requestPermission, permissionStatus])

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      const granted = await handleRequestPermission()
      if (!granted) return
    }

    const started = await startRecording()
    if (!started && error) {
      toast({
        title: "Recording Failed",
        description: error,
        variant: "destructive"
      })
    }
  }, [permissionStatus, handleRequestPermission, startRecording, error])

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    await stopRecording()
  }, [stopRecording])

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
    }
    cancelRecording()
    onCancel?.()
  }, [isPlaying, cancelRecording, onCancel])

  // Handle playback toggle
  const handleTogglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
      }
    } else {
      audioRef.current.play()
      setIsPlaying(true)
      
      // Update progress during playback
      playbackIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100
          setPlaybackProgress(progress)
        }
      }, 100)
    }
  }, [audioUrl, isPlaying])

  // Handle audio ended
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => {
      setIsPlaying(false)
      setPlaybackProgress(0)
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
      }
    }

    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('ended', handleEnded)
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
      }
    }
  }, [audioUrl])

  // Handle send voice message
  const handleSend = useCallback(async () => {
    if (!audioBlob) return

    setIsSending(true)
    try {
      await onSendVoice(audioBlob, duration)
      resetRecording()
      setPlaybackProgress(0)
    } catch (err) {
      console.error('Failed to send voice message:', err)
      toast({
        title: "Send Failed",
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
    setPlaybackProgress(0)
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
    }
    resetRecording()
  }, [resetRecording])

  // Show error toast when error changes
  useEffect(() => {
    if (error && !isRecording) {
      toast({
        title: "Recording Error",
        description: error,
        variant: "destructive"
      })
    }
  }, [error, isRecording])

  // Not supported state
  if (!isSupported) {
    return (
      <div className={cn("flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground", className)}>
        <MicOff className="h-5 w-5" />
        <span className="text-sm">Voice recording is not supported in this browser</span>
      </div>
    )
  }

  // Recording state - WhatsApp style overlay
  if (isRecording) {
    const progressPercent = (duration / maxDuration) * 100

    return (
      <div className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm",
        className
      )}>
        <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full">
          {/* Main recording indicator */}
          <div className="relative">
            {/* Outer pulsing ring */}
            {!isPaused && (
              <div 
                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                style={{ 
                  transform: `scale(${1 + audioLevel * 0.5})`,
                  transition: 'transform 0.1s ease-out'
                }}
              />
            )}
            
            {/* Audio level ring */}
            <div 
              className={cn(
                "absolute inset-0 rounded-full transition-all duration-100",
                isPaused ? "bg-yellow-500/30" : "bg-red-500/30"
              )}
              style={{ 
                transform: `scale(${1.2 + audioLevel * 0.6})`,
              }}
            />
            
            {/* Main button */}
            <div className={cn(
              "relative h-24 w-24 rounded-full flex items-center justify-center transition-colors",
              isPaused ? "bg-yellow-500" : "bg-red-500"
            )}>
              <Mic className={cn(
                "h-10 w-10 text-white",
                !isPaused && "animate-pulse"
              )} />
            </div>
          </div>

          {/* Duration */}
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-white mb-1">
              {formatDuration(duration)}
            </div>
            <div className="text-white/70 text-sm">
              {isPaused ? 'Paused' : 'Recording...'}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs">
            <Progress 
              value={progressPercent} 
              className="h-1.5 bg-white/20 [&>div]:bg-white" 
            />
            <div className="flex justify-between text-xs text-white/50 mt-1">
              <span>{formatDuration(duration)}</span>
              <span>{formatDuration(maxDuration)}</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-4">
            {/* Cancel button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={handleCancel}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Pause/Resume button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={isPaused ? resumeRecording : pauseRecording}
            >
              {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </Button>

            {/* Stop button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-white text-red-500 hover:bg-white/90"
              onClick={handleStopRecording}
            >
              <Square className="h-6 w-6 fill-current" />
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-center text-xs text-white/50">
            Press Stop when done
          </div>
        </div>
      </div>
    )
  }

  // Preview state - show recorded audio
  if (audioBlob && audioUrl) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20",
        className
      )}>
        {/* Hidden audio element */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* Play/Pause button */}
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-2 shrink-0"
          onClick={handleTogglePlayback}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        {/* Waveform visualization */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-0.5 h-8 px-1">
            {Array.from({ length: 40 }).map((_, i) => {
              const isActive = isPlaying && (i / 40) * 100 <= playbackProgress
              const height = Math.sin(i * 0.4) * 12 + 16
              
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-all duration-150",
                    isActive ? "bg-primary" : "bg-primary/30"
                  )}
                  style={{
                    height: `${height}px`,
                    minHeight: '4px'
                  }}
                />
              )
            })}
          </div>
          
          {/* Progress bar underneath */}
          <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        </div>

        {/* Duration */}
        <div className="text-sm font-medium text-muted-foreground min-w-[40px] text-center shrink-0">
          {formatDuration(duration)}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
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

          <Button
            size="sm"
            onClick={handleSend}
            disabled={isSending || disabled}
            className="rounded-full px-5 gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </div>
    )
  }

  // Default state - mic button with permission status
  const isBlocked = permissionStatus === 'denied' || permissionStatus === 'unavailable'
  
  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full transition-all",
          permissionStatus === 'granted' && "hover:bg-red-500/10 hover:text-red-500",
          isBlocked && "text-muted-foreground",
          permissionStatus === 'checking' && "opacity-50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={permissionStatus === 'granted' ? handleStartRecording : handleRequestPermission}
        disabled={disabled || permissionStatus === 'checking' || permissionStatus === 'unavailable'}
        title={
          permissionStatus === 'unavailable'
            ? "Microphone not available - Refresh page"
            : permissionStatus === 'denied' 
              ? "Microphone blocked - Click to retry" 
              : permissionStatus === 'granted' 
                ? "Record voice message" 
                : permissionStatus === 'checking'
                  ? "Checking microphone..."
                  : "Enable microphone"
        }
      >
        {permissionStatus === 'checking' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isBlocked ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className={cn(
            "h-5 w-5",
            permissionStatus === 'granted' && "text-red-500"
          )} />
        )}
      </Button>
      
      {/* Permission denied/unavailable tooltip */}
      {isBlocked && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-destructive text-destructive-foreground text-xs rounded-lg shadow-lg max-w-[250px] text-center whitespace-normal z-50">
          <AlertCircle className="h-4 w-4 mx-auto mb-1" />
          <div className="font-medium mb-1">
            {permissionStatus === 'unavailable' ? 'Microphone Unavailable' : 'Microphone Blocked'}
          </div>
          <div className="opacity-90 text-[10px] leading-tight">
            {permissionStatus === 'unavailable' 
              ? 'Microphone is blocked by browser policy. Please refresh the page and try again.'
              : 'Click the 🔒 lock icon in your browser\'s address bar → Allow microphone → Refresh page'
            }
          </div>
          {permissionStatus === 'denied' && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  handleRequestPermission()
                }}
                className="text-[10px] underline hover:no-underline"
              >
                Try Again
              </button>
            </div>
          )}
          {permissionStatus === 'unavailable' && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  window.location.reload()
                }}
                className="text-[10px] underline hover:no-underline"
              >
                Refresh Page
              </button>
            </div>
          )}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-destructive" />
        </div>
      )}
    </div>
  )
})

// Compact voice recorder - just the button that opens the full recorder
interface CompactVoiceRecorderProps {
  onSendVoice: (audioBlob: Blob, duration: number) => Promise<void>
  disabled?: boolean
  className?: string
}

export const CompactVoiceRecorder = memo(function CompactVoiceRecorder({
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
      className={cn(
        "h-9 w-9 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={() => setIsExpanded(true)}
      disabled={disabled}
      title="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </Button>
  )
})

export default VoiceRecorder
