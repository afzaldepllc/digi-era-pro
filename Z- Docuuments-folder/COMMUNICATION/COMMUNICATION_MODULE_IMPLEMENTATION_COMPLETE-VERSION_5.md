# Communication Module - Complete Implementation Documentation

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Architecture](#2-database-architecture)
3. [Tech Stack & Integration](#3-tech-stack--integration)
4. [Real-time System (Supabase)](#4-real-time-system-supabase)
5. [API Routes Reference](#5-api-routes-reference)
6. [State Management (Redux)](#6-state-management-redux)
7. [Custom Hooks](#7-custom-hooks)
8. [Frontend Components](#8-frontend-components)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [File Structure](#10-file-structure)

---

## 1. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js 14)                               │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────────────────────┐ │
│  │  React Components│  │ useCommunications│  │ Redux Store (communicationSlice)│ │
│  │  - ChatWindow    │◄─┤     Hook        │◄─┤ - channels, messages            │ │
│  │  - MessageList   │  │                  │  │ - onlineUserIds, typingUsers   │ │
│  │  - MessageInput  │  │                  │  │ - loading states               │ │
│  │  - ChannelList   │  │                  │  └──────────────────────────────────┘ │
│  └─────────────────┘  └───────┬────────┘                                        │
│                                │                                                 │
└────────────────────────────────┼─────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────┐ ┌───────────────────┐ ┌─────────────────────┐
│  RealtimeManager    │ │   API Routes      │ │   Supabase Client   │
│  (Singleton)        │ │   /api/comm/...   │ │   (Realtime Sub)    │
│  - Presence         │ │   - messages      │ │                     │
│  - Typing           │ │   - channels      │ │                     │
│  - Broadcasting     │ │   - reactions     │ │                     │
└─────────────────────┘ └─────────┬─────────┘ └─────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND LAYER                                       │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────────────┐ │
│  │  Supabase (PostgreSQL)   │  │  MongoDB (via Mongoose)                      │ │
│  │  - channels              │  │  - Users (primary user data)                 │ │
│  │  - messages              │  │  - Roles                                     │ │
│  │  - channel_members       │  │  - Projects, Departments                     │ │
│  │  - reactions             │  │                                              │ │
│  │  - read_receipts         │  │  * Used only for user lookup/enrichment     │ │
│  │  - attachments           │  │                                              │ │
│  └─────────────────────────┘  └──────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  AWS S3 (File Storage)                                                       ││
│  │  - chat-attachments/ (message files)                                         ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Why Hybrid Database Approach?

| Database | Purpose | Rationale |
|----------|---------|-----------|
| **Supabase (PostgreSQL)** | Real-time communication data | Built-in realtime, optimized for chat, broadcasts, presence |
| **MongoDB** | User profiles, auth, business data | Primary app database, maintains single source of truth for users |
| **AWS S3** | File attachments | Scalable blob storage with presigned URLs |

---

## 2. Database Architecture

### Prisma Schema (Supabase/PostgreSQL)

```prisma
// channels - Chat rooms/conversations
model channels {
  id                  String            @id @default(uuid())
  type                String            // 'dm', 'project', 'department', 'client-support'
  name                String?
  avatar_url          String?
  mongo_department_id String?           // Reference to MongoDB
  mongo_project_id    String?           // Reference to MongoDB
  mongo_creator_id    String            // Reference to MongoDB User
  is_private          Boolean           @default(false)
  member_count        Int               @default(0)
  last_message_at     DateTime?
  categories          String[]          @default([])
  created_at          DateTime          @default(now())
  updated_at          DateTime          @default(now())
  
  // Relations
  channel_members     channel_members[]
  messages            messages[]
  attachments         attachments[]
  reactions           reactions[]
}

// channel_members - Channel membership with roles
model channel_members {
  id                    String    @id @default(uuid())
  channel_id            String
  mongo_member_id       String    // Reference to MongoDB User._id
  role                  String    @default("member")  // 'admin', 'member'
  joined_at             DateTime  @default(now())
  last_seen_at          DateTime?
  is_online             Boolean   @default(false)
  notifications_enabled Boolean   @default(true)
  
  channels              channels  @relation(...)
  @@unique([channel_id, mongo_member_id])
}

// messages - Chat messages with denormalized sender data
model messages {
  id                       String    @id @default(uuid())
  channel_id               String
  mongo_sender_id          String
  content                  String    // HTML content from TipTap editor
  content_type             String    @default("text")  // 'text', 'file', 'system'
  thread_id                String?   // For threading
  parent_message_id        String?   // For replies
  reply_count              Int       @default(0)
  mongo_mentioned_user_ids String[]  // @mentions
  is_edited                Boolean   @default(false)
  edited_at                DateTime?
  created_at               DateTime  @default(now())
  
  // ⭐ DENORMALIZED SENDER DATA (Key optimization!)
  sender_name              String    @default("Unknown User")
  sender_email             String    @default("")
  sender_avatar            String?
  sender_role              String    @default("User")
  
  // Relations
  attachments              attachments[]
  reactions                reactions[]
  read_receipts            read_receipts[]
}

// reactions - Message reactions (emoji)
model reactions {
  id            String   @id @default(uuid())
  message_id    String
  channel_id    String
  mongo_user_id String
  user_name     String   @default("Unknown")  // Denormalized
  emoji         String
  created_at    DateTime @default(now())
  
  @@unique([message_id, mongo_user_id, emoji])
}

// read_receipts - Message read status
model read_receipts {
  id            String   @id @default(uuid())
  message_id    String
  mongo_user_id String
  read_at       DateTime @default(now())
  
  @@unique([message_id, mongo_user_id])
}

// attachments - File attachments
model attachments {
  id                String   @id @default(uuid())
  message_id        String
  channel_id        String
  mongo_uploader_id String
  file_name         String
  file_url          String?
  s3_key            String?
  s3_bucket         String?
  file_size         Int?
  file_type         String?
  created_at        DateTime @default(now())
}
```

### Denormalization Strategy

Messages store sender data directly to avoid MongoDB lookups on every message read:

```typescript
// When creating a message, fetch sender once and store inline
const senderData = await User.findById(session.user.id)

const message = await prisma.messages.create({
  data: {
    content: data.content,
    // Denormalized sender fields
    sender_name: senderData.name,
    sender_email: senderData.email,
    sender_avatar: senderData.avatar,
    sender_role: extractRoleName(senderData.role),
  }
})
```

**Benefits:**
- ✅ No MongoDB joins on message fetch
- ✅ Instant message loading
- ✅ Real-time broadcast includes complete data
- ⚠️ Trade-off: Must update if user changes name/avatar (rare)

---

## 3. Tech Stack & Integration

### Core Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) | React framework with SSR |
| State | Redux Toolkit | Centralized state management |
| Styling | Tailwind CSS + shadcn/ui | UI components |
| Rich Editor | TipTap | WYSIWYG message editor |
| Real-time | Supabase Realtime | WebSocket connections |
| Database | PostgreSQL (Supabase) | Communication data |
| Database | MongoDB | User/business data |
| Storage | AWS S3 | File attachments |
| Auth | NextAuth.js | Session management |

### Key Dependencies

```json
{
  "@supabase/supabase-js": "^2.x",
  "@prisma/client": "^5.x",
  "@reduxjs/toolkit": "^2.x",
  "@tiptap/react": "^2.x",
  "date-fns": "^3.x",
  "mongoose": "^8.x"
}
```

---

## 4. Real-time System (Supabase)

### RealtimeManager Class

The `RealtimeManager` is a **singleton** class that manages all Supabase real-time connections:

**Location:** `lib/realtime-manager.ts`

```typescript
class RealtimeManager {
  private rtChannels: Map<string, RealtimeChannel> = new Map()
  private presenceChannel: RealtimeChannel | null = null
  private eventHandlers: RealtimeEventHandlers = {}
  // Typing throttle state
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private lastTypingSent: Map<string, number> = new Map()
}
```

### Supabase Channel Types Used

#### 1. Global Presence Channel (`global_presence`)

**Purpose:** Track which users are online across the entire app.

```typescript
async initializePresence(userId: string, userName: string, userAvatar?: string) {
  this.presenceChannel = supabase.channel('global_presence', {
    config: {
      presence: { key: userId }
    }
  })

  this.presenceChannel
    .on('presence', { event: 'sync' }, () => {
      // Called when presence state updates
      const state = this.presenceChannel.presenceState()
      // state = { "userId1": [...], "userId2": [...] }
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      // User came online
      this.eventHandlers.onUserOnline?.(key)
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      // User went offline
      this.eventHandlers.onUserOffline?.(key)
    })
    .subscribe()

  // Track current user's presence
  await this.presenceChannel.track({
    visitorId: userId,
    userName: userName,
    userAvatar: userAvatar,
    online_at: new Date().toISOString()
  })
}
```

**Supabase Methods Used:**
- `channel(name, config)` - Create presence channel with user key
- `.on('presence', { event: 'sync' | 'join' | 'leave' })` - Listen to presence events
- `.presenceState()` - Get current state of all online users
- `.track(payload)` - Announce user's presence

#### 2. Chat Channel Subscriptions (`rt_${channelId}`)

**Purpose:** Real-time updates for a specific chat channel.

```typescript
subscribeToChannel(channelId: string) {
  const rtChannel = supabase.channel(`rt_${channelId}`, {
    config: {
      broadcast: { self: false }  // Don't receive own broadcasts
    }
  })

  rtChannel
    .on('broadcast', { event: 'new_message' }, (payload) => {
      this.eventHandlers.onNewMessage?.(payload.payload)
    })
    .on('broadcast', { event: 'message_update' }, (payload) => {
      this.eventHandlers.onMessageUpdate?.(payload.payload)
    })
    .on('broadcast', { event: 'message_delete' }, (payload) => {
      this.eventHandlers.onMessageDelete?.(payload.payload.messageId)
    })
    .on('broadcast', { event: 'typing_start' }, (payload) => {
      this.eventHandlers.onTypingStart?.(payload.payload)
    })
    .on('broadcast', { event: 'typing_stop' }, (payload) => {
      this.eventHandlers.onTypingStop?.(payload.payload)
    })
    .on('broadcast', { event: 'message_read' }, (payload) => {
      this.eventHandlers.onMessageRead?.(payload.payload)
    })
    .on('broadcast', { event: 'reaction_added' }, (payload) => {
      this.eventHandlers.onReactionAdd?.(payload.payload)
    })
    .on('broadcast', { event: 'reaction_removed' }, (payload) => {
      this.eventHandlers.onReactionRemove?.(payload.payload)
    })
    .subscribe()
}
```

**Supabase Methods Used:**
- `.on('broadcast', { event: 'eventName' }, handler)` - Listen to broadcast events
- `.subscribe()` - Activate the subscription
- `.send({ type: 'broadcast', event: 'name', payload })` - Send broadcast

#### 3. User Notification Channel (`notifications_${userId}`)

**Purpose:** Personal notifications for @mentions.

```typescript
async subscribeToNotifications(userId: string) {
  this.notificationChannel = supabase.channel(`notifications_${userId}`)
  
  this.notificationChannel
    .on('broadcast', { event: 'mention_notification' }, (payload) => {
      this.eventHandlers.onMentionNotification?.(payload.payload)
    })
    .subscribe()
}
```

### Broadcast Events Reference

| Event | Trigger | Payload |
|-------|---------|---------|
| `new_message` | Message created | Full message object with sender |
| `message_update` | Message edited | Updated message object |
| `message_delete` | Message deleted | `{ messageId }` |
| `typing_start` | User starts typing | `{ userId, userName, channelId }` |
| `typing_stop` | User stops typing | `{ userId, channelId }` |
| `message_read` | Message marked read | `{ messageId, userId, channelId, readAt }` |
| `reaction_added` | Reaction added | Full reaction object |
| `reaction_removed` | Reaction removed | `{ id, message_id, mongo_user_id, emoji }` |
| `mention_notification` | User @mentioned | Notification data |

### Typing Indicator Optimization

The typing system uses throttling to prevent flooding:

```typescript
private readonly TYPING_THROTTLE_MS = 2000  // Send every 2s max
private readonly TYPING_TIMEOUT_MS = 3500   // Auto-stop after 3.5s
private readonly REMOTE_TYPING_TIMEOUT_MS = 4000  // Remove stale indicator

async sendTypingStart(channelId: string, userId: string) {
  const now = Date.now()
  const lastSent = this.lastTypingSent.get(channelId) || 0
  
  // Throttle: skip if sent recently
  if (this.isTyping.get(channelId) && now - lastSent < TYPING_THROTTLE_MS) {
    return
  }
  
  // Set auto-stop timeout
  const timeout = setTimeout(() => {
    this.sendTypingStop(channelId, userId)
  }, TYPING_TIMEOUT_MS)
  this.typingTimeouts.set(channelId, timeout)
  
  // Broadcast typing
  this.isTyping.set(channelId, true)
  this.lastTypingSent.set(channelId, now)
  
  rtChannel.send({
    type: 'broadcast',
    event: 'typing_start',
    payload: { userId, userName, channelId }
  })
}
```

---

## 5. API Routes Reference

### Base Path: `/api/communication`

#### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/channels` | Get user's channels (with filters) |
| POST | `/channels` | Create new channel |

**GET /channels Query Params:**
- `type` - Filter by channel type ('dm', 'project', etc.)
- `department_id` - Filter by department
- `project_id` - Filter by project

**POST /channels Body:**
```typescript
{
  type: 'dm' | 'project' | 'department' | 'client-support',
  name?: string,
  channel_members?: string[],  // For DMs
  mongo_department_id?: string,
  mongo_project_id?: string,
  is_private?: boolean
}
```

#### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/messages` | Get channel messages (paginated) |
| POST | `/messages` | Send text message |
| POST | `/messages/with-files` | Send message with attachments |
| PUT | `/messages/[messageId]` | Edit message |
| DELETE | `/messages/[messageId]` | Delete message |
| GET | `/messages/search` | Search messages in channel |

**GET /messages Query Params:**
- `channel_id` (required) - UUID
- `limit` - Default 50
- `offset` - Default 0

**POST /messages Body:**
```typescript
{
  channel_id: string,
  content: string,           // HTML from TipTap
  content_type?: 'text' | 'file',
  thread_id?: string,
  parent_message_id?: string,
  mongo_mentioned_user_ids?: string[]
}
```

#### Reactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reactions` | Toggle reaction (add/remove) |
| DELETE | `/reactions` | Remove specific reaction |

**POST /reactions Body:**
```typescript
{
  message_id: string,
  channel_id: string,
  emoji: string  // "👍", "❤️", etc.
}
```

#### Read Receipts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/read-receipts` | Mark message as read |
| GET | `/read-receipts` | Get receipts for message |

#### Attachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attachments` | Upload files to channel |
| GET | `/attachments` | Get channel attachments |
| GET | `/attachments/download` | Get presigned download URL |

#### Members

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/members` | Get channel members |
| POST | `/members` | Add member / update status |
| DELETE | `/members` | Remove member from channel |

---

## 6. State Management (Redux)

### communicationSlice

**Location:** `store/slices/communicationSlice.ts`

#### State Structure

```typescript
interface CommunicationState {
  // Channel management
  channels: IChannel[]
  activeChannelId: string | null
  selectedChannel: IChannel | null
  
  // Messages keyed by channelId
  messages: Record<string, ICommunication[]>
  
  // Real-time presence
  onlineUsers: IParticipant[]
  onlineUserIds: string[]        // Fast lookup array
  typingUsers: Record<string, ITypingIndicator[]>
  
  // UI State
  isChannelListExpanded: boolean
  isContextPanelVisible: boolean
  
  // Loading states
  loading: boolean               // Channels loading
  actionLoading: boolean         // Send/create actions
  messagesLoading: boolean       // Messages loading
  channelsInitialized: boolean   // Prevent duplicate fetches
  
  // Error handling
  error: string | null
  
  // Current user
  currentUser: IParticipant | null
  currentUserId: string | null
  
  // Notifications
  unreadCount: number
  notifications: Notification[]
}
```

#### Key Reducers

| Reducer | Purpose |
|---------|---------|
| `setActiveChannel` | Select channel, clear unread |
| `addMessage` | Add new message, update channel order |
| `updateMessage` | Update message (optimistic) |
| `prependMessages` | Add older messages (pagination) |
| `addMessageReadReceipt` | Add read receipt in real-time |
| `addReactionToMessage` | Add reaction (optimistic) |
| `removeReactionFromMessage` | Remove reaction |
| `setTyping` | Add typing indicator |
| `removeTyping` | Remove typing indicator |
| `setOnlineUserIds` | Sync online users from presence |
| `addOnlineUser` / `removeOnlineUser` | Individual presence updates |

#### Optimistic Updates Pattern

```typescript
// In useCommunications hook
const sendMessage = async (messageData) => {
  const tempId = crypto.randomUUID()
  
  // 1. Create optimistic message
  const optimisticMessage = {
    id: tempId,
    ...messageData,
    isOptimistic: true,
    sender: currentUser
  }
  
  // 2. Add to store immediately
  dispatch(addMessage({ channelId, message: optimisticMessage }))
  
  try {
    // 3. Send to API
    const response = await apiRequest('/api/communication/messages', { ... })
    
    // 4. Update with real data
    dispatch(updateMessage({
      channelId,
      messageId: tempId,
      updates: { ...response, isOptimistic: false }
    }))
  } catch (error) {
    // 5. Mark as failed
    dispatch(updateMessage({
      channelId,
      messageId: tempId,
      updates: { isFailed: true }
    }))
  }
}
```

---

## 7. Custom Hooks

### useCommunications

**Location:** `hooks/use-communications.ts`

The main hook that orchestrates all communication functionality.

#### Returned Values

```typescript
return {
  // State (from Redux)
  channels, activeChannelId, selectedChannel, messages,
  onlineUsers, typingUsers, loading, error, unreadCount,
  
  // Real-time presence
  onlineUserIds,
  isUserOnline: (userId) => boolean,
  getOnlineUsers: () => string[],
  
  // Channel operations
  fetchChannels, selectChannel, clearActiveChannel, createChannel,
  
  // Message operations
  fetchMessages, fetchOlderMessages, searchMessages,
  sendMessage, sendMessageWithFiles, updateMessage, markAsRead,
  
  // Reaction operations
  toggleReaction,
  
  // Real-time operations
  setTyping, removeTyping,
  
  // UI operations
  toggleChannelList, toggleContextPanel,
  
  // User data
  mockCurrentUser,  // Current session user
  allUsers,         // All users for @mentions
  usersLoading, sessionStatus
}
```

#### Initialization Flow

```typescript
// 1. Set current user ID in store
useEffect(() => {
  if (sessionUserId) dispatch(setCurrentUserId(sessionUserId))
}, [sessionUserId])

// 2. Initialize presence tracking
useEffect(() => {
  if (sessionUserId && !presenceInitializedRef.current) {
    realtimeManager.initializePresence(sessionUserId, sessionUserName, sessionUserAvatar)
  }
}, [sessionUserId])

// 3. Fetch channels (once per session)
useEffect(() => {
  if (sessionUserId && !globalFetchedChannels.get(sessionUserId)) {
    globalFetchedChannels.set(sessionUserId, true)
    fetchChannels()
  }
}, [sessionUserId])

// 4. Subscribe to active channel
useEffect(() => {
  if (activeChannelId) {
    realtimeManager.subscribeToChannel(activeChannelId)
    fetchMessages({ channel_id: activeChannelId })
  }
  return () => {
    realtimeManager.unsubscribeFromChannel(activeChannelId)
  }
}, [activeChannelId])
```

### useChatAttachments

**Location:** `hooks/use-chat-attachments.ts`

Handles file upload/download operations:

```typescript
return {
  uploadAttachments,    // Upload files to S3
  isUploading,
  uploadProgress,
  fetchChannelAttachments,
  downloadAttachment,   // Get presigned URL
  previewAttachment,
  error
}
```

---

## 8. Frontend Components

### Component Hierarchy

```
CommunicationsPage (app/communications/page.tsx)
├── CommunicationSidebar
│   ├── ChannelList (channels + search)
│   └── UserDirectory (start new DMs)
│
└── ChatWindow
    ├── Header (channel info, actions)
    ├── MessageList
    │   ├── Message bubbles
    │   │   ├── Avatar, content, time
    │   │   ├── AttachmentGrid
    │   │   ├── MessageReactions
    │   │   └── QuickReactionBar
    │   └── TypingIndicator
    ├── MessageInput
    │   └── RichMessageEditor (TipTap)
    │       ├── Toolbar (bold, italic, etc.)
    │       ├── MentionPicker (@mentions)
    │       └── EmojiPicker
    └── ContextPanel (media, files, members)
```

### Key Components

#### ChatWindow (`components/communication/chat-window.tsx`)

Main chat container that:
- Connects to `useCommunications` hook
- Handles message sending/editing
- Manages search functionality
- Coordinates MessageList and MessageInput

#### MessageList (`components/communication/message-list.tsx`)

Virtualized message list with:
- Infinite scroll (load older on scroll up)
- Read receipt tracking via IntersectionObserver
- Message grouping by date
- Reply threading UI

#### RichMessageEditor (`components/communication/rich-message-editor.tsx`)

TipTap-based editor with:
- Rich text formatting (bold, italic, lists, code)
- @mention detection and picker
- Emoji picker integration
- File attachment handling
- Reply/Edit mode support

#### OnlineIndicator (`components/communication/online-indicator.tsx`)

Shows online users with:
- Real-time updates from `onlineUserIds`
- Avatar stack with green ring
- Tooltip with user names

#### TypingIndicator (`components/communication/typing-indicator.tsx`)

Shows "X is typing..." with:
- Animated dots
- Multiple users support
- Auto-cleanup via timeouts

---

## 9. Data Flow Diagrams

### Sending a Message

```
User Types Message
       │
       ▼
RichMessageEditor.onSend()
       │
       ▼
MessageInput.handleSendFromEditor()
       │
       ▼
useCommunications.sendMessage()
       │
       ├─────► 1. Create optimistic message
       │              │
       │              ▼
       │       dispatch(addMessage())
       │              │
       │              ▼
       │       UI updates immediately
       │
       ├─────► 2. POST /api/communication/messages
       │              │
       │              ▼
       │       API: Create in Supabase DB
       │              │
       │              ▼
       │       API: Broadcast via Supabase
       │              │
       │              ▼
       │       Other users receive via WebSocket
       │
       └─────► 3. Update optimistic with real ID
                      │
                      ▼
               dispatch(updateMessage())
```

### Real-time Message Receipt

```
Other User Sends Message
       │
       ▼
Supabase broadcasts 'new_message'
       │
       ▼
RealtimeManager receives via .on('broadcast')
       │
       ▼
Calls eventHandlers.onNewMessage(message)
       │
       ▼
useCommunications.onNewMessage callback
       │
       ├─── Skip if from self (prevent duplicates)
       │
       ▼
dispatch(addMessage({ channelId, message }))
       │
       ▼
Redux updates state
       │
       ▼
React re-renders MessageList
```

### Presence Updates

```
User Opens App
       │
       ▼
useCommunications initializes
       │
       ▼
realtimeManager.initializePresence()
       │
       ▼
Supabase presence.track()
       │
       ▼
Other users receive 'join' event
       │
       ▼
dispatch(addOnlineUser(userId))
       │
       ▼
OnlineIndicator shows green dot
```

---

## 10. File Structure

```
digi-era-pro/
├── app/
│   ├── api/
│   │   └── communication/
│   │       ├── channels/
│   │       │   └── route.ts         # GET/POST channels
│   │       ├── messages/
│   │       │   ├── route.ts         # GET/POST messages
│   │       │   ├── [messageId]/
│   │       │   │   └── route.ts     # PUT/DELETE message
│   │       │   ├── search/
│   │       │   │   └── route.ts     # GET search
│   │       │   └── with-files/
│   │       │       └── route.ts     # POST with attachments
│   │       ├── reactions/
│   │       │   └── route.ts         # POST/DELETE reactions
│   │       ├── read-receipts/
│   │       │   └── route.ts         # POST/GET receipts
│   │       ├── members/
│   │       │   └── route.ts         # Channel membership
│   │       └── attachments/
│   │           ├── route.ts         # Upload/list
│   │           └── download/
│   │               └── route.ts     # Presigned URLs
│   │
│   └── communications/
│       ├── page.tsx                 # Main page
│       └── [channelId]/
│           └── page.tsx             # Channel view
│
├── components/
│   └── communication/
│       ├── chat-window.tsx
│       ├── message-list.tsx
│       ├── message-input.tsx
│       ├── rich-message-editor.tsx
│       ├── channel-list.tsx
│       ├── user-directory.tsx
│       ├── online-indicator.tsx
│       ├── typing-indicator.tsx
│       ├── mention-picker.tsx
│       ├── emoji-picker.tsx
│       ├── reaction-picker.tsx
│       ├── attachment-preview.tsx
│       └── create-channel-modal.tsx
│
├── hooks/
│   ├── use-communications.ts        # Main hook
│   └── use-chat-attachments.ts      # File handling
│
├── lib/
│   ├── realtime-manager.ts          # Supabase realtime singleton
│   ├── supabase.ts                  # Supabase client
│   ├── prisma.ts                    # Prisma client
│   ├── db-utils.ts                  # DB operations
│   └── communication/
│       ├── utils.ts                 # Enrichment helpers
│       └── channel-helpers.ts       # Channel creation logic
│
├── store/
│   └── slices/
│       └── communicationSlice.ts    # Redux state
│
├── types/
│   ├── communication.ts             # TypeScript interfaces
│   └── supabase.ts                  # Supabase types
│
└── prisma/
    └── schema.prisma                # Database schema
```

---

## Appendix: TypeScript Interfaces

### Core Types

```typescript
// Message
interface ICommunication {
  id: string
  channel_id: string
  mongo_sender_id: string
  content: string
  content_type: 'text' | 'file' | 'system'
  thread_id?: string
  parent_message_id?: string
  reply_count: number
  mongo_mentioned_user_ids?: string[]
  is_edited: boolean
  edited_at?: string
  created_at: string
  attachments?: IAttachment[]
  read_receipts?: IReadReceipt[]
  reactions?: IReaction[]
  
  // Denormalized sender
  sender_name: string
  sender_email: string
  sender_avatar?: string
  sender_role: string
  sender?: ISender  // Computed object for UI
}

// Channel
interface IChannel {
  id: string
  type: 'dm' | 'project' | 'department' | 'client-support'
  name?: string
  avatar_url?: string
  is_private: boolean
  member_count: number
  last_message_at?: string
  last_message?: ICommunication
  channel_members: IChannelMember[]
  unreadCount?: number
}

// Typing indicator
interface ITypingIndicator {
  channelId: string
  userId: string
  userName: string
  timestamp: string
}

// Reaction
interface IReaction {
  id: string
  message_id: string
  channel_id: string
  mongo_user_id: string
  user_name?: string
  emoji: string
  created_at: string
}
```

---

*Documentation last updated: December 2024*
