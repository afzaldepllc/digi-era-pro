# Complete Real-Time Communication Planning
## use-communications.ts & realtime-manager.ts

**Version:** 1.0  
**Date:** December 2024  
**Project:** Digi Era Pro CRM - MongoDB + Supabase Real-Time System

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Security Model](#security-model)
3. [Real-Time Flow](#real-time-flow)
4. [Implementation Plan](#implementation-plan)
5. [Best Practices](#best-practices)
6. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### System Design
```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   MongoDB       │         │  Next.js API     │         │   Supabase      │
│   (Main DB)     │◄────────┤   Routes         │────────►│   (Real-Time)   │
│                 │         │                  │         │                 │
│ - Users         │         │ - Permissions    │         │ - Channels      │
│ - Departments   │         │ - Validation     │         │ - Messages      │
│ - Projects      │         │ - Enrichment     │         │ - Members       │
│ - Roles         │         │ - Rate Limiting  │         │ - Reactions     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                    │                              │
                                    │                              │
                            ┌───────▼──────────┐          ┌───────▼─────────┐
                            │  useCommunications│          │ RealtimeManager │
                            │  (React Hook)     │◄─────────┤   (Singleton)   │
                            └──────────────────┘          └─────────────────┘
                                    │                              │
                                    │                              │
                            ┌───────▼──────────────────────────────▼─────────┐
                            │         React Components (UI)                  │
                            │  - ChatWindow, MessageList, ChannelList        │
                            └────────────────────────────────────────────────┘
```

### Data Flow Principles

1. **MongoDB = Source of Truth for Users**
   - User profiles, departments, projects stored in MongoDB
   - Authentication via NextAuth with MongoDB

2. **Supabase = Real-Time Communication Only**
   - Messages, channels, reactions stored in Supabase
   - Only stores MongoDB user IDs (no user data duplication)
   - Real-time subscriptions via Supabase Realtime

3. **API Layer = Security & Enrichment**
   - All permissions checked via API (no RLS in Supabase)
   - Enriches Supabase data with MongoDB user info
   - Handles rate limiting and validation

---

## Security Model

### Core Principle: API-First Security
**NO Row Level Security (RLS) in Supabase** - All security handled in Next.js API routes

### Permission Flow
```typescript
// Every API endpoint follows this pattern
const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(
  request, 
  'communication', 
  'create' // or 'read', 'update', 'delete'
)

// Permission checks:
// 1. Is user authenticated?
// 2. Does user have 'communication' module permission?
// 3. Does user have 'create' action permission?
// 4. Custom business logic (e.g., is user member of channel?)
```

### Security Checklist

**Messages API (`/api/communication/messages`)**
- ✅ POST: User must be member of channel
- ✅ GET: User must be member of channel
- ✅ PUT: User must be sender OR admin
- ✅ DELETE: User must be sender OR admin

**Channels API (`/api/communication/channels`)**
- ✅ POST: Any authenticated user can create
- ✅ GET: Return only channels where user is member
- ✅ PUT: User must be admin/owner of channel
- ✅ DELETE: User must be owner OR super admin

**Members API (`/api/communication/members`)**
- ✅ POST: User must be admin of channel
- ✅ DELETE: User must be admin OR self-removal

### Rate Limiting
```typescript
// Implement rate limiting per user per endpoint
const rateLimits = {
  sendMessage: { limit: 60, window: 60000 }, // 60 msgs/min
  createChannel: { limit: 10, window: 60000 }, // 10 channels/min
  typing: { limit: 30, window: 10000 }, // 30 typing events/10s
}
```

---

## Real-Time Flow

### Message Send Flow (Optimistic Update Pattern)

```typescript
// STEP 1: Optimistic Update (Instant UI)
const tempMessage = {
  id: `temp_${Date.now()}`,
  content: "Hello!",
  sender_id: currentUserId,
  channel_id: activeChannelId,
  created_at: new Date().toISOString(),
  _pending: true, // Mark as pending
}

// Immediately add to local state
dispatch(addMessage({ channelId: activeChannelId, message: tempMessage }))

// STEP 2: API Call (Background)
try {
  const response = await fetch('/api/communication/messages', {
    method: 'POST',
    body: JSON.stringify({ content: "Hello!", channel_id: activeChannelId })
  })
  
  const savedMessage = await response.json()
  
  // STEP 3: Replace temp with real message
  dispatch(updateMessage({
    channelId: activeChannelId,
    messageId: tempMessage.id,
    updates: { ...savedMessage, _pending: false }
  }))
  
  // STEP 4: Broadcast to other users (NOT self)
  await realtimeManager.broadcastMessage(activeChannelId, savedMessage)
  
} catch (error) {
  // STEP 5: Mark as failed if error
  dispatch(updateMessage({
    channelId: activeChannelId,
    messageId: tempMessage.id,
    updates: { _error: true, _pending: false }
  }))
}
```

### Message Receive Flow (Real-Time)

```typescript
// STEP 1: Supabase broadcasts message
realtimeChannel.on('broadcast', { event: 'new_message' }, (payload) => {
  const message = payload.payload
  
  // STEP 2: Filter out own messages (already in state via optimistic update)
  if (message.mongo_sender_id === currentUserId) {
    console.log('Skipping own message')
    return
  }
  
  // STEP 3: Enrich with user data from MongoDB
  const enrichedMessage = enrichMessageWithUserData(message, allUsers)
  
  // STEP 4: Add to local state
  dispatch(addMessage({ channelId: message.channel_id, message: enrichedMessage }))
  
  // STEP 5: Show notification if needed
  if (message.channel_id !== activeChannelId) {
    showNotification(`New message from ${enrichedMessage.sender?.name}`)
  }
})
```

### Key Design Decisions

1. **Sender sees message instantly** via optimistic update
2. **No GET request after POST** - reduces latency
3. **Broadcast only to others** - sender already has message
4. **Skip self-broadcasts** - prevents duplicates
5. **Background API work** - doesn't block UI

---

## Implementation Plan

### Phase 1: Realtime Manager (`lib/realtime-manager.ts`)

#### 1.1 Core Structure
```typescript
export class RealtimeManager {
  private rtChannels: Map<string, RealtimeChannel> = new Map()
  private eventHandlers: RealtimeEventHandlers = {}
  private subscriptionPromises: Map<string, Promise<void>> = new Map()
  
  constructor(handlers: RealtimeEventHandlers = {}) {
    this.eventHandlers = handlers
  }
}
```

#### 1.2 Subscription Management
```typescript
async subscribeToChannel(channelId: string): Promise<void> {
  // Prevent duplicate subscriptions
  if (this.subscriptionPromises.has(channelId)) {
    return this.subscriptionPromises.get(channelId)
  }
  
  // Check if already subscribed
  if (this.rtChannels.has(channelId)) {
    const channel = this.rtChannels.get(channelId)
    if (channel.state === 'joined') {
      return Promise.resolve()
    }
  }
  
  const promise = this._subscribeInternal(channelId)
  this.subscriptionPromises.set(channelId, promise)
  
  try {
    await promise
  } finally {
    this.subscriptionPromises.delete(channelId)
  }
}

private async _subscribeInternal(channelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rtChannel = supabase.channel(`rt_${channelId}`, {
      config: { presence: { key: channelId }, broadcast: { self: false } } // Added self: false
    })
    
    // Register all event listeners
    rtChannel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        this.eventHandlers.onNewMessage?.(payload.payload)
      })
      .on('broadcast', { event: 'message_updated' }, (payload) => {
        this.eventHandlers.onMessageUpdate?.(payload.payload)
      })
      .on('broadcast', { event: 'message_deleted' }, (payload) => {
        this.eventHandlers.onMessageDelete?.(payload.payload.messageId)
      })
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        this.eventHandlers.onTypingStart?.(payload.payload.userId)
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        this.eventHandlers.onTypingStop?.(payload.payload.userId)
      })
      .on('broadcast', { event: 'reaction_add' }, (payload) => {
        this.eventHandlers.onReactionAdd?.(payload.payload)
      })
      .on('broadcast', { event: 'reaction_remove' }, (payload) => {
        this.eventHandlers.onReactionRemove?.(payload.payload.reactionId)
      })
      .on('presence', { event: 'join' }, (payload) => {
        this.eventHandlers.onUserOnline?.(payload.newPresences[0]?.userId)
      })
      .on('presence', { event: 'leave' }, (payload) => {
        this.eventHandlers.onUserOffline?.(payload.leftPresences[0]?.userId)
      })
    
    // Subscribe with timeout
    const timeout = setTimeout(() => {
      reject(new Error(`Subscription timeout for channel ${channelId}`))
    }, 10000)
    
    rtChannel.subscribe((status, err) => {
      if (err) {
        clearTimeout(timeout)
        reject(err)
        return
      }
      
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout)
        this.rtChannels.set(channelId, rtChannel)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout)
        reject(new Error(`Subscription failed: ${status}`))
      }
    })
  })
}
```

#### 1.3 Broadcasting Methods
```typescript
async broadcastMessage(channelId: string, message: any): Promise<void> {
  await this._ensureSubscribed(channelId)
  const rtChannel = this.rtChannels.get(channelId)
  
  if (rtChannel) {
    await rtChannel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    })
  }
}

async broadcastTyping(channelId: string, userId: string, isTyping: boolean): Promise<void> {
  await this._ensureSubscribed(channelId)
  const rtChannel = this.rtChannels.get(channelId)
  
  if (rtChannel) {
    await rtChannel.send({
      type: 'broadcast',
      event: isTyping ? 'typing_start' : 'typing_stop',
      payload: { userId, timestamp: Date.now() }
    })
  }
}

private async _ensureSubscribed(channelId: string): Promise<void> {
  if (!this.rtChannels.has(channelId)) {
    await this.subscribeToChannel(channelId)
  }
}
```

#### 1.4 Cleanup & Error Handling
```typescript
unsubscribeFromChannel(channelId: string): void {
  const rtChannel = this.rtChannels.get(channelId)
  if (rtChannel) {
    supabase.removeChannel(rtChannel)
    this.rtChannels.delete(channelId)
  }
}

cleanup(): void {
  for (const [_, rtChannel] of this.rtChannels) {
    supabase.removeChannel(rtChannel)
  }
  this.rtChannels.clear()
  this.subscriptionPromises.clear()
}

updateHandlers(handlers: Partial<RealtimeEventHandlers>): void {
  this.eventHandlers = { ...this.eventHandlers, ...handlers }
}
```

#### 1.5 Singleton Pattern
```typescript
let realtimeManagerInstance: RealtimeManager | null = null

export const getRealtimeManager = (handlers?: RealtimeEventHandlers): RealtimeManager => {
  if (!realtimeManagerInstance) {
    realtimeManagerInstance = new RealtimeManager(handlers)
  } else if (handlers) {
    realtimeManagerInstance.updateHandlers(handlers)
  }
  return realtimeManagerInstance
}

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManagerInstance?.cleanup()
  })
}
```

---

### Phase 2: Communications Hook (`hooks/use-communications.ts`)

#### 2.1 Hook Structure
```typescript
export function useCommunications() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const { data: session } = useSession()
  
  // Get realtime manager singleton
  const realtimeManager = useMemo(() => getRealtimeManager(), [])
  
  // Refs to prevent duplicate initialization
  const hasInitialized = useRef(false)
  const subscriptionRef = useRef<string | null>(null)
  
  // State
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  
  // Redux state
  const {
    channels,
    activeChannelId,
    messages,
    loading,
    // ... other state
  } = useAppSelector((state) => state.communications)
  
  const sessionUserId = useMemo(() => 
    (session?.user as any)?.id, 
    [session?.user]
  )
  
  // ... rest of implementation
}
```

#### 2.2 User Data Management
```typescript
// Fetch all users once on mount
useEffect(() => {
  const fetchUsers = async () => {
    if (!sessionUserId || allUsers.length > 0 || usersLoading) return
    
    try {
      setUsersLoading(true)
      const response = await apiRequest('/api/users')
      setAllUsers(response.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      })
    } finally {
      setUsersLoading(false)
    }
  }
  
  fetchUsers()
}, [sessionUserId]) // Only run once when user logs in
```

#### 2.3 Real-Time Event Handlers
```typescript
// Memoize handlers to prevent unnecessary re-subscriptions
const onNewMessage = useCallback((message: any) => {
  // Skip self messages (already added via optimistic update)
  if (message.mongo_sender_id === sessionUserId) {
    return
  }
  
  // Enrich with user data
  const enrichedMessage = enrichMessageWithUserData(message, allUsers)
  
  // Add to state
  dispatch(addMessage({ 
    channelId: message.channel_id, 
    message: enrichedMessage 
  }))
  
  // Show notification if not in active channel
  if (message.channel_id !== activeChannelId) {
    dispatch(addNotification({
      id: message.id,
      type: 'message',
      title: `${enrichedMessage.sender?.name || 'Someone'}`,
      message: enrichedMessage.content,
      channelId: message.channel_id,
      timestamp: message.created_at
    }))
  }
}, [dispatch, allUsers, sessionUserId, activeChannelId])

const onMessageUpdate = useCallback((message: any) => {
  const enrichedMessage = enrichMessageWithUserData(message, allUsers)
  dispatch(updateMessage({
    channelId: message.channel_id,
    messageId: message.id,
    updates: enrichedMessage
  }))
}, [dispatch, allUsers])

const onMessageDelete = useCallback((messageId: string) => {
  // Remove from state
  dispatch(deleteMessage({ messageId }))
}, [dispatch])

const onTypingStart = useCallback((userId: string) => {
  if (userId === sessionUserId) return
  
  const user = allUsers.find(u => u._id === userId)
  dispatch(setTyping({
    channelId: activeChannelId || '',
    userId,
    userName: user?.name || 'Someone',
    timestamp: new Date().toISOString()
  }))
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    dispatch(removeTyping({ channelId: activeChannelId || '', userId }))
  }, 5000)
}, [dispatch, activeChannelId, allUsers, sessionUserId])

const onTypingStop = useCallback((userId: string) => {
  dispatch(removeTyping({ 
    channelId: activeChannelId || '', 
    userId 
  }))
}, [dispatch, activeChannelId])

const onUserOnline = useCallback((userId: string) => {
  dispatch(updateUserOnlineStatus({ userId, isOnline: true }))
}, [dispatch])

const onUserOffline = useCallback((userId: string) => {
  dispatch(updateUserOnlineStatus({ userId, isOnline: false }))
}, [dispatch])
```

#### 2.4 Channel Subscription
```typescript
// Subscribe to active channel
useEffect(() => {
  const subscribe = async () => {
    if (!activeChannelId || subscriptionRef.current === activeChannelId) {
      return
    }
    
    try {
      // Unsubscribe from previous channel
      if (subscriptionRef.current) {
        realtimeManager.unsubscribeFromChannel(subscriptionRef.current)
      }
      
      // Subscribe to new channel
      await realtimeManager.subscribeToChannel(activeChannelId)
      subscriptionRef.current = activeChannelId
      
      // Fetch messages for this channel
      await fetchMessages({ channel_id: activeChannelId })
      
    } catch (error) {
      console.error('Failed to subscribe to channel:', error)
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to channel',
        variant: 'destructive'
      })
    }
  }
  
  subscribe()
  
  // Cleanup on unmount or channel change
  return () => {
    if (subscriptionRef.current) {
      realtimeManager.unsubscribeFromChannel(subscriptionRef.current)
      subscriptionRef.current = null
    }
  }
}, [activeChannelId, realtimeManager, fetchMessages, toast])
```

#### 2.5 Update Handlers When Dependencies Change
```typescript
// Update realtime handlers when they change
useEffect(() => {
  realtimeManager.updateHandlers({
    onNewMessage,
    onMessageUpdate,
    onMessageDelete,
    onTypingStart,
    onTypingStop,
    onUserOnline,
    onUserOffline,
  })
}, [
  realtimeManager,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
  onTypingStart,
  onTypingStop,
  onUserOnline,
  onUserOffline,
])
```

#### 2.6 Send Message (Optimistic Update)
```typescript
const sendMessage = useCallback(async (messageData: CreateMessageData) => {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Create optimistic message
  const optimisticMessage = {
    id: tempId,
    channel_id: messageData.channel_id,
    mongo_sender_id: sessionUserId!,
    content: messageData.content,
    content_type: messageData.content_type || 'text',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_edited: false,
    mongo_mentioned_user_ids: messageData.mongo_mentioned_user_ids || [],
    attachments: messageData.attachments || [],
    reactions: [],
    _pending: true, // Mark as pending
  }
  
  // Enrich with current user data
  const enriched = enrichMessageWithUserData(optimisticMessage, allUsers)
  
  // Add to state immediately (optimistic update)
  dispatch(addMessage({ 
    channelId: messageData.channel_id, 
    message: enriched 
  }))
  
  try {
    // Send to API (background)
    const response = await apiRequest('/api/communication/messages', {
      method: 'POST',
      body: JSON.stringify(messageData)
    })
    
    // Replace temp message with real one
    const realMessage = enrichMessageWithUserData(response.data, allUsers)
    dispatch(updateMessage({
      channelId: messageData.channel_id,
      messageId: tempId,
      updates: { ...realMessage, _pending: false }
    }))
    
    // Broadcast to other users (background, don't await)
    realtimeManager.broadcastMessage(messageData.channel_id, response.data)
      .catch(err => console.error('Broadcast failed:', err))
    
    return response.data
    
  } catch (error) {
    // Mark as failed
    dispatch(updateMessage({
      channelId: messageData.channel_id,
      messageId: tempId,
      updates: { _error: true, _pending: false }
    }))
    
    toast({
      title: 'Failed to send',
      description: 'Message could not be sent',
      variant: 'destructive'
    })
    
    throw error
  }
}, [dispatch, allUsers, sessionUserId, realtimeManager, toast])
```

#### 2.7 Typing Indicators (Debounced)
```typescript
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

const handleTyping = useCallback(() => {
  if (!activeChannelId || !sessionUserId) return
  
  // Only send if not already typing
  const isAlreadyTyping = typingTimeoutRef.current !== null
  
  if (!isAlreadyTyping) {
    realtimeManager.broadcastTyping(activeChannelId, sessionUserId, true)
  }
  
  // Clear previous timeout
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current)
  }
  
  // Auto-stop after 3 seconds of no typing
  typingTimeoutRef.current = setTimeout(() => {
    realtimeManager.broadcastTyping(activeChannelId, sessionUserId, false)
    typingTimeoutRef.current = null
  }, 3000)
}, [activeChannelId, sessionUserId, realtimeManager])

// Call this on input onChange
// <input onChange={handleTyping} />
```

#### 2.8 Fetch Operations
```typescript
const fetchChannels = useCallback(async (params = {}) => {
  try {
    dispatch(setLoading(true))
    
    const queryParams = new URLSearchParams(params)
    const response = await apiRequest(
      `/api/communication/channels?${queryParams.toString()}`
    )
    
    dispatch(setChannels(response))
    return response
    
  } catch (error) {
    dispatch(setError('Failed to fetch channels'))
    toast({
      title: 'Error',
      description: 'Could not load channels',
      variant: 'destructive'
    })
    return []
  } finally {
    dispatch(setLoading(false))
  }
}, [dispatch, toast])

const fetchMessages = useCallback(async (params: FetchMessagesParams) => {
  try {
    dispatch(setMessagesLoading(true))
    
    const queryParams = new URLSearchParams({
      channel_id: params.channel_id,
      limit: String(params.limit || 50),
      offset: String(params.offset || 0)
    })
    
    const response = await apiRequest(
      `/api/communication/messages?${queryParams.toString()}`
    )
    
    // Enrich all messages
    const enriched = response.map((msg: any) => 
      enrichMessageWithUserData(msg, allUsers)
    )
    
    dispatch(setMessages({ 
      channelId: params.channel_id, 
      messages: enriched 
    }))
    
    return enriched
    
  } catch (error) {
    dispatch(setError('Failed to fetch messages'))
    toast({
      title: 'Error',
      description: 'Could not load messages',
      variant: 'destructive'
    })
    return []
  } finally {
    dispatch(setMessagesLoading(false))
  }
}, [dispatch, allUsers, toast])
```

#### 2.9 Return Values
```typescript
return {
  // State
  channels,
  activeChannelId,
  messages,
  loading,
  messagesLoading,
  allUsers,
  usersLoading,
  
  // Operations
  fetchChannels,
  fetchMessages,
  sendMessage,
  selectChannel,
  createChannel,
  
  // Typing
  handleTyping,
  stopTyping,
  typingUsers,
  
  // Real-time
  onlineUsers,
  
  // UI
  isChannelListExpanded,
  isContextPanelVisible,
  toggleChannelList,
  toggleContextPanel,
  
  // Error handling
  error,
  clearError,
}
```

---

## Best Practices

### 1. Prevent Memory Leaks
```typescript
// Always cleanup subscriptions
useEffect(() => {
  // Setup
  realtimeManager.subscribeToChannel(channelId)
  
  // Cleanup
  return () => {
    realtimeManager.unsubscribeFromChannel(channelId)
  }
}, [channelId])
```

### 2. Memoize Everything
```typescript
// Prevent infinite loops and unnecessary re-renders
const realtimeManager = useMemo(() => getRealtimeManager(), [])
const sessionUserId = useMemo(() => session?.user?.id, [session?.user])

// Memoize callbacks
const onNewMessage = useCallback((message) => {
  // handler logic
}, [dependencies])
```

### 3. Optimistic Updates
```typescript
// Always show immediate feedback
dispatch(addMessage(optimisticMessage))

// Then sync with server
const realMessage = await api.post('/messages', data)
dispatch(updateMessage(realMessage))
```

### 4. Error Handling
```typescript
try {
  await sendMessage(data)
} catch (error) {
  // Mark message as failed
  dispatch(updateMessage({ ...message, _error: true }))
  
  // Show user-friendly error
  toast({ title: 'Failed to send', variant: 'destructive' })
  
  // Log for debugging
  console.error('[v0] Send message error:', error)
}
```

### 5. Deduplicate Events
```typescript
// Skip self events
if (message.sender_id === currentUserId) return

// Skip duplicates
if (messages.some(m => m.id === message.id)) return
```

### 6. Debounce High-Frequency Events
```typescript
// Typing indicators
const debouncedTyping = debounce(() => {
  realtimeManager.broadcastTyping(channelId, userId, false)
}, 3000)
```

---

## Performance Optimization

### 1. Connection Pooling
```typescript
// Reuse Supabase client
export const supabase = createClient(url, key) // Singleton

// Reuse RealtimeManager
export const getRealtimeManager = () => {
  if (!instance) instance = new RealtimeManager()
  return instance
}
```

### 2. Pagination & Lazy Loading
```typescript
// Load messages in chunks
const fetchMessages = async (channelId, limit = 50, offset = 0) => {
  return apiRequest(
    `/api/messages?channel_id=${channelId}&limit=${limit}&offset=${offset}`
  )
}

// Implement infinite scroll
const loadMore = () => {
  if (!hasMore || loading) return
  fetchMessages(channelId, 50, messages.length)
}
```

### 3. Caching
```typescript
// Cache channels list
const channelsCache = new Map()

const fetchChannels = async () => {
  const cached = channelsCache.get('all')
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data
  }
  
  const data = await api.get('/channels')
  channelsCache.set('all', { data, timestamp: Date.now() })
  return data
}
```

### 4. Batch Updates
```typescript
// Batch multiple state updates
unstable_batchedUpdates(() => {
  dispatch(addMessage(message1))
  dispatch(addMessage(message2))
  dispatch(updateChannel(channel))
})
```

### 5. Virtual Scrolling
```typescript
// For large message lists, use virtual scrolling
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={80}
>
  {MessageRow}
</FixedSizeList>
```

---

## Testing Checklist

### Unit Tests
- ✅ RealtimeManager: subscription/unsubscription
- ✅ useCommunications: message sending with optimistic updates
- ✅ useCommunications: channel switching
- ✅ Message enrichment utility functions

### Integration Tests
- ✅ Send message → Receive in another client
- ✅ Typing indicators appear/disappear correctly
- ✅ Channel subscription cleanup on unmount
- ✅ Error recovery (network failure, API errors)

### Performance Tests
- ✅ 100+ messages load in < 2s
- ✅ Message send latency < 100ms (optimistic)
- ✅ No memory leaks after 1000 messages
- ✅ Smooth scrolling with virtual list

### Security Tests
- ✅ Cannot send messages to channels not a member of
- ✅ Cannot read messages from private channels
- ✅ Rate limiting prevents spam
- ✅ XSS protection in message content

---

## Deployment Checklist

### Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...

# MongoDB
MONGODB_URI=mongodb+srv://...

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key
```

### Database Setup
1. ✅ Run Prisma migrations: `pnpm prisma migrate deploy`
2. ✅ Seed initial data: `pnpm prisma db seed`
3. ✅ Verify Supabase Realtime is enabled

### Monitoring
1. ✅ Set up error tracking (Sentry)
2. ✅ Monitor WebSocket connections
3. ✅ Track message delivery rates
4. ✅ Alert on high error rates

---

## Summary

This plan provides:
1. **Instant UI updates** via optimistic updates
2. **True real-time** for all users via Supabase broadcast
3. **API-first security** - no reliance on RLS
4. **MongoDB integration** - user data enrichment
5. **Best practices** - memoization, cleanup, error handling
6. **Performance** - pagination, caching, virtual scrolling

The sender no longer makes GET requests after sending - the message appears instantly and broadcasts to others in the background.






but why now the sender name is unknwon alway 

while api giving the correct data but not in the messages ui 

{
    "success": true,
    "data": [
        {
            "id": "41b9b596-0f98-42f4-9498-5a5abd43237f",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "hello man",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:45:41.576Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "e30052b6-520b-4e1a-8b0d-8be173e549c0",
                    "message_id": "41b9b596-0f98-42f4-9498-5a5abd43237f",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T15:45:58.869Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "5a08a156-6fda-4d5d-ab39-fc55f0fef8e1",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "yess",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:46:04.319Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "1c306955-b57a-4050-a7a9-3427be0ffb16",
                    "message_id": "5a08a156-6fda-4d5d-ab39-fc55f0fef8e1",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T15:46:23.753Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "e0236369-cb67-4505-959b-ca6afba22390",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "yes",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:46:20.954Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "8f3defbb-7149-464c-9bc2-d0167533e447",
                    "message_id": "e0236369-cb67-4505-959b-ca6afba22390",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T15:46:32.446Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "973c896c-a2ac-40c6-98a6-926b06e2e8ec",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "ok",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:46:30.816Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "6c173675-ef86-4f9e-8b4b-15457e0af795",
                    "message_id": "973c896c-a2ac-40c6-98a6-926b06e2e8ec",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T15:46:42.407Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "72e2626e-cc66-44f3-aca0-ef7e06bfcbb8",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "yes man",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:46:39.328Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "172db0a6-e22c-4eed-98d3-27e4a8d4cba3",
                    "message_id": "72e2626e-cc66-44f3-aca0-ef7e06bfcbb8",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T15:48:13.222Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "c9c0ffb1-6373-442f-8543-9cfba96ebfde",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "yes here",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:49:17.658Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "e9816e52-9970-4dd0-9766-8713fe3f7aa8",
                    "message_id": "c9c0ffb1-6373-442f-8543-9cfba96ebfde",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T15:49:36.623Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "a93c9f6f-000f-4241-bc72-3fa81b9d1372",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "ok",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:49:32.040Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "2ec92c0a-787d-41c9-be99-f0e256083a68",
                    "message_id": "a93c9f6f-000f-4241-bc72-3fa81b9d1372",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T15:50:41.632Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "33438f82-ae06-43c7-bdb1-ff8e4df90233",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "ggjhgjggjhg",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:50:36.955Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "ca25cb28-a6de-4c0c-ae34-f29b57049404",
                    "message_id": "33438f82-ae06-43c7-bdb1-ff8e4df90233",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T15:53:39.612Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "abfb31f7-3838-42e5-948f-b99d2ee85dfe",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "hello",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:53:48.468Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "6b7fff07-a98f-41a0-b86a-d181200b6f78",
                    "message_id": "abfb31f7-3838-42e5-948f-b99d2ee85dfe",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T15:55:38.707Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "5f36c4f7-eba1-4fec-9d64-5040e0e52951",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "ggh",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T15:56:59.649Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "af919c27-eea9-484a-8c4f-6c45d2a144ee",
                    "message_id": "5f36c4f7-eba1-4fec-9d64-5040e0e52951",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:10:59.824Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "ea7e3be8-d7f8-4b80-a6eb-e1af41a31b51",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "testing user 1",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:11:51.775Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "ede42798-8fd3-416c-842e-2d6d9d70a5ae",
                    "message_id": "ea7e3be8-d7f8-4b80-a6eb-e1af41a31b51",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:14:02.201Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "7f2795e2-559b-41e0-807a-28d02ea74889",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "supeer admin side 1",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:14:22.344Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "97b15593-e74a-45ba-8dd2-e05e986f2642",
                    "message_id": "7f2795e2-559b-41e0-807a-28d02ea74889",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:14:56.140Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "ed1d58dc-2bff-4b32-8176-ab2f5ba17242",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "tesing user sisde 2",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:14:51.885Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "bf1889f3-3eb5-412f-8670-65c951744606",
                    "message_id": "ed1d58dc-2bff-4b32-8176-ab2f5ba17242",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:15:27.242Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "f95ff1c0-6c6b-42a0-8b43-c5b957884eba",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "super side 2",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:15:54.876Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "f83393f4-f44d-46f7-9c61-4aaac1a9fcff",
                    "message_id": "f95ff1c0-6c6b-42a0-8b43-c5b957884eba",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:16:33.263Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "26b63f6f-cba1-457b-8527-35eb57222b47",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "testi9ng 3",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:16:29.545Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "abe0e8f3-5225-475f-8bc5-f22ad22ce4bc",
                    "message_id": "26b63f6f-cba1-457b-8527-35eb57222b47",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:17:24.236Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "5ee8f509-b109-4097-9c9e-0c8e0500d985",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "ddsd",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:17:42.811Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "8ecd6104-84ec-46c4-9354-a99d8f72da10",
                    "message_id": "5ee8f509-b109-4097-9c9e-0c8e0500d985",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:18:33.964Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "e49098c7-5a51-42d6-b3df-6f2594e29de7",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "sadasdas",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:18:29.160Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "55ed8c22-e41b-4428-bfe1-7a52a74ad385",
                    "message_id": "e49098c7-5a51-42d6-b3df-6f2594e29de7",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:19:10.573Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "8a5e457b-0e34-4fc9-a4f1-0384b1569fb6",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "testing4",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:20:12.747Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "30c87330-0f4a-4827-81fd-5b117a30a9fb",
                    "message_id": "8a5e457b-0e34-4fc9-a4f1-0384b1569fb6",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:20:36.274Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "02d16fd1-6751-4741-99ef-94739397789c",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "super4",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:20:30.288Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "99fd6d3f-1610-46c6-950f-7979c5c914c8",
                    "message_id": "02d16fd1-6751-4741-99ef-94739397789c",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:23:06.921Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "24eecfce-d485-4c8c-964c-0a17ee552b97",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "testing5",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:23:03.519Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "621b6ef3-3fa1-4288-a286-3e697cf1774e",
                    "message_id": "24eecfce-d485-4c8c-964c-0a17ee552b97",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:35:17.265Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "6f2a5b9a-709c-4ca7-846f-96cd00542d92",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "HELLO",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:36:16.467Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "817407a9-cbf8-49e6-84a5-7b041d885ed2",
                    "message_id": "6f2a5b9a-709c-4ca7-846f-96cd00542d92",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:36:45.178Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "303ab1f1-5d1c-49f7-abdc-283a897837d5",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "HELLO",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:36:38.709Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "196f1b9a-3526-470a-8927-304d64b9c626",
                    "message_id": "303ab1f1-5d1c-49f7-abdc-283a897837d5",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:37:04.110Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "8f7d98c6-259b-48ae-84ed-5c45270ee83c",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "TEST",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:36:59.596Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "65d1b7a0-3702-4353-bbad-28fc73b7fe7a",
                    "message_id": "8f7d98c6-259b-48ae-84ed-5c45270ee83c",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:37:17.091Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "8093aed5-d29a-4afe-b92e-a59dac1eca57",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "SUPER",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:37:12.723Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "b704b2de-0190-46ff-aadf-ec2d58f40b14",
                    "message_id": "8093aed5-d29a-4afe-b92e-a59dac1eca57",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:50:12.785Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "9d20cba8-e198-47d0-9a20-c6b2323a0607",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "test",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:50:22.500Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "c348752b-4eb3-4efc-9f63-71236932f694",
                    "message_id": "9d20cba8-e198-47d0-9a20-c6b2323a0607",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T17:52:23.870Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "ae8f49d1-65bf-46eb-9785-fb3c78c3f965",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "super",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:53:10.167Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "4d63fa01-bae1-4a0f-b027-d2edb4cb7169",
                    "message_id": "ae8f49d1-65bf-46eb-9785-fb3c78c3f965",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:54:21.663Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "533d60fb-13b9-4173-83cc-953d50a188e9",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "test",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:54:53.976Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "0bb82638-8883-4167-ad43-4ffa6b746f4c",
                    "message_id": "533d60fb-13b9-4173-83cc-953d50a188e9",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:56:50.329Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "2df124f9-a7f5-485a-94a6-73d942ac09d0",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "super",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T17:57:21.734Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "a08175bc-c9b5-43f7-ba83-41a3a7b63879",
                    "message_id": "2df124f9-a7f5-485a-94a6-73d942ac09d0",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T17:59:51.617Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "5049f431-9333-446b-8ac6-e955edbc0e4f",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "sup[er",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T18:01:57.713Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "de3bc862-3965-404c-a6b4-c50a63098ff5",
                    "message_id": "5049f431-9333-446b-8ac6-e955edbc0e4f",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T18:03:52.688Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "70f994d6-1b06-4bc2-b1ca-a6de0c7369f6",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "super",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T18:05:52.590Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "19f34c3e-695c-46fd-af46-d2b1db9dd358",
                    "message_id": "70f994d6-1b06-4bc2-b1ca-a6de0c7369f6",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T18:08:37.066Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "1bc106e2-2924-4d15-9f5b-05ce4ada3451",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "super",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T18:20:30.637Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "568832a0-43bf-438a-bac0-c1099f01b211",
                    "message_id": "1bc106e2-2924-4d15-9f5b-05ce4ada3451",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T18:20:36.306Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "d00834a2-cfa5-4ef7-9a9c-e38ec75d5080",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "test",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T18:20:45.222Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "a9220682-1ef2-4d26-94af-b261bdf07405",
                    "message_id": "d00834a2-cfa5-4ef7-9a9c-e38ec75d5080",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T18:20:49.128Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "1b3242fa-ba8c-4f38-bae8-d14cb07639f3",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "working",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T18:21:00.985Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "6b798b3b-b83b-4125-8e0e-16f0e5796b5e",
                    "message_id": "1b3242fa-ba8c-4f38-bae8-d14cb07639f3",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T18:21:07.104Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "3b7d76dc-858f-41e9-9a44-d18d17dde409",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "hello super admin",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T20:04:05.569Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "858d55ea-6914-44f7-84cc-62336c12407a",
                    "message_id": "3b7d76dc-858f-41e9-9a44-d18d17dde409",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T20:04:08.870Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "f374a4ff-9551-45b6-b400-606c2c1462e0",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "second one",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T20:04:23.756Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "c93e1127-f70e-4c2f-8828-51c2d48830cb",
                    "message_id": "f374a4ff-9551-45b6-b400-606c2c1462e0",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T20:04:25.675Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "20222d09-0242-4714-b753-13d87f65b7c0",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "bfdvbfdgrfdgdfgdfgdf",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T20:04:57.085Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "191ed856-626b-4f38-924b-31f69a58e991",
                    "message_id": "20222d09-0242-4714-b753-13d87f65b7c0",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T20:05:00.465Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "1369921a-3d7e-4c8b-a9c6-9bb870732844",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "test user",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T20:05:15.691Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "456a33c7-19e7-4889-ab75-d430cd7c8f06",
                    "message_id": "1369921a-3d7e-4c8b-a9c6-9bb870732844",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T20:05:19.234Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "c21ef316-d427-4963-81b7-0f88b371d353",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "hello",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T20:29:39.289Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "68000971-c7e5-45fc-9ab6-12bcde80a9bf",
                    "message_id": "c21ef316-d427-4963-81b7-0f88b371d353",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T20:29:48.265Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "43b14513-3e91-4ca6-9f05-beb22ea38813",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "hello",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:12:50.944Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "4a162096-2122-41bb-9439-f2ccf62887a0",
                    "message_id": "43b14513-3e91-4ca6-9f05-beb22ea38813",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T21:14:42.241Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "be70eb32-61dc-432e-9944-86903817df48",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "hello amn",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:16:23.118Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "665cb2d5-b38a-4959-9dbb-71b922c5ee3c",
                    "message_id": "be70eb32-61dc-432e-9944-86903817df48",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T21:16:33.893Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "1404b20f-b0b9-4469-9c9e-f7d4136a9c30",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "yess man",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:16:51.082Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "5e51320f-c052-4ef1-87b6-184a797b7fbb",
                    "message_id": "1404b20f-b0b9-4469-9c9e-f7d4136a9c30",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T21:17:00.683Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "26c641ee-a3b7-4278-9984-a434a964060d",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "test 1",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:19:04.275Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "0b8436cb-d775-4e6d-8157-2644b4e2de55",
                    "message_id": "26c641ee-a3b7-4278-9984-a434a964060d",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T21:19:27.994Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "055e2f65-9ace-4179-aa01-a9e50001ae28",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "694288ab5d89dfdc5ce2d9e2",
            "content": "super1",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:19:42.091Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "0942f57e-7af9-4e5f-8167-43b8fc038ed6",
                    "message_id": "055e2f65-9ace-4179-aa01-a9e50001ae28",
                    "mongo_user_id": "69428eda0b2802786d353a19",
                    "read_at": "2025-12-18T21:20:11.313Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "694288ab5d89dfdc5ce2d9e2",
                "name": "Super Administrator",
                "email": "superadmin@gmail.com",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "96df53db-0e4f-4609-8654-cb170beaa8ec",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "test2",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:24:03.338Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "f118c6da-5080-4f58-9d51-df18354ed612",
                    "message_id": "96df53db-0e4f-4609-8654-cb170beaa8ec",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T21:28:58.099Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "03b1ac6e-a7d1-4833-839d-2a4229c94908",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "jygjjhgjgjhgjhgfghg",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:24:36.229Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "d18b8fa3-9400-4792-b858-b26aedf9be9f",
                    "message_id": "03b1ac6e-a7d1-4833-839d-2a4229c94908",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T21:28:58.113Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "5d871018-bccf-4efa-9ac7-6b9c13c97708",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "ffdfdsfsdfdsfsd",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:25:39.406Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "7af2e49e-a8c1-421d-b5cf-2da3d4cc4369",
                    "message_id": "5d871018-bccf-4efa-9ac7-6b9c13c97708",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T21:28:58.493Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        },
        {
            "id": "5df22a91-8c34-46d9-8abc-4ee9c1520377",
            "channel_id": "90560994-fa70-49cc-a538-d4775fe47a78",
            "mongo_sender_id": "69428eda0b2802786d353a19",
            "content": "jhgjgjj gjgjhg",
            "content_type": "text",
            "thread_id": null,
            "reply_count": 0,
            "mongo_mentioned_user_ids": [],
            "is_edited": false,
            "edited_at": null,
            "created_at": "2025-12-18T21:27:06.920Z",
            "parent_message_id": null,
            "other_messages": [],
            "read_receipts": [
                {
                    "id": "a3aa86c5-7e3b-476b-94aa-6d1eaa1c89b7",
                    "message_id": "5df22a91-8c34-46d9-8abc-4ee9c1520377",
                    "mongo_user_id": "694288ab5d89dfdc5ce2d9e2",
                    "read_at": "2025-12-18T21:28:58.635Z"
                }
            ],
            "reactions": [],
            "attachments": [],
            "sender": {
                "mongo_member_id": "69428eda0b2802786d353a19",
                "name": "Testing user",
                "email": "bc230202687maf@vu.edu.pk",
                "avatar": "",
                "role": "User",
                "userType": "User",
                "isOnline": false
            }
        }
    ],
    "meta": {
        "total": 47,
        "limit": 50,
        "offset": 0
    }
}


and also in the case of user who sending the messages of open chat for his case also not show the his own  name or correct avatae

now make sure every things should be working well properly according to the requirements and realtime and definite the typing for every things