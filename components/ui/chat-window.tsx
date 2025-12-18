"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageList } from "@/components/ui/message-list"
import { MessageInput } from "@/components/ui/message-input"
import { OnlineIndicator } from "@/components/ui/online-indicator"
import { ContextPanel } from "@/components/ui/context-panel"
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
import FullscreenToggle from "./FullscreenToggle"

export function ChatWindow({ channelId, className, onToggleSidebar, isSidebarExpanded }: ChatWindowProps) {
  const {
    selectedChannel,
    messages,
    messagesLoading,
    actionLoading,
    error,
    typingUsers,
    onlineUsers,
    isContextPanelVisible,
    sendMessage,
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

  const handleReply = (message: ICommunication) => {
    // TODO: Implement reply functionality
    console.log('Reply to:', message)
  }

  const handleEdit = (message: ICommunication) => {
    // TODO: Implement edit functionality
    console.log('Edit message:', message)
  }

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
        const status = otherParticipant.isOnline ? 'Online' : 'Offline'
        const role = otherParticipant.userRole ? ` • ${otherParticipant.userRole}` : ''
        return `${status}${role}`
      }
      return 'Direct Message'
    }
    
    const activeMembers = selectedChannel.channel_members.filter(p => p.isOnline).length
    return `${selectedChannel.channel_members.length} members, ${activeMembers} online`
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full w-full max-w-full bg-background overflow-hidden", className)}>
        {/* Header */}
        <div className="border-b bg-card px-4 py-2">
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
                    maxVisible={3}
                    size="sm"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-4">
              {/* Call buttons for DM */}
              {selectedChannel.type === 'dm' && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Voice call</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Video className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Video call</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}

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

              <FullscreenToggle mode="hide-layout" />
            </div>
          </div>

          {/* Search bar (when visible) */}
          {isSearchVisible && (
            <div className="mt-3 pt-3 border-t">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search in this conversation..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-100">
          {/* Messages area */}
          <div className="flex-1 flex flex-col min-w-0">
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
              <div className="flex-1 min-h-0 h-full">
                {(() => {
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
                    />
                  )
                })()}
              </div>
            )}

            {/* Message input */}
            <MessageInput
              channelId={channelId}
              onSend={handleSendMessage}
              disabled={actionLoading}
              placeholder={`Message ${getChannelTitle()}...`}
              allowAttachments={true}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
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