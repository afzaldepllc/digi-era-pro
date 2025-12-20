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
  setChannelsInitialized,
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
import { enrichMessageWithUserData } from '@/lib/communication/utils'

// Global flag to prevent multiple channel fetches across component remounts
// let globalChannelsFetched = false

// Global maps to prevent duplicate fetches per user across component remounts
const globalFetchedUsers = new Map<string, boolean>()
const globalFetchedChannels = new Map<string, boolean>()

export function useCommunications() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const realtimeManager = useMemo(() => getRealtimeManager(), [])
  const hasInitialized = useRef(false)  
  const hasUsersInitialized = useRef(false)
  const channelsFetchedRef = useRef(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasFetchedUsersRef = useRef(false)
  const hasFetchedChannelsRef = useRef(false)
  
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
  const sessionUserId = useMemo(() => (session?.user as ExtendedSessionUser)?.id, [session?.user])

  // Memoized event handlers for realtime manager
  const onNewMessage = useCallback((message: any) => {
    console.log('📩 onNewMessage handler called with:', message)
    
    // Skip messages from self to avoid duplicates
    if (message.mongo_sender_id === sessionUserId) {
      console.log('📩 Skipping message from self')
      return
    }
    
    if (message && typeof message === 'object' && message.mongo_sender_id) {
      // Message is already enriched from the API broadcast
      console.log('📩 Received enriched message:', message)
      
      dispatch(addMessage({ channelId: message.channel_id, message }))
    } else {
      console.error('Invalid message received, skipping:', message)
    }
  }, [dispatch, sessionUserId])

  const onMessageUpdate = useCallback((message: any) => {
    console.log('📝 onMessageUpdate handler called')
    // Message is already enriched from the API broadcast
    console.log('📝 Received updated enriched message:', message)
    dispatch(updateMessage({
      channelId: message.channel_id,
      messageId: message.id,
      updates: message
    }))
  }, [dispatch])

  const onMessageDelete = useCallback((messageId: any) => {
    console.log('🗑️ Message deleted:', messageId)
  }, [])

  const onUserJoined = useCallback((member: any) => {
    console.log('👋 User joined:', member)
  }, [])

  const onUserLeft = useCallback((memberId: any) => {
    console.log('👋 User left:', memberId)
  }, [])

  const onUserOnline = useCallback((userId: any) => {
    const updatedUsers = onlineUsers.map(u =>
      u.mongo_member_id === userId ? { ...u, isOnline: true } : u
    )
    dispatch(updateOnlineUsers(updatedUsers))
  }, [dispatch, onlineUsers])

  const onUserOffline = useCallback((userId: any) => {
    const updatedUsers = onlineUsers.map(u =>
      u.mongo_member_id === userId ? { ...u, isOnline: false } : u
    )
    dispatch(updateOnlineUsers(updatedUsers))
  }, [dispatch, onlineUsers])

  const onTypingStart = useCallback((userId: any) => {
    dispatch(setTyping({
      channelId: activeChannelId || '',
      userId,
      userName: 'Unknown User',
      timestamp: new Date().toISOString()
    }))
  }, [dispatch, activeChannelId])

  const onTypingStop = useCallback((userId: any) => {
    dispatch(removeTyping({ channelId: activeChannelId || '', userId }))
  }, [dispatch, activeChannelId])


  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])


  useEffect(() => {
    const fetchAllUsers = async () => {
      if (sessionUserId && !globalFetchedUsers.get(sessionUserId) && allUsers.length === 0 && !usersLoading && !hasUsersInitialized.current) {
        globalFetchedUsers.set(sessionUserId, true)
        hasFetchedUsersRef.current = true
        hasUsersInitialized.current = true
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
  }, [sessionUserId])

  // Fetch channels on mount - but only if not already initialized globally
  useEffect(() => {
    console.log('🔄 Channels fetch useEffect running, hasFetchedChannels:', hasFetchedChannelsRef.current, 'sessionUserId:', sessionUserId, 'loading:', loading)
    if (sessionUserId && !globalFetchedChannels.get(sessionUserId) && !loading) {
      globalFetchedChannels.set(sessionUserId, true)
      hasFetchedChannelsRef.current = true
      channelsFetchedRef.current = true
      console.log('🚀 Fetching channels')
      fetchChannels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]) // Only depend on sessionUserId

  // Subscribe to active channel
  useEffect(() => {
    const subscribe = async () => {
      if (activeChannelId) {
        console.log('Subscribing to channel:', activeChannelId)
        try {
          await realtimeManager.subscribeToChannel(activeChannelId)
          fetchMessages({ channel_id: activeChannelId })
        } catch (error) {
          console.error('Failed to subscribe to channel:', error)
        }
      }
    }
    subscribe()

    return () => {
      if (activeChannelId) {
        console.log('Unsubscribing from channel:', activeChannelId)
        realtimeManager.unsubscribeFromChannel(activeChannelId)
      }
    }
  }, [activeChannelId, realtimeManager])

  // Update handlers when they change
  useEffect(() => {
    realtimeManager.updateHandlers({
      onNewMessage,
      onMessageUpdate,
      onMessageDelete,
      onUserJoined,
      onUserLeft,
      onUserOnline,
      onUserOffline,
      onTypingStart,
      onTypingStop
    })
  }, [realtimeManager, onNewMessage, onMessageUpdate, onMessageDelete, onUserJoined, onUserLeft, onUserOnline, onUserOffline, onTypingStart, onTypingStop])

  // Channel operations
  const fetchChannels = useCallback(async (params: { type?: string; department_id?: string; project_id?: string } = {}) => {
    console.log('🔄 fetchChannels called with params:', params)
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
      console.log('Raw response from API:', response)
      dispatch(setChannels(response))
      return response  
    } catch (error) {
      dispatch(setError('Failed to fetch channels'))
      dispatch(setChannelsInitialized(true)) // Prevent infinite retries
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
    // Clear messages to force re-fetch with enriched data
    dispatch(setMessages({ channelId: channel_id, messages: [] }))
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
      dispatch(setMessages({ channelId: params.channel_id, messages: response }))

      console.log('Fetched and enriched messages320:', response) 
      return response
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
    const tempId = crypto.randomUUID()
    try {
      dispatch(setActionLoading(true))

      // Get sender info from session for optimistic update
      const senderName = sessionUser?.name || sessionUser?.email || 'Unknown User'
      const senderEmail = sessionUser?.email || ''
      const senderAvatar = sessionUser?.image || sessionUser?.avatar || ''
      const senderRole = sessionUser?.role || 'User'

      // Create optimistic message with denormalized sender fields
      const optimisticMessage = {
        id: tempId,
        channel_id: messageData.channel_id,
        mongo_sender_id: sessionUserId!,
        content: messageData.content,
        content_type: messageData.content_type || 'text',
        thread_id: messageData.thread_id,
        parent_message_id: messageData.parent_message_id,
        mongo_mentioned_user_ids: messageData.mongo_mentioned_user_ids || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        read_receipts: [],
        reactions: [],
        attachments: [],
        reply_count: 0,
        is_edited: false,
        isOptimistic: true, // Flag to identify optimistic messages
        // Denormalized sender fields (same as stored in Supabase)
        sender_name: senderName,
        sender_email: senderEmail,
        sender_avatar: senderAvatar,
        sender_role: senderRole,
        // Computed sender object for UI compatibility
        sender: {
          mongo_member_id: sessionUserId!,
          name: senderName,
          email: senderEmail,
          avatar: senderAvatar,
          role: senderRole,
          userType: 'User' as 'User' | 'Client',
          isOnline: true
        }
      }

      // Add optimistic message to state
      dispatch(addMessage({ channelId: messageData.channel_id, message: optimisticMessage }))

      // Send to API
      const response = await apiRequest('/api/communication/messages', {
        method: 'POST',
        body: JSON.stringify(messageData)
      })
      // Check if response is valid
      if (!response || !response.id) {
        console.error('Invalid response from API:', response)
        dispatch(updateMessage({
          channelId: messageData.channel_id,
          messageId: tempId,
          updates: { isFailed: true }
        }))
        return
      }
      if (response.id) {
        dispatch(updateMessage({
          channelId: messageData.channel_id,
          messageId: tempId,
          updates: { ...response, isOptimistic: false }
        }))
      }

      // Broadcast is now handled by the API route
      // console.log('📤 Broadcasting message, channel_id:', messageData.channel_id)
      // await realtimeManager.broadcastMessage(messageData.channel_id, response)

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      })
      

      return response.message
    } catch (error) {
      // Mark optimistic message as failed
      dispatch(updateMessage({
        channelId: messageData.channel_id,
        messageId: tempId,
        updates: { isFailed: true }
      }))

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
  }, [dispatch, sessionUserId, allUsers, realtimeManager]) // Removed toast to prevent infinite loop

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

      return response
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
  const setUserTyping = useCallback(async (typingIndicator: ITypingIndicator) => {
    if (activeChannelId) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Send typing start
      await realtimeManager.sendTypingStart(activeChannelId, typingIndicator.userId)
      dispatch(setTyping(typingIndicator))

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        removeUserTyping(activeChannelId, typingIndicator.userId)
      }, 3000)
    }
  }, [dispatch, activeChannelId, realtimeManager])

  const removeUserTyping = useCallback(async (channelId: string, userId: string) => {
    await realtimeManager.sendTypingStop(channelId, userId)
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
