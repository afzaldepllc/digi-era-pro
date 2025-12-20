import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { 
  ICommunication, 
  IChannel, 
  IParticipant, 
  ITypingIndicator, 
  CommunicationFilters, 
  CommunicationSort
} from '@/types/communication'

// State interface
interface CommunicationState {
  // Channel management
  channels: IChannel[]
  activeChannelId: string | null
  selectedChannel: IChannel | null
  
  // Message management
  messages: Record<string, ICommunication[]> // Keyed by channelId
  
  // Real-time features
  onlineUsers: IParticipant[]
  onlineUserIds: string[] // Quick lookup for online status (array for Redux serialization)
  typingUsers: Record<string, ITypingIndicator[]> // Keyed by channelId
  
  // UI State
  isChannelListExpanded: boolean
  isContextPanelVisible: boolean
  
  // Loading states
  loading: boolean
  actionLoading: boolean
  messagesLoading: boolean
  channelsInitialized: boolean // Prevents multiple components from fetching channels
  
  // Error handling
  error: string | null
  
  // Filters and pagination
  filters: CommunicationFilters
  sort: CommunicationSort
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  
  // Current user (from auth state)
  currentUser: IParticipant | null
  currentUserId: string | null
  
  // Notifications
  unreadCount: number
  notifications: Array<{
    id: string
    type: 'message' | 'mention'
    title?: string
    channelId: string
    message?: ICommunication
    messageId?: string
    preview?: string
    timestamp: Date
    read: boolean
  }>
}

const initialState: CommunicationState = {
  channels: [],
  activeChannelId: null,
  selectedChannel: null,
  messages: {},
  onlineUsers: [],
  onlineUserIds: [],
  typingUsers: {},
  isChannelListExpanded: true,
  isContextPanelVisible: false,
  loading: false,
  actionLoading: false,
  messagesLoading: false,
  channelsInitialized: false,
  error: null,
  filters: {},
  sort: { field: 'created_at', direction: 'asc' },
  pagination: { page: 1, limit: 50, total: 0, pages: 0 },
  currentUser: null,
  currentUserId: null,
  unreadCount: 0,
  notifications: []
}

const communicationSlice = createSlice({
  name: "communications",
  initialState,
  reducers: {
    // ============================================
    // Channel Management
    // ============================================
    
    setActiveChannel: (state, action: PayloadAction<string>) => {
      state.activeChannelId = action.payload
      state.selectedChannel = state.channels.find(ch => ch.id === action.payload) || null
      
      // Clear unread count for this channel when selected
      const channelIndex = state.channels.findIndex(ch => ch.id === action.payload)
      if (channelIndex !== -1 && state.channels[channelIndex].unreadCount) {
        state.unreadCount -= state.channels[channelIndex].unreadCount
        state.channels[channelIndex].unreadCount = 0
      }
      
      // Clear typing indicators for this channel
      state.typingUsers[action.payload] = []
    },
    
    clearActiveChannel: (state) => {
      state.activeChannelId = null
      state.selectedChannel = null
    },
    
    // ============================================
    // Message Management with Channel Ordering
    // ============================================
    
    addMessage: (state, action: PayloadAction<{ channelId: string; message: ICommunication }>) => {
      const { channelId, message } = action.payload
      
      if (!state.messages[channelId]) {
        state.messages[channelId] = []
      }
      
      // Check for duplicate - don't add if message already exists
      const messageExists = state.messages[channelId].some(m => m.id === message.id)
      if (messageExists) {
        console.log('Message already exists, skipping duplicate:', message.id)
        return
      }
      
      state.messages[channelId].push(message)
      
      // Update channel's last message and move to top
      const channelIndex = state.channels.findIndex(ch => ch.id === channelId)
      if (channelIndex !== -1) {
        const channel = state.channels[channelIndex]
        channel.last_message = message
        channel.last_message_at = message.created_at
        
        // Update unread count if not active channel and not from current user
        if (channelId !== state.activeChannelId && message.mongo_sender_id !== state.currentUserId) {
          channel.unreadCount = (channel.unreadCount || 0) + 1
          state.unreadCount += 1
        }
        
        // Move channel to top of list (most recent first)
        if (channelIndex > 0) {
          state.channels.splice(channelIndex, 1)
          state.channels.unshift(channel)
        }
        
        // Update selectedChannel if it's the same channel
        if (state.selectedChannel?.id === channelId) {
          state.selectedChannel = { ...channel }
        }
      }
    },
    
    updateMessage: (state, action: PayloadAction<{ channelId: string; messageId: string; updates: Partial<ICommunication> }>) => {
      const { channelId, messageId, updates } = action.payload
      
      if (state.messages[channelId]) {
        const messageIndex = state.messages[channelId].findIndex(msg => msg.id === messageId)
        if (messageIndex !== -1) {
          state.messages[channelId][messageIndex] = {
            ...state.messages[channelId][messageIndex],
            ...updates
          }
        }
      }
    },
    
    // Add a read receipt to a message (real-time update)
    addMessageReadReceipt: (state, action: PayloadAction<{ 
      channelId: string; 
      messageId: string; 
      userId: string;
      readAt: string;
    }>) => {
      const { channelId, messageId, userId, readAt } = action.payload
      
      if (state.messages[channelId]) {
        const messageIndex = state.messages[channelId].findIndex(msg => msg.id === messageId)
        if (messageIndex !== -1) {
          const message = state.messages[channelId][messageIndex]
          // Initialize read_receipts if not present
          if (!message.read_receipts) {
            message.read_receipts = []
          }
          // Check if receipt already exists for this user
          const existingReceipt = message.read_receipts.find(r => r.mongo_user_id === userId)
          if (!existingReceipt) {
            message.read_receipts.push({
              message_id: messageId,
              mongo_user_id: userId,
              read_at: readAt
            })
          }
        }
      }
    },
    
    // Mark message as delivered (when receiver comes online or receives message)
    setMessageDelivered: (state, action: PayloadAction<{ 
      channelId: string; 
      messageId: string;
    }>) => {
      const { channelId, messageId } = action.payload
      
      if (state.messages[channelId]) {
        const messageIndex = state.messages[channelId].findIndex(msg => msg.id === messageId)
        if (messageIndex !== -1) {
          // Remove optimistic flag - message has been confirmed delivered
          state.messages[channelId][messageIndex].isOptimistic = false
        }
      }
    },
    
    // ============================================
    // Typing Indicators (Optimized)
    // ============================================
    
    setTyping: (state, action: PayloadAction<ITypingIndicator>) => {
      const typing = action.payload
      
      if (!state.typingUsers[typing.channelId]) {
        state.typingUsers[typing.channelId] = []
      }
      
      // Don't add typing from current user
      if (typing.userId === state.currentUserId) {
        return
      }
      
      const existingIndex = state.typingUsers[typing.channelId].findIndex(t => t.userId === typing.userId)
      if (existingIndex !== -1) {
        // Update existing typing indicator timestamp
        state.typingUsers[typing.channelId][existingIndex] = typing
      } else {
        // Add new typing indicator
        state.typingUsers[typing.channelId].push(typing)
      }
    },
    
    removeTyping: (state, action: PayloadAction<{ channelId: string; userId: string }>) => {
      const { channelId, userId } = action.payload
      
      if (state.typingUsers[channelId]) {
        state.typingUsers[channelId] = state.typingUsers[channelId].filter(t => t.userId !== userId)
      }
    },
    
    clearTypingForChannel: (state, action: PayloadAction<string>) => {
      const channelId = action.payload
      state.typingUsers[channelId] = []
    },
    
    // ============================================
    // Online Presence (New)
    // ============================================
    
    setCurrentUserId: (state, action: PayloadAction<string>) => {
      state.currentUserId = action.payload
    },
    
    setOnlineUserIds: (state, action: PayloadAction<string[]>) => {
      // Use array directly instead of Set for Redux serialization
      state.onlineUserIds = [...action.payload]
      
      // Update channel_members online status in channels
      state.channels = state.channels.map(channel => ({
        ...channel,
        channel_members: channel.channel_members?.map(member => ({
          ...member,
          isOnline: action.payload.includes(member.mongo_member_id),
          is_online: action.payload.includes(member.mongo_member_id)
        })) || []
      }))
      
      // Update selectedChannel if exists
      if (state.selectedChannel) {
        state.selectedChannel = {
          ...state.selectedChannel,
          channel_members: state.selectedChannel.channel_members?.map(member => ({
            ...member,
            isOnline: action.payload.includes(member.mongo_member_id),
            is_online: action.payload.includes(member.mongo_member_id)
          })) || []
        }
      }
    },
    
    addOnlineUser: (state, action: PayloadAction<string>) => {
      const userId = action.payload
      // Add to array if not already present
      if (!state.onlineUserIds.includes(userId)) {
        state.onlineUserIds.push(userId)
      }
      
      // Update channel members
      state.channels = state.channels.map(channel => ({
        ...channel,
        channel_members: channel.channel_members?.map(member => ({
          ...member,
          isOnline: member.mongo_member_id === userId ? true : member.isOnline,
          is_online: member.mongo_member_id === userId ? true : member.is_online
        })) || []
      }))
      
      if (state.selectedChannel) {
        state.selectedChannel = {
          ...state.selectedChannel,
          channel_members: state.selectedChannel.channel_members?.map(member => ({
            ...member,
            isOnline: member.mongo_member_id === userId ? true : member.isOnline,
            is_online: member.mongo_member_id === userId ? true : member.is_online
          })) || []
        }
      }
    },
    
    removeOnlineUser: (state, action: PayloadAction<string>) => {
      const userId = action.payload
      // Remove from array
      state.onlineUserIds = state.onlineUserIds.filter(id => id !== userId)
      
      // Update channel members
      state.channels = state.channels.map(channel => ({
        ...channel,
        channel_members: channel.channel_members?.map(member => ({
          ...member,
          isOnline: member.mongo_member_id === userId ? false : member.isOnline,
          is_online: member.mongo_member_id === userId ? false : member.is_online
        })) || []
      }))
      
      if (state.selectedChannel) {
        state.selectedChannel = {
          ...state.selectedChannel,
          channel_members: state.selectedChannel.channel_members?.map(member => ({
            ...member,
            isOnline: member.mongo_member_id === userId ? false : member.isOnline,
            is_online: member.mongo_member_id === userId ? false : member.is_online
          })) || []
        }
      }
    },
    
    updateOnlineUsers: (state, action: PayloadAction<IParticipant[]>) => {
      state.onlineUsers = action.payload
      
      // Update channel_members online status in channels
      state.channels = state.channels.map(channel => ({
        ...channel,
        channel_members: channel.channel_members?.map(member => ({
          ...member,
          isOnline: action.payload.some(user => user.mongo_member_id === member.mongo_member_id && user.isOnline)
        })) || []
      }))
    },
    
    // UI State management
    toggleChannelList: (state) => {
      state.isChannelListExpanded = !state.isChannelListExpanded
    },
    
    toggleContextPanel: (state) => {
      state.isContextPanelVisible = !state.isContextPanelVisible
    },
    
    setChannelListExpanded: (state, action: PayloadAction<boolean>) => {
      state.isChannelListExpanded = action.payload
    },
    
    setContextPanelVisible: (state, action: PayloadAction<boolean>) => {
      state.isContextPanelVisible = action.payload
    },
    
    // Filters and search
    setFilters: (state, action: PayloadAction<Partial<CommunicationFilters>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1 // Reset to first page when filters change
    },
    
    setSort: (state, action: PayloadAction<CommunicationSort>) => {
      state.sort = action.payload
      state.pagination.page = 1 // Reset to first page when sort changes
    },
    
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      state.pagination = { ...state.pagination, ...action.payload }
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
    
    // Notifications
    addNotification: (state, action: PayloadAction<{ 
      id: string
      type: 'message' | 'mention'
      title?: string
      channelId: string
      message?: ICommunication
      messageId?: string
      preview?: string
      read?: boolean
    }>) => {
      state.notifications.push({
        id: action.payload.id,
        type: action.payload.type,
        title: action.payload.title,
        channelId: action.payload.channelId,
        message: action.payload.message,
        messageId: action.payload.messageId,
        preview: action.payload.preview,
        timestamp: new Date(),
        read: action.payload.read ?? false
      })
    },
    
    clearNotifications: (state) => {
      state.notifications = []
    },
    
    // Data setters for TanStack Query integration
    setChannels: (state, action: PayloadAction<IChannel[]>) => {
      // Only update if channels actually changed (prevent infinite loops)
      const newChannelIds = action.payload.map(c => c.id).sort().join(',')
      const currentChannelIds = state.channels.map(c => c.id).sort().join(',')
      
      if (newChannelIds === currentChannelIds) {
        // Channels are the same, skip update
        return
      }
      
      state.channels = action.payload
      state.channelsInitialized = true // Mark as initialized to prevent duplicate fetches
      // Initialize unreadCount for channels if not present
      state.channels.forEach(channel => {
        if (channel.unreadCount === undefined || channel.unreadCount === null) {
          channel.unreadCount = 0
        }
      })
      // Calculate total unread count
      state.unreadCount = state.channels.reduce((total, channel) => total + (channel.unreadCount || 0), 0)
    },
    
    setMessages: (state, action: PayloadAction<{ channelId: string; messages: ICommunication[] }>) => {
      const { channelId, messages } = action.payload
      state.messages[channelId] = messages
    },
    
    // Loading state setters
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    
    setActionLoading: (state, action: PayloadAction<boolean>) => {
      state.actionLoading = action.payload
    },
    
    setMessagesLoading: (state, action: PayloadAction<boolean>) => {
      state.messagesLoading = action.payload
    },
    
    // Reset state
    resetState: (state) => {
      Object.assign(state, initialState)
    },

    setChannelsInitialized: (state, action: PayloadAction<boolean>) => {
      state.channelsInitialized = action.payload
    }
  }
})

export const {
  setActiveChannel,
  clearActiveChannel,
  setChannels,
  setMessages,
  addMessage,
  updateMessage,
  addMessageReadReceipt,
  setMessageDelivered,
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
} = communicationSlice.actions

export default communicationSlice.reducer