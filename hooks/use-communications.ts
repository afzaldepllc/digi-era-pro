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
import { getRealtimeManager, RealtimeEventHandlers } from '@/lib/realtime-manager'

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
  const sessionUserName = useMemo(() => sessionUser?.name || sessionUser?.email || 'Unknown', [sessionUser])
  const sessionUserAvatar = useMemo(() => sessionUser?.image || sessionUser?.avatar, [sessionUser])

  // ============================================
  // Realtime Event Handlers
  // ============================================

  const onNewMessage = useCallback((message: any) => {
    console.log('📩 onNewMessage handler called with:', message)
    
    // Skip messages from self to avoid duplicates (optimistic updates handle this)
    if (message.mongo_sender_id === sessionUserId) {
      console.log('📩 Skipping message from self')
      return
    }
    
    if (message && typeof message === 'object' && message.mongo_sender_id) {
      console.log('📩 Received enriched message:', message)
      dispatch(addMessage({ channelId: message.channel_id, message }))
    } else {
      console.error('Invalid message received, skipping:', message)
    }
  }, [dispatch, sessionUserId])

  const onMessageUpdate = useCallback((message: any) => {
    console.log('📝 onMessageUpdate handler called')
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

  const onUserOnline = useCallback((userId: string) => {
    console.log('🟢 User online:', userId)
    dispatch(addOnlineUser(userId))
  }, [dispatch])

  const onUserOffline = useCallback((userId: string) => {
    console.log('🔴 User offline:', userId)
    dispatch(removeOnlineUser(userId))
  }, [dispatch])

  // Handle typing start with proper data structure
  const onTypingStart = useCallback((data: { userId: string; userName: string; channelId: string }) => {
    console.log('⌨️ Typing start:', data)
    dispatch(setTyping({
      channelId: data.channelId,
      userId: data.userId,
      userName: data.userName || 'Someone',
      timestamp: new Date().toISOString()
    }))
  }, [dispatch])

  // Handle typing stop
  const onTypingStop = useCallback((data: { userId: string; channelId: string }) => {
    console.log('⌨️ Typing stop:', data)
    dispatch(removeTyping({ channelId: data.channelId, userId: data.userId }))
  }, [dispatch])

  // Handle message read (real-time update from other users)
  const onMessageRead = useCallback((data: { 
    messageId: string; 
    userId: string; 
    channelId: string; 
    readAt: string 
  }) => {
    console.log('👁️ Message read:', data)
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
    console.log('📨 Message delivered:', data)
    dispatch(setMessageDelivered({
      channelId: data.channelId,
      messageId: data.messageId
    }))
  }, [dispatch])

  // Handle presence sync (initial load and updates)
  const onPresenceSync = useCallback((presenceState: Record<string, any[]>) => {
    console.log('🌐 Presence sync:', Object.keys(presenceState))
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
    console.log('📬 Mention notification received:', data)
    
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
    toast({
      title: `@${data.sender_name} mentioned you`,
      description: data.content_preview.slice(0, 60) + (data.content_preview.length > 60 ? '...' : ''),
    })
  }, [dispatch, toast])

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
    console.log('👍 Reaction added:', data)
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
    console.log('👎 Reaction removed:', data)
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
          console.log('✅ Presence initialized for:', sessionUserId)
        } catch (error) {
          console.error('❌ Failed to initialize presence:', error)
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
      onReactionRemove
    }
    realtimeManager.updateHandlers(handlers)
  }, [realtimeManager, onNewMessage, onMessageUpdate, onMessageDelete, onMessageRead, onMessageDelivered, onUserJoined, onUserLeft, onUserOnline, onUserOffline, onTypingStart, onTypingStop, onPresenceSync, onMentionNotification, onReactionAdd, onReactionRemove])

  // Subscribe to notifications when user is logged in
  useEffect(() => {
    if (sessionUserId) {
      realtimeManager.subscribeToNotifications(sessionUserId).catch(err => {
        console.error('Failed to subscribe to notifications:', err)
      })
    }
    
    return () => {
      realtimeManager.unsubscribeFromNotifications()
    }
  }, [sessionUserId, realtimeManager])

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
      // TODO: Change back to 50 after testing pagination
      const MESSAGE_LIMIT = 5 // params.limit || 50
      const queryParams = new URLSearchParams({
        channel_id: params.channel_id,
        limit: MESSAGE_LIMIT.toString(),
        offset: '0'
      })
      
      const response = await apiRequest(`/api/communication/messages?${queryParams.toString()}`)
      dispatch(setMessages({ channelId: params.channel_id, messages: response.data || response }))

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

  // Fetch older messages (pagination - prepend to existing)
  const fetchOlderMessages = useCallback(async (params: FetchMessagesParams & { offset: number }) => {
    try {
      // TODO: Change back to 30 after testing pagination
      const OLDER_MESSAGE_LIMIT = 5 // params.limit || 30
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
      console.error('Failed to fetch older messages:', error)
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
      console.error('Failed to search messages:', error)
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

      toast({
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
      toast({
        title: "Error",
        description: "Failed to send message with files",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, sessionUserId, sessionUser, toast])

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

      toast({
        title: "Message updated",
        description: "Your message has been edited",
      })

      return response
    } catch (error) {
      dispatch(setError('Failed to update message'))
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, messages, toast])

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
      
      // Broadcast read receipt to other users in the channel
      if (sessionUserId) {
        await realtimeManager.broadcastMessageRead(channel_id, messageId, sessionUserId)
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error)
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

      console.log('✅ Reaction toggled:', result)
    } catch (error: any) {
      console.error('Failed to toggle reaction:', error)
      
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
      
      toast({
        title: "Error",
        description: error?.error || "Failed to add reaction",
        variant: "destructive"
      })
    }
  }, [dispatch, messages, sessionUserId, sessionUserName, toast])

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
    refreshMessages
  }
}
