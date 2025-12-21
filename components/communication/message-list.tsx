"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
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
  Edit,
  Clock,
  CornerDownRight,
  Loader2,
  Smile
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ICommunication, ITypingIndicator, IParticipant, IAttachment, IGroupedReaction } from "@/types/communication"
import { AttachmentGrid } from "./attachment-preview"
import { QuickReactionBar, MessageReactions } from "./reaction-picker"
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
import HtmlTextRenderer, { extractTextFromHtml } from "../shared/html-text-renderer"

interface MessageListProps {
  messages: ICommunication[]
  typingUsers: ITypingIndicator[]
  currentUserId: string
  onMessageRead?: (messageId: string) => void
  onReply?: (message: ICommunication) => void
  onEdit?: (message: ICommunication) => void
  onDelete?: (messageId: string) => void
  onReaction?: (messageId: string, channelId: string, emoji: string) => void
  onScrollToMessage?: (messageId: string) => void
  onLoadMore?: () => Promise<{ messages: ICommunication[]; hasMore: boolean }>
  hasMoreMessages?: boolean
  isLoadingMore?: boolean
  className?: string
  readReceipts?: IReadReceipt[] // Array of read receipts for all messages in this channel
  channel_members?: IParticipant[] // For showing who read
}

export function MessageList({
  messages,
  typingUsers,
  currentUserId,
  onMessageRead,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onScrollToMessage,
  onLoadMore,
  hasMoreMessages = true,
  isLoadingMore = false,
  className,
  readReceipts = [],
  channel_members = []
}: MessageListProps) {
  const [visibleMessages, setVisibleMessages] = useState(new Set<string>())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const prevScrollHeightRef = useRef<number>(0)
  const prevFirstMessageIdRef = useRef<string | null>(null)
  const isInitialLoadRef = useRef(true)
  const isNearBottomRef = useRef(true)
  const shouldRestoreScrollRef = useRef(false)

  // Use useLayoutEffect to restore scroll position BEFORE browser paint
  // This prevents the visual "jump" when loading older messages
  useLayoutEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    // Restore scroll position after loading older messages (prepended)
    if (shouldRestoreScrollRef.current && prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current
      container.scrollTop = container.scrollTop + scrollDiff
      shouldRestoreScrollRef.current = false
      prevScrollHeightRef.current = 0
      return
    }

    // Update the first message id reference
    const currentFirstMessageId = messages.length > 0 ? messages[0].id : null
    const messagesWerePrepended = prevFirstMessageIdRef.current !== null && 
                                   currentFirstMessageId !== null && 
                                   prevFirstMessageIdRef.current !== currentFirstMessageId &&
                                   messages.some(m => m.id === prevFirstMessageIdRef.current)
    
    prevFirstMessageIdRef.current = currentFirstMessageId

    // Don't auto-scroll if messages were prepended (older messages loaded)
    if (messagesWerePrepended) {
      return
    }

    // Initial load - scroll to bottom immediately
    if (isInitialLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      isInitialLoadRef.current = false
      return
    }

    // Only auto-scroll for new messages if user was near bottom
    if (isNearBottomRef.current && !loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loadingMore])

  // Infinite scroll - load more when scrolling to top
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current
    if (!container) return

    // Track if user is near the bottom (within 150px)
    // This determines whether we should auto-scroll on new messages
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    isNearBottomRef.current = distanceFromBottom < 150

    // Don't trigger load more if already loading or no more messages
    if (loadingMore || !hasMoreMessages || !onLoadMore) return

    // Trigger load more when scrolled near top (within 100px)
    if (container.scrollTop < 100) {
      // Save scroll height BEFORE loading new messages
      prevScrollHeightRef.current = container.scrollHeight
      shouldRestoreScrollRef.current = true
      setLoadingMore(true)
      
      try {
        await onLoadMore()
        // hasMoreMessages will be updated by parent
      } finally {
        setLoadingMore(false)
      }
    }
  }, [loadingMore, hasMoreMessages, onLoadMore])

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

    // Observe all message elements
    const messageElements = document.querySelectorAll('[data-message-id]')
    messageElements.forEach(el => observerRef.current?.observe(el))

    return () => observerRef.current?.disconnect()
  }, [messages, currentUserId, onMessageRead, visibleMessages])

  // Scroll to a specific message (for reply navigation)
  const scrollToMessage = useCallback((messageId: string) => {
    const element = messageRefs.current.get(messageId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight briefly
      element.classList.add('bg-primary/10')
      setTimeout(() => {
        element.classList.remove('bg-primary/10')
      }, 2000)
    }
    onScrollToMessage?.(messageId)
  }, [onScrollToMessage])

  // Find parent message for reply preview
  const getParentMessage = useCallback((parentId?: string): ICommunication | undefined => {
    if (!parentId) return undefined
    return messages.find(m => m.id === parentId)
  }, [messages])
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

  // file_name: string
  // file_url?: string
  // s3_key?: string
  // s3_bucket?: string
  // file_size?: number
  // file_type?: string
  const renderAttachments = (attachments: IAttachment[]) => {
    if (!attachments || attachments.length === 0) return null
    
    return (
      <div className="mt-2">
        <AttachmentGrid attachments={attachments} />
      </div>
    )
  }

  // Helper to group reactions by emoji for display
  const groupReactions = (reactions: ICommunication['reactions']): IGroupedReaction[] => {
    if (!reactions || reactions.length === 0) return []
    
    const grouped: Record<string, IGroupedReaction> = {}
    
    reactions.forEach(reaction => {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          hasCurrentUserReacted: false
        }
      }
      grouped[reaction.emoji].count++
      grouped[reaction.emoji].users.push({
        id: reaction.id,
        mongo_user_id: reaction.mongo_user_id,
        name: reaction.user_name
      })
      if (reaction.mongo_user_id === currentUserId) {
        grouped[reaction.emoji].hasCurrentUserReacted = true
      }
    })
    
    return Object.values(grouped)
  }

  const MessageItem = ({ message, isOwn }: { message: ICommunication; isOwn: boolean }) => {
    const sender = message.sender

    // Get read receipts from message's own read_receipts (for real-time updates) or from props (fallback)
    const messageReceipts = message.read_receipts || []
    const propReceipts = readReceipts.filter(r => r.message_id === message.id)
    // Merge both sources, preferring message's own receipts
    const allReceipts = [...messageReceipts]
    propReceipts.forEach(pr => {
      if (!allReceipts.some(r => r.mongo_user_id === pr.mongo_user_id)) {
        allReceipts.push(pr)
      }
    })
    
    // Find all read receipts for this message (excluding sender)
    const receipts = allReceipts.filter(r => r.mongo_user_id !== message.mongo_sender_id)

    // For current user, check if this message is read
    const isReadByCurrentUser = receipts.some(r => r.mongo_user_id === currentUserId)

    // For sender, show who has read
    const readers = channel_members.filter(p =>
      receipts.some(r => r.mongo_user_id === p.mongo_member_id)
    )
    
    // Get parent message for reply preview
    const parentMessage = getParentMessage(message.parent_message_id)

    // Message status
    const getStatusIcon = () => {
      if (message.isOptimistic) {
        // Message is being sent
        return <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />
      }
      if (message.isFailed) {
        // Message failed to send
        return (
          <Tooltip>
            <TooltipTrigger>
              <span className="text-destructive text-xs">!</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Failed to send. Click to retry.</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      if (readers.length > 0) {
        // Message has been read by at least one person
        return <CheckCheck className="h-3 w-3 text-primary" />
      }
      // Message sent but not read yet
      return <Check className="h-3 w-3 text-muted-foreground" />
    }

    console.log('sender170', sender)
    console.log('readers171', readers)

    return (
      <div
        data-message-id={message.id}
        ref={(el) => {
          if (el) messageRefs.current.set(message.id, el)
        }}
        className={cn(
          "flex gap-2 px-3 py-1 group transition-colors duration-500",
          isOwn && "flex-row-reverse"
        )}
      >
        {/* Avatar */}
        <div className="shrink-0">
          {/* <Avatar className="h-8 w-8">
            <AvatarImage src={sender?.avatar} alt={sender?.name} />
            <AvatarFallback className="text-xs">
              {sender?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar> */}
          <Avatar className="h-8 w-8 transition-transform duration-200 group-hover:scale-110">
            <AvatarImage src={sender?.avatar} alt={sender?.name} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/40 text-primary font-semibold text-sm">
              {sender?.name
                ? (() => {
                  const parts = sender.name.trim().split(' ');
                  if (parts.length === 1) {
                    return parts[0][0].toUpperCase();
                  }
                  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                })()
                : ''}
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
            "relative bg-card rounded-lg p-3 shadow-sm border max-w-[70%] w-auto overflow-visible",
            isOwn ? "bg-primary text-primary-foreground ml-8 self-end" : "bg-background mr-8 self-start"
            )}>
              {/* Reply preview */}
              {parentMessage && (
                <button
                  onClick={() => scrollToMessage(parentMessage.id)}
                  className={cn(
                    "flex items-start gap-2 mb-2 p-2 rounded text-xs w-full text-left transition-colors",
                    isOwn ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <CornerDownRight className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium truncate", isOwn ? "text-primary-foreground" : "text-foreground")}>
                      {parentMessage.sender?.name || parentMessage.sender_name}
                    </p>
                    <p className={cn("truncate opacity-70", isOwn ? "text-primary-foreground" : "text-muted-foreground")}>
                      {extractTextFromHtml(parentMessage.content, 60)}
                    </p>
                  </div>
                </button>
              )}
              
              <HtmlTextRenderer
              content={message.content}
              fallbackText="No description"
              showFallback={true}
              renderAsHtml={true}
              className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]"
              truncateHtml={false}
              />

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && 
              renderAttachments(message.attachments)
            }
            
            {/* Quick reaction bar (visible on hover) */}
            {onReaction && (
              <div className={cn(
                "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                isOwn ? "left-0" : "right-0"
              )}>
                <QuickReactionBar
                  onSelect={(emoji) => onReaction(message.id, message.channel_id, emoji)}
                />
              </div>
            )}
            </div>

          {/* Message reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <MessageReactions
              reactions={groupReactions(message.reactions)}
              onReactionClick={(emoji) => onReaction?.(message.id, message.channel_id, emoji)}
              currentUserId={currentUserId}
              className={isOwn ? "justify-end" : "justify-start"}
            />
          )}

          {/* Status and read receipts UI */}
          <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isOwn && "justify-end")}>
            {isOwn && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center">
                    {getStatusIcon()}
                  </TooltipTrigger>
                  <TooltipContent>
                    {message.isOptimistic ? (
                      <p>Sending...</p>
                    ) : message.isFailed ? (
                      <p>Failed to send</p>
                    ) : readers.length > 0 ? (
                      <div>
                        <p className="font-medium">Read by {readers.length}</p>
                        <div className="flex flex-col gap-1 mt-1 max-h-32 overflow-y-auto">
                          {readers.map(r => {
                            const receipt = receipts.find(rr => rr.mongo_user_id === r.mongo_member_id)
                            return (
                              <span key={`reader-${r.mongo_member_id}`} className="flex items-center gap-1 text-xs">
                                <span>{r.name}</span>
                                {receipt && (
                                  <span className="text-muted-foreground ml-1">
                                    {format(new Date(receipt.read_at), 'HH:mm')}
                                  </span>
                                )}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p>Sent</p>
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
      <>
        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className={cn("flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 p-3", className)}
        >
          {/* Load more indicator at top */}
          {hasMoreMessages && messages.length > 0 && (
            <div 
              ref={loadMoreTriggerRef}
              className="flex justify-center py-2"
            >
              {loadingMore || isLoadingMore ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading older messages...</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLoadMore?.()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Load older messages
                </Button>
              )}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground h-full">
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
                        <Avatar key={`typing-${typing.userId}`} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="text-xs">
                            {user.name ? (() => {
                              const parts = user.name.trim().split(' ');
                              if (parts.length === 1) {
                                return parts[0][0].toUpperCase();
                              }
                              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                            })()
                              : ''}
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
      </>
    </TooltipProvider>
  )
}
