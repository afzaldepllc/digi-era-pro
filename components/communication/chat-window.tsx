"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageList } from "@/components/communication/message-list"
import { MessageInput, MessageInputRef } from "@/components/communication/message-input"
import { OnlineIndicator } from "@/components/communication/online-indicator"
import { TypingIndicator } from "@/components/communication/typing-indicator"
import { ContextPanel } from "@/components/ui/context-panel"
import FullscreenToggle, { FullscreenToggleRef } from '@/components/shared/FullscreenToggle'
import { 
  Info, 
  Phone, 
  Video, 
  MoreVertical,
  Search,
  Pin,
  Archive,
  Settings,
  Menu,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatWindowProps, CreateMessageData, ICommunication, ITypingIndicator, IParticipant } from "@/types/communication"
import { useCommunications } from "@/hooks/use-communications"
import { format } from "date-fns"
import {
  DropdownMenu, 
  DropdownMenuContent,  
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

export function ChatWindow({ channelId, className, onToggleSidebar, isSidebarExpanded, fullscreenRef, onFullscreenChange }: ChatWindowProps) {
  const {
    selectedChannel,
    messages,
    messagesLoading,
    actionLoading,
    error,
    typingUsers,
    onlineUsers,
    onlineUserIds,
    isContextPanelVisible,
    sendMessage,
    updateMessage,
    markAsRead,
    setTyping,
    removeTyping,
    toggleContextPanel,
    setError,
    mockCurrentUser,
    sessionStatus,
    usersLoading,
    selectChannel
  } = useCommunications()

  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const messageInputRef = useRef<MessageInputRef>(null)
  
  console.log('selectedChannel messages in ChatWindow66:', messages)
  // Auto-select channel if channelId is provided and no channel is selected
  useEffect(() => {
    if (channelId && !selectedChannel) {
      selectChannel(channelId)
    }
  }, [channelId, selectedChannel, selectChannel])
  
  // Show loading state while session is being fetched
  const isInitializing = sessionStatus === 'loading' || usersLoading

  // Handle typing indicators
  const handleTyping = () => {
    if (mockCurrentUser && channelId) {
      setTyping({
        channelId,
        userId: mockCurrentUser?._id,
        userName: mockCurrentUser.name || 'Unknown',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleStopTyping = () => {
    if (mockCurrentUser && channelId) {
      removeTyping(channelId, mockCurrentUser?._id)
    }
  }

  // Handle sending messages
  const handleSendMessage = async (messageData: CreateMessageData) => {
    try {
      await sendMessage(messageData)
      handleStopTyping() // Stop typing indicator after sending
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  // Handle message actions
  const handleMessageRead = (messageId: string) => {
    markAsRead(messageId, channelId)
  }

  const handleReply = useCallback((message: ICommunication) => {
    messageInputRef.current?.setReplyTo(message)
  }, [])

  const handleEdit = useCallback((message: ICommunication) => {
    messageInputRef.current?.setEditMessage(message)
  }, [])

  const handleEditMessage = useCallback(async (messageId: string, data: CreateMessageData) => {
    if (updateMessage) {
      await updateMessage(messageId, { content: data.content })
    }
  }, [updateMessage])

  const handleDelete = (messageId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete message:', messageId)
  }

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-lg">Loading...</h3>
            <p className="text-muted-foreground mt-1">
              Setting up your communication system
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if not authenticated
  if (sessionStatus === 'unauthenticated' || !mockCurrentUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <Search className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-lg">Authentication Required</h3>
            <p className="text-muted-foreground mt-1">
              Please log in to access the communication system
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-lg">No conversation selected</h3>
            <p className="text-muted-foreground mt-1">
              Choose a conversation from the sidebar to start messaging
            </p>
          </div>
        </div>
      </div>
    )
  }

  const getChannelTitle = () => {
    if (selectedChannel.type === 'dm' && mockCurrentUser) {
      const otherParticipant = selectedChannel.channel_members.find(p => p.mongo_member_id !== mockCurrentUser._id)
      return otherParticipant?.name || 'Unknown User'
    }
    return selectedChannel.name
  }

  const getChannelSubtitle = () => {
    if (selectedChannel.type === 'dm' && mockCurrentUser) {
      const otherParticipant = selectedChannel.channel_members.find(p => p.mongo_member_id !== mockCurrentUser._id)
      if (otherParticipant) {
        // Use real-time onlineUserIds for status
        const isOnline = onlineUserIds.includes(otherParticipant.mongo_member_id)
        const status = isOnline ? 'Online' : 'Offline'
        const role = otherParticipant.userRole ? ` • ${otherParticipant.userRole}` : ''
        return `${status}${role}`
      }
      return 'Direct Message'
    }
    
    // Use real-time onlineUserIds for active members count
    const activeMembers = selectedChannel.channel_members.filter(p => 
      onlineUserIds.includes(p.mongo_member_id)
    ).length
    return `${selectedChannel.channel_members.length} members, ${activeMembers} online`
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full w-full max-w-full bg-background overflow-hidden", className)}>
        {/* Header */}
        <div className="border-b bg-card px-4 py-2 relative">
          <div className="flex items-center justify-between">
            {/* Channel info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Toggle sidebar button (desktop) */}
              {onToggleSidebar && (
                <div className="hidden lg:flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleSidebar}
                    className="h-9 w-9 p-0 hover:bg-accent transition-all duration-200 hover:scale-105 mr-2"
                  >
                    {isSidebarExpanded ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Menu className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg truncate">{getChannelTitle()}</h2>
                  
                  {selectedChannel.type === 'project' && (
                    <Badge variant="outline" className="shrink-0">Project</Badge>
                  )}
                  
                  {selectedChannel.type === 'client-support' && (
                    <Badge variant="secondary" className="shrink-0">Client Support</Badge>
                  )}
                  
                  {!selectedChannel.is_private && (
                    <Badge variant="destructive" className="shrink-0">External</Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {getChannelSubtitle()}
                </p>
              </div>
              
              {/* Online indicators for group channels */}
              {selectedChannel.channel_members.length > 2 && (
                <div className="shrink-0">
                  <OnlineIndicator 
                    users={selectedChannel.channel_members as IParticipant[]} 
                    onlineUserIds={onlineUserIds}
                    maxVisible={3}
                    size="sm"
                  />
                </div>
              )}

              {/* Typing indicator - real-time from Supabase */}
              {channelId && typingUsers[channelId] && typingUsers[channelId].length > 0 && (
                <div className="shrink-0 ml-2">
                  <TypingIndicator
                    typingUsers={typingUsers[channelId]}
                    currentUserId={mockCurrentUser?._id}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-4">

              {/* Search toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={isSearchVisible ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setIsSearchVisible(!isSearchVisible)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search messages</p>
                </TooltipContent>
              </Tooltip>

              {/* Context panel toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={isContextPanelVisible ? "default" : "outline"} 
                    size="sm"
                    onClick={toggleContextPanel}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Channel info</p>
                </TooltipContent>
              </Tooltip>

              {/* More options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Pin className="h-4 w-4 mr-2" />
                    Pin Channel
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" />
                    Channel Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Archive className="h-4 w-4 mr-2" />
                    Archive Channel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <FullscreenToggle mode="hide-layout" ref={fullscreenRef} onChange={onFullscreenChange} />
            </div>
          </div>

          {/* Search bar (when visible) - Positioned absolutely to overlay */}
          {isSearchVisible && (
            <div className="absolute inset-0 bg-card border-b z-50 px-4 py-2 flex items-center animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 w-full">
                {/* Back/Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSearchVisible(false)}
                  className="h-8 w-8 p-0 hover:bg-muted shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Search input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 hover:bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                  />
                </div>

                {/* Navigation arrows */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    disabled
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    disabled
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </div>

                {/* Result counter */}
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  0 of 0
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Messages area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Error display */}
            {error && (
              <Alert className="m-4 mb-0">
                <AlertDescription className="flex items-center justify-between">
                  {error}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setError('')}
                  >
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Loading skeleton */}
            {messagesLoading && (
              <div className="flex-1 p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-16 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            {!messagesLoading && mockCurrentUser && (
              (() => {
                const channelMessages = (messages as unknown as Record<string, ICommunication[]>)[channelId] || []
                const channelTypingUsers = (typingUsers as unknown as Record<string, ITypingIndicator[]>)[channelId] || []
                
                return (
                  <MessageList
                    messages={channelMessages}
                    typingUsers={channelTypingUsers}
                    currentUserId={mockCurrentUser._id}
                    onMessageRead={handleMessageRead}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    className="flex-1 min-h-0"
                  />
                )
              })()
            )}

            {/* Message input */}
            <MessageInput
              ref={messageInputRef}
              channelId={channelId}
              onSend={handleSendMessage}
              onEdit={handleEditMessage}
              disabled={actionLoading}
              placeholder={`Message ${getChannelTitle()}...`}
              allowAttachments={true}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
              channelMembers={selectedChannel?.channel_members || []}
            />
          </div>

          {/* Context panel */}
          <ContextPanel
            channel={selectedChannel}
            isVisible={isContextPanelVisible}
            onToggle={toggleContextPanel}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}