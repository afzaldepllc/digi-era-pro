"use client"

import { useState, useRef, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreateMessageData } from "@/types/communication"
import { useToast } from "@/hooks/use-toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import RichMessageEditor, { RichMessageEditorRef } from "./rich-message-editor"

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
  const [messageHtml, setMessageHtml] = useState("")
  const [messageText, setMessageText] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  
  const editorRef = useRef<RichMessageEditorRef | null>(null)
  
  const { toast } = useToast()

  // Handler the editor will call when it wants to send a message
  const handleSendFromEditor = async (html: string, text: string, files: File[]) => {
    if ((!text || text.trim().length === 0) && files.length === 0) return false
    if (disabled || isUploading) return false

    try {
      const contentToSend = html && html.trim().length > 0 ? html.trim() : (text || "").trim()

      const messageData: CreateMessageData = {
        channel_id: channelId,
        content: contentToSend,
        content_type: files.length > 0 ? 'file' : 'text',
        attachments: files.length > 0 ? files.map(f => f.name) : undefined
      }

      await onSend(messageData)

      return true
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
      return false
    }
  }

  // const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
  //   const files = Array.from(e.target.files || [])
    
  //   // Validate file types and sizes
  //   const validFiles = files.filter(file => {
  //     if (file.size > 10 * 1024 * 1024) { // 10MB limit
  //       toast({
  //         title: "File too large",
  //         description: `${file.name} is larger than 10MB`,
  //         variant: "destructive"
  //       })
  //       return false
  //     }
  //     return true
  //   })
    
  //   if (validFiles.length + attachments.length > 5) {
  //     toast({
  //       title: "Too many files",
  //       description: "You can only attach up to 5 files",
  //       variant: "destructive"
  //     })
  //     return
  //   }
    
  //   setAttachments(prev => [...prev, ...validFiles])
    
  //   // Clear input
  //   if (fileInputRef.current) {
  //     fileInputRef.current.value = ""
  //   }
  // }

  // const removeAttachment = (index: number) => {
  //   setAttachments(prev => prev.filter((_, i) => i !== index))
  // }

  // const getFileIcon = (file: File) => {
  //   if (file.type.startsWith('image/')) {
  //     return <Image className="h-4 w-4" />
  //   }
  //   return <FileText className="h-4 w-4" />
  // }

  // const canSend = ((messageText && messageText.trim().length > 0) || attachments.length > 0) && !disabled && !isUploading

  return (
    <TooltipProvider>
      <div className={cn("border-t bg-card p-2", className)}>


        {/* Input area */}
        <div className="flex items-end gap-2">


          {/* Rich Text Editor */}
          <div className="flex-1">
            <RichMessageEditor
              ref={editorRef}
              value={messageHtml}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
              onChange={(html, text) => {
                setMessageHtml(html)
                setMessageText(text)
              }}
              onTyping={onTyping}
              onStopTyping={onStopTyping}
              onSend={handleSendFromEditor}
            />
          </div>

          {/* Send is handled inside RichMessageEditor now */}
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-1 text-xs text-muted-foreground">
          Press Enter to send, Shift + Enter for new line
        </div>
      </div>
    </TooltipProvider>
  )
}