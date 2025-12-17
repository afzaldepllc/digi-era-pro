import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import { useSession } from 'next-auth/react'
import type { User } from '@/types'
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
import { apiRequest } from '@/lib/utils/api-client'
import { getRealtimeManager } from '@/lib/realtime-manager'

export function useCommunications() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const realtimeManager = getRealtimeManager()
  const hasInitialized = useRef(false)
  
  // State for real users data
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

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
    channelsInitialized,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications
  } = useAppSelector((state) => state.communications)

  // Initialize realtime manager with event handlers
  useEffect(() => {
    console.log('🔧 Updating realtime handlers')
    realtimeManager.updateHandlers({
      onNewMessage: (message) => {
        console.log('📩 onNewMessage handler called with:', message)
        dispatch(addMessage({ channelId: message.channel_id, message }))
      },
      onMessageUpdate: (message) => {
        console.log('📝 onMessageUpdate handler called')
        dispatch(updateMessage({
          channelId: message.channel_id,
          messageId: message.id,
          updates: message
        }))
      },
      onMessageDelete: (messageId) => {
        // Handle message deletion
        console.log('🗑️ Message deleted:', messageId)
      },
      onUserJoined: (member) => {
        // Handle user joined
        console.log('👋 User joined:', member)
      },
      onUserLeft: (memberId) => {
        // Handle user left
        console.log('👋 User left:', memberId)
      },
      onUserOnline: (userId) => {
        // Update online users list
        const updatedUsers = [...onlineUsers]
        const userIndex = updatedUsers.findIndex(u => u.mongo_member_id === userId)
        if (userIndex !== -1) {
          updatedUsers[userIndex].isOnline = true
        }
        dispatch(updateOnlineUsers(updatedUsers))
      },
      onUserOffline: (userId) => {
        // Update online users list
        const updatedUsers = [...onlineUsers]
        const userIndex = updatedUsers.findIndex(u => u.mongo_member_id === userId)
        if (userIndex !== -1) {
          updatedUsers[userIndex].isOnline = false
        }
        dispatch(updateOnlineUsers(updatedUsers))
      },
      onTypingStart: (userId) => {
        dispatch(setTyping({
          channelId: activeChannelId || '',
          userId,
          userName: 'Unknown User', // Will be resolved later
          timestamp: new Date().toISOString()
        }))
      },
      onTypingStop: (userId) => {
        dispatch(removeTyping({ channelId: activeChannelId || '', userId }))
      }
    })
    console.log('✅ Realtime handlers updated')
  }, [dispatch, realtimeManager, activeChannelId, onlineUsers])

  // Type guard for session user with extended properties
  interface ExtendedSessionUser {
    id?: string
    name?: string | null
    email?: string | null
    role?: string
    image?: string | null
    avatar?: string
    permissions?: any[]
  }
  
  const sessionUser = session?.user as ExtendedSessionUser | undefined

  // Fetch all users on mount for user directory
  useEffect(() => {
    const fetchAllUsers = async () => {
      if (sessionUser?.id && allUsers.length === 0 && !usersLoading) {
        try {
          setUsersLoading(true)
          const response = await apiRequest('/api/users')
          setAllUsers(response.users || [])
        } catch (error) {
          console.error('Failed to fetch users:', error)
        } finally {
          setUsersLoading(false)
        }
      }
    }
    
    fetchAllUsers()
  }, [sessionUser?.id])

  // Fetch channels on mount - but only if not already initialized globally
  useEffect(() => {
    if (!channelsInitialized && !hasInitialized.current && sessionUser?.id) {
      hasInitialized.current = true
      fetchChannels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelsInitialized, sessionUser?.id]) // Re-run if channelsInitialized changes

  // Subscribe to active channel
  useEffect(() => {
    if (activeChannelId) {
      console.log('Subscribing to channel:', activeChannelId)
      realtimeManager.subscribeToChannel(activeChannelId)
      fetchMessages({ channel_id: activeChannelId })
    }

    return () => {
      if (activeChannelId) {
        console.log('Unsubscribing from channel:', activeChannelId)
        realtimeManager.unsubscribeFromChannel(activeChannelId)
      }
    }
  }, [activeChannelId, realtimeManager])

  // Channel operations
  const fetchChannels = useCallback(async (params: { type?: string; department_id?: string; project_id?: string } = {}) => {
    try {
      dispatch(setLoading(true))
      // Build query string
      const queryParams = new URLSearchParams()
      if (params.type) queryParams.append('type', params.type)
      if (params.department_id) queryParams.append('department_id', params.department_id)
      if (params.project_id) queryParams.append('project_id', params.project_id)
      
      const queryString = queryParams.toString()
      const url = `/api/communication/channels${queryString ? `?${queryString}` : ''}`
      
      const response = await apiRequest(url)
      dispatch(setChannels(response.channels))
      return response.channels
    } catch (error) {
      dispatch(setError('Failed to fetch channels'))
      toast({
        title: "Error",
        description: "Failed to load channels",
        variant: "destructive"
      })
      return []
    } finally {
      dispatch(setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]) // Removed toast from dependencies to prevent infinite loop

  const selectChannel = useCallback((channel_id: string) => {
    dispatch(setActiveChannel(channel_id))
  }, [dispatch])

  const clearChannel = useCallback(() => {
    dispatch(clearActiveChannel())
  }, [dispatch])

  // Message operations
  const fetchMessages = useCallback(async (params: FetchMessagesParams) => {
    try {
      dispatch(setMessagesLoading(true))
      // Build query string
      const queryParams = new URLSearchParams({
        channel_id: params.channel_id,
        limit: (params.limit || 50).toString(),
        offset: '0'
      })
      
      const response = await apiRequest(`/api/communication/messages?${queryParams.toString()}`)
      dispatch(setMessages({ channelId: params.channel_id, messages: response.messages }))
      return response.messages
    } catch (error) {
      dispatch(setError('Failed to fetch messages'))
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      })
      return []
    } finally {
      dispatch(setMessagesLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]) // Removed toast to prevent infinite loop

  const sendMessage = useCallback(async (messageData: CreateMessageData) => {
    try {
      dispatch(setActionLoading(true))
      const response = await apiRequest('/api/communication/messages', {
        method: 'POST',
        body: JSON.stringify(messageData)
      })

      // Immediately add the message to Redux state (optimistic update)
      // This ensures the sender sees their message instantly
      if (response.message) {
        dispatch(addMessage({ 
          channelId: messageData.channel_id, 
          message: response.message 
        }))
      }

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      })

      return response.message
    } catch (error) {
      dispatch(setError('Failed to send message'))
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]) // Removed toast to prevent infinite loop

  const createChannel = useCallback(async (channelData: CreateChannelData) => {
    try {
      dispatch(setActionLoading(true))
      const response = await apiRequest('/api/communication/channels', {
        method: 'POST',
        body: JSON.stringify(channelData)
      })

      // Refresh channels list
      await fetchChannels()

      toast({
        title: "Channel created",
        description: "New conversation started successfully",
      })

      return response.channel
    } catch (error) {
      dispatch(setError('Failed to create channel'))
      toast({
        title: "Error",
        description: "Failed to create channel",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, fetchChannels]) // Removed toast to prevent infinite loop

  const markAsRead = useCallback(async (messageId: string, channel_id: string) => {
    try {
      await apiRequest('/api/communication/read-receipts', {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId, channel_id })
      })
    } catch (error) {
      console.error('Failed to mark message as read:', error)
    }
  }, [])

  // Real-time operations
  const setUserTyping = useCallback((typingIndicator: ITypingIndicator) => {
    if (activeChannelId) {
      realtimeManager.sendTypingStart(activeChannelId, typingIndicator.userId)
      dispatch(setTyping(typingIndicator))

      // Auto-remove typing indicator after 3 seconds
      setTimeout(() => {
        removeUserTyping(activeChannelId, typingIndicator.userId)
      }, 3000)
    }
  }, [dispatch, activeChannelId, realtimeManager])

  const removeUserTyping = useCallback((channelId: string, userId: string) => {
    realtimeManager.sendTypingStop(channelId, userId)
    dispatch(removeTyping({ channelId, userId }))
  }, [dispatch, realtimeManager])

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
  const handleSetFilters = useCallback((newFilters: CommunicationFilters) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const handleSetSort = useCallback((newSort: CommunicationSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const handleSetPagination = useCallback((newPagination: any) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  // Error handling
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleSetError = useCallback((errorMessage: string) => {
    dispatch(setError(errorMessage))
  }, [dispatch])

  // Notifications
  const handleAddNotification = useCallback((notification: any) => {
    dispatch(addNotification(notification))
  }, [dispatch])

  const handleClearNotifications = useCallback(() => {
    dispatch(clearNotifications())
  }, [dispatch])

  // Utility operations
  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshChannels = useCallback(() => {
    return fetchChannels()
  }, [fetchChannels])

  const refreshMessages = useCallback(() => {
    if (activeChannelId) {
      return fetchMessages({ channel_id: activeChannelId })
    }
  }, [fetchMessages, activeChannelId])

  // Get current user from session
  const currentUserFromSession = useMemo(() => {
    if (!sessionUser) return null
    
    return {
      _id: sessionUser.id || '',
      name: sessionUser.name || '',
      email: sessionUser.email || '',
      role: sessionUser.role || '',
      avatar: sessionUser.image || sessionUser.avatar || undefined,
      status: 'active' as const,
      permissions: sessionUser.permissions || [],
    } as User
  }, [sessionUser])

  // Filter active users (exclude current user)
  const activeUsers = useMemo(() => {
    return allUsers.filter(user => 
      user._id !== currentUserFromSession?._id && 
      user.status === 'active'
    )
  }, [allUsers, currentUserFromSession?._id])

  const hasChannels = channels.length > 0

  return {
    // State
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
    notifications,

    // Real user data
    mockUsers: activeUsers, // For backward compatibility with existing components
    mockCurrentUser: currentUserFromSession, // For backward compatibility with existing components
    allUsers,
    currentUserFromSession,
    usersLoading,
    sessionStatus: status,
    hasChannels,

    // Channel operations
    fetchChannels,
    selectChannel,
    clearActiveChannel: clearChannel,

    // Message operations
    fetchMessages,
    sendMessage,
    createChannel,
    markAsRead,

    // Real-time operations
    setTyping: setUserTyping,
    removeTyping: removeUserTyping,

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
