import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { 
  ICommunication, 
  IChannel, 
  IParticipant, 
  ITypingIndicator, 
  CommunicationFilters, 
  CommunicationSort,
  FetchMessagesParams,
  CreateMessageData,
  CreateChannelData,
  UpdateMessageData
} from '@/types/communication'

// Async Thunks (Real API implementations)
export const fetchChannels = createAsyncThunk(
  'communications/fetchChannels',
  async (params: { isInternal?: boolean } = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.isInternal !== undefined) {
        queryParams.append('isInternal', params.isInternal.toString())
      }

      const response = await fetch(`/api/communications/channels?${queryParams}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch channels')
      }

      return data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch channels')
    }
  }
)

export const fetchMessages = createAsyncThunk(
  'communications/fetchMessages',
  async (params: FetchMessagesParams, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('channelId', params.channelId)
      if (params.page) queryParams.append('page', params.page.toString())
      if (params.limit) queryParams.append('limit', params.limit.toString())

      const response = await fetch(`/api/communications/messages?${queryParams}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch messages')
      }

      return data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch messages')
    }
  }
)

export const createChannel = createAsyncThunk(
  'communications/createChannel',
  async (channelData: CreateChannelData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/communications/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(channelData),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create channel')
      }

      return data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create channel')
    }
  }
)

export const sendMessage = createAsyncThunk(
  'communications/sendMessage',
  async (messageData: CreateMessageData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/communications/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to send message')
      }

      return data
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to send message')
    }
  }
)

export const markMessageAsRead = createAsyncThunk(
  'communications/markMessageAsRead',
  async ({ messageId, channelId }: { messageId: string; channelId: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/communications/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to mark message as read')
      }

      return {
        success: true,
        data: { messageId, channelId, readAt: new Date().toISOString() }
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to mark message as read')
    }
  }
)

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
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'asc' },
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
      state.selectedChannel = state.channels.find(ch => ch.channelId === action.payload) || null
      
      // Mark channel messages as read
      if (state.messages[action.payload]) {
        state.messages[action.payload] = state.messages[action.payload].map(msg => ({
          ...msg,
          isRead: true,
          readAt: msg.readAt || new Date().toISOString() as any
        }))
      }
      
      // Update channel unread count
      const channelIndex = state.channels.findIndex(ch => ch.channelId === action.payload)
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
      
      state.messages[channelId].push(message)
      
      // Update channel's last message and unread count
      const channelIndex = state.channels.findIndex(ch => ch.channelId === channelId)
      if (channelIndex !== -1) {
        state.channels[channelIndex].lastMessage = message
        if (channelId !== state.activeChannelId && message.senderId !== state.currentUser?._id) {
          state.channels[channelIndex].unreadCount += 1
          state.unreadCount += 1
        }
      }
    },
    
    updateMessage: (state, action: PayloadAction<{ channelId: string; messageId: string; updates: Partial<ICommunication> }>) => {
      const { channelId, messageId, updates } = action.payload
      
      if (state.messages[channelId]) {
        const messageIndex = state.messages[channelId].findIndex(msg => msg._id === messageId)
        if (messageIndex !== -1) {
          state.messages[channelId][messageIndex] = {
            ...state.messages[channelId][messageIndex],
            ...updates,
            updatedAt: new Date().toISOString() as any
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
        participants: channel.participants.map(participant => ({
          ...participant,
          isOnline: action.payload.some(user => user._id === participant._id && user.isOnline)
        }))
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
        timestamp: new Date().toISOString() as any
      })
    },
    
    clearNotifications: (state) => {
      state.notifications = []
    },
    
    // Reset state
    resetState: (state) => {
      Object.assign(state, initialState)
    }
  },
  
  extraReducers: (builder) => {
    // Fetch Channels
    builder.addCase(fetchChannels.pending, (state) => {
      state.loading = true
      state.error = null
    })
    
    builder.addCase(fetchChannels.fulfilled, (state, action) => {
      state.loading = false
      state.channels = action.payload.data
      state.pagination = action.payload.pagination
      
      // Initialize unreadCount for channels if not present
      state.channels.forEach(channel => {
        if (channel.unreadCount === undefined || channel.unreadCount === null) {
          channel.unreadCount = 0
        }
      })
      
      // Calculate total unread count
      state.unreadCount = state.channels.reduce((total, channel) => total + (channel.unreadCount || 0), 0)
    })
    
    builder.addCase(fetchChannels.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    })
    
    // Fetch Messages
    builder.addCase(fetchMessages.pending, (state) => {
      state.messagesLoading = true
      state.error = null
    })
    
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      state.messagesLoading = false
      
      console.log('fetchMessages.fulfilled - channelId:', action.meta.arg.channelId)
      console.log('fetchMessages.fulfilled - action.payload.data:', action.payload.data)
      console.log('fetchMessages.fulfilled - data length:', action.payload.data?.length)
      
      state.messages[action.meta.arg.channelId] = action.payload.data
      console.log('fetchMessages.fulfilled - state.messages after:', state.messages)
    })
    
    builder.addCase(fetchMessages.rejected, (state, action) => {
      state.messagesLoading = false
      state.error = action.payload as string
    })
    
    // Create Channel
    builder.addCase(createChannel.pending, (state) => {
      state.actionLoading = true
      state.error = null
    })
    
    builder.addCase(createChannel.fulfilled, (state, action) => {
      state.actionLoading = false
      
      const channel = action.payload.data
      state.channels.push(channel)
      
      // Set as active channel
      state.activeChannelId = channel.channelId
      state.selectedChannel = channel
    })
    
    builder.addCase(createChannel.rejected, (state, action) => {
      state.actionLoading = false
      state.error = action.payload as string
    })
    
    // Send Message
    builder.addCase(sendMessage.pending, (state) => {
      state.actionLoading = true
      state.error = null
    })
    
    builder.addCase(sendMessage.fulfilled, (state, action) => {
      state.actionLoading = false
      
      const message = action.payload.data
      const channelId = message.channelId
      
      if (!state.messages[channelId]) {
        state.messages[channelId] = []
      }
      
      state.messages[channelId].push(message)
      
      // Update channel's last message
      const channelIndex = state.channels.findIndex(ch => ch.channelId === channelId)
      if (channelIndex !== -1) {
        state.channels[channelIndex].lastMessage = message
      }
    })
    
    builder.addCase(sendMessage.rejected, (state, action) => {
      state.actionLoading = false
      state.error = action.payload as string
    })
    
    // Mark Message as Read
    builder.addCase(markMessageAsRead.fulfilled, (state, action) => {
      const { messageId, channelId, readAt } = action.payload.data
      
      if (state.messages[channelId]) {
        const messageIndex = state.messages[channelId].findIndex(msg => msg._id === messageId)
        if (messageIndex !== -1) {
          state.messages[channelId][messageIndex] = {
            ...state.messages[channelId][messageIndex],
            isRead: true,
            readAt
          }
        }
      }
    })
  }
})

export const {
  setActiveChannel,
  clearActiveChannel,
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
  clearError,
  setError,
  addNotification,
  clearNotifications,
  resetState
} = communicationSlice.actions

export default communicationSlice.reducer