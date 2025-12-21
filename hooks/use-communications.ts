import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import { useSession } from 'next-auth/react'
import type { User } from '@/types'
import {
  setActiveChannel,
  clearActiveChannel,
  setChannels,
  setMessages,
  prependMessages,
  addMessage,
  updateMessage,
  addMessageReadReceipt,
  setMessageDelivered,
  addReactionToMessage,
  removeReactionFromMessage,
  setTyping,
  removeTyping,
  clearTypingForChannel,
  setCurrentUserId,
  setOnlineUserIds,
  addOnlineUser,
  removeOnlineUser,
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
  resetState,
  // Channel real-time updates (Phase 3)
  addChannel,
  updateChannel,
  removeChannel,
  // Trash management imports (Phase 2)
  moveMessageToTrash,
  restoreMessageFromTrash,
  hideMessageForSelf,
  permanentlyDeleteMessage,
  setTrashedMessages,
  appendTrashedMessages,
  setTrashedMessagesLoading,
  clearTrashedMessages,
  type ITrashedMessage
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
import { getRealtimeManager, RealtimeEventHandlers } from '@/lib/realtime-manager'
import { communicationLogger as logger } from '@/lib/logger'
import { communicationCache } from '@/lib/communication/cache'

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
  const presenceInitializedRef = useRef(false)
  const hasFetchedUsersRef = useRef(false)
  const hasFetchedChannelsRef = useRef(false)
  
  // Use ref for toast to prevent unnecessary callback recreations
  const toastRef = useRef(toast)
  useEffect(() => {
    toastRef.current = toast
  }, [toast])
  
  // State for real users data
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const {
    channels,
    activeChannelId,
    selectedChannel,
    messages,
    onlineUsers,
    onlineUserIds,
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
    currentUserId: storeCurrentUserId,
    unreadCount,
    notifications,
    // Trash management state (Phase 2)
    trashedMessages,
    trashedMessagesLoading,
    trashedMessagesPagination
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
  const sessionUserName = useMemo(() => sessionUser?.name || sessionUser?.email || 'Unknown', [sessionUser])
  const sessionUserAvatar = useMemo(() => sessionUser?.image || sessionUser?.avatar, [sessionUser])

  // ============================================
  // Realtime Event Handlers
  // ============================================

  const onNewMessage = useCallback((message: any) => {
    logger.debug('onNewMessage handler called with:', message)
    
    // Skip messages from self to avoid duplicates (optimistic updates handle this)
    if (message.mongo_sender_id === sessionUserId) {
      logger.debug('Skipping message from self')
      return
    }
    
    if (message && typeof message === 'object' && message.mongo_sender_id) {
      logger.debug('Received enriched message:', message)
      dispatch(addMessage({ channelId: message.channel_id, message }))
    } else {
      logger.error('Invalid message received, skipping:', message)
    }
  }, [dispatch, sessionUserId])

  const onMessageUpdate = useCallback((message: any) => {
    logger.debug('onMessageUpdate handler called')
    dispatch(updateMessage({
      channelId: message.channel_id,
      messageId: message.id,
      updates: message
    }))
  }, [dispatch])

  const onMessageDelete = useCallback((messageId: any) => {
    logger.debug('Message deleted:', messageId)
  }, [])

  const onUserJoined = useCallback((member: any) => {
    logger.debug('User joined:', member)
  }, [])

  const onUserLeft = useCallback((memberId: any) => {
    logger.debug('User left:', memberId)
  }, [])

  const onUserOnline = useCallback((userId: string) => {
    logger.debug('User online:', userId)
    dispatch(addOnlineUser(userId))
  }, [dispatch])

  const onUserOffline = useCallback((userId: string) => {
    logger.debug('User offline:', userId)
    dispatch(removeOnlineUser(userId))
  }, [dispatch])

  // Handle typing start with proper data structure
  const onTypingStart = useCallback((data: { userId: string; userName: string; channelId: string }) => {
    logger.debug('Typing start:', data)
    dispatch(setTyping({
      channelId: data.channelId,
      userId: data.userId,
      userName: data.userName || 'Someone',
      timestamp: new Date().toISOString()
    }))
  }, [dispatch])

  // Handle typing stop
  const onTypingStop = useCallback((data: { userId: string; channelId: string }) => {
    logger.debug('Typing stop:', data)
    dispatch(removeTyping({ channelId: data.channelId, userId: data.userId }))
  }, [dispatch])

  // Handle message read (real-time update from other users)
  const onMessageRead = useCallback((data: { 
    messageId: string; 
    userId: string; 
    channelId: string; 
    readAt: string 
  }) => {
    logger.debug('Message read:', data)
    // Don't process our own read receipts
    if (data.userId === sessionUserId) return
    
    dispatch(addMessageReadReceipt({
      channelId: data.channelId,
      messageId: data.messageId,
      userId: data.userId,
      readAt: data.readAt
    }))
  }, [dispatch, sessionUserId])

  // Handle message delivered (when server confirms message received)
  const onMessageDelivered = useCallback((data: { 
    messageId: string; 
    channelId: string 
  }) => {
    logger.debug('Message delivered:', data)
    dispatch(setMessageDelivered({
      channelId: data.channelId,
      messageId: data.messageId
    }))
  }, [dispatch])

  // Handle presence sync (initial load and updates)
  const onPresenceSync = useCallback((presenceState: Record<string, any[]>) => {
    logger.debug('Presence sync:', Object.keys(presenceState))
    const onlineIds = Object.keys(presenceState)
    dispatch(setOnlineUserIds(onlineIds))
  }, [dispatch])

  // Handle mention notifications
  const onMentionNotification = useCallback((data: {
    type: string
    message_id: string
    channel_id: string
    sender_name: string
    sender_avatar?: string
    content_preview: string
    created_at: string
  }) => {
    logger.debug('Mention notification received:', data)
    
    // Add notification to store
    dispatch(addNotification({
      id: `mention_${data.message_id}`,
      type: 'mention',
      title: `${data.sender_name} mentioned you`,
      channelId: data.channel_id,
      messageId: data.message_id,
      preview: data.content_preview,
      read: false
    }))

    // Show toast notification
    toastRef.current({
      title: `@${data.sender_name} mentioned you`,
      description: data.content_preview.slice(0, 60) + (data.content_preview.length > 60 ? '...' : ''),
    })
  }, [dispatch])

  // Handle reaction added (real-time)
  const onReactionAdd = useCallback((data: {
    id: string;
    message_id: string;
    channel_id: string;
    mongo_user_id: string;
    user_name?: string;
    emoji: string;
    created_at: string;
  }) => {
    logger.debug('Reaction added:', data)
    // Skip reactions from self (already handled optimistically)
    if (data.mongo_user_id === sessionUserId) return
    
    dispatch(addReactionToMessage({
      channelId: data.channel_id,
      messageId: data.message_id,
      reaction: {
        id: data.id,
        mongo_user_id: data.mongo_user_id,
        user_name: data.user_name,
        emoji: data.emoji,
        created_at: data.created_at
      }
    }))
  }, [dispatch, sessionUserId])

  // Handle reaction removed (real-time)
  const onReactionRemove = useCallback((data: {
    id: string;
    message_id: string;
    channel_id: string;
    mongo_user_id: string;
    emoji: string;
  }) => {
    logger.debug('Reaction removed:', data)
    // Skip reactions from self (already handled optimistically)
    if (data.mongo_user_id === sessionUserId) return
    
    dispatch(removeReactionFromMessage({
      channelId: data.channel_id,
      messageId: data.message_id,
      reactionId: data.id,
      mongo_user_id: data.mongo_user_id,
      emoji: data.emoji
    }))
  }, [dispatch, sessionUserId])

  // ============================================
  // Channel Real-time Event Handlers (Phase 3)
  // ============================================

  // Handle channel update (archive/unarchive, settings changes, etc.)
  const onChannelUpdate = useCallback((data: {
    id: string;
    type: 'update' | 'archive' | 'unarchive' | 'member_left' | 'new_channel';
    channel?: IChannel & { members?: Array<{ user_id: string }> };
    member_id?: string;
  }) => {
    logger.debug('Channel update received:', data)
    
    if (data.type === 'new_channel' && data.channel) {
      // New channel created - add it if current user is a member
      const isMember = data.channel.members?.some((m: { user_id: string }) => m.user_id === sessionUserId)
      if (isMember) {
        dispatch(addChannel(data.channel as IChannel))
        // Update cache
        communicationCache.addChannelToCache(data.channel)
        toastRef.current({
          title: "New Channel",
          description: `You've been added to #${data.channel.name}`,
        })
      }
    } else if (data.type === 'member_left' && data.member_id === sessionUserId) {
      // Current user was removed or left - remove channel from list
      dispatch(removeChannel(data.id))
      // Update cache
      communicationCache.removeChannelFromCache(data.id)
    } else if (data.channel) {
      // Channel updated (archive/unarchive, name change, etc.)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _channelId, ...updates } = data.channel
      dispatch(updateChannel({
        id: data.id,
        ...updates
      }))
      // Update cache
      communicationCache.updateChannelInCache(data.id, data.channel)
    }
  }, [dispatch, sessionUserId])

  // ============================================
  // Trash-Related Event Handlers (Phase 2)
  // ============================================

  // Handle message trashed (real-time)
  const onMessageTrashed = useCallback((data: {
    message_id: string;
    channel_id: string;
    trashed_by: string;
    trashed_at: string;
    trash_reason?: string;
  }) => {
    logger.debug('Message trashed:', data)
    
    // Don't process if we initiated the trash action (already handled optimistically)
    if (data.trashed_by === sessionUserId) return
    
    dispatch(moveMessageToTrash({
      channelId: data.channel_id,
      messageId: data.message_id,
      trashedAt: data.trashed_at,
      trashedBy: data.trashed_by,
      trashReason: data.trash_reason
    }))
  }, [dispatch, sessionUserId])

  // Handle message restored (real-time)
  const onMessageRestored = useCallback((data: {
    message: ICommunication;
    restored_by: string;
    channel_id: string;
  }) => {
    logger.debug('Message restored:', data)
    
    // Don't process if we initiated the restore (already handled optimistically)
    if (data.restored_by === sessionUserId) return
    
    dispatch(restoreMessageFromTrash({
      messageId: data.message.id,
      channelId: data.channel_id,
      restoredMessage: data.message
    }))
  }, [dispatch, sessionUserId])

  // Handle message hidden (real-time - only affects current user)
  const onMessageHidden = useCallback((data: {
    message_id: string;
    channel_id: string;
    hidden_by: string;
  }) => {
    logger.debug('Message hidden:', data)
    
    // Only hide if the current user initiated the hide
    if (data.hidden_by === sessionUserId) {
      dispatch(hideMessageForSelf({
        channelId: data.channel_id,
        messageId: data.message_id
      }))
    }
  }, [dispatch, sessionUserId])

  // Handle message permanently deleted (real-time)
  const onMessagePermanentlyDeleted = useCallback((data: {
    message_id: string;
    channel_id: string;
    deleted_by: string;
  }) => {
    logger.debug('Message permanently deleted:', data)
    
    // Remove from trash if present
    dispatch(permanentlyDeleteMessage({ messageId: data.message_id }))
    
    // Also remove from active messages in case it wasn't in trash
    if (messages[data.channel_id]) {
      const messageExists = messages[data.channel_id].some(m => m.id === data.message_id)
      if (messageExists) {
        dispatch(hideMessageForSelf({
          channelId: data.channel_id,
          messageId: data.message_id
        }))
      }
    }
  }, [dispatch, messages])

  // ============================================
  // Initialization Effects
  // ============================================

  // Set current user ID in store
  useEffect(() => {
    if (sessionUserId && sessionUserId !== storeCurrentUserId) {
      dispatch(setCurrentUserId(sessionUserId))
    }
  }, [sessionUserId, storeCurrentUserId, dispatch])

  // Initialize presence tracking
  useEffect(() => {
    const initPresence = async () => {
      if (sessionUserId && sessionUserName && !presenceInitializedRef.current) {
        presenceInitializedRef.current = true
        try {
          await realtimeManager.initializePresence(
            sessionUserId,
            sessionUserName,
            sessionUserAvatar
          )
          logger.debug('Presence initialized for:', sessionUserId)
        } catch (error) {
          logger.error('Failed to initialize presence:', error)
          presenceInitializedRef.current = false
        }
      }
    }
    
    initPresence()
    
    // Cleanup on unmount
    return () => {
      // Don't cleanup presence on component unmount, keep user online
    }
  }, [sessionUserId, sessionUserName, sessionUserAvatar, realtimeManager])

  // Fetch all users
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
          logger.error('Failed to fetch users:', error)
        } finally {
          setUsersLoading(false)
        }
      }
    }
    
    fetchAllUsers()
  }, [sessionUserId])

  // Fetch channels on mount - but only if not already initialized globally
  useEffect(() => {
    logger.debug('Channels fetch useEffect running, hasFetchedChannels:', hasFetchedChannelsRef.current, 'sessionUserId:', sessionUserId, 'loading:', loading)
    if (sessionUserId && !globalFetchedChannels.get(sessionUserId) && !loading) {
      globalFetchedChannels.set(sessionUserId, true)
      hasFetchedChannelsRef.current = true
      channelsFetchedRef.current = true
      logger.debug('Fetching channels')
      fetchChannels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]) // Only depend on sessionUserId

  // Subscribe to active channel
  useEffect(() => {
    const subscribe = async () => {
      if (activeChannelId) {
        logger.debug('Subscribing to channel:', activeChannelId)
        try {
          await realtimeManager.subscribeToChannel(activeChannelId)
          fetchMessages({ channel_id: activeChannelId })
        } catch (error) {
          logger.error('Failed to subscribe to channel:', error)
        }
      }
    }
    subscribe()

    return () => {
      if (activeChannelId) {
        logger.debug('Unsubscribing from channel:', activeChannelId)
        // Send typing stop if user was typing
        if (sessionUserId) {
          realtimeManager.sendTypingStop(activeChannelId, sessionUserId)
        }
        realtimeManager.unsubscribeFromChannel(activeChannelId)
        dispatch(clearTypingForChannel(activeChannelId))
      }
    }
  }, [activeChannelId, realtimeManager, sessionUserId, dispatch])

  // Update handlers when they change
  useEffect(() => {
    const handlers: RealtimeEventHandlers = {
      onNewMessage,
      onMessageUpdate,
      onMessageDelete,
      onMessageRead,
      onMessageDelivered,
      onUserJoined,
      onUserLeft,
      onUserOnline,
      onUserOffline,
      onTypingStart,
      onTypingStop,
      onPresenceSync,
      onMentionNotification,
      onReactionAdd,
      onReactionRemove,
      onChannelUpdate
    }
    realtimeManager.updateHandlers(handlers)
  }, [realtimeManager, onNewMessage, onMessageUpdate, onMessageDelete, onMessageRead, onMessageDelivered, onUserJoined, onUserLeft, onUserOnline, onUserOffline, onTypingStart, onTypingStop, onPresenceSync, onMentionNotification, onReactionAdd, onReactionRemove, onChannelUpdate])

  // Subscribe to notifications when user is logged in
  useEffect(() => {
    if (sessionUserId) {
      realtimeManager.subscribeToNotifications(sessionUserId).catch(err => {
        logger.error('Failed to subscribe to notifications:', err)
      })
    }
    
    return () => {
      realtimeManager.unsubscribeFromNotifications()
    }
  }, [sessionUserId, realtimeManager])

  // Channel operations
  const fetchChannels = useCallback(async (
    params: { type?: string; department_id?: string; project_id?: string; forceRefresh?: boolean } = {}
  ) => {
    logger.debug('fetchChannels called with params:', params)
    
    // Check cache first (only for unfiltered requests)
    const isUnfiltered = !params.type && !params.department_id && !params.project_id
    if (isUnfiltered && !params.forceRefresh) {
      const cachedChannels = communicationCache.getChannels()
      if (cachedChannels) {
        logger.debug('Using cached channels:', cachedChannels.length)
        dispatch(setChannels(cachedChannels))
        return cachedChannels
      }
    }
    
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
      logger.debug('Channels loaded:', response?.length || 0)
      
      // Cache the response (only for unfiltered requests)
      if (isUnfiltered) {
        communicationCache.setChannels(response)
      }
      
      dispatch(setChannels(response))
      return response  
    } catch (error) {
      dispatch(setError('Failed to fetch channels'))
      dispatch(setChannelsInitialized(true)) // Prevent infinite retries
      toastRef.current({
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
      const MESSAGE_LIMIT = params.limit || 50
      const queryParams = new URLSearchParams({
        channel_id: params.channel_id,
        limit: MESSAGE_LIMIT.toString(),
        offset: '0'
      })
      
      const response = await apiRequest(`/api/communication/messages?${queryParams.toString()}`)
      dispatch(setMessages({ channelId: params.channel_id, messages: response.data || response }))

      logger.debug('Fetched messages:', response.data?.length || response?.length || 0)
      return response
    } catch (error) {
      dispatch(setError('Failed to fetch messages'))
      toastRef.current({
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

  // Fetch older messages (pagination - prepend to existing)
  const fetchOlderMessages = useCallback(async (params: FetchMessagesParams & { offset: number }) => {
    try {
      const OLDER_MESSAGE_LIMIT = params.limit || 30
      const queryParams = new URLSearchParams({
        channel_id: params.channel_id,
        limit: OLDER_MESSAGE_LIMIT.toString(),
        offset: params.offset.toString()
      })
      
      const response = await apiRequest(`/api/communication/messages?${queryParams.toString()}`)
      const olderMessages = response.data || response
      
      return {
        messages: olderMessages,
        hasMore: olderMessages.length === OLDER_MESSAGE_LIMIT
      }
    } catch (error) {
      logger.error('Failed to fetch older messages:', error)
      return { messages: [], hasMore: false }
    }
  }, [])

  // Search messages in a channel
  const searchMessages = useCallback(async (channelId: string, query: string, limit = 20, offset = 0) => {
    try {
      const queryParams = new URLSearchParams({
        channel_id: channelId,
        query,
        limit: limit.toString(),
        offset: offset.toString()
      })
      
      const response = await apiRequest(`/api/communication/messages/search?${queryParams.toString()}`)
      
      return {
        messages: response.data || [],
        total: response.meta?.total || 0,
        hasMore: response.meta?.hasMore || false
      }
    } catch (error) {
      logger.error('Failed to search messages:', error)
      return { messages: [], total: 0, hasMore: false }
    }
  }, [])

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
        logger.error('Invalid response from API:', response)
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

      toastRef.current({
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
      toastRef.current({
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

  // Send message with file attachments
  const sendMessageWithFiles = useCallback(async (
    messageData: CreateMessageData,
    files: File[],
    onProgress?: (progress: number) => void
  ) => {
    const tempId = crypto.randomUUID()
    try {
      dispatch(setActionLoading(true))

      // Get sender info from session for optimistic update
      const senderName = sessionUser?.name || sessionUser?.email || 'Unknown User'
      const senderEmail = sessionUser?.email || ''
      const senderAvatar = sessionUser?.image || sessionUser?.avatar || ''
      const senderRole = sessionUser?.role || 'User'

      // Create optimistic message with placeholder attachments
      const optimisticAttachments = files.map((file, index) => ({
        id: `temp_${index}`,
        message_id: tempId,
        file_name: file.name,
        file_url: URL.createObjectURL(file),
        file_size: file.size,
        file_type: file.type,
        created_at: new Date().toISOString(),
        isUploading: true
      }))

      const optimisticMessage = {
        id: tempId,
        channel_id: messageData.channel_id,
        mongo_sender_id: sessionUserId!,
        content: messageData.content,
        content_type: files.length > 0 ? 'file' : (messageData.content_type || 'text'),
        thread_id: messageData.thread_id,
        parent_message_id: messageData.parent_message_id,
        mongo_mentioned_user_ids: messageData.mongo_mentioned_user_ids || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        read_receipts: [],
        reactions: [],
        attachments: optimisticAttachments,
        reply_count: 0,
        is_edited: false,
        isOptimistic: true,
        sender_name: senderName,
        sender_email: senderEmail,
        sender_avatar: senderAvatar,
        sender_role: senderRole,
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

      // Build form data
      const formData = new FormData()
      formData.append('channel_id', messageData.channel_id)
      formData.append('content', messageData.content || '')
      formData.append('content_type', messageData.content_type || 'text')
      if (messageData.thread_id) {
        formData.append('thread_id', messageData.thread_id)
      }
      if (messageData.parent_message_id) {
        formData.append('parent_message_id', messageData.parent_message_id)
      }
      if (messageData.mongo_mentioned_user_ids?.length) {
        formData.append('mongo_mentioned_user_ids', JSON.stringify(messageData.mongo_mentioned_user_ids))
      }
      files.forEach(file => {
        formData.append('files', file)
      })

      // Upload via XHR for progress tracking
      const response = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress?.(progress)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText)
            if (response.success) {
              resolve(response.data)
            } else {
              reject(new Error(response.error || 'Upload failed'))
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.open('POST', '/api/communication/messages/with-files')
        xhr.send(formData)
      })

      // Update optimistic message with real data
      if (response?.id) {
        // Clean up object URLs
        optimisticAttachments.forEach(att => {
          if (att.file_url?.startsWith('blob:')) {
            URL.revokeObjectURL(att.file_url)
          }
        })

        dispatch(updateMessage({
          channelId: messageData.channel_id,
          messageId: tempId,
          updates: { ...response, isOptimistic: false }
        }))
      }

      toastRef.current({
        title: files.length > 0 ? "Files sent" : "Message sent",
        description: files.length > 0 
          ? `${files.length} file(s) uploaded successfully`
          : "Your message has been sent successfully",
      })

      return response
    } catch (error) {
      // Mark optimistic message as failed
      dispatch(updateMessage({
        channelId: messageData.channel_id,
        messageId: tempId,
        updates: { isFailed: true }
      }))

      dispatch(setError('Failed to send message with files'))
      toastRef.current({
        title: "Error",
        description: "Failed to send message with files",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId, sessionUser])

  // Update an existing message (for editing)
  const editMessage = useCallback(async (messageId: string, updates: { content?: string }) => {
    try {
      dispatch(setActionLoading(true))

      // Find the message to get channel_id
      let channelId = ''
      for (const [chId, msgs] of Object.entries(messages)) {
        const msg = msgs.find((m: ICommunication) => m.id === messageId)
        if (msg) {
          channelId = chId
          break
        }
      }

      if (!channelId) {
        throw new Error('Message not found')
      }

      // Optimistically update the message
      dispatch(updateMessage({
        channelId,
        messageId,
        updates: {
          ...updates,
          is_edited: true,
          edited_at: new Date().toISOString()
        }
      }))

      // Send to API
      const response = await apiRequest(`/api/communication/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      })

      if (response?.id) {
        dispatch(updateMessage({
          channelId,
          messageId,
          updates: response
        }))
      }

      toastRef.current({
        title: "Message updated",
        description: "Your message has been edited",
      })

      return response
    } catch (error) {
      dispatch(setError('Failed to update message'))
      toastRef.current({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, messages])

  const createChannel = useCallback(async (channelData: CreateChannelData) => {
    try {
      dispatch(setActionLoading(true))
      const response = await apiRequest('/api/communication/channels', {
        method: 'POST',
        body: JSON.stringify(channelData)
      })

      // Add the new channel to Redux state immediately (optimistic update)
      if (response?.id) {
        dispatch(addChannel(response as IChannel))
        // Also update cache
        communicationCache.addChannelToCache(response)
      }

      toastRef.current({
        title: "Channel created",
        description: "New conversation started successfully",
      })

      return response
    } catch (error) {
      dispatch(setError('Failed to create channel'))
      toastRef.current({
        title: "Error",
        description: "Failed to create channel",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]) // Removed fetchChannels - using optimistic update now

  const markAsRead = useCallback(async (messageId: string, channel_id: string) => {
    try {
      await apiRequest('/api/communication/read-receipts', {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId, channel_id })
      })
      
      // Broadcast read receipt to other users in the channel
      if (sessionUserId) {
        await realtimeManager.broadcastMessageRead(channel_id, messageId, sessionUserId)
      }
    } catch (error) {
      logger.error('Failed to mark message as read:', error)
    }
  }, [realtimeManager, sessionUserId])

  // ============================================
  // Reaction Operations
  // ============================================

  /**
   * Toggle a reaction on a message.
   * If the user already reacted with this emoji, it will be removed.
   * Otherwise, it will be added.
   */
  const toggleReaction = useCallback(async (messageId: string, channelId: string, emoji: string) => {
    if (!sessionUserId) return

    try {
      // Check if user already reacted with this emoji
      const channelMessages = messages[channelId] || []
      const message = channelMessages.find(m => m.id === messageId)
      const existingReaction = message?.reactions?.find(
        r => r.mongo_user_id === sessionUserId && r.emoji === emoji
      )

      if (existingReaction) {
        // Optimistically remove the reaction
        dispatch(removeReactionFromMessage({
          channelId,
          messageId,
          reactionId: existingReaction.id,
          mongo_user_id: sessionUserId,
          emoji
        }))
      } else {
        // Optimistically add the reaction
        const tempReactionId = crypto.randomUUID()
        dispatch(addReactionToMessage({
          channelId,
          messageId,
          reaction: {
            id: tempReactionId,
            mongo_user_id: sessionUserId,
            user_name: sessionUserName,
            emoji,
            created_at: new Date().toISOString()
          }
        }))
      }

      // Send to API (toggle behavior handled on server)
      // apiRequest returns the data directly on success, or throws on error
      const result = await apiRequest('/api/communication/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: messageId,
          channel_id: channelId,
          emoji
        })
      }, false) // Don't show error toast, we handle it ourselves

      logger.debug('Reaction toggled:', result)
    } catch (error: any) {
      logger.error('Failed to toggle reaction:', error)
      
      // Check if user already reacted with this emoji (for reverting)
      const channelMessages = messages[channelId] || []
      const message = channelMessages.find(m => m.id === messageId)
      const existingReaction = message?.reactions?.find(
        r => r.mongo_user_id === sessionUserId && r.emoji === emoji
      )
      
      // Revert optimistic update on error
      if (existingReaction) {
        // We had removed it, re-add it
        dispatch(addReactionToMessage({
          channelId,
          messageId,
          reaction: existingReaction
        }))
      } else {
        // We had added it, remove it
        dispatch(removeReactionFromMessage({
          channelId,
          messageId,
          mongo_user_id: sessionUserId,
          emoji
        }))
      }
      
      toastRef.current({
        title: "Error",
        description: error?.error || "Failed to add reaction",
        variant: "destructive"
      })
    }
  }, [dispatch, messages, sessionUserId, sessionUserName])

  // ============================================
  // Trash Operations (Phase 2: Message Lifecycle)
  // ============================================

  /**
   * Move a message to trash (soft delete with 30-day restoration window)
   * Only the message owner or admin can do this
   */
  const moveToTrash = useCallback(async (messageId: string, channelId: string, reason?: string) => {
    if (!sessionUserId) return { success: false, error: 'Not authenticated' }

    try {
      dispatch(setActionLoading(true))

      // Optimistically move to trash
      dispatch(moveMessageToTrash({
        channelId,
        messageId,
        trashedAt: new Date().toISOString(),
        trashedBy: sessionUserId,
        trashReason: reason
      }))

      // Send to API - use query params as expected by the API route
      const queryParams = new URLSearchParams({ deleteType: 'trash' })
      if (reason) queryParams.set('reason', reason)
      
      const response = await apiRequest(`/api/communication/messages/${messageId}?${queryParams.toString()}`, {
        method: 'DELETE'
      })

      toastRef.current({
        title: "Message moved to trash",
        description: "You can restore it within 30 days",
      })

      return { success: true, data: response }
    } catch (error: any) {
      logger.error('Failed to move message to trash:', error)
      
      // Revert optimistic update - refetch messages
      if (activeChannelId) {
        fetchMessages({ channel_id: activeChannelId })
      }

      toastRef.current({
        title: "Error",
        description: error?.error || "Failed to move message to trash",
        variant: "destructive"
      })

      return { success: false, error: error?.error || 'Failed to move to trash' }
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId, activeChannelId, fetchMessages])

  /**
   * Hide a message for the current user only (Delete for Me)
   * The message remains visible to other users
   */
  const hideForSelf = useCallback(async (messageId: string, channelId: string) => {
    if (!sessionUserId) return { success: false, error: 'Not authenticated' }

    try {
      dispatch(setActionLoading(true))

      // Optimistically hide the message
      dispatch(hideMessageForSelf({
        channelId,
        messageId
      }))

      // Send to API - use query params as expected by the API route
      await apiRequest(`/api/communication/messages/${messageId}?deleteType=self`, {
        method: 'DELETE'
      })

      toastRef.current({
        title: "Message hidden",
        description: "This message will no longer appear for you",
      })

      return { success: true }
    } catch (error: any) {
      logger.error('Failed to hide message:', error)
      
      // Revert optimistic update - refetch messages
      if (activeChannelId) {
        fetchMessages({ channel_id: activeChannelId })
      }

      toastRef.current({
        title: "Error",
        description: error?.error || "Failed to hide message",
        variant: "destructive"
      })

      return { success: false, error: error?.error || 'Failed to hide message' }
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId, activeChannelId, fetchMessages])

  /**
   * Restore a message from trash
   * Only available within 30 days of trashing
   */
  const restoreFromTrash = useCallback(async (messageId: string) => {
    if (!sessionUserId) return { success: false, error: 'Not authenticated' }

    try {
      dispatch(setActionLoading(true))

      // Send to API first to get the restored message
      // Note: apiRequest unwraps successful responses, so we get the data directly
      const restoredMessage = await apiRequest('/api/communication/messages/restore', {
        method: 'POST',
        body: JSON.stringify({ messageId })
      })

      if (restoredMessage && restoredMessage.id && restoredMessage.channel_id) {
        // Update Redux state with restored message
        dispatch(restoreMessageFromTrash({
          messageId,
          channelId: restoredMessage.channel_id,
          restoredMessage: restoredMessage
        }))

        toastRef.current({
          title: "Message restored",
          description: "The message has been restored successfully",
        })

        return { success: true, data: restoredMessage }
      }

      throw new Error('Invalid restore response')
    } catch (error: any) {
      logger.error('Failed to restore message:', error)

      toastRef.current({
        title: "Error",
        description: error?.error || error?.message || "Failed to restore message",
        variant: "destructive"
      })

      return { success: false, error: error?.error || 'Failed to restore message' }
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId])

  /**
   * Permanently delete a message (no recovery possible)
   * Only admins can do this
   */
  const permanentlyDelete = useCallback(async (messageId: string) => {
    if (!sessionUserId) return { success: false, error: 'Not authenticated' }

    try {
      dispatch(setActionLoading(true))

      // Optimistically remove from trash
      dispatch(permanentlyDeleteMessage({ messageId }))

      // Send to API - use query params as expected by the API route
      await apiRequest(`/api/communication/messages/${messageId}?deleteType=permanent`, {
        method: 'DELETE'
      })

      toastRef.current({
        title: "Message permanently deleted",
        description: "This action cannot be undone",
      })

      return { success: true }
    } catch (error: any) {
      logger.error('Failed to permanently delete message:', error)
      
      // Refetch trashed messages to restore state
      fetchTrashedMessages()

      toastRef.current({
        title: "Error",
        description: error?.error || "Failed to permanently delete message",
        variant: "destructive"
      })

      return { success: false, error: error?.error || 'Failed to delete permanently' }
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId])

  /**
   * Fetch trashed messages for the current user
   */
  const fetchTrashedMessages = useCallback(async (params?: { limit?: number; offset?: number }) => {
    if (!sessionUserId) return { success: false, error: 'Not authenticated' }

    try {
      dispatch(setTrashedMessagesLoading(true))

      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.offset) queryParams.append('offset', params.offset.toString())
      
      const queryString = queryParams.toString()
      const url = `/api/communication/messages/trash${queryString ? `?${queryString}` : ''}`

      // Note: apiRequest unwraps successful responses, so we may get data directly or full response
      const response = await apiRequest(url)

      // Handle both unwrapped array and full response object
      let messagesData: any[] = []
      let paginationData: any = null

      if (Array.isArray(response)) {
        // apiRequest unwrapped to just the data array
        messagesData = response
      } else if (response && typeof response === 'object') {
        // Full response object with success/data/pagination
        if (response.data && Array.isArray(response.data)) {
          messagesData = response.data
          paginationData = response.pagination
        } else if (response.success === false) {
          throw new Error(response.error || 'Failed to fetch trash')
        }
      }

      const trashedMessagesData: ITrashedMessage[] = messagesData.map((msg: any) => ({
        ...msg,
        trashed_at: msg.trashed_at,
        trashed_by: msg.trashed_by,
        trash_reason: msg.trash_reason,
        days_remaining: msg.days_remaining,
        expires_at: msg.expires_at,
        is_expiring_soon: msg.is_expiring_soon
      }))

      const defaultLimit = params?.limit || 20
      const calculatedPagination = {
        page: paginationData?.page || Math.floor((params?.offset || 0) / defaultLimit) + 1,
        limit: defaultLimit,
        total: paginationData?.total || trashedMessagesData.length,
        pages: paginationData?.totalPages || Math.ceil(trashedMessagesData.length / defaultLimit),
        hasMore: paginationData?.hasMore || trashedMessagesData.length === defaultLimit
      }

      if (params?.offset && params.offset > 0) {
        // Append for pagination
        dispatch(appendTrashedMessages({
          messages: trashedMessagesData,
          pagination: calculatedPagination
        }))
      } else {
        // Set fresh data
        dispatch(setTrashedMessages({
          messages: trashedMessagesData,
          pagination: calculatedPagination
        }))
      }

      return { success: true, data: trashedMessagesData }
    } catch (error: any) {
      logger.error('Failed to fetch trashed messages:', error)
      
      toastRef.current({
        title: "Error",
        description: "Failed to load trash",
        variant: "destructive"
      })

      return { success: false, error: error?.error || 'Failed to fetch trash' }
    } finally {
      dispatch(setTrashedMessagesLoading(false))
    }
  }, [dispatch, sessionUserId])

  /**
   * Clear all trashed messages from state
   */
  const clearTrash = useCallback(() => {
    dispatch(clearTrashedMessages())
  }, [dispatch])

  // ============================================
  // Optimized Typing Operations
  // ============================================
  
  /**
   * Send typing indicator - optimized with throttling.
   * Call this on every keystroke, the realtime manager handles debouncing.
   */
  const setUserTyping = useCallback(async (typingIndicator: ITypingIndicator) => {
    if (activeChannelId && sessionUserId) {
      // The realtime manager handles throttling internally
      await realtimeManager.sendTypingStart(
        activeChannelId, 
        sessionUserId,
        sessionUserName
      )
    }
  }, [activeChannelId, sessionUserId, sessionUserName, realtimeManager])

  /**
   * Stop typing indicator - call when user stops typing or sends message.
   */
  const removeUserTyping = useCallback(async (channelId: string, userId: string) => {
    await realtimeManager.sendTypingStop(channelId, userId)
  }, [realtimeManager])

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

  // ============================================
  // Channel Leave/Archive Operations (Phase 2)
  // ============================================

  /**
   * Leave a channel.
   * If user is the only admin, admin role is transferred to the oldest member.
   * If user is the last member, channel is archived.
   */
  const leaveChannel = useCallback(async (channelId: string) => {
    try {
      dispatch(setActionLoading(true))
      
      const result = await apiRequest(`/api/communication/channels/${channelId}/leave`, {
        method: 'POST'
      })

      // Remove channel from local state immediately (optimistic)
      dispatch(removeChannel(channelId))
      
      // Update cache
      communicationCache.removeChannelFromCache(channelId)

      // Handle different response formats
      const wasArchived = result?.archived || result?.action === 'archived'
      const message = result?.message || (wasArchived ? "Channel was archived (you were the last member)" : "You have left the channel")

      toastRef.current({
        title: wasArchived ? "Channel archived" : "Left channel",
        description: message,
      })

      // If we left the currently active channel, clear it
      if (activeChannelId === channelId) {
        dispatch(clearActiveChannel())
      }

      return { success: true, ...result }
    } catch (error: any) {
      // Extract error message from various error formats
      const errorMessage = error?.error || error?.message || 'Failed to leave channel'
      
      // Check for specific error cases
      if (errorMessage.includes('cannot leave') || errorMessage.includes('admin')) {
        toastRef.current({
          title: "Cannot leave channel",
          description: "You must transfer admin role before leaving",
          variant: "destructive"
        })
        return { success: false, needsAdminTransfer: true }
      }
      
      dispatch(setError(errorMessage))
      toastRef.current({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
      return { success: false, error: errorMessage }
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, activeChannelId])

  /**
   * Archive or unarchive a channel.
   * Only channel admins can archive/unarchive.
   */
  const archiveChannel = useCallback(async (
    channelId: string, 
    action: 'archive' | 'unarchive' = 'archive'
  ) => {
    try {
      dispatch(setActionLoading(true))
      
      const result = await apiRequest(`/api/communication/channels/${channelId}/archive`, {
        method: 'POST',
        body: JSON.stringify({ action })
      })

      // Optimistically update the channel in Redux state
      const archiveUpdates: Partial<IChannel> & { id: string } = {
        id: channelId,
        is_archived: action === 'archive'
      }
      if (action === 'archive') {
        archiveUpdates.archived_at = new Date().toISOString()
        archiveUpdates.archived_by = sessionUserId || undefined
      }
      dispatch(updateChannel(archiveUpdates))
      
      // Update cache
      communicationCache.updateChannelInCache(channelId, archiveUpdates)

      // Handle different response formats
      const message = result?.message || `Channel has been ${action === 'archive' ? 'archived' : 'unarchived'}`
      
      toastRef.current({
        title: action === 'archive' ? "Channel archived" : "Channel unarchived",
        description: message,
      })

      return { success: true, ...result }
    } catch (error: any) {
      // Extract error message from various error formats
      const errorMessage = error?.error || error?.message || `Failed to ${action} channel`
      
      // Check for specific error cases
      if (errorMessage.includes('already archived')) {
        toastRef.current({
          title: "Already archived",
          description: "This channel is already archived",
          variant: "default"
        })
        return { success: false, alreadyArchived: true }
      }
      
      if (errorMessage.includes('not archived')) {
        toastRef.current({
          title: "Not archived",
          description: "This channel is not archived",
          variant: "default"
        })
        return { success: false, notArchived: true }
      }
      
      dispatch(setError(errorMessage))
      toastRef.current({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
      return { success: false, error: errorMessage }
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId])

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
    
    // Online presence
    onlineUserIds,
    isUserOnline: (userId: string) => realtimeManager.isUserOnline(userId),
    getOnlineUsers: () => realtimeManager.getOnlineUsers(),

    // Channel operations
    fetchChannels,
    selectChannel,
    clearActiveChannel: clearChannel,

    // Message operations
    fetchMessages,
    fetchOlderMessages,
    searchMessages,
    prependMessagesToChannel: (channelId: string, newMessages: ICommunication[]) => {
      dispatch(prependMessages({ channelId, messages: newMessages }))
    },
    sendMessage,
    sendMessageWithFiles,
    updateMessage: editMessage,
    createChannel,
    markAsRead,

    // Channel leave/archive operations (Phase 2)
    leaveChannel,
    archiveChannel,

    // Reaction operations
    toggleReaction,

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
    refreshMessages,

    // Trash operations (Phase 2: Message Lifecycle)
    trashedMessages,
    trashedMessagesLoading,
    trashedMessagesPagination,
    moveToTrash,
    hideForSelf,
    restoreFromTrash,
    permanentlyDelete,
    fetchTrashedMessages,
    clearTrash
  }
}
