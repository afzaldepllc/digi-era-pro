"use client"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  Reply,
  MoreVertical,
  Trash2,
  Edit
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ICommunication, ITypingIndicator, IParticipant, IAttachment } from "@/types/communication"
import { formatDistanceToNow, format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { IReadReceipt } from "@/types/communication"

interface MessageListProps {
  messages: ICommunication[]
  typingUsers: ITypingIndicator[]
  currentUserId: string
  onMessageRead?: (messageId: string) => void
  onReply?: (message: ICommunication) => void
  onEdit?: (message: ICommunication) => void
  onDelete?: (messageId: string) => void
  className?: string
  readReceipts?: IReadReceipt[] // Array of read receipts for all messages in this channel
  participants?: IParticipant[] // For showing who read
}

export function MessageList({
  messages,
  typingUsers,
  currentUserId,
  onMessageRead,
  onReply,
  onEdit,
  onDelete,
  className,
  readReceipts = [],
  participants = []
}: MessageListProps) {
  const [visibleMessages, setVisibleMessages] = useState(new Set<string>())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])
  console.log("visibleMessages62", visibleMessages);
  // Intersection Observer for read receipts
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id')
            if (messageId && !visibleMessages.has(messageId)) {
              setVisibleMessages(prev => new Set([...prev, messageId]))

              // Mark as read if not from current user
              const message = messages.find(m => m.id === messageId)
              if (message && message.mongo_sender_id !== currentUserId && !message.read_receipts?.length && onMessageRead) {
                onMessageRead(messageId)
              }
            }
          }
        })
      },
      { threshold: 0.5 }
    )
    console.log("visibleMessages88", visibleMessages);
    // Observe all message elements
    const messageElements = document.querySelectorAll('[data-message-id]')
    messageElements.forEach(el => observerRef.current?.observe(el))

    return () => observerRef.current?.disconnect()
  }, [messages, currentUserId, onMessageRead, visibleMessages])
  const formatMessageTime = (date: Date) => {
    const now = new Date()
    const messageDate = new Date(date)
    const diffInHours = Math.abs(now.getTime() - messageDate.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return format(messageDate, 'HH:mm')
    } else if (diffInHours < 24 * 7) {
      return format(messageDate, 'EEE HH:mm')
    } else {
      return format(messageDate, 'MMM d, HH:mm')
    }
  }
  console.log('Rendering MessageList with messages118:', messages);
  // file_name: string
  // file_url?: string
  // s3_key?: string
  // s3_bucket?: string
  // file_size?: number
  // file_type?: string
  const renderAttachment = (attachment: IAttachment, index: number) => {
    const fileName = attachment.file_name;
    const isImage = attachment.file_type?.startsWith('image/')       

    return (
      <div key={index} className="mt-2">
        {isImage ? (
          <div className="relative max-w-xs">
            <img
              src={attachment.file_url}
              alt={fileName}
              className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90"
              onClick={() => window.open(attachment.file_url, '_blank')}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 opacity-80 hover:opacity-100"
              onClick={() => window.open(attachment.file_url, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50 max-w-xs">
            <Download className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm truncate flex-1">{fileName}</span>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  const MessageItem = ({ message, isOwn }: { message: ICommunication; isOwn: boolean }) => {
    const sender = message.mongo_sender_id as unknown as IParticipant

    // Find all read receipts for this message (excluding sender)
    const receipts = readReceipts.filter(r => r.message_id === message.id && r.mongo_user_id !== message.mongo_sender_id)

    // For current user, check if this message is read
    const isReadByCurrentUser = receipts.some(r => r.mongo_user_id === currentUserId)

    // For sender, show who has read
    const readers = participants.filter(p =>
      receipts.some(r => r.mongo_user_id === p.mongo_member_id)
    )

    return (
      <div
        data-message-id={message.id}
        className={cn(
          "flex gap-3 p-3 hover:bg-muted/50 group",
          isOwn && "flex-row-reverse"
        )}
      >
        {/* Avatar */}
        <div className="shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={sender?.avatar} alt={sender?.name} />
            <AvatarFallback className="text-xs">
              {sender?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Message content */}
        <div className={cn("flex-1 space-y-1 flex flex-col", isOwn && "text-right")}> 
          {/* Header */}
          <div className={cn("flex items-center gap-2", isOwn && "flex-row-reverse")}> 
            <span className="font-medium text-sm">{sender?.name}</span>

            {sender?.role && (
              <Badge variant="outline" className="text-xs">
                {sender?.role}
              </Badge>
            )}

            <span className="text-xs text-muted-foreground">
              {formatMessageTime(new Date(message.created_at))}
            </span>

            {/* Message actions (visible on hover) */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {onReply && (
                    <DropdownMenuItem onClick={() => onReply(message)}>
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </DropdownMenuItem>
                  )}
                  {isOwn && onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(message)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {isOwn && onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(message.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Message text */}
          <div className={cn(
            "bg-card rounded-lg p-3 shadow-sm border max-w-[70%] w-fit",
            isOwn ? "bg-primary text-primary-foreground ml-8 self-end" : "bg-background mr-8 self-start"
          )}>
            <p className="text-sm whitespace-pre-wrap break-words break-all">
              {message.content}
            </p>

            {/* Attachments */}
            {message.attachments && message.attachments.map((attachment, index) =>
              renderAttachment(attachment, index)
            )}
          </div>

          {/* Read receipts UI */}
          <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isOwn && "justify-end")}> 
            {isOwn && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {readers.length > 0 ? (
                      <CheckCheck className="h-3 w-3 text-primary" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{readers.length > 0 ? `Read by ${readers.length}` : 'Sent'}</p>
                    {readers.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {readers.map(r => (
                          <span key={r.mongo_member_id} className="flex items-center gap-1">
                            {r.name}
                            {/* Optionally show time: */}
                            {(() => {
                              const receipt = receipts.find(rr => rr.mongo_user_id === r.mongo_member_id)
                              return receipt ? (
                                <span className="ml-1 text-muted-foreground">{format(new Date(receipt.read_at), 'PPpp')}</span>
                              ) : null
                            })()}
                          </span>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {message.edited_at && message.edited_at !== message.created_at && (
              <span className="italic">(edited)</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p>No messages yet</p>
                <p className="text-sm mt-1">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isOwn={message.mongo_sender_id === currentUserId}
                />
              ))}

              {/* Typing indicators */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="flex -space-x-1">
                    {typingUsers.slice(0, 3).map((typing) => {
                      const user = { name: typing.userName, avatar: '' }
                      return (
                        <Avatar key={typing.userId} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="text-xs">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )
                    })}
                  </div>

                  <div className="text-sm text-muted-foreground italic">
                    {typingUsers.length === 1
                      ? `${typingUsers[0].userName} is typing...`
                      : `${typingUsers.length} people are typing...`
                    }
                  </div>

                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </TooltipProvider>
  )
}
