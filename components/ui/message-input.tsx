"use client"

import { useState, useRef, KeyboardEvent, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Send, 
  Paperclip, 
  Image, 
  FileText, 
  X,
  Smile
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateMessageData } from "@/types/communication"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MessageInputProps {
  channelId: string
  onSend: (data: CreateMessageData) => void
  disabled?: boolean
  placeholder?: string
  allowAttachments?: boolean
  maxLength?: number
  className?: string
  onTyping?: () => void
  onStopTyping?: () => void
}

export function MessageInput({
  channelId,
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  allowAttachments = true,
  maxLength = 5000,
  className,
  onTyping,
  onStopTyping
}: MessageInputProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()

  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    
    if (value.length <= maxLength) {
      setMessage(value)
      
      // Handle typing indicators
      if (onTyping && value.length > 0) {
        onTyping()
        
        // Clear previous timer
        if (typingTimer) {
          clearTimeout(typingTimer)
        }
        
        // Set new timer to stop typing after 2 seconds of inactivity
        const timer = setTimeout(() => {
          if (onStopTyping) {
            onStopTyping()
          }
        }, 2000)
        
        setTypingTimer(timer)
      } else if (onStopTyping && value.length === 0) {
        onStopTyping()
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    if (!message.trim() && attachments.length === 0) return
    if (disabled || isUploading) return

    try {
      const messageData: CreateMessageData = {
        channelId,
        message: message.trim(),
        communicationType: 'chat',
        priority: 'medium',
        attachments: attachments.length > 0 ? attachments.map(f => f.name) : undefined // Will be file URLs in real implementation
      }

      await onSend(messageData)
      
      // Clear form
      setMessage("")
      setAttachments([])
      
      // Stop typing indicator
      if (onStopTyping) {
        onStopTyping()
      }
      
      // Focus back to textarea
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    }
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive"
        })
        return false
      }
      return true
    })
    
    if (validFiles.length + attachments.length > 5) {
      toast({
        title: "Too many files",
        description: "You can only attach up to 5 files",
        variant: "destructive"
      })
      return
    }
    
    setAttachments(prev => [...prev, ...validFiles])
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  const canSend = (message.trim().length > 0 || attachments.length > 0) && !disabled && !isUploading

  return (
    <TooltipProvider>
      <div className={cn("border-t bg-card p-4", className)}>
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
                {getFileIcon(file)}
                <span className="max-w-[150px] truncate text-xs">
                  {file.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          {/* File attachment button */}
          {allowAttachments && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={disabled || isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Attach file (Max 10MB)</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Message textarea */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="min-h-[44px] max-h-32 resize-none pr-12"
              rows={1}
            />
            
            {/* Character count */}
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {message.length}/{maxLength}
            </div>
          </div>

          {/* Emoji button (placeholder for future implementation) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                disabled={disabled}
                className="shrink-0"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add emoji</p>
            </TooltipContent>
          </Tooltip>

          {/* Send button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSend}
                disabled={!canSend}
                size="icon"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Send message (Enter)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Keyboard shortcut hint */}
        <div className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift + Enter for new line
        </div>
      </div>
    </TooltipProvider>
  )
}