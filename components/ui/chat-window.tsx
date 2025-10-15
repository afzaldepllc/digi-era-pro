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
import { ChatWindowProps, CreateMessageData, ICommunication, ITypingIndicator } from "@/types/communication"
import { useCommunications } from "@/hooks/use-communications"
import { useAuthUser } from "@/hooks/use-auth-user"
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

export function ChatWindow({ channelId, className, onToggleSidebar, isSidebarExpanded }: ChatWindowProps) {
  const { user: currentUser } = useAuthUser()
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
    setError
  } = useCommunications()

  const [isSearchVisible, setIsSearchVisible] = useState(false)

  // Handle typing indicators
  const handleTyping = () => {
    if (currentUser && channelId) {
      setTyping({
        channelId,
        userId: currentUser.id,
        userName: currentUser.name || 'Unknown',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleStopTyping = () => {
    if (currentUser && channelId) {
      removeTyping(channelId, currentUser.id)
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
    if (selectedChannel.type === 'dm' && currentUser) {
      const otherParticipant = selectedChannel.participants.find(p => p._id !== currentUser.id)
      return otherParticipant?.name || 'Unknown User'
    }
    return selectedChannel.name
  }

  const getChannelSubtitle = () => {
    if (selectedChannel.type === 'dm' && currentUser) {
      const otherParticipant = selectedChannel.participants.find(p => p._id !== currentUser.id)
      if (otherParticipant) {
        const status = otherParticipant.isOnline ? 'Online' : 'Offline'
        const role = otherParticipant.role ? ` • ${otherParticipant.role}` : ''
        return `${status}${role}`
      }
      return 'Direct Message'
    }
    
    const activeMembers = selectedChannel.participants.filter(p => p.isOnline).length
    return `${selectedChannel.participants.length} members, ${activeMembers} online`
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full w-full max-w-full bg-background overflow-hidden", className)}>
        {/* Header */}
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between">
            {/* Channel info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
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
                  
                  {!selectedChannel.isInternal && (
                    <Badge variant="destructive" className="shrink-0">External</Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {getChannelSubtitle()}
                </p>
              </div>
              
              {/* Online indicators for group channels */}
              {selectedChannel.participants.length > 2 && (
                <div className="shrink-0">
                  <OnlineIndicator 
                    users={selectedChannel.participants} 
                    maxVisible={3}
                    size="sm"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
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
        <div className="flex flex-1 min-h-0">
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
            {!messagesLoading && currentUser && (
              <div className="flex-1 min-h-0 h-full">
                {(() => {
                  const channelMessages = (messages as unknown as Record<string, ICommunication[]>)[channelId] || []
                  console.log('ChatWindow - channelId:355', channelId)
                  console.log('ChatWindow - messages object:356', messages)
                  console.log('ChatWindow - channelMessages:357', channelMessages)
                  console.log('ChatWindow - channelMessages length:358', channelMessages.length)
                  return (
                    <MessageList
                      messages={messages}
                      typingUsers={typingUsers}
                      currentUserId={currentUser.id}
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