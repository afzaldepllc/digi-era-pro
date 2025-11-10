import { useCallback, useEffect, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import { useSocket } from '@/components/providers/socket-provider'
import {
  setActiveChannel,
  clearActiveChannel,
  setChannels,
  setMessages,
  addMessage,
  updateMessage,
  setTyping,
  removeTyping,
  updateOnlineUsers,
  toggleChannelList,
  toggleContextPanel,
  setChannelListExpanded,
  setContextPanelVisible,
  setFilters,
  setSort,
  setPagination,
  setLoading,
  setActionLoading,
  setMessagesLoading,
  clearError,
  setError,
  addNotification,
  clearNotifications,
  resetState
} from '@/store/slices/communicationSlice'
import {
  useGenericQuery,
  useGenericCreate,
  useGenericUpdate,
  type UseGenericQueryOptions,
} from './use-generic-query'
import type {
  FetchMessagesParams,
  CreateMessageData,
  CreateChannelData,
  CommunicationFilters,
  CommunicationSort,
  ITypingIndicator,
  IParticipant,
  ICommunication,
  IChannel
} from '@/types/communication'
import { useToast } from '@/hooks/use-toast'

export function useCommunications() {
  const dispatch = useAppDispatch()
  const { socket, isConnected } = useSocket()
  const { toast } = useToast()

  const {
    channels,
    activeChannelId,
    selectedChannel,
    messages,
    onlineUsers,
    typingUsers,
    isChannelListExpanded,
    isContextPanelVisible,
    loading,
    actionLoading,
    messagesLoading,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications
  } = useAppSelector((state) => state.communications)

  // Define options for generic hooks - Channels
  const channelOptions: UseGenericQueryOptions<IChannel> = useMemo(() => ({
    entityName: 'channels',
    baseUrl: '/api/communications/channels',
    reduxDispatchers: {
      setEntities: (entities) => dispatch(setChannels(entities as IChannel[])),
      setLoading: (loading) => dispatch(setLoading(loading)),
      setActionLoading: (loading) => dispatch(setActionLoading(loading)),
      setError: (error) => dispatch(setError(error)),
      clearError: () => dispatch(clearError()),
    },
  }), [dispatch])

  // Define options for generic hooks - Messages
  const messageOptions: UseGenericQueryOptions<ICommunication> = useMemo(() => ({
    entityName: 'messages',
    baseUrl: '/api/communications/messages',
    reduxDispatchers: {
      setLoading: (loading) => dispatch(setMessagesLoading(loading)),
      setActionLoading: (loading) => dispatch(setActionLoading(loading)),
      setError: (error) => dispatch(setError(error)),
      clearError: () => dispatch(clearError()),
    },
  }), [dispatch])

  // Memoize query params to prevent unnecessary re-renders
  const channelQueryParams = useMemo(() => ({
    page: pagination.page,
    limit: pagination.limit,
    filters,
    sort: {
      field: sort.field,
      direction: sort.direction as 'asc' | 'desc',
    },
  }), [pagination.page, pagination.limit, filters, sort.field, sort.direction])

  const messageQueryParams = useMemo(() => ({
    page: 1,
    limit: 50,
    filters: activeChannelId ? { channelId: activeChannelId } : {},
    sort: {
      field: 'createdAt' as const,
      direction: 'asc' as const,
    },
  }), [activeChannelId])

  // Use generic hooks for channels
  const { 
    data: fetchedChannels, 
    isLoading: channelsQueryLoading, 
    refetch: refetchChannels 
  } = useGenericQuery(channelOptions, channelQueryParams, true)

  // Use generic hooks for messages (only fetch when activeChannelId exists)
  const { 
    data: fetchedMessages, 
    isLoading: messagesQueryLoading, 
    refetch: refetchMessages 
  } = useGenericQuery(messageOptions, messageQueryParams, !!activeChannelId)

  // Update Redux with fetched messages when they arrive
  useEffect(() => {
    if (fetchedMessages && activeChannelId) {
      dispatch(setMessages({ channelId: activeChannelId, messages: fetchedMessages }))
    }
  }, [fetchedMessages, activeChannelId, dispatch])

  // Mutations
  const createChannelMutation = useGenericCreate<IChannel>(channelOptions)
  const sendMessageMutation = useGenericCreate<ICommunication>(messageOptions)
  const updateMessageMutation = useGenericUpdate<ICommunication>(messageOptions)

  // Socket.io integration
  useEffect(() => {
    if (!socket || !isConnected) return

    // Get all channel IDs user has access to
    const channelIds = channels.map(ch => ch.channelId)

    // Connect to socket with user's channels
    socket.emit('user:connect', {
      token: '', // Will be handled by auth middleware
      channelIds
    })

    // Listen for real-time events
    const handleMessageReceive = (message: ICommunication) => {
      dispatch(addMessage({ channelId: message.channelId, message }))
      dispatch(addNotification({ channelId: message.channelId, message }))
    }

    const handleMessageRead = (data: { messageId: string; userId: string }) => {
      if (activeChannelId) {
        dispatch(updateMessage({
          channelId: activeChannelId,
          messageId: data.messageId,
          updates: { isRead: true, readAt: new Date().toISOString() }
        }))
      }
    }

    const handleTyping = (data: { channelId: string; userId: string; userName: string }) => {
      dispatch(setTyping({
        channelId: data.channelId,
        userId: data.userId,
        userName: data.userName,
        timestamp: new Date().toISOString()
      } as ITypingIndicator))
    }

    const handleStopTyping = (data: { channelId: string; userId: string }) => {
      dispatch(removeTyping({ channelId: data.channelId, userId: data.userId }))
    }

    const handleUserOnline = (userId: string) => {
      // Update online status in participants
      const updatedUsers = onlineUsers.map(user =>
        user._id === userId ? { ...user, isOnline: true } : user
      )
      dispatch(updateOnlineUsers(updatedUsers))
    }

    const handleUserOffline = (userId: string) => {
      // Update online status in participants
      const updatedUsers = onlineUsers.map(user =>
        user._id === userId ? { ...user, isOnline: false } : user
      )
      dispatch(updateOnlineUsers(updatedUsers))
    }

    const handleError = (error: string) => {
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      })
    }

    // Register event listeners
    socket.on('message:receive', handleMessageReceive)
    socket.on('message:read', handleMessageRead)
    socket.on('message:typing', handleTyping)
    socket.on('message:stop_typing', handleStopTyping)
    socket.on('user:online', handleUserOnline)
    socket.on('user:offline', handleUserOffline)
    socket.on('error', handleError)

    // Cleanup
    return () => {
      socket.off('message:receive', handleMessageReceive)
      socket.off('message:read', handleMessageRead)
      socket.off('message:typing', handleTyping)
      socket.off('message:stop_typing', handleStopTyping)
      socket.off('user:online', handleUserOnline)
      socket.off('user:offline', handleUserOffline)
      socket.off('error', handleError)
    }
  }, [socket, isConnected, channels, activeChannelId, onlineUsers, dispatch, toast])

  // Join channel when selected
  useEffect(() => {
    if (!socket || !isConnected || !activeChannelId) return

    socket.emit('channel:join', activeChannelId)

    return () => {
      if (activeChannelId) {
        socket.emit('channel:leave', activeChannelId)
      }
    }
  }, [socket, isConnected, activeChannelId])

  // Channel operations
  const handleFetchChannels = useCallback((params: { isInternal?: boolean } = {}) => {
    // Update filters if needed
    if (params.isInternal !== undefined) {
      dispatch(setFilters({ isInternal: params.isInternal }))
    }
    return refetchChannels()
  }, [dispatch, refetchChannels])

  const handleSelectChannel = useCallback((channelId: string) => {
    console.log('handleSelectChannel called with:', channelId)
    dispatch(setActiveChannel(channelId))
  }, [dispatch])

  const handleClearChannel = useCallback(() => {
    dispatch(clearActiveChannel())
  }, [dispatch])

  // Message operations
  const handleFetchMessages = useCallback((params: FetchMessagesParams) => {
    // The generic hook will automatically refetch when activeChannelId changes
    return refetchMessages()
  }, [refetchMessages])

  const handleSendMessage = useCallback(async (messageData: CreateMessageData) => {
    try {
      const result = await sendMessageMutation.mutateAsync(messageData)
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      })
      
      // Refetch messages to update the list
      await refetchMessages()
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      })
      throw error
    }
  }, [sendMessageMutation, toast, refetchMessages])

  const handleCreateChannel = useCallback(async (channelData: CreateChannelData) => {
    try {
      const result = await createChannelMutation.mutateAsync(channelData)
      
      toast({
        title: "Channel created",
        description: "New conversation started successfully",
      })
      
      // Refetch channels to update the list
      await refetchChannels()
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create channel",
        variant: "destructive"
      })
      throw error
    }
  }, [createChannelMutation, toast, refetchChannels])

  const handleMarkAsRead = useCallback((messageId: string, channelId: string) => {
    return updateMessageMutation.mutateAsync({ 
      id: messageId, 
      data: { isRead: true } 
    })
  }, [updateMessageMutation])

  const handleUpdateMessage = useCallback((channelId: string, messageId: string, updates: Partial<ICommunication>) => {
    dispatch(updateMessage({ channelId, messageId, updates }))
  }, [dispatch])

  // Real-time operations
  const handleSetTyping = useCallback((typingIndicator: ITypingIndicator) => {
    if (socket && isConnected) {
      socket.emit('message:typing', { channelId: typingIndicator.channelId })
    }
    dispatch(setTyping(typingIndicator))

    // Auto-remove typing indicator after 3 seconds
    setTimeout(() => {
      dispatch(removeTyping({
        channelId: typingIndicator.channelId,
        userId: typingIndicator.userId
      }))
    }, 3000)
  }, [socket, isConnected, dispatch])

  const handleRemoveTyping = useCallback((channelId: string, userId: string) => {
    if (socket && isConnected) {
      socket.emit('message:stop_typing', { channelId })
    }
    dispatch(removeTyping({ channelId, userId }))
  }, [socket, isConnected, dispatch])

  const handleUpdateOnlineUsers = useCallback((users: IParticipant[]) => {
    dispatch(updateOnlineUsers(users))
  }, [dispatch])

  // UI state operations
  const handleToggleChannelList = useCallback(() => {
    dispatch(toggleChannelList())
  }, [dispatch])

  const handleToggleContextPanel = useCallback(() => {
    dispatch(toggleContextPanel())
  }, [dispatch])

  const handleSetChannelListExpanded = useCallback((expanded: boolean) => {
    dispatch(setChannelListExpanded(expanded))
  }, [dispatch])

  const handleSetContextPanelVisible = useCallback((visible: boolean) => {
    dispatch(setContextPanelVisible(visible))
  }, [dispatch])

  // Filter and search operations
  const handleSetFilters = useCallback((newFilters: Partial<CommunicationFilters>) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: CommunicationSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: { page?: number; limit?: number }) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  // Error handling
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleSetError = useCallback((error: string) => {
    dispatch(setError(error))
  }, [dispatch])

  // Notifications
  const handleAddNotification = useCallback((channelId: string, message: ICommunication) => {
    dispatch(addNotification({ channelId, message }))
    
    // Show toast notification
    toast({
      title: "New message",
      description: `${message.message.substring(0, 50)}${message.message.length > 50 ? '...' : ''}`,
    })
  }, [dispatch, toast])

  const handleClearNotifications = useCallback(() => {
    dispatch(clearNotifications())
  }, [dispatch])

  // Utility operations
  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshChannels = useCallback(() => {
    return handleFetchChannels({ isInternal: filters.isInternal })
  }, [handleFetchChannels, filters.isInternal])

  const refreshMessages = useCallback(() => {
    if (activeChannelId) {
      return handleFetchMessages({ channelId: activeChannelId })
    }
    return Promise.resolve()
  }, [handleFetchMessages, activeChannelId])

  // Computed values
  const activeMessages = useMemo(() => {
    return activeChannelId ? messages[activeChannelId] || [] : []
  }, [messages, activeChannelId])

  const activeTypingUsers = useMemo(() => {
    return activeChannelId ? typingUsers[activeChannelId] || [] : []
  }, [typingUsers, activeChannelId])

  const hasChannels = channels.length > 0
  const hasMessages = activeMessages.length > 0
  const hasUnreadMessages = unreadCount > 0
  const hasNotifications = notifications.length > 0

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      // Prioritize channels with unread messages
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1
      
      // Then sort by last message timestamp
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0
      
      return bTime - aTime // Most recent first
    })
  }, [channels])

  const filteredChannels = useMemo(() => {
    let filtered = sortedChannels

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(channel => 
        channel.name.toLowerCase().includes(searchLower) ||
        channel.participants.some((p: IParticipant) => p.name.toLowerCase().includes(searchLower))
      )
    }

    if (filters.isInternal !== undefined) {
      filtered = filtered.filter(channel => channel.isInternal === filters.isInternal)
    }

    return filtered
  }, [sortedChannels, filters])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        handleClearError()
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [error, handleClearError])

  return {
    // State
    channels: filteredChannels,
    allChannels: fetchedChannels || channels,
    activeChannelId,
    selectedChannel,
    messages: activeMessages,
    allMessages: messages,
    onlineUsers,
    typingUsers: activeTypingUsers,
    allTypingUsers: typingUsers,
    isChannelListExpanded,
    isContextPanelVisible,
    loading: channelsQueryLoading || loading,
    actionLoading: createChannelMutation.isPending || sendMessageMutation.isPending || actionLoading,
    messagesLoading: messagesQueryLoading || messagesLoading,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications,

    // Computed values
    hasChannels,
    hasMessages,
    hasUnreadMessages,
    hasNotifications,
    sortedChannels,

    // Channel operations
    fetchChannels: handleFetchChannels,
    selectChannel: handleSelectChannel,
    clearChannel: handleClearChannel,
    createChannel: handleCreateChannel,

    // Message operations
    fetchMessages: handleFetchMessages,
    sendMessage: handleSendMessage,
    markAsRead: handleMarkAsRead,
    updateMessage: handleUpdateMessage,

    // Real-time operations
    setTyping: handleSetTyping,
    removeTyping: handleRemoveTyping,
    updateOnlineUsers: handleUpdateOnlineUsers,

    // UI state operations
    toggleChannelList: handleToggleChannelList,
    toggleContextPanel: handleToggleContextPanel,
    setChannelListExpanded: handleSetChannelListExpanded,
    setContextPanelVisible: handleSetContextPanelVisible,

    // Filter and search operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,

    // Error handling
    clearError: handleClearError,
    setError: handleSetError,

    // Notifications
    addNotification: handleAddNotification,
    clearNotifications: handleClearNotifications,

    // Utility operations
    resetState: handleResetState,
    refreshChannels,
    refreshMessages
  }
}