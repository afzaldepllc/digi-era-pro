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
  
  // Notifications
  unreadCount: number
  notifications: Array<{
    id: string
    channelId: string
    message: ICommunication
    timestamp: Date
  }>
}

const initialState: CommunicationState = {
  channels: [],
  activeChannelId: null,
  selectedChannel: null,
  messages: {},
  onlineUsers: [],
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
  unreadCount: 0,
  notifications: []
}

const communicationSlice = createSlice({
  name: "communications",
  initialState,
  reducers: {
    // Channel management
    setActiveChannel: (state, action: PayloadAction<string>) => {
      state.activeChannelId = action.payload
      state.selectedChannel = state.channels.find(ch => ch.id === action.payload) || null
      
      // Update channel unread count
      const channelIndex = state.channels.findIndex(ch => ch.id === action.payload)
      if (channelIndex !== -1) {
        state.channels[channelIndex].unreadCount = 0
      }
    },
    
    clearActiveChannel: (state) => {
      state.activeChannelId = null
      state.selectedChannel = null
    },
    
    // Message management
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
      
      // Update channel's last message and unread count
      const channelIndex = state.channels.findIndex(ch => ch.id === channelId)
      if (channelIndex !== -1) {
        state.channels[channelIndex].last_message = message
        if (channelId !== state.activeChannelId && message.mongo_sender_id !== state.currentUser?.mongo_member_id) {
          state.channels[channelIndex].unreadCount = (state.channels[channelIndex].unreadCount || 0) + 1
          state.unreadCount += 1
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
    
    // Real-time features
    setTyping: (state, action: PayloadAction<ITypingIndicator>) => {
      const typing = action.payload
      
      if (!state.typingUsers[typing.channelId]) {
        state.typingUsers[typing.channelId] = []
      }
      
      const existingIndex = state.typingUsers[typing.channelId].findIndex(t => t.userId === typing.userId)
      if (existingIndex !== -1) {
        state.typingUsers[typing.channelId][existingIndex] = typing
      } else {
        state.typingUsers[typing.channelId].push(typing)
      }
    },
    
    removeTyping: (state, action: PayloadAction<{ channelId: string; userId: string }>) => {
      const { channelId, userId } = action.payload
      
      if (state.typingUsers[channelId]) {
        state.typingUsers[channelId] = state.typingUsers[channelId].filter(t => t.userId !== userId)
      }
    },
    
    updateOnlineUsers: (state, action: PayloadAction<IParticipant[]>) => {
      state.onlineUsers = action.payload
      
      // Update participants online status in channels
      state.channels = state.channels.map(channel => ({
        ...channel,
        participants: channel.participants?.map(participant => ({
          ...participant,
          isOnline: action.payload.some(user => user.mongo_member_id === participant.mongo_member_id && user.isOnline)
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
    addNotification: (state, action: PayloadAction<{ channelId: string; message: ICommunication }>) => {
      state.notifications.push({
        id: Date.now().toString(),
        channelId: action.payload.channelId,
        message: action.payload.message,
        timestamp: new Date()
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
} = communicationSlice.actions

export default communicationSlice.reducer