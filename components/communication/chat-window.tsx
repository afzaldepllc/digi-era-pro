"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageList } from "@/components/communication/message-list"
import { MessageInput, MessageInputRef } from "@/components/communication/message-input"
import { OnlineIndicator } from "@/components/communication/online-indicator"
import { TypingIndicator } from "@/components/communication/typing-indicator"
import { ContextPanel } from "@/components/ui/context-panel"
import { ChannelSettingsModal } from "@/components/communication/channel-settings-modal"
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
  X,
  LogOut
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
    sendMessageWithFiles,
    updateMessage,
    markAsRead,
    setTyping,
    removeTyping,
    toggleContextPanel,
    setError,
    mockCurrentUser,
    sessionStatus,
    usersLoading,
    selectChannel,
    fetchOlderMessages,
    prependMessagesToChannel,
    searchMessages,
    toggleReaction,
    // Trash operations (Phase 2)
    moveToTrash,
    hideForSelf,
    // Channel management (Phase 3)
    leaveChannel,
    archiveChannel,
  } = useCommunications()

  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ICommunication[]>([])
  const [showChannelSettings, setShowChannelSettings] = useState(false)
  const [searchIndex, setSearchIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [searchTotal, setSearchTotal] = useState(0)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageInputRef = useRef<MessageInputRef>(null)
  
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
      // Error is handled by the sendMessage function
    }
  }

  // Handle sending voice messages
  const handleSendVoice = useCallback(async (audioBlob: Blob, duration: number) => {
    if (!channelId) return
    
    try {
      // Create form data for upload
      const formData = new FormData()
      formData.append('file', audioBlob, `voice-message-${Date.now()}.webm`)
      formData.append('folder', 'voice-messages')
      formData.append('channelId', channelId)
      
      // Upload to S3
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload voice message')
      }
      
      const uploadResult = await uploadResponse.json()
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed')
      }
      
      // Send message with audio attachment
      await sendMessage({
        channel_id: channelId,
        content: '🎤 Voice message',
        content_type: 'audio',
        audio_attachment: {
          file_url: uploadResult.url,
          file_name: 'Voice Message',
          file_size: audioBlob.size,
          file_type: audioBlob.type,
          duration_seconds: duration
        }
      })
      
      handleStopTyping()
    } catch (error) {
      console.error('Failed to send voice message:', error)
      throw error
    }
  }, [channelId, sendMessage, handleStopTyping])

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
    // Legacy delete - now handled by moveToTrash
    if (channelId && moveToTrash) {
      moveToTrash(messageId, channelId)
    }
  }

  // Handle move to trash (Phase 2: Message Lifecycle)
  const handleMoveToTrash = useCallback((messageId: string, msgChannelId: string) => {
    moveToTrash(messageId, msgChannelId)
  }, [moveToTrash])

  // Handle hide for self (Phase 2: Message Lifecycle)
  const handleHideForSelf = useCallback((messageId: string, msgChannelId: string) => {
    hideForSelf(messageId, msgChannelId)
  }, [hideForSelf])

  // Handle reaction toggle on a message
  const handleReaction = useCallback((messageId: string, emoji: string) => {
    if (!channelId) return
    toggleReaction(messageId, channelId, emoji)
  }, [channelId, toggleReaction])

  // Handle loading more (older) messages
  const handleLoadMore = useCallback(async () => {
    if (!channelId || isLoadingMore) return { messages: [], hasMore: false }
    
    const channelMessages = (messages as unknown as Record<string, ICommunication[]>)[channelId] || []
    const offset = channelMessages.length
    
    setIsLoadingMore(true)
    try {
      const result = await fetchOlderMessages({
        channel_id: channelId,
        limit: 30,
        offset
      })
      
      if (result.messages.length > 0) {
        prependMessagesToChannel(channelId, result.messages)
      }
      
      setHasMoreMessages(result.hasMore)
      return result
    } finally {
      setIsLoadingMore(false)
    }
  }, [channelId, messages, isLoadingMore, fetchOlderMessages, prependMessagesToChannel])

  // Reset hasMoreMessages when channel changes
  useEffect(() => {
    setHasMoreMessages(true)
  }, [channelId])

  // Reset search when channel changes
  useEffect(() => {
    setSearchQuery("")
    setSearchResults([])
    setSearchTotal(0)
    setSearchIndex(0)
    setIsSearching(false)
  }, [channelId])

  // Search messages with debounce
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (!query.trim()) {
      setSearchResults([])
      setSearchTotal(0)
      setSearchIndex(0)
      return
    }
    
    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      if (!channelId) return
      
      setIsSearching(true)
      try {
        const result = await searchMessages(channelId, query.trim(), 50, 0)
        setSearchResults(result.messages)
        setSearchTotal(result.total)
        setSearchIndex(result.messages.length > 0 ? 1 : 0)
        
        // Navigate to first result
        if (result.messages.length > 0) {
          await navigateToSearchResult(result.messages[0])
        }
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [channelId, searchMessages])

  // Navigate to a search result message - loads more messages if needed
  const navigateToSearchResult = useCallback(async (message: ICommunication) => {
    if (!channelId) return
    
    const channelMessages = (messages as unknown as Record<string, ICommunication[]>)[channelId] || []
    
    // Check if message is already loaded
    const isLoaded = channelMessages.some(m => m.id === message.id)
    
    if (!isLoaded) {
      // Message not loaded - we need to load all messages up to and including this one
      // Find how many messages we need to load based on the message's position
      // For now, load enough messages to include this search result
      const messageDate = new Date(message.created_at)
      const oldestLoadedMessage = channelMessages[0]
      
      if (oldestLoadedMessage) {
        const oldestDate = new Date(oldestLoadedMessage.created_at)
        
        // If the search result is older than what we have loaded, load more
        if (messageDate < oldestDate) {
          // Keep loading until we have the message or can't load more
          let offset = channelMessages.length
          let hasMore = true
          let attempts = 0
          const maxAttempts = 10 // Prevent infinite loop
          
          while (hasMore && attempts < maxAttempts) {
            const result = await fetchOlderMessages({
              channel_id: channelId,
              limit: 20,
              offset
            })
            
            if (result.messages.length > 0) {
              prependMessagesToChannel(channelId, result.messages)
              offset += result.messages.length
              
              // Check if we now have the message
              if (result.messages.some((m: ICommunication) => m.id === message.id)) {
                break
              }
            }
            
            hasMore = result.hasMore
            attempts++
          }
          
          // Wait a bit for React to render the new messages
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }
    
    // Now try to scroll to the message
    scrollToSearchResult(message.id)
  }, [channelId, messages, fetchOlderMessages, prependMessagesToChannel])

  // Scroll to a search result message (visual only)
  const scrollToSearchResult = useCallback((messageId: string) => {
    // Try multiple times in case DOM hasn't updated yet
    const attemptScroll = (attemptsLeft: number) => {
      const element = document.querySelector(`[data-message-id="${messageId}"]`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Highlight the message
        element.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30')
        setTimeout(() => {
          element.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30')
        }, 2000)
      } else if (attemptsLeft > 0) {
        // Retry after a short delay
        setTimeout(() => attemptScroll(attemptsLeft - 1), 100)
      }
    }
    attemptScroll(5)
  }, [])

  // Navigate to previous search result
  const handleSearchPrev = useCallback(async () => {
    if (searchResults.length === 0) return
    const newIndex = searchIndex > 1 ? searchIndex - 1 : searchResults.length
    setSearchIndex(newIndex)
    await navigateToSearchResult(searchResults[newIndex - 1])
  }, [searchResults, searchIndex, navigateToSearchResult])

  // Navigate to next search result
  const handleSearchNext = useCallback(async () => {
    if (searchResults.length === 0) return
    const newIndex = searchIndex < searchResults.length ? searchIndex + 1 : 1
    setSearchIndex(newIndex)
    await navigateToSearchResult(searchResults[newIndex - 1])
  }, [searchResults, searchIndex, navigateToSearchResult])

  // Clear search when closing
  const handleCloseSearch = useCallback(() => {
    setIsSearchVisible(false)
    setSearchQuery("")
    setSearchResults([])
    setSearchTotal(0)
    setSearchIndex(0)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
  }, [])

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
                  
                  {(selectedChannel as any).is_archived && (
                    <Badge variant="secondary" className="shrink-0 gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Archive className="h-3 w-3" />
                      Archived
                    </Badge>
                  )}
                  
                  {!selectedChannel.is_private && !(selectedChannel as any).is_archived && (
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
                  <DropdownMenuItem onClick={() => setShowChannelSettings(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Channel Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {selectedChannel && selectedChannel.type !== 'dm' && (
                    <>
                      <DropdownMenuItem 
                        onClick={() => leaveChannel(channelId)}
                        className="text-orange-600 focus:text-orange-600"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Leave Channel
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => archiveChannel(channelId, (selectedChannel as any).is_archived ? 'unarchive' : 'archive')}
                        className="text-destructive focus:text-destructive"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {(selectedChannel as any).is_archived ? 'Unarchive Channel' : 'Archive Channel'}
                      </DropdownMenuItem>
                    </>
                  )}
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
                  onClick={handleCloseSearch}
                  className="h-8 w-8 p-0 hover:bg-muted shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Search input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search messages..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 hover:bg-muted/50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSearchNext()
                      } else if (e.key === 'Escape') {
                        handleCloseSearch()
                      }
                    }}
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Navigation arrows */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    disabled={searchResults.length === 0}
                    onClick={handleSearchPrev}
                    title="Previous result (↑)"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    disabled={searchResults.length === 0}
                    onClick={handleSearchNext}
                    title="Next result (↓)"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </div>

                {/* Result counter */}
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {searchQuery.trim() ? (
                    isSearching ? 'Searching...' : `${searchIndex} of ${searchTotal}`
                  ) : (
                    'Type to search'
                  )}
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
                    onMoveToTrash={handleMoveToTrash}
                    onHideForSelf={handleHideForSelf}
                    onReaction={handleReaction}
                    onLoadMore={handleLoadMore}
                    hasMoreMessages={hasMoreMessages}
                    isLoadingMore={isLoadingMore}
                    className="flex-1 min-h-0"
                    channel_members={selectedChannel?.channel_members || []}
                  />
                )
              })()
            )}

            {/* Archived channel banner */}
            {(selectedChannel as any)?.is_archived && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  This channel is archived. You can view messages but cannot send new ones.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => archiveChannel(channelId, 'unarchive')}
                  className="ml-2 h-7 text-xs"
                  disabled={actionLoading}
                >
                  Unarchive
                </Button>
              </div>
            )}

            {/* Message input - hidden for archived channels */}
            {!(selectedChannel as any)?.is_archived && (
              <MessageInput
                ref={messageInputRef}
                channelId={channelId}
                onSend={handleSendMessage}
                onSendWithFiles={sendMessageWithFiles}
                onSendVoice={handleSendVoice}
                onEdit={handleEditMessage}
                disabled={actionLoading}
                placeholder={`Message ${getChannelTitle()}...`}
                allowAttachments={true}
                onTyping={handleTyping}
                onStopTyping={handleStopTyping}
                channelMembers={selectedChannel?.channel_members || []}
              />
            )}
          </div>

          {/* Context panel */}
          <ContextPanel
            channel={selectedChannel}
            isVisible={isContextPanelVisible}
            onToggle={toggleContextPanel}
          />
        </div>
      </div>

      {/* Channel Settings Modal */}
      {selectedChannel && (
        <ChannelSettingsModal
          isOpen={showChannelSettings}
          onClose={() => setShowChannelSettings(false)}
          channel={selectedChannel}
        />
      )}
    </TooltipProvider>
  )
}