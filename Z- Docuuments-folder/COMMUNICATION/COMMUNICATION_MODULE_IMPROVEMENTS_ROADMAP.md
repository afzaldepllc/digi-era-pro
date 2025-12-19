# Communication Module - Professional Improvements Roadmap

## Executive Summary

This document outlines a comprehensive improvement plan to elevate the communication module to professional standards matching WhatsApp, Slack, and similar enterprise-grade chat applications. The improvements are organized into **phases** following a divide-and-conquer methodology.

---

## Current State Assessment

### ✅ What's Working Well
- Real-time messaging via Supabase broadcasts
- Presence tracking (online/offline users)
- Typing indicators with throttling
- Optimistic updates for messages
- Denormalized sender data (no MongoDB joins on read)
- Reactions with real-time sync
- File attachments via S3
- @mentions with notifications
- Read receipts
- Rich text editor (TipTap)

### ⚠️ Issues Identified

| Category | Issue | Impact |
|----------|-------|--------|
| **Message Delete** | Not implemented in UI | Missing feature |
| **Channel Delete** | Not implemented | Missing feature |
| **Channel Pin/Archive** | No channel settings for pin/archive | Missing feature |
| **Chat Filters** | No filter panel (flask button) | Missing feature |
| **Message Notifications** | No real-time notifications in header | Missing feature |
| **Notification Settings** | Not implemented | Missing feature |
| **Sidebar Responsiveness** | Fixed width, no resize, poor mobile UX | UX issue (but should be resizable)
| **Error Recovery** | Failed messages can't be retried | Poor UX |
| **Loading States** | Inconsistent, no skeletons | Jarring UX |
| **Cache Invalidation** | No proper cache layer | Stale data |
| **Pagination** | Hardcoded to 5 messages (testing) | Broken |
| **Read Receipts** | No real-time broadcast from API | Partial implementation |
| **Message Status** | No delivered/sent indicators | Missing feature |
| **Reconnection** | No handling for disconnects | Reliability issue |
| **Search** | Debug logs in production code | Needs cleanup |
| **Attachments** | No loading states in list | UX issue |

---

## Phase-by-Phase Implementation Plan

---

## Phase 1: Critical Bug Fixes & Cleanup (Priority: URGENT)

**Estimated Time: 2-3 days**

### 1.1 Fix Hardcoded Pagination Limits

**Problem:** Messages limited to 5 (testing value)

**Location:** `hooks/use-communications.ts`

```typescript
// CURRENT (BROKEN)
const MESSAGE_LIMIT = 5 // params.limit || 50
const OLDER_MESSAGE_LIMIT = 5 // params.limit || 30

// FIX
const MESSAGE_LIMIT = params.limit || 50
const OLDER_MESSAGE_LIMIT = params.limit || 30
```

**Files to Update:**
- [use-communications.ts](../hooks/use-communications.ts#L448) - `fetchMessages`
- [use-communications.ts](../hooks/use-communications.ts#L515) - `fetchOlderMessages`

### 1.2 Remove Debug Console Logs

**Problem:** Production code contains debugging statements

**Files to Clean:**
- [use-communications.ts](../hooks/use-communications.ts) - Multiple `console.log`
- [chat-window.tsx](../components/communication/chat-window.tsx#L79) - `console.log`
- [channel-list.tsx](../components/communication/channel-list.tsx#L57) - `console.log`
- [messages/search/route.ts](../app/api/communication/messages/search/route.ts) - Debug logs

**Action:** Create environment-aware logging:

```typescript
// lib/logger.ts
const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  debug: (...args: any[]) => isDev && console.log('[DEBUG]', ...args),
  info: (...args: any[]) => console.log('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
}
```

### 1.3 Fix Duplicate isOnline Fields

**Problem:** Both `isOnline` and `is_online` used inconsistently

**Location:** `store/slices/communicationSlice.ts`

```typescript
// CURRENT
member.isOnline = ...
member.is_online = ...

// FIX: Use only one field consistently
member.isOnline = action.payload.includes(member.mongo_member_id)
// Remove is_online references
```

**Files to Update:**
- `store/slices/communicationSlice.ts` - Standardize to `isOnline`
- `types/communication.ts` - Remove duplicate field
- All component usages

### 1.4 Fix Message Input Toast Dependency

**Problem:** Toast in dependencies can cause infinite loops

**Location:** `hooks/use-communications.ts`

```typescript
// CURRENT - Risky
}, [dispatch, toast])

// BETTER - Use ref for toast
const toastRef = useRef(toast)
toastRef.current = toast
// Then use toastRef.current in callbacks
```

---

## Phase 2: Message Lifecycle Completion (Priority: HIGH)

**Estimated Time: 3-4 days**

### 2.1 Implement Message Delete (Trash-Based with 30-Day Restore)

**Current State:** `handleDelete` is a placeholder

---

#### 🏢 Architecture: Supabase PostgreSQL + MongoDB Hybrid

| Data Type | Storage | Reason |
|-----------|---------|--------|
| **Messages, Channels, Reactions, Attachments, Read Receipts** | **Supabase PostgreSQL (Prisma)** | Already working well with mongo_ids as foreign keys |
| **Audit Logs** | **MongoDB** | Compliance, investigation, long-term retention |
| **Realtime Events** (typing, presence, broadcasts) | **Supabase Realtime** | WebSocket infrastructure |

> ✅ **Current Implementation:** All communication data is stored in Supabase PostgreSQL using Prisma, with `mongo_sender_id`, `mongo_member_id` etc. referencing MongoDB users. This is working well - **DO NOT CHANGE**.
> 
> 📝 **Audit Logs:** Store in MongoDB for compliance/investigation purposes (separate from realtime data).

---

#### 🗑️ Trash-Based Deletion Flow (WhatsApp/Gmail Style)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MESSAGE LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Active Message] ────── User Deletes ──────► [Trash]                  │
│        │                                          │                     │
│        │                                  Within 30 days?               │
│        │                                  /           \                 │
│        │                               Yes             No               │
│        │                                │               │               │
│        │                         [Restorable]    [Cron Job Runs]       │
│        │                                │               │               │
│        │                         User Restores    Permanent Delete     │
│        │                                │               │               │
│        └────────────────────────────────┘               ▼               │
│                                                  [Audit Log Only]       │
│                                                  (Content preserved)    │
└─────────────────────────────────────────────────────────────────────────┘
```

| Action | What Happens | Reversible | Time Limit |
|--------|--------------|------------|------------|
| **Move to Trash** | `is_trashed = true`, hidden from channel | ✅ Yes | 30 days |
| **Hide for Me** | User ID added to `hidden_by_users` array | ✅ Yes | Unlimited |
| **Restore from Trash** | `is_trashed = false`, message returns | ✅ Yes | 30 days |
| **Permanent Delete** | Removed from Supabase, audit log preserved in MongoDB | ❌ No | Auto after 30 days |

---

#### 2.1.1 Prisma Schema Updates (Supabase PostgreSQL)

**Update `prisma/schema.prisma`:**

```prisma
model messages {
  id                String   @id @default(uuid())
  channel_id        String
  mongo_sender_id   String   // Reference to MongoDB User
  
  // Denormalized sender info (already exists)
  sender_name       String?
  sender_email      String?
  sender_avatar     String?
  sender_role       String?
  
  // Content
  content           String
  content_type      String   @default("text") // 'text' | 'html' | 'markdown'
  
  // Reply/Thread
  reply_to_id       String?
  thread_count      Int      @default(0)
  
  // Status
  is_edited         Boolean  @default(false)
  edited_at         DateTime?
  
  // ========== NEW: Trash fields ==========
  is_trashed        Boolean  @default(false)
  trashed_at        DateTime?
  trashed_by        String?  // mongo_user_id who trashed
  trash_reason      String?
  
  // For "Hide for Me" - array of mongo_user_ids
  hidden_by_users   String[] @default([])
  
  // Preserved content for restoration
  original_content  String?
  // ========================================
  
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  // Relations
  channels          channels @relation(fields: [channel_id], references: [id], onDelete: Cascade)
  reactions         reactions[]
  attachments       attachments[]
  read_receipts     read_receipts[]
  
  @@index([channel_id, is_trashed, created_at(sort: Desc)])
  @@index([mongo_sender_id, is_trashed])
  @@index([is_trashed, trashed_at])
}
```

---

#### 2.1.2 MongoDB Schema (Audit Logs Only)

**Create `models/MessageAuditLog.ts`:**

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface IMessageAuditLog extends Document {
  // References to Supabase message (UUID string)
  supabase_message_id: string
  supabase_channel_id: string
  
  action: 'created' | 'edited' | 'trashed' | 'restored' | 'permanently_deleted'
  
  // Actor info (MongoDB user reference)
  actor_id: mongoose.Types.ObjectId
  actor_name: string
  actor_email: string
  actor_role?: string
  
  // Content snapshots (for compliance)
  previous_content?: string
  new_content?: string
  
  // Metadata
  metadata?: {
    trash_reason?: string
    message_created_at?: Date
    days_in_trash?: number
    ip_address?: string
    user_agent?: string
    sender_mongo_id?: string
    [key: string]: any
  }
  
  created_at: Date
}

const MessageAuditLogSchema = new Schema<IMessageAuditLog>({
  supabase_message_id: { 
    type: String, 
    required: true,
    index: true 
  },
  supabase_channel_id: { 
    type: String, 
    required: true,
    index: true 
  },
  
  action: { 
    type: String, 
    enum: ['created', 'edited', 'trashed', 'restored', 'permanently_deleted'],
    required: true,
    index: true
  },
  
  actor_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actor_name: { type: String, required: true },
  actor_email: { type: String, required: true },
  actor_role: String,
  
  previous_content: String,
  new_content: String,
  
  metadata: Schema.Types.Mixed
  
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
})

// Indexes for compliance queries
MessageAuditLogSchema.index({ supabase_channel_id: 1, created_at: -1 })
MessageAuditLogSchema.index({ actor_id: 1, action: 1 })
MessageAuditLogSchema.index({ action: 1, created_at: -1 })

export const MessageAuditLog = mongoose.models.MessageAuditLog || 
  mongoose.model<IMessageAuditLog>('MessageAuditLog', MessageAuditLogSchema)
```

---

#### 2.1.3 API Routes (Prisma + MongoDB Audit)

**Move to Trash: `DELETE /api/communication/messages`**

```typescript
// app/api/communication/messages/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { MessageAuditLog } from '@/models/MessageAuditLog'
import { createClient } from '@supabase/supabase-js'
import connectDB from '@/lib/mongodb'

export async function DELETE(request: NextRequest) {
  const { session, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('messageId')
  const deleteType = searchParams.get('deleteType') || 'trash' // 'trash' | 'self'
  const reason = searchParams.get('reason') || ''

  if (!messageId) {
    return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
  }

  // Fetch from Supabase PostgreSQL via Prisma
  const message = await prisma.messages.findUnique({
    where: { id: messageId }
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.is_trashed) {
    return NextResponse.json({ error: 'Message is already in trash' }, { status: 400 })
  }

  const userId = session.user.id
  const isOwner = message.mongo_sender_id === userId

  // Permission check
  if (!isOwner && !isSuperAdmin) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
  }

  // "Hide for Me" - just add user to hidden_by_users array
  if (deleteType === 'self') {
    await prisma.messages.update({
      where: { id: messageId },
      data: {
        hidden_by_users: {
          push: userId
        }
      }
    })

    return NextResponse.json({ success: true, deleteType: 'self' })
  }

  // "Move to Trash" - can be restored within 30 days
  await prisma.messages.update({
    where: { id: messageId },
    data: {
      is_trashed: true,
      trashed_at: new Date(),
      trashed_by: userId,
      trash_reason: reason,
      original_content: message.content // Preserve for restoration
    }
  })

  // Create audit log in MongoDB (for compliance)
  await connectDB()
  await MessageAuditLog.create({
    supabase_message_id: messageId,
    supabase_channel_id: message.channel_id,
    action: 'trashed',
    actor_id: userId,
    actor_name: session.user.name || 'Unknown',
    actor_email: session.user.email || '',
    actor_role: isSuperAdmin ? 'super_admin' : 'user',
    previous_content: message.content,
    metadata: {
      trash_reason: reason,
      message_created_at: message.created_at,
      sender_mongo_id: message.mongo_sender_id
    }
  })

  // Broadcast via Supabase Realtime
  await broadcastMessageEvent(message.channel_id, 'message_trashed', {
    messageId,
    channelId: message.channel_id,
    trashedBy: userId
  })

  return NextResponse.json({ 
    success: true, 
    deleteType: 'trash',
    message: 'Message moved to trash. You can restore it within 30 days.'
  })
}

// Helper: Broadcast via Supabase Realtime
async function broadcastMessageEvent(channelId: string, event: string, payload: any) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const channel = supabaseAdmin.channel(`rt_${channelId}`)
    await channel.send({
      type: 'broadcast',
      event,
      payload
    })
  } catch (e) {
    console.error(`Failed to broadcast ${event}:`, e)
  }
}
```

**Restore from Trash: `POST /api/communication/messages/restore`**

```typescript
// app/api/communication/messages/restore/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { MessageAuditLog } from '@/models/MessageAuditLog'
import connectDB from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  const { session, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { messageId } = body

  if (!messageId) {
    return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
  }

  const message = await prisma.messages.findUnique({
    where: { id: messageId }
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (!message.is_trashed) {
    return NextResponse.json({ error: 'Message is not in trash' }, { status: 400 })
  }

  const userId = session.user.id
  const isOwner = message.mongo_sender_id === userId

  // Permission check - only owner or admin can restore
  if (!isOwner && !isSuperAdmin) {
    return NextResponse.json({ error: 'You can only restore your own messages' }, { status: 403 })
  }

  // Check 30-day window
  const trashedAt = new Date(message.trashed_at!)
  const now = new Date()
  const daysSinceTrashed = Math.floor((now.getTime() - trashedAt.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceTrashed > 30) {
    return NextResponse.json({ 
      error: 'Message cannot be restored. It has been in trash for more than 30 days.' 
    }, { status: 400 })
  }

  // Restore message in Supabase
  const restoredMessage = await prisma.messages.update({
    where: { id: messageId },
    data: {
      is_trashed: false,
      trashed_at: null,
      trashed_by: null,
      trash_reason: null
    }
  })

  // Audit log in MongoDB
  await connectDB()
  await MessageAuditLog.create({
    supabase_message_id: messageId,
    supabase_channel_id: message.channel_id,
    action: 'restored',
    actor_id: userId,
    actor_name: session.user.name || 'Unknown',
    actor_email: session.user.email || '',
    actor_role: isSuperAdmin ? 'super_admin' : 'user',
    new_content: message.content,
    metadata: {
      days_in_trash: daysSinceTrashed
    }
  })

  // Broadcast restoration via Supabase Realtime
  await broadcastMessageEvent(message.channel_id, 'message_restored', {
    messageId,
    channelId: message.channel_id,
    restoredBy: userId,
    message: restoredMessage
  })

  return NextResponse.json({ 
    success: true, 
    message: restoredMessage,
    note: 'Message restored successfully'
  })
}
```

**Get Trashed Messages: `GET /api/communication/messages/trash`**

```typescript
// app/api/communication/messages/trash/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const channelId = searchParams.get('channelId') // Optional filter
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const userId = session.user.id

  // Query: only user's own trashed messages
  const where: any = {
    mongo_sender_id: userId,
    is_trashed: true
  }

  if (channelId) {
    where.channel_id = channelId
  }

  // Get messages with channel info
  const messages = await prisma.messages.findMany({
    where,
    orderBy: { trashed_at: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      channels: {
        select: { id: true, name: true, type: true }
      }
    }
  })

  // Calculate remaining days for each message
  const now = new Date()
  const messagesWithExpiry = messages.map(msg => {
    const trashedAt = new Date(msg.trashed_at!)
    const daysSinceTrashed = Math.floor((now.getTime() - trashedAt.getTime()) / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.max(0, 30 - daysSinceTrashed)
    
    return {
      ...msg,
      days_remaining: daysRemaining,
      expires_at: new Date(trashedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    }
  })

  const total = await prisma.messages.count({ where })

  return NextResponse.json({
    messages: messagesWithExpiry,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
}
```

---

#### 2.1.4 Permanent Deletion Cron Job (30 Days)

**Create `scripts/cleanup-trashed-messages.ts`:**

```typescript
// scripts/cleanup-trashed-messages.ts
// Run via cron: 0 2 * * * (daily at 2 AM)
// Command: npx ts-node scripts/cleanup-trashed-messages.ts

import { prisma } from '@/lib/prisma'
import mongoose from 'mongoose'
import { MessageAuditLog } from '@/models/MessageAuditLog'
import { S3Service } from '@/lib/services/s3-service'

const RETENTION_DAYS = 30 // Messages permanently deleted after 30 days in trash

async function cleanupTrashedMessages() {
  // Connect to MongoDB for audit logs
  await mongoose.connect(process.env.MONGODB_URI!)
  
  console.log('🗑️ Starting trashed messages cleanup (30-day retention)...')
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  // Find messages to permanently delete from Supabase
  const messagesToDelete = await prisma.messages.findMany({
    where: {
      is_trashed: true,
      trashed_at: { lt: cutoffDate }
    },
    include: {
      attachments: true
    }
  })

  console.log(`Found ${messagesToDelete.length} messages to permanently delete`)

  let deleted = 0
  let errors = 0

  for (const msg of messagesToDelete) {
    try {
      // Create final audit log in MongoDB BEFORE permanent deletion
      await MessageAuditLog.create({
        supabase_message_id: msg.id,
        supabase_channel_id: msg.channel_id,
        action: 'permanently_deleted',
        actor_id: new mongoose.Types.ObjectId(), // System actor
        actor_name: 'System Cleanup (30-day retention)',
        actor_email: 'system@internal',
        previous_content: msg.original_content || msg.content, // PRESERVE CONTENT IN AUDIT
        metadata: {
          trashed_at: msg.trashed_at,
          trashed_by: msg.trashed_by,
          trash_reason: msg.trash_reason,
          days_in_trash: RETENTION_DAYS,
          retention_policy: `${RETENTION_DAYS} days`,
          message_created_at: msg.created_at,
          sender_mongo_id: msg.mongo_sender_id,
          sender_name: msg.sender_name,
          sender_email: msg.sender_email
        }
      })

      // Delete attachments from S3 if any
      for (const attachment of msg.attachments) {
        try {
          if (attachment.s3_key) {
            await S3Service.deleteFile(attachment.s3_key)
          }
        } catch (s3Error) {
          console.error(`Failed to delete S3 file ${attachment.s3_key}:`, s3Error)
        }
      }

      // Permanently delete from Supabase PostgreSQL
      // This cascades to attachments, reactions, read_receipts
      await prisma.messages.delete({
        where: { id: msg.id }
      })
      
      deleted++
      
      if (deleted % 100 === 0) {
        console.log(`Progress: ${deleted}/${messagesToDelete.length} deleted`)
      }
    } catch (error) {
      console.error(`Failed to delete message ${msg.id}:`, error)
      errors++
    }
  }

  console.log(`✅ Cleanup complete: ${deleted} deleted, ${errors} errors`)
  console.log(`📝 Audit logs preserved in MongoDB for compliance`)
  
  await mongoose.disconnect()
  await prisma.$disconnect()
}

// Run
cleanupTrashedMessages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err)
    process.exit(1)
  })
```

**Add to `package.json`:**

```json
{
  "scripts": {
    "cleanup:messages": "npx ts-node scripts/cleanup-trashed-messages.ts"
  }
}
```

**Cron Configuration (Linux/Server):**

```bash
# crontab -e
0 2 * * * cd /path/to/project && npm run cleanup:messages >> /var/log/message-cleanup.log 2>&1
```

---

#### 2.1.5 Redux State Updates

**Update `store/slices/communicationSlice.ts`:**

```typescript
// Add to state interface
interface CommunicationState {
  // ... existing fields
  
  trashedMessages: Message[]
  trashedMessagesLoading: boolean
  trashedMessagesPagination: {
    page: number
    totalPages: number
    total: number
  }
}

// Initial state additions
trashedMessages: [],
trashedMessagesLoading: false,
trashedMessagesPagination: { page: 1, totalPages: 0, total: 0 }

// Add reducers
reducers: {
  // ... existing reducers

  // Move message to trash (local state update)
  moveMessageToTrash: (state, action: PayloadAction<{
    messageId: string
    channelId: string
    trashedBy: string
  }>) => {
    const { messageId, channelId } = action.payload
    const messages = state.messages[channelId]
    if (messages) {
      state.messages[channelId] = messages.filter(m => m.id !== messageId)
    }
    
    // Update last_message if needed
    const channel = state.channels.find(c => c.id === channelId)
    if (channel?.last_message?.id === messageId) {
      // Set to previous non-deleted message or null
      channel.last_message = null
    }
  },

  // Restore message from trash
  restoreMessageFromTrash: (state, action: PayloadAction<{
    messageId: string
    channelId: string
    message: Message
  }>) => {
    const { channelId, message, messageId } = action.payload
    
    // Add back to channel messages
    if (!state.messages[channelId]) {
      state.messages[channelId] = []
    }
    
    // Insert in correct chronological position
    const messages = state.messages[channelId]
    const insertIndex = messages.findIndex(m => 
      new Date(m.created_at) < new Date(message.created_at)
    )
    
    if (insertIndex === -1) {
      messages.push(message)
    } else {
      messages.splice(insertIndex, 0, message)
    }
    
    // Remove from trashed messages
    state.trashedMessages = state.trashedMessages.filter(m => m.id !== messageId)
  },

  // Hide message for self only
  hideMessageForSelf: (state, action: PayloadAction<{
    messageId: string
    channelId: string
  }>) => {
    const { messageId, channelId } = action.payload
    const messages = state.messages[channelId]
    if (messages) {
      state.messages[channelId] = messages.filter(m => m.id !== messageId)
    }
  },

  // Set trashed messages list
  setTrashedMessages: (state, action: PayloadAction<{
    messages: Message[]
    pagination: { page: number; totalPages: number; total: number }
  }>) => {
    state.trashedMessages = action.payload.messages
    state.trashedMessagesPagination = action.payload.pagination
  },

  setTrashedMessagesLoading: (state, action: PayloadAction<boolean>) => {
    state.trashedMessagesLoading = action.payload
  },
}
```

---

#### 2.1.6 Hook Functions

**Add to `hooks/use-communications.ts`:**

```typescript
// Move to Trash
const moveToTrash = useCallback(async (
  messageId: string, 
  channelId: string, 
  reason?: string
) => {
  try {
    const url = new URL('/api/communication/messages', window.location.origin)
    url.searchParams.set('messageId', messageId)
    url.searchParams.set('deleteType', 'trash')
    if (reason) url.searchParams.set('reason', reason)

    const response = await fetch(url.toString(), { method: 'DELETE' })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete message')
    }

    dispatch(moveMessageToTrash({ messageId, channelId, trashedBy: session?.user?.id }))
    toast({ title: 'Message moved to trash', description: 'You can restore it within 30 days' })
    
    return true
  } catch (error: any) {
    toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' })
    return false
  }
}, [dispatch, session, toast])

// Hide for self only
const hideForSelf = useCallback(async (messageId: string, channelId: string) => {
  try {
    const url = new URL('/api/communication/messages', window.location.origin)
    url.searchParams.set('messageId', messageId)
    url.searchParams.set('deleteType', 'self')

    const response = await fetch(url.toString(), { method: 'DELETE' })
    
    if (!response.ok) throw new Error('Failed to hide message')

    dispatch(hideMessageForSelf({ messageId, channelId }))
    toast({ title: 'Message hidden' })
  } catch (error) {
    toast({ title: 'Failed to hide message', variant: 'destructive' })
  }
}, [dispatch, toast])

// Restore from Trash
const restoreFromTrash = useCallback(async (messageId: string) => {
  try {
    const response = await fetch('/api/communication/messages/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to restore message')
    }

    const { message } = await response.json()
    dispatch(restoreMessageFromTrash({ 
      messageId, 
      channelId: message.channel_id, 
      message 
    }))
    
    toast({ title: 'Message restored successfully' })
    return true
  } catch (error: any) {
    toast({ title: 'Failed to restore', description: error.message, variant: 'destructive' })
    return false
  }
}, [dispatch, toast])

// Fetch Trashed Messages
const fetchTrashedMessages = useCallback(async (
  channelId?: string, 
  page: number = 1
) => {
  try {
    dispatch(setTrashedMessagesLoading(true))
    
    const url = new URL('/api/communication/messages/trash', window.location.origin)
    if (channelId) url.searchParams.set('channelId', channelId)
    url.searchParams.set('page', page.toString())

    const response = await fetch(url.toString())
    const { messages, pagination } = await response.json()
    
    dispatch(setTrashedMessages({ messages, pagination }))
  } catch (error) {
    console.error('Failed to fetch trashed messages:', error)
  } finally {
    dispatch(setTrashedMessagesLoading(false))
  }
}, [dispatch])

// Return from hook
return {
  // ... existing returns
  moveToTrash,
  hideForSelf,
  restoreFromTrash,
  fetchTrashedMessages,
  trashedMessages,
  trashedMessagesLoading,
  trashedMessagesPagination
}
```

---

#### 2.1.7 Realtime Handlers

**Add to realtime subscription in `use-communications.ts`:**

```typescript
// Handle message trashed event
channel.on('broadcast', { event: 'message_trashed' }, (payload) => {
  const { messageId, channelId } = payload.payload
  dispatch(moveMessageToTrash({ 
    messageId, 
    channelId, 
    trashedBy: payload.payload.trashedBy 
  }))
})

// Handle message restored event
channel.on('broadcast', { event: 'message_restored' }, (payload) => {
  const { messageId, channelId, message } = payload.payload
  dispatch(restoreMessageFromTrash({ messageId, channelId, message }))
})
```

---

#### 2.1.8 UI Components

**Trash View Component:**

```tsx
// components/communication/trash-view.tsx

import { useEffect, useState } from 'react'
import { useCommunications } from '@/hooks/use-communications'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, RotateCcw, Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function TrashView({ onClose }: { onClose?: () => void }) {
  const { 
    trashedMessages, 
    trashedMessagesLoading,
    trashedMessagesPagination,
    fetchTrashedMessages,
    restoreFromTrash 
  } = useCommunications()

  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    fetchTrashedMessages()
  }, [fetchTrashedMessages])

  const handleRestore = async (messageId: string) => {
    setRestoring(messageId)
    await restoreFromTrash(messageId)
    setRestoring(null)
  }

  if (trashedMessagesLoading && trashedMessages.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading trash...</p>
      </div>
    )
  }

  if (trashedMessages.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">Trash is empty</p>
        <p className="text-sm mt-2">Deleted messages appear here for 30 days</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          <span className="font-medium">Trash</span>
          <Badge variant="secondary">{trashedMessagesPagination.total} messages</Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {trashedMessages.map((message) => (
          <div 
            key={message.id} 
            className="border rounded-lg p-4 bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Channel info */}
                <p className="text-xs text-muted-foreground mb-1">
                  #{message.channel_id?.name || 'Unknown channel'}
                </p>
                
                {/* Message content preview */}
                <p className="text-sm line-clamp-2">{message.content}</p>
                
                {/* Expiry info */}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Deleted {formatDistanceToNow(new Date(message.trashed_at))} ago
                  </span>
                  
                  {message.days_remaining <= 7 ? (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Expires in {message.days_remaining} days
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {message.days_remaining} days to restore
                    </Badge>
                  )}
                </div>
              </div>

              {/* Restore button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(message.id)}
                disabled={restoring === message.id}
              >
                {restoring === message.id ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Restore
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {trashedMessagesPagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={trashedMessagesPagination.page <= 1}
            onClick={() => fetchTrashedMessages(undefined, trashedMessagesPagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {trashedMessagesPagination.page} of {trashedMessagesPagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={trashedMessagesPagination.page >= trashedMessagesPagination.totalPages}
            onClick={() => fetchTrashedMessages(undefined, trashedMessagesPagination.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

**Delete Menu in Message Item:**

```tsx
// In message-item.tsx or message-list.tsx

{isOwner && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleReply(message)}>
        <Reply className="mr-2 h-4 w-4" />
        Reply
      </DropdownMenuItem>
      
      <DropdownMenuSeparator />
      
      <DropdownMenuItem onClick={() => hideForSelf(message.id, channelId)}>
        <EyeOff className="mr-2 h-4 w-4" />
        Hide for Me
      </DropdownMenuItem>
      
      <DropdownMenuItem 
        onClick={() => moveToTrash(message.id, channelId)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Move to Trash
        <Badge variant="outline" className="ml-auto text-xs">30d</Badge>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

**Add Trash Access to Sidebar:**

```tsx
// In channel-list.tsx or sidebar

<Button 
  variant="ghost" 
  className="w-full justify-start"
  onClick={() => setShowTrash(true)}
>
  <Trash2 className="h-4 w-4 mr-2" />
  Trash
  {trashedMessagesPagination.total > 0 && (
    <Badge variant="secondary" className="ml-auto">
      {trashedMessagesPagination.total}
    </Badge>
  )}
</Button>
```
      is_deleted: true,
      deleted_at: {
        lt: cutoffDate
      }
    }
  })

  console.log(`Permanently deleted ${result.count} messages older than ${RETENTION_DAYS} days`)

  // Also clean up orphaned attachments, reactions, read_receipts
  // (handled by cascade delete in schema)
}
```

---

#### 2.1.9 Admin Panel Considerations

For enterprise compliance, admins should be able to:

```typescript
// Admin-only endpoints

// GET /api/admin/communication/deleted-messages
// View all soft-deleted messages (for investigation)

// POST /api/admin/communication/messages/[messageId]/restore  
// Restore a soft-deleted message

// GET /api/admin/communication/audit-log
// View full audit trail from MongoDB
```

---

### 2.2 Implement Channel Delete/Archive (Enterprise-Grade)

**New Feature:** Ability to delete or archive channels

---

#### 🏢 Enterprise Channel Deletion Strategy

| Feature | Implementation | Why |
|---------|---------------|-----|
| **Archive (Recommended)** | Set `is_archived = true`, read-only | Preserve history, can reactivate |
| **Soft Delete** | Set `is_deleted = true`, hide from users | Compliance, recovery |
| **Hard Delete** | Actually remove (admin only) | Storage, GDPR "right to be forgotten" |
| **Leave Channel** | Remove user from channel_members | Personal preference |
| **Export Before Delete** | Download channel history | Compliance, backup |

---

#### 2.2.1 Schema Updates

```prisma
model channels {
  // ... existing fields
  
  // Archive/Delete fields
  is_archived      Boolean   @default(false)
  archived_at      DateTime?
  archived_by      String?
  
  is_deleted       Boolean   @default(false)
  deleted_at       DateTime?
  deleted_by       String?
  
  // For compliance - reason for deletion
  deletion_reason  String?
}

// Channel audit log
model channel_audit_log {
  id            String   @id @default(uuid())
  channel_id    String
  action        String   // 'created' | 'archived' | 'unarchived' | 'deleted' | 'member_added' | 'member_removed'
  actor_id      String
  actor_name    String
  target_id     String?  // For member actions
  metadata      Json?
  created_at    DateTime @default(now())
  
  @@index([channel_id, created_at])
}
```

---

#### 2.2.2 API Route

Create `app/api/communication/channels/[channelId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createClient } from '@supabase/supabase-js'

// PATCH /api/communication/channels/[channelId] - Archive/Unarchive
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params
  const { session, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body // 'archive' | 'unarchive'

  // Verify admin permission
  const isAdmin = isSuperAdmin || await isChannelAdmin(channelId, session.user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Only admins can archive channels' }, { status: 403 })
  }

  const channel = await prisma.channels.findUnique({ where: { id: channelId } })
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  if (action === 'archive') {
    await prisma.channels.update({
      where: { id: channelId },
      data: {
        is_archived: true,
        archived_at: new Date(),
        archived_by: session.user.id
      }
    })

    // Audit log
    await prisma.channel_audit_log.create({
      data: {
        channel_id: channelId,
        action: 'archived',
        actor_id: session.user.id,
        actor_name: (session.user as any).name || 'Unknown'
      }
    })

    // Broadcast to all channel members
    await broadcastChannelUpdate(channelId, { action: 'archived' })

    return NextResponse.json({ success: true, message: 'Channel archived' })
  }

  if (action === 'unarchive') {
    await prisma.channels.update({
      where: { id: channelId },
      data: {
        is_archived: false,
        archived_at: null,
        archived_by: null
      }
    })

    await prisma.channel_audit_log.create({
      data: {
        channel_id: channelId,
        action: 'unarchived',
        actor_id: session.user.id,
        actor_name: (session.user as any).name || 'Unknown'
      }
    })

    return NextResponse.json({ success: true, message: 'Channel unarchived' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// DELETE /api/communication/channels/[channelId] - Soft/Hard delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params
  const { session, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { deleteType, reason } = body // 'soft' | 'hard', reason for audit

  const channel = await prisma.channels.findUnique({ 
    where: { id: channelId },
    include: { channel_members: true }
  })

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  // Permission check
  const isOwner = channel.mongo_creator_id === session.user.id
  const isAdmin = isSuperAdmin || await isChannelAdmin(channelId, session.user.id)

  // DM channels: either participant can delete (for themselves)
  // Group channels: only owner/admin can delete
  if (channel.type !== 'dm' && !isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Only channel owner or admin can delete' }, { status: 403 })
  }

  // Hard delete requires super admin
  if (deleteType === 'hard' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Hard delete requires super admin privileges' }, { status: 403 })
  }

  if (deleteType === 'hard') {
    // Export before hard delete (optional - for compliance)
    // await exportChannelHistory(channelId)

    // Hard delete - cascades to messages, members, attachments
    await prisma.channels.delete({
      where: { id: channelId }
    })

    return NextResponse.json({ success: true, message: 'Channel permanently deleted' })
  }

  // Soft delete (default)
  await prisma.channels.update({
    where: { id: channelId },
    data: {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: session.user.id,
      deletion_reason: reason
    }
  })

  // Audit log
  await prisma.channel_audit_log.create({
    data: {
      channel_id: channelId,
      action: 'deleted',
      actor_id: session.user.id,
      actor_name: (session.user as any).name || 'Unknown',
      metadata: { reason, member_count: channel.channel_members.length }
    }
  })

  // Broadcast deletion
  await broadcastChannelUpdate(channelId, { action: 'deleted' })

  return NextResponse.json({ success: true, message: 'Channel deleted' })
}

// Helper functions
async function isChannelAdmin(channelId: string, userId: string): Promise<boolean> {
  const membership = await prisma.channel_members.findFirst({
    where: {
      channel_id: channelId,
      mongo_member_id: userId,
      role: { in: ['admin', 'owner'] }
    }
  })
  return !!membership
}

async function broadcastChannelUpdate(channelId: string, update: any) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const channel = supabaseAdmin.channel(`rt_${channelId}`)
    await channel.send({
      type: 'broadcast',
      event: 'channel_update',
      payload: { channelId, ...update }
    })
  } catch (e) {
    console.error('Failed to broadcast channel update:', e)
  }
}
```

---

#### 2.2.3 Leave Channel (For Users)

```typescript
// POST /api/communication/channels/[channelId]/leave
export async function POST(request: NextRequest, { params }) {
  const { channelId } = await params
  const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')

  // Remove user from channel_members
  await prisma.channel_members.delete({
    where: {
      channel_id_mongo_member_id: {
        channel_id: channelId,
        mongo_member_id: session.user.id
      }
    }
  })

  // Update member count
  await prisma.channels.update({
    where: { id: channelId },
    data: { member_count: { decrement: 1 } }
  })

  // If last member, optionally archive the channel
  const remainingMembers = await prisma.channel_members.count({
    where: { channel_id: channelId }
  })

  if (remainingMembers === 0) {
    await prisma.channels.update({
      where: { id: channelId },
      data: { is_archived: true, archived_at: new Date() }
    })
  }

  return NextResponse.json({ success: true })
}
```

---

#### 2.2.4 UI - Channel Settings Modal

```tsx
// components/communication/channel-settings-modal.tsx

export function ChannelSettingsModal({ channel, isAdmin, onClose }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Channel Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            {isAdmin && <TabsTrigger value="danger">Danger Zone</TabsTrigger>}
          </TabsList>

          <TabsContent value="danger">
            <div className="space-y-4 border-destructive/20 border rounded-lg p-4">
              <h4 className="font-medium text-destructive">Danger Zone</h4>

              {/* Archive Channel */}
              {!channel.is_archived ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Archive Channel</p>
                    <p className="text-sm text-muted-foreground">
                      Make read-only. Can be unarchived later.
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Unarchive Channel</p>
                    <p className="text-sm text-muted-foreground">
                      Restore messaging capability.
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleUnarchive}>
                    Unarchive
                  </Button>
                </div>
              )}

              <Separator />

              {/* Delete Channel */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Channel</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this channel and all messages.
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{channel.name}"?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>This will delete the channel and all its messages for everyone.</p>
                <p className="text-warning">⚠️ This action cannot be undone.</p>
                
                <div className="mt-4">
                  <Label>Reason (optional, for audit)</Label>
                  <Input 
                    placeholder="Why is this channel being deleted?"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive"
                onClick={() => handleDelete(deleteReason)}
              >
                Delete Channel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
```

---

#### 2.2.5 Archived Channel UI

```tsx
// In channel-list.tsx - Show archived indicator

{channel.is_archived && (
  <Badge variant="secondary" className="text-xs">
    <Archive className="h-3 w-3 mr-1" />
    Archived
  </Badge>
)}

// In chat-window.tsx - Disable input for archived channels

{selectedChannel?.is_archived && (
  <div className="p-4 bg-muted text-center text-muted-foreground">
    <Archive className="h-5 w-5 mx-auto mb-2" />
    <p>This channel is archived</p>
    <p className="text-sm">Messages are read-only</p>
    {isAdmin && (
      <Button variant="outline" size="sm" className="mt-2" onClick={handleUnarchive}>
        Unarchive
      </Button>
    )}
  </div>
)}
```

### 2.3 Failed Message Retry

**Problem:** Failed messages show error but can't be retried

#### 2.3.1 Add Failed State UI

```tsx
// In message-list.tsx
{message.isFailed && (
  <div className="flex items-center gap-2 text-destructive text-xs mt-1">
    <AlertCircle className="h-3 w-3" />
    <span>Failed to send</span>
    <Button variant="ghost" size="xs" onClick={() => onRetry(message)}>
      Retry
    </Button>
    <Button variant="ghost" size="xs" onClick={() => onDiscard(message.id)}>
      Discard
    </Button>
  </div>
)}
```

#### 2.3.2 Retry Logic

```typescript
const retryMessage = useCallback(async (failedMessage: ICommunication) => {
  // Remove failed message
  dispatch(deleteMessage({ channelId: failedMessage.channel_id, messageId: failedMessage.id }))
  
  // Resend
  await sendMessage({
    channel_id: failedMessage.channel_id,
    content: failedMessage.content,
    content_type: failedMessage.content_type
  })
}, [dispatch, sendMessage])
```

### 2.4 Message Delivery Status

**Feature:** WhatsApp-style sent/delivered/read indicators

#### 2.4.1 Message States

```typescript
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

interface ICommunication {
  // ... existing
  status?: MessageStatus  // Computed field
}
```

#### 2.4.2 Status Icon Component

```tsx
function MessageStatus({ message, currentUserId }) {
  if (message.mongo_sender_id !== currentUserId) return null
  
  if (message.isFailed) return <X className="text-destructive" />
  if (message.isOptimistic) return <Clock className="text-muted" />
  
  const isRead = message.read_receipts?.some(r => r.mongo_user_id !== currentUserId)
  if (isRead) return <CheckCheck className="text-blue-500" />
  
  // Delivered (message saved but not read)
  return <CheckCheck className="text-muted" />
}
```

---

### 2.5 Persist Selected Channel on Page Refresh

**Problem:** When user refreshes the page, they see channel list with no selected channel, losing their context.

**Target:** Restore the previously selected channel and fetch fresh messages on page load.

---

#### 2.5.1 Architecture Decision

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **URL-based (Recommended)** | Shareable links, browser navigation works, SEO-friendly | Requires route setup | ✅ Best for production |
| **localStorage** | Simple, works without route changes | Not shareable, can get stale | ⚠️ Fallback option |
| **Redux Persist** | Automatic state restoration | Overhead, can restore stale data | ❌ Too heavy for this |

**Recommended:** Use URL-based routing with optional localStorage fallback.

---

#### 2.5.2 URL-Based Approach (Dynamic Route)

**Create `app/communications/[channelId]/page.tsx`:**

```typescript
// app/communications/[channelId]/page.tsx

import { Metadata } from 'next'
import { CommunicationPage } from '@/components/communication/communication-page'

interface Props {
  params: Promise<{ channelId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channelId } = await params
  // Optionally fetch channel name for metadata
  return {
    title: `Chat - Channel`,
  }
}

export default async function ChannelPage({ params }: Props) {
  const { channelId } = await params
  
  return <CommunicationPage initialChannelId={channelId} />
}
```

**Update main page `app/communications/page.tsx`:**

```typescript
// app/communications/page.tsx

import { redirect } from 'next/navigation'
import { CommunicationPage } from '@/components/communication/communication-page'

export default function CommunicationsPage() {
  // Check localStorage for last channel (client-side redirect handled in component)
  return <CommunicationPage />
}
```

---

#### 2.5.3 CommunicationPage Component Updates

```tsx
// components/communication/communication-page.tsx

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useCommunications } from '@/hooks/use-communications'
import { ChannelList } from './channel-list'
import { ChatWindow } from './chat-window'

interface CommunicationPageProps {
  initialChannelId?: string
}

const LAST_CHANNEL_KEY = 'comm_last_channel'

export function CommunicationPage({ initialChannelId }: CommunicationPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const initialLoadDone = useRef(false)
  
  const {
    channels,
    selectedChannel,
    setSelectedChannel,
    fetchChannels,
    fetchMessages,
    channelsLoading,
    messagesLoading
  } = useCommunications()

  // Handle initial load and channel restoration
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const initializeChannel = async () => {
      // 1. Fetch channels first
      await fetchChannels()
      
      // 2. Determine which channel to select
      let channelToSelect = initialChannelId

      // If no initialChannelId from URL, check localStorage
      if (!channelToSelect) {
        channelToSelect = localStorage.getItem(LAST_CHANNEL_KEY) || undefined
      }

      // 3. If we have a channel to restore, select it
      if (channelToSelect && channels.length > 0) {
        const channel = channels.find(c => c.id === channelToSelect)
        if (channel) {
          handleSelectChannel(channel)
        } else {
          // Channel not found (deleted?), clear storage
          localStorage.removeItem(LAST_CHANNEL_KEY)
        }
      }
    }

    initializeChannel()
  }, []) // Run once on mount

  // When channels load and we have initialChannelId, auto-select
  useEffect(() => {
    if (initialChannelId && channels.length > 0 && !selectedChannel) {
      const channel = channels.find(c => c.id === initialChannelId)
      if (channel) {
        handleSelectChannel(channel)
      }
    }
  }, [channels, initialChannelId])

  // Handle channel selection
  const handleSelectChannel = useCallback(async (channel: Channel) => {
    // Update Redux state
    setSelectedChannel(channel)
    
    // Persist to localStorage
    localStorage.setItem(LAST_CHANNEL_KEY, channel.id)
    
    // Update URL without full page reload
    if (pathname !== `/communications/${channel.id}`) {
      router.push(`/communications/${channel.id}`, { scroll: false })
    }
    
    // Fetch fresh messages for this channel
    await fetchMessages({ channel_id: channel.id })
  }, [setSelectedChannel, fetchMessages, router, pathname])

  // Clear selection handler
  const handleClearSelection = useCallback(() => {
    setSelectedChannel(null)
    localStorage.removeItem(LAST_CHANNEL_KEY)
    router.push('/communications', { scroll: false })
  }, [setSelectedChannel, router])

  return (
    <div className="flex h-full">
      {/* Channel List */}
      <div className="w-80 border-r flex-shrink-0">
        <ChannelList 
          channels={channels}
          selectedChannelId={selectedChannel?.id}
          onSelectChannel={handleSelectChannel}
          loading={channelsLoading}
        />
      </div>

      {/* Chat Window */}
      <div className="flex-1">
        {selectedChannel ? (
          <ChatWindow 
            channel={selectedChannel}
            loading={messagesLoading}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">Select a conversation</p>
        <p className="text-sm">Choose a channel from the list to start chatting</p>
      </div>
    </div>
  )
}
```

---

#### 2.5.4 Redux State Updates

**Add `setSelectedChannel` to slice:**

```typescript
// communicationSlice.ts

setSelectedChannel: (state, action: PayloadAction<Channel | null>) => {
  state.selectedChannel = action.payload
  
  // Clear messages if deselecting
  if (!action.payload) {
    // Optionally keep messages in cache
  }
},
```

---

#### 2.5.5 Hook Updates

**Add to `use-communications.ts`:**

```typescript
// Select channel with auto-fetch
const selectChannel = useCallback(async (channel: Channel | null) => {
  dispatch(setSelectedChannel(channel))
  
  if (channel) {
    // Persist selection
    if (typeof window !== 'undefined') {
      localStorage.setItem('comm_last_channel', channel.id)
    }
    
    // Fetch messages with fresh data (bypass cache on refresh)
    await fetchMessages({ 
      channel_id: channel.id, 
      force: true // Add this param to force fresh fetch
    })
  }
}, [dispatch, fetchMessages])

// Get last selected channel from storage
const getPersistedChannelId = useCallback((): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('comm_last_channel')
}, [])

// Clear persisted channel
const clearPersistedChannel = useCallback(() => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('comm_last_channel')
  }
}, [])
```

---

#### 2.5.6 Handle Fresh Data on Refresh

**Ensure `fetchMessages` always gets fresh data:**

```typescript
// In use-communications.ts

const fetchMessages = useCallback(async (params: {
  channel_id: string
  limit?: number
  force?: boolean // Add this
}) => {
  try {
    dispatch(setMessagesLoading(true))
    
    // Clear existing messages for this channel if force refresh
    if (params.force) {
      dispatch(clearMessagesForChannel({ channelId: params.channel_id }))
    }
    
    const response = await fetch(
      `/api/communication/messages?channel_id=${params.channel_id}&limit=${params.limit || 50}`
    )
    
    const data = await response.json()
    
    dispatch(setMessages({
      channelId: params.channel_id,
      messages: data.messages
    }))
    
  } catch (error) {
    console.error('Failed to fetch messages:', error)
  } finally {
    dispatch(setMessagesLoading(false))
  }
}, [dispatch])
```

---

#### 2.5.7 Realtime Subscription on Channel Select

**Ensure realtime is connected when channel is restored:**

```typescript
// In use-communications.ts useEffect

useEffect(() => {
  if (selectedChannel && sessionUserId) {
    // Connect to realtime for this channel
    subscribeToChannel(selectedChannel.id)
    
    return () => {
      // Cleanup when channel changes
      unsubscribeFromChannel(selectedChannel.id)
    }
  }
}, [selectedChannel?.id, sessionUserId])
```

---

#### 2.5.8 Browser Back/Forward Navigation

**Handle browser history correctly:**

```tsx
// In CommunicationPage component

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

export function CommunicationPage({ initialChannelId }: Props) {
  const params = useParams()
  const channelIdFromUrl = params?.channelId as string | undefined
  
  // React to URL changes (back/forward navigation)
  useEffect(() => {
    if (channelIdFromUrl && channelIdFromUrl !== selectedChannel?.id) {
      const channel = channels.find(c => c.id === channelIdFromUrl)
      if (channel) {
        selectChannel(channel)
      }
    } else if (!channelIdFromUrl && selectedChannel) {
      // Navigated to /communications (no channel)
      selectChannel(null)
    }
  }, [channelIdFromUrl, channels])
  
  // ... rest of component
}
```

---

#### 2.5.9 Summary Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PAGE REFRESH / INITIAL LOAD                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. User navigates to /communications/[channelId] or refreshes page    │
│                          │                                              │
│                          ▼                                              │
│  2. Component mounts with initialChannelId from URL                     │
│                          │                                              │
│                          ▼                                              │
│  3. fetchChannels() - Get all user's channels                          │
│                          │                                              │
│                          ▼                                              │
│  4. If channelId exists:                                               │
│     - Find channel in list                                             │
│     - setSelectedChannel(channel)                                       │
│     - fetchMessages({ channel_id, force: true })                       │
│     - subscribeToChannel(channelId) - Connect realtime                 │
│                          │                                              │
│                          ▼                                              │
│  5. Display channel list + chat window with fresh messages             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Channel Management & UI Enhancements (Priority: HIGH)

**Estimated Time: 4-5 days**

This phase focuses on essential channel management features, notification system, and responsive sidebar improvements for a professional chat experience.

---

### 3.1 Channel Settings - Archive & Pin

**Features:**
- Archive/Unarchive channels from settings
- Pin/Unpin important channels (appear at top)
- Channel settings modal with all management options

---

#### 3.1.1 Schema Updates for Pinned Channels

**Update `prisma/schema.prisma`:**

```prisma
model channel_members {
  // ... existing fields
  
  // Pin channel for this user
  is_pinned     Boolean   @default(false)
  pinned_at     DateTime?
  
  // Notification preferences per channel
  mute_until    DateTime?
  notification_level  String  @default("all")  // 'all' | 'mentions' | 'none'
}

model channels {
  // ... existing fields
  
  // Archive fields (if not already present)
  is_archived      Boolean   @default(false)
  archived_at      DateTime?
  archived_by      String?
}
```

---

#### 3.1.2 API Routes for Pin/Archive

**Create `app/api/communication/channels/[channelId]/pin/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// POST /api/communication/channels/[channelId]/pin - Toggle pin status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params
  const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Find current membership
  const membership = await prisma.channel_members.findFirst({
    where: {
      channel_id: channelId,
      mongo_member_id: userId
    }
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  // Toggle pin status
  const updatedMembership = await prisma.channel_members.update({
    where: { id: membership.id },
    data: {
      is_pinned: !membership.is_pinned,
      pinned_at: !membership.is_pinned ? new Date() : null
    }
  })

  return NextResponse.json({
    success: true,
    is_pinned: updatedMembership.is_pinned,
    message: updatedMembership.is_pinned ? 'Channel pinned' : 'Channel unpinned'
  })
}
```

**Archive API already exists in Phase 2 - reuse or extend:**

```typescript
// PATCH /api/communication/channels/[channelId]
// Body: { action: 'archive' | 'unarchive' }
```

---

#### 3.1.3 Channel Settings Modal Component

```tsx
// components/communication/channel-settings-modal.tsx

'use client'

import { useState } from 'react'
import { useCommunications } from '@/hooks/use-communications'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Button, Switch, Label, Separator, Input, Avatar
} from '@/components/ui'
import { Pin, Archive, Bell, BellOff, Trash2, Camera, Users, Settings } from 'lucide-react'

interface ChannelSettingsModalProps {
  channel: IChannel
  isAdmin: boolean
  onClose: () => void
}

export function ChannelSettingsModal({ channel, isAdmin, onClose }: ChannelSettingsModalProps) {
  const { 
    pinChannel, 
    archiveChannel, 
    updateChannelSettings,
    updateNotificationSettings 
  } = useCommunications()

  const [notificationLevel, setNotificationLevel] = useState<'all' | 'mentions' | 'none'>('all')
  const [isPinned, setIsPinned] = useState(channel.is_pinned || false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleTogglePin = async () => {
    setIsUpdating(true)
    await pinChannel(channel.id)
    setIsPinned(!isPinned)
    setIsUpdating(false)
  }

  const handleArchive = async () => {
    await archiveChannel(channel.id, channel.is_archived ? 'unarchive' : 'archive')
    onClose()
  }

  const handleNotificationChange = async (level: 'all' | 'mentions' | 'none') => {
    setNotificationLevel(level)
    await updateNotificationSettings(channel.id, { notification_level: level })
  }

  return (
   Use the CustomModal component for this one 
  )
}
```

---

#### 3.1.4 Hook Functions for Channel Settings

**Add to `hooks/use-communications.ts`:**

```typescript
// Pin/Unpin channel
const pinChannel = useCallback(async (channelId: string) => {
  try {
    const response = await fetch(`/api/communication/channels/${channelId}/pin`, {
      method: 'POST'
    })
    
    if (!response.ok) throw new Error('Failed to update pin status')
    
    const data = await response.json()
    
    // Update local state
    dispatch(updateChannelPinStatus({ channelId, is_pinned: data.is_pinned }))
    
    toast({
      title: data.is_pinned ? 'Channel pinned' : 'Channel unpinned'
    })
    
    return data.is_pinned
  } catch (error) {
    toast({ title: 'Failed to update pin status', variant: 'destructive' })
    return null
  }
}, [dispatch, toast])

// Archive/Unarchive channel
const archiveChannel = useCallback(async (
  channelId: string, 
  action: 'archive' | 'unarchive'
) => {
  try {
    const response = await fetch(`/api/communication/channels/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    
    if (!response.ok) throw new Error('Failed to update archive status')
    
    dispatch(updateChannelArchiveStatus({ 
      channelId, 
      is_archived: action === 'archive' 
    }))
    
    toast({
      title: action === 'archive' ? 'Channel archived' : 'Channel unarchived'
    })
  } catch (error) {
    toast({ title: 'Failed to update channel', variant: 'destructive' })
  }
}, [dispatch, toast])

// Update notification settings
const updateNotificationSettings = useCallback(async (
  channelId: string,
  settings: { notification_level?: 'all' | 'mentions' | 'none'; mute_until?: Date | null }
) => {
  try {
    const response = await fetch(`/api/communication/channels/${channelId}/notifications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    
    if (!response.ok) throw new Error('Failed to update notifications')
    
    dispatch(updateChannelNotifications({ channelId, ...settings }))
    
    toast({ title: 'Notification settings updated' })
  } catch (error) {
    toast({ title: 'Failed to update settings', variant: 'destructive' })
  }
}, [dispatch, toast])
```

---

#### 3.1.5 Redux Slice Updates

**Add to `store/slices/communicationSlice.ts`:**

```typescript
// Reducers
updateChannelPinStatus: (state, action: PayloadAction<{
  channelId: string
  is_pinned: boolean
}>) => {
  const { channelId, is_pinned } = action.payload
  const channel = state.channels.find(c => c.id === channelId)
  if (channel) {
    channel.is_pinned = is_pinned
    channel.pinned_at = is_pinned ? new Date().toISOString() : null
  }
  
  // Re-sort channels to move pinned to top
  state.channels.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.last_message_at || b.created_at).getTime() - 
           new Date(a.last_message_at || a.created_at).getTime()
  })
},

updateChannelArchiveStatus: (state, action: PayloadAction<{
  channelId: string
  is_archived: boolean
}>) => {
  const { channelId, is_archived } = action.payload
  const channel = state.channels.find(c => c.id === channelId)
  if (channel) {
    channel.is_archived = is_archived
    channel.archived_at = is_archived ? new Date().toISOString() : null
  }
},

updateChannelNotifications: (state, action: PayloadAction<{
  channelId: string
  notification_level?: 'all' | 'mentions' | 'none'
  mute_until?: Date | null
}>) => {
  const { channelId, notification_level, mute_until } = action.payload
  const channel = state.channels.find(c => c.id === channelId)
  if (channel) {
    if (notification_level) channel.notification_level = notification_level
    if (mute_until !== undefined) channel.mute_until = mute_until
  }
},
```

---

#### 3.1.6 Channel List with Pinned Channels

**Update `components/communication/channel-list.tsx`:**

```tsx
// Sort channels with pinned first
const sortedChannels = useMemo(() => {
  return [...filteredChannels].sort((a, b) => {
    // Pinned channels first
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    
    // Then by last message time
    const aTime = new Date(a.last_message_at || a.created_at).getTime()
    const bTime = new Date(b.last_message_at || b.created_at).getTime()
    return bTime - aTime
  })
}, [filteredChannels])

// In channel item render
{channel.is_pinned && (
  <Pin className="h-3 w-3 text-primary absolute top-2 right-2" />
)}

{channel.is_archived && (
  <Badge variant="secondary" className="text-xs">
    <Archive className="h-3 w-3 mr-1" />
    Archived
  </Badge>
)}
```

---

### 3.2 Chat Filters & Search (Flask Button)

**Features:**
- Filter by channel type (DM, Group, Project, etc.)
- Filter by unread messages
- Filter by date range
- Advanced search with flask button trigger

---

#### 3.2.1 Filter Panel Component

```tsx
// components/communication/chat-filters.tsx

'use client'

import { useState, useCallback } from 'react'
import {
  Popover, PopoverContent, PopoverTrigger,
  Button, Label, Switch, Separator,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  DatePicker
} from '@/components/ui'
import { Filter, X, Search, MessageSquare, Users, Briefcase, HeadphonesIcon } from 'lucide-react'

interface ChatFiltersProps {
  onFiltersChange: (filters: ChatFilterState) => void
  currentFilters: ChatFilterState
}

export interface ChatFilterState {
  type: 'all' | 'dm' | 'group' | 'project' | 'client-support'
  unreadOnly: boolean
  hasAttachments: boolean
  dateRange: {
    from?: Date
    to?: Date
  } | null
  searchQuery: string
}

const defaultFilters: ChatFilterState = {
  type: 'all',
  unreadOnly: false,
  hasAttachments: false,
  dateRange: null,
  searchQuery: ''
}

export function ChatFilters({ onFiltersChange, currentFilters }: ChatFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<ChatFilterState>(currentFilters)

  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === 'type') return value !== 'all'
    if (key === 'searchQuery') return value !== ''
    if (key === 'dateRange') return value !== null
    return value === true
  }).length

  const handleApply = useCallback(() => {
    onFiltersChange(localFilters)
    setIsOpen(false)
  }, [localFilters, onFiltersChange])

  const handleClear = useCallback(() => {
    setLocalFilters(defaultFilters)
    onFiltersChange(defaultFilters)
  }, [onFiltersChange])

  const channelTypes = [
    { value: 'all', label: 'All Channels', icon: MessageSquare },
    { value: 'dm', label: 'Direct Messages', icon: MessageSquare },
    { value: 'group', label: 'Group Chats', icon: Users },
    { value: 'project', label: 'Project Channels', icon: Briefcase },
    { value: 'client-support', label: 'Client Support', icon: HeadphonesIcon },
  ]

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={activeFilterCount > 0 ? 'default' : 'outline'} 
          size="sm"
          className="relative"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-4" align="start">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold">Filter Chats</h4>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>

        <div className="space-y-4">
          {/* Search within filters */}
          <div>
            <Label className="text-sm font-medium">Search</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search messages, channels..."
                value={localFilters.searchQuery}
                onChange={(e) => setLocalFilters(prev => ({ 
                  ...prev, 
                  searchQuery: e.target.value 
                }))}
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Channel Type */}
          <div>
            <Label className="text-sm font-medium">Channel Type</Label>
            <Select
              value={localFilters.type}
              onValueChange={(value: any) => setLocalFilters(prev => ({ 
                ...prev, 
                type: value 
              }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channelTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Toggle Filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Unread Only</Label>
              <Switch
                checked={localFilters.unreadOnly}
                onCheckedChange={(checked) => setLocalFilters(prev => ({ 
                  ...prev, 
                  unreadOnly: checked 
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Has Attachments</Label>
              <Switch
                checked={localFilters.hasAttachments}
                onCheckedChange={(checked) => setLocalFilters(prev => ({ 
                  ...prev, 
                  hasAttachments: checked 
                }))}
              />
            </div>
          </div>

          <Separator />

          {/* Date Range */}
          <div>
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <DatePicker
                placeholder="From"
                value={localFilters.dateRange?.from}
                onChange={(date) => setLocalFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, from: date }
                }))}
              />
              <DatePicker
                placeholder="To"
                value={localFilters.dateRange?.to}
                onChange={(date) => setLocalFilters(prev => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, to: date }
                }))}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

---

#### 3.2.2 Integrate Filters in Communication Sidebar

**Update `components/communication/communication-sidebar.tsx`:**

```tsx
import { ChatFilters, ChatFilterState } from './chat-filters'

// In component
const [filters, setFilters] = useState<ChatFilterState>(defaultFilters)

// Filter channels based on current filters
const filteredChannels = useMemo(() => {
  return channels.filter(channel => {
    // Type filter
    if (filters.type !== 'all' && channel.type !== filters.type) return false
    
    // Unread filter
    if (filters.unreadOnly && !channel.unread_count) return false
    
    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const matchesName = channel.name?.toLowerCase().includes(query)
      const matchesLastMessage = channel.last_message?.content?.toLowerCase().includes(query)
      if (!matchesName && !matchesLastMessage) return false
    }
    
    // Date range filter
    if (filters.dateRange) {
      const lastMessageDate = new Date(channel.last_message_at || channel.created_at)
      if (filters.dateRange.from && lastMessageDate < filters.dateRange.from) return false
      if (filters.dateRange.to && lastMessageDate > filters.dateRange.to) return false
    }
    
    return true
  })
}, [channels, filters])

// In JSX header
<div className="flex items-center gap-2">
  <ChatFilters 
    currentFilters={filters} 
    onFiltersChange={setFilters} 
  />
  {/* Search input */}
</div>
```

---

### 3.3 Real-time Message Notifications (Header)

**Features:**
- Notification bell icon in header with unread count badge
- Real-time updates via Supabase
- Dropdown with recent notifications
- Click to navigate to message/channel
- Mark as read functionality

---

#### 3.3.1 Notification Store (Redux)

**Add to `store/slices/communicationSlice.ts`:**

```typescript
interface MessageNotification {
  id: string
  type: 'message' | 'mention' | 'reaction' | 'channel_invite'
  channel_id: string
  channel_name: string
  message_id?: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
  content_preview: string // First 100 chars
  created_at: string
  read: boolean
}

interface CommunicationState {
  // ... existing fields
  
  // Notifications
  notifications: MessageNotification[]
  unreadNotificationCount: number
  notificationSettings: {
    enabled: boolean
    sound: boolean
    desktop: boolean
    showPreviews: boolean
  }
}

// Reducers
addNotification: (state, action: PayloadAction<MessageNotification>) => {
  // Add to beginning (newest first)
  state.notifications.unshift(action.payload)
  
  // Keep only last 50 notifications
  if (state.notifications.length > 50) {
    state.notifications = state.notifications.slice(0, 50)
  }
  
  // Update unread count
  if (!action.payload.read) {
    state.unreadNotificationCount++
  }
},

markNotificationRead: (state, action: PayloadAction<string>) => {
  const notification = state.notifications.find(n => n.id === action.payload)
  if (notification && !notification.read) {
    notification.read = true
    state.unreadNotificationCount = Math.max(0, state.unreadNotificationCount - 1)
  }
},

markAllNotificationsRead: (state) => {
  state.notifications.forEach(n => n.read = true)
  state.unreadNotificationCount = 0
},

clearNotifications: (state) => {
  state.notifications = []
  state.unreadNotificationCount = 0
},

setNotificationSettings: (state, action: PayloadAction<Partial<CommunicationState['notificationSettings']>>) => {
  state.notificationSettings = { ...state.notificationSettings, ...action.payload }
},
```

---

#### 3.3.2 Message Notification Component (Header)

**Create `components/communication/message-notification.tsx`:**

```tsx
'use client'

import { memo, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppSelector, useAppDispatch } from '@/hooks/redux'
import { 
  markNotificationRead, 
  markAllNotificationsRead 
} from '@/store/slices/communicationSlice'
import {
  Popover, PopoverContent, PopoverTrigger,
  Button, Badge, ScrollArea, Separator, Avatar
} from '@/components/ui'
import { Bell, MessageSquare, AtSign, Heart, UserPlus, Check, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface MessageNotificationProps {
  className?: string
}

export const MessageNotification = memo(function MessageNotification({ 
  className 
}: MessageNotificationProps) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  
  const notifications = useAppSelector(state => state.communications.notifications)
  const unreadCount = useAppSelector(state => state.communications.unreadNotificationCount)
  const notificationSettings = useAppSelector(state => state.communications.notificationSettings)

  // Request browser notification permission
  useEffect(() => {
    if (notificationSettings.desktop && 'Notification' in window) {
      Notification.requestPermission()
    }
  }, [notificationSettings.desktop])

  const handleNotificationClick = useCallback((notification: MessageNotification) => {
    // Mark as read
    dispatch(markNotificationRead(notification.id))
    
    // Navigate to channel/message
    router.push(`/communications/${notification.channel_id}${
      notification.message_id ? `?messageId=${notification.message_id}` : ''
    }`)
  }, [dispatch, router])

  const handleMarkAllRead = useCallback(() => {
    dispatch(markAllNotificationsRead())
  }, [dispatch])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign className="h-4 w-4 text-blue-500" />
      case 'reaction': return <Heart className="h-4 w-4 text-pink-500" />
      case 'channel_invite': return <UserPlus className="h-4 w-4 text-green-500" />
      default: return <MessageSquare className="h-4 w-4 text-primary" />
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("relative", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleMarkAllRead}
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Sender Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    {notification.sender_avatar ? (
                      <img src={notification.sender_avatar} alt="" />
                    ) : (
                      <div className="bg-primary text-primary-foreground h-full w-full flex items-center justify-center text-sm font-semibold">
                        {notification.sender_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getNotificationIcon(notification.type)}
                      <span className="font-medium text-sm truncate">
                        {notification.sender_name}
                      </span>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.content_preview}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>#{notification.channel_name}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="p-2">
          <Button 
            variant="ghost" 
            className="w-full justify-center text-sm"
            onClick={() => router.push('/communications')}
          >
            View all messages
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
})
```

---

#### 3.3.3 Integrate in Header

**Update `components/layout/header.tsx`:**

```tsx
import { MessageNotification } from '@/components/communication/message-notification'

// In the header JSX, add before user profile dropdown
<div className="flex items-center justify-end space-x-2 lg:space-x-4">
  <ThemeToggle />
  
  {/* Message Notifications */}
  <MessageNotification className="h-8 w-8 lg:h-9 lg:w-9" />

  {/* User Profile Dropdown */}
  <DropdownMenu>
    {/* ... existing content */}
  </DropdownMenu>
</div>
```

---

#### 3.3.4 Realtime Notification Handler

**Add to `hooks/use-communications.ts`:**

```typescript
// Handle incoming message notifications
const handleIncomingMessage = useCallback((message: ICommunication) => {
  // Don't notify for own messages
  if (message.mongo_sender_id === sessionUserId) return
  
  // Don't notify if channel is currently active
  if (message.channel_id === activeChannelId) return
  
  // Get channel info for notification
  const channel = channels.find(c => c.id === message.channel_id)
  if (!channel) return
  
  // Check notification settings
  const channelNotificationLevel = channel.notification_level || 'all'
  if (channelNotificationLevel === 'none') return
  
  // Check for mentions
  const isMentioned = message.content.includes(`@${sessionUserName}`) || 
                      message.content.includes('@everyone')
  
  if (channelNotificationLevel === 'mentions' && !isMentioned) return
  
  // Create notification
  const notification: MessageNotification = {
    id: crypto.randomUUID(),
    type: isMentioned ? 'mention' : 'message',
    channel_id: message.channel_id,
    channel_name: channel.name || 'Direct Message',
    message_id: message.id,
    sender_id: message.mongo_sender_id,
    sender_name: message.sender?.name || 'Unknown',
    sender_avatar: message.sender?.avatar,
    content_preview: message.content.substring(0, 100),
    created_at: new Date().toISOString(),
    read: false
  }
  
  dispatch(addNotification(notification))
  
  // Play notification sound
  if (notificationSettings.sound) {
    playNotificationSound()
  }
  
  // Show desktop notification
  if (notificationSettings.desktop && 'Notification' in window && 
      Notification.permission === 'granted') {
    new Notification(notification.sender_name, {
      body: notification.content_preview,
      icon: notification.sender_avatar || '/notification-icon.png',
      tag: notification.id
    })
  }
}, [sessionUserId, activeChannelId, channels, dispatch, notificationSettings])

// Helper function for notification sound
const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {}) // Ignore autoplay errors
  } catch (e) {
    // Audio not supported
  }
}
```

---

### 3.4 Notification Settings

**Features:**
- Toggle notifications on/off globally
- Sound notifications toggle
- Desktop notifications toggle
- Show message previews toggle
- Per-channel notification settings (in channel settings modal)

---

#### 3.4.1 Notification Settings Component

**Create `components/communication/notification-settings.tsx`:**

```tsx
'use client'

import { useState } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/redux'
import { setNotificationSettings } from '@/store/slices/communicationSlice'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Switch, Label, Separator
} from '@/components/ui'
import { Bell, Volume2, Monitor, Eye } from 'lucide-react'

export function NotificationSettings() {
  const dispatch = useAppDispatch()
  const settings = useAppSelector(state => state.communications.notificationSettings)

  const handleToggle = (key: keyof typeof settings) => {
    dispatch(setNotificationSettings({ [key]: !settings[key] }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure how you receive notifications for messages
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications for new messages
              </p>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={() => handleToggle('enabled')}
          />
        </div>

        <Separator />

        {/* Sound Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Sound Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Play a sound when receiving messages
              </p>
            </div>
          </div>
          <Switch
            checked={settings.sound}
            onCheckedChange={() => handleToggle('sound')}
            disabled={!settings.enabled}
          />
        </div>

        {/* Desktop Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications even when browser is minimized
              </p>
            </div>
          </div>
          <Switch
            checked={settings.desktop}
            onCheckedChange={() => handleToggle('desktop')}
            disabled={!settings.enabled}
          />
        </div>

        {/* Message Previews */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Show Message Previews</Label>
              <p className="text-sm text-muted-foreground">
                Display message content in notifications
              </p>
            </div>
          </div>
          <Switch
            checked={settings.showPreviews}
            onCheckedChange={() => handleToggle('showPreviews')}
            disabled={!settings.enabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### 3.5 Responsive Sidebar Width (Min/Max)

**Features:**
- Resizable sidebar on large screens (min: 280px, max: 400px)
- Drag handle for horizontal resize
- 100% width on mobile with channel/chat toggle
- Persist sidebar width preference in localStorage

---

#### 3.5.1 Resizable Sidebar Component

**Update `components/communication/communication-sidebar.tsx`:**

```tsx
'use client'

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-mobile'
import { GripVertical } from 'lucide-react'

const MIN_WIDTH = 280
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 320
const STORAGE_KEY = 'comm_sidebar_width'

interface CommunicationSidebarProps {
  channels: IChannel[]
  activeChannelId?: string | null
  currentUserId: string
  onlineUserIds?: string[]
  onChannelSelect: (channelId: string) => void
  onCreateChannel?: () => void
  loading?: boolean
  className?: string
  onClose?: () => void // For mobile: close sidebar when channel selected
}

export const CommunicationSidebar = memo(function CommunicationSidebar({
  channels,
  activeChannelId,
  currentUserId,
  onlineUserIds = [],
  onChannelSelect,
  onCreateChannel,
  loading = false,
  className,
  onClose
}: CommunicationSidebarProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  // Sidebar width state (only for desktop)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? parseInt(saved, 10) : DEFAULT_WIDTH
    }
    return DEFAULT_WIDTH
  })
  
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Persist width to localStorage
  useEffect(() => {
    if (!isMobile && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, sidebarWidth.toString())
    }
  }, [sidebarWidth, isMobile])

  // Handle resize start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return
    
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth
    
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [isMobile, sidebarWidth])

  // Handle resize
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + deltaX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Handle channel selection (close sidebar on mobile)
  const handleChannelSelect = useCallback((channelId: string) => {
    onChannelSelect(channelId)
    if (isMobile && onClose) {
      onClose()
    }
  }, [onChannelSelect, isMobile, onClose])

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "flex flex-col h-full bg-card border-r relative",
        // Mobile: full width, fixed positioning
        isMobile && "w-full fixed inset-0 z-50",
        // Desktop: dynamic width
        !isMobile && "flex-shrink-0",
        className
      )}
      style={{ 
        width: isMobile ? '100%' : `${sidebarWidth}px`,
        minWidth: isMobile ? '100%' : `${MIN_WIDTH}px`,
        maxWidth: isMobile ? '100%' : `${MAX_WIDTH}px`
      }}
    >
      {/* Mobile Header with Close Button */}
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <div className="pl-4 pr-10 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Messages</h2>
            {onCreateChannel && (
              <Button variant="ghost" size="sm" onClick={onCreateChannel}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Channel List Content */}
      <ScrollArea className="flex-1">
        {loading ? (
          <ChannelListSkeleton />
        ) : (
          <div className="pt-2 pr-0 pl-0 space-y-2">
            {/* User Directory */}
            <Collapsible defaultOpen>
              {/* ... existing UserDirectory content */}
            </Collapsible>

            <Separator />

            {/* Channel List */}
            <Collapsible defaultOpen>
              {/* ... existing ChannelList content */}
            </Collapsible>
          </div>
        )}
      </ScrollArea>

      {/* Resize Handle (Desktop Only) */}
      {!isMobile && (
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize",
            "hover:bg-primary/20 transition-colors",
            "group flex items-center justify-center",
            isResizing && "bg-primary/30"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className={cn(
            "absolute right-0 w-4 h-12 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isResizing && "opacity-100"
          )}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  )
})
```

---

#### 3.5.2 Mobile View Toggle (Show Sidebar or Chat)

**Update `app/communications/page.tsx` or wrapper component:**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useMediaQuery } from '@/hooks/use-mobile'
import { CommunicationSidebar } from '@/components/communication/communication-sidebar'
import { ChatWindow } from '@/components/communication/chat-window'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MessageSquare } from 'lucide-react'

export function CommunicationPage() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [showSidebar, setShowSidebar] = useState(true)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)

  const handleChannelSelect = useCallback((channelId: string) => {
    setSelectedChannelId(channelId)
    if (isMobile) {
      setShowSidebar(false) // Show chat on mobile when channel selected
    }
  }, [isMobile])

  const handleBackToList = useCallback(() => {
    setShowSidebar(true)
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar - Always visible on desktop, toggleable on mobile */}
      {(!isMobile || showSidebar) && (
        <CommunicationSidebar
          channels={channels}
          activeChannelId={selectedChannelId}
          currentUserId={currentUserId}
          onChannelSelect={handleChannelSelect}
          onClose={() => setShowSidebar(false)}
        />
      )}

      {/* Chat Window - Always visible on desktop, toggleable on mobile */}
      {(!isMobile || !showSidebar) && (
        <div className="flex-1 flex flex-col">
          {/* Mobile Back Button */}
          {isMobile && selectedChannelId && (
            <div className="flex items-center gap-2 p-4 border-b">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium">Back to channels</span>
            </div>
          )}

          {selectedChannelId ? (
            <ChatWindow 
              channelId={selectedChannelId}
              onToggleSidebar={() => setShowSidebar(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose from your channels to start chatting</p>
                {isMobile && (
                  <Button 
                    className="mt-4" 
                    onClick={() => setShowSidebar(true)}
                  >
                    View Channels
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

#### 3.5.3 CSS Transitions for Smooth Resize

**Add to `globals.css`:**

```css
/* Smooth sidebar resize transition */
.sidebar-resizing {
  transition: width 0ms !important;
}

/* Animation for mobile sidebar slide */
@media (max-width: 768px) {
  .comm-sidebar-enter {
    transform: translateX(-100%);
    animation: slideIn 200ms ease-out forwards;
  }

  .comm-sidebar-exit {
    animation: slideOut 200ms ease-in forwards;
  }

  @keyframes slideIn {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }

  @keyframes slideOut {
    from { transform: translateX(0); }
    to { transform: translateX(-100%); }
  }
}
```

---

### 3.6 Implementation Checklist

| Feature | Schema | API | Hook | Component | Redux | Status |
|---------|--------|-----|------|-----------|-------|--------|
| **Pin Channel** | ✅ | ✅ | ✅ | ✅ | ✅ | Ready |
| **Archive Channel** | ✅ | ✅ (Phase 2) | ✅ | ✅ | ✅ | Ready |
| **Channel Settings Modal** | - | - | - | ✅ | - | Ready |
| **Chat Filters** | - | - | - | ✅ | ✅ | Ready |
| **Message Notifications** | ✅ | - | ✅ | ✅ | ✅ | Ready |
| **Notification Settings** | - | - | - | ✅ | ✅ | Ready |
| **Responsive Sidebar** | - | - | - | ✅ | - | Ready |
| **Mobile View Toggle** | - | - | - | ✅ | - | Ready |

---

### 3.7 Files to Create/Update

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Update | Add is_pinned, pinned_at to channel_members |
| `app/api/communication/channels/[channelId]/pin/route.ts` | Create | Pin/unpin endpoint |
| `app/api/communication/channels/[channelId]/notifications/route.ts` | Create | Notification settings endpoint |
| `components/communication/channel-settings-modal.tsx` | Create | Full settings modal |
| `components/communication/chat-filters.tsx` | Create | Filter panel component |
| `components/communication/message-notification.tsx` | Create | Header notification dropdown |
| `components/communication/notification-settings.tsx` | Create | Settings UI |
| `components/communication/communication-sidebar.tsx` | Update | Resizable + mobile support |
| `components/layout/header.tsx` | Update | Add MessageNotification |
| `store/slices/communicationSlice.ts` | Update | Add notification state & actions |
| `hooks/use-communications.ts` | Update | Add pin, archive, notification handlers |
| `public/sounds/notification.mp3` | Create | Notification sound file |

---

## Phase 4: Loading & Error States (Priority: HIGH)

**Estimated Time: 2-3 days**

### 4.1 Comprehensive Loading Skeletons

#### 4.1.1 Channel List Skeleton

```tsx
// components/communication/channel-list-skeleton.tsx
export function ChannelListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

#### 4.1.2 Message List Skeleton

```tsx
export function MessageListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Simulate alternating sent/received messages */}
      <MessageBubbleSkeleton align="left" />
      <MessageBubbleSkeleton align="right" />
      <MessageBubbleSkeleton align="left" long />
      <MessageBubbleSkeleton align="right" />
    </div>
  )
}

function MessageBubbleSkeleton({ align, long = false }) {
  return (
    <div className={cn("flex gap-2", align === "right" && "flex-row-reverse")}>
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className={cn("max-w-[70%]", align === "right" && "items-end")}>
        <Skeleton className={cn("h-16 rounded-lg", long ? "w-80" : "w-48")} />
        <Skeleton className="h-3 w-12 mt-1" />
      </div>
    </div>
  )
}
```

### 4.2 Granular Loading States

Add more specific loading states to Redux:

```typescript
interface CommunicationState {
  // Replace single 'loading' with granular states
  loadingStates: {
    channels: 'idle' | 'loading' | 'success' | 'error'
    messages: 'idle' | 'loading' | 'success' | 'error'
    sendMessage: 'idle' | 'loading' | 'success' | 'error'
    members: 'idle' | 'loading' | 'success' | 'error'
  }
  errors: {
    channels?: string
    messages?: string
    sendMessage?: string
  }
}
```

### 4.3 Error Boundaries

```tsx
// components/communication/chat-error-boundary.tsx
class ChatErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">Failed to load chat</p>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### 4.4 Empty States

```tsx
// No channels
<EmptyState
  icon={<MessageSquare />}
  title="No conversations yet"
  description="Start a new conversation or join a channel"
  action={<Button onClick={onCreateChannel}>Start Chatting</Button>}
/>

// No messages in channel
<EmptyState
  icon={<MessageCircle />}
  title="No messages yet"
  description="Be the first to send a message"
/>

// No search results
<EmptyState
  icon={<Search />}
  title="No messages found"
  description={`No messages matching "${query}"`}
/>
```

---

## Phase 5: Cache & Data Management (Priority: MEDIUM-HIGH)

**Estimated Time: 3-4 days**

### 5.1 Implement React Query (TanStack Query)

**Why:** Better caching, background refetching, stale data handling

#### 5.1.1 Install Dependencies

```bash
pnpm add @tanstack/react-query
```

#### 5.1.2 Query Provider Setup

```tsx
// app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      gcTime: 1000 * 60 * 30,    // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 2
    }
  }
})
```

#### 5.1.3 Channels Query

```typescript
// hooks/use-channels-query.ts
export function useChannelsQuery() {
  const { data: session } = useSession()
  
  return useQuery({
    queryKey: ['channels', session?.user?.id],
    queryFn: () => apiRequest('/api/communication/channels'),
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 2,  // 2 minutes
  })
}
```

#### 5.1.4 Messages Query with Infinite Scroll

```typescript
export function useMessagesQuery(channelId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', channelId],
    queryFn: ({ pageParam = 0 }) => 
      apiRequest(`/api/communication/messages?channel_id=${channelId}&offset=${pageParam}&limit=50`),
    getNextPageParam: (lastPage, pages) => 
      lastPage.data.length === 50 ? pages.length * 50 : undefined,
    enabled: !!channelId,
    staleTime: 1000 * 60,
  })
}
```

#### 5.1.5 Optimistic Updates with Mutations

```typescript
export function useSendMessage() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateMessageData) => 
      apiRequest('/api/communication/messages', { method: 'POST', body: JSON.stringify(data) }),
    
    onMutate: async (newMessage) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', newMessage.channel_id] })
      
      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(['messages', newMessage.channel_id])
      
      // Optimistically add message
      queryClient.setQueryData(['messages', newMessage.channel_id], (old: any) => ({
        ...old,
        pages: [
          ...old.pages,
          { data: [...(old.pages.at(-1)?.data || []), { ...newMessage, id: 'temp', isOptimistic: true }] }
        ]
      }))
      
      return { previousMessages }
    },
    
    onError: (err, newMessage, context) => {
      // Rollback on error
      queryClient.setQueryData(['messages', newMessage.channel_id], context.previousMessages)
    },
    
    onSettled: (data, error, variables) => {
      // Refetch to sync
      queryClient.invalidateQueries({ queryKey: ['messages', variables.channel_id] })
    }
  })
}
```

### 5.2 Background Sync & Refetching

```typescript
// Refetch messages when window regains focus (after being hidden)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && activeChannelId) {
      queryClient.invalidateQueries({ queryKey: ['messages', activeChannelId] })
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [activeChannelId])
```

### 5.3 Local Storage Persistence (Optional)

```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'communication-cache'
})

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24  // 24 hours
})
```

---

## Phase 6: Reconnection & Reliability (Priority: HIGH)

**Estimated Time: 2-3 days**

### 6.1 Connection State Management

```typescript
// lib/realtime-manager.ts - Add connection state
class RealtimeManager {
  private connectionState: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000  // Start with 1s, exponential backoff

  getConnectionState() {
    return this.connectionState
  }

  // Add to Redux state
  // connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
}
```

### 6.2 Automatic Reconnection

```typescript
// In RealtimeManager
private setupReconnection() {
  // Listen for Supabase connection events
  supabase.realtime.on('disconnect', () => {
    this.connectionState = 'disconnected'
    this.eventHandlers.onConnectionChange?.('disconnected')
    this.attemptReconnect()
  })
  
  supabase.realtime.on('connected', () => {
    this.connectionState = 'connected'
    this.reconnectAttempts = 0
    this.eventHandlers.onConnectionChange?.('connected')
    
    // Re-subscribe to all channels
    this.resubscribeAll()
  })
}

private async attemptReconnect() {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    this.eventHandlers.onReconnectFailed?.()
    return
  }
  
  this.connectionState = 'reconnecting'
  this.eventHandlers.onConnectionChange?.('reconnecting')
  
  const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
  await sleep(delay)
  
  this.reconnectAttempts++
  
  try {
    await supabase.realtime.connect()
  } catch (e) {
    this.attemptReconnect()
  }
}

private async resubscribeAll() {
  // Re-subscribe to presence
  if (this.currentUserId) {
    await this.initializePresence(this.currentUserId, this.currentUserName!, this.currentUserAvatar)
  }
  
  // Re-subscribe to all channels
  for (const channelId of this.rtChannels.keys()) {
    await this.subscribeToChannel(channelId)
  }
}
```

### 6.3 Offline Banner UI

```tsx
// components/communication/connection-status.tsx
export function ConnectionStatus() {
  const connectionStatus = useAppSelector(s => s.communications.connectionStatus)
  
  if (connectionStatus === 'connected') return null
  
  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 p-2 text-center text-sm z-50",
      connectionStatus === 'disconnected' && "bg-destructive text-destructive-foreground",
      connectionStatus === 'reconnecting' && "bg-warning text-warning-foreground"
    )}>
      {connectionStatus === 'disconnected' && (
        <>
          <WifiOff className="inline h-4 w-4 mr-2" />
          Connection lost. Messages may not be delivered.
        </>
      )}
      {connectionStatus === 'reconnecting' && (
        <>
          <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
          Reconnecting...
        </>
      )}
    </div>
  )
}
```

### 6.4 Queue Messages When Offline

```typescript
// Store pending messages when offline
const pendingMessages = new Map<string, CreateMessageData[]>()

const sendMessage = async (data: CreateMessageData) => {
  if (connectionStatus === 'disconnected') {
    // Queue message
    const queue = pendingMessages.get(data.channel_id) || []
    queue.push(data)
    pendingMessages.set(data.channel_id, queue)
    
    // Add to UI with 'queued' status
    dispatch(addMessage({
      channelId: data.channel_id,
      message: { ...data, id: crypto.randomUUID(), isQueued: true }
    }))
    
    return
  }
  
  // Normal send logic
}

// On reconnection
const flushPendingMessages = async () => {
  for (const [channelId, messages] of pendingMessages) {
    for (const msg of messages) {
      await sendMessage(msg)
    }
  }
  pendingMessages.clear()
}
```

---

## Phase 7: Performance Optimizations (Priority: MEDIUM)

**Estimated Time: 3-4 days**

### 7.1 Virtualized Message List

**Why:** Render only visible messages for large conversations

```bash
pnpm add @tanstack/react-virtual
```

```tsx
// components/communication/virtualized-message-list.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualizedMessageList({ messages }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,  // Estimated message height
    overscan: 5,  // Render 5 extra items above/below viewport
  })
  
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <MessageBubble message={messages[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 7.2 Memo Optimization

```tsx
// Memoize heavy components
export const MessageBubble = memo(function MessageBubble({ message, ...props }) {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if message changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.reactions?.length === nextProps.message.reactions?.length &&
    prevProps.message.read_receipts?.length === nextProps.message.read_receipts?.length
  )
})
```

### 7.3 Lazy Load Heavy Components

```tsx
// Lazy load attachment viewer, emoji picker, etc.
const AttachmentViewer = lazy(() => import('./attachment-viewer'))
const EmojiPicker = lazy(() => import('./emoji-picker'))

// In component
<Suspense fallback={<Skeleton className="h-8 w-8" />}>
  <EmojiPicker />
</Suspense>
```

### 7.4 Debounce Search

Already implemented but ensure debounce time is optimal:

```typescript
const SEARCH_DEBOUNCE_MS = 300  // 300ms is good UX
```

### 7.5 Reduce Re-renders

```typescript
// Use selectors to prevent unnecessary re-renders
const selectChannelMessages = createSelector(
  [(state) => state.communications.messages, (_, channelId) => channelId],
  (messages, channelId) => messages[channelId] || []
)

// In component
const messages = useAppSelector(state => selectChannelMessages(state, channelId))
```

---

## Phase 8: Missing Features (Priority: MEDIUM)

**Estimated Time: 4-5 days**

### 8.1 Message Forwarding

```typescript
// New API endpoint
POST /api/communication/messages/forward
Body: {
  message_id: string,
  target_channel_ids: string[]
}

// UI: "Forward" in message menu
// Opens channel picker modal
```

### 8.2 Pin Messages

```prisma
// Schema addition
model pinned_messages {
  id          String   @id @default(uuid())
  message_id  String
  channel_id  String
  pinned_by   String
  pinned_at   DateTime @default(now())
  
  @@unique([channel_id, message_id])
}
```

### 8.3 Message Threading (Expand)

Current implementation has basic replies. Enhance:

```typescript
// View all replies in a slide-over panel
// Thread view with dedicated input
// Thread participant avatars
```

### 8.4 User Mentions with Autocomplete

Already implemented but improve:
- Show user status (online/offline) in picker
- Sort by recent interactions
- Add @everyone / @channel support

### 8.5 Link Previews

```typescript
// When message contains URL, fetch metadata
// Show preview card with title, description, image
// Cache link previews server-side
```

### 8.6 Starred Messages

```prisma
model starred_messages {
  id         String   @id @default(uuid())
  message_id String
  user_id    String
  starred_at DateTime @default(now())
  
  @@unique([message_id, user_id])
}
```

### 8.7 Channel Settings

- Edit channel name/description
- Change channel avatar
- Manage notification preferences
- Mute channel

---

## Phase 9: Schema & Normalization Review (Priority: MEDIUM)

**Estimated Time: 2-3 days**

### 9.1 Unused/Redundant Fields

| Field | Location | Status | Action |
|-------|----------|--------|--------|
| `is_online` | channel_members | Redundant | Use Supabase presence instead |
| `last_seen_at` | channel_members | Unused | Remove or implement |
| `thread_id` | messages | Partially used | Implement full threading or remove |
| `avatar_url` | channels | Rarely used | Keep for group avatars |

### 9.2 Missing Indexes

```prisma
model messages {
  // Add composite index for faster queries
  @@index([channel_id, created_at])
  @@index([mongo_sender_id])
}

model channel_members {
  @@index([mongo_member_id])
}
```

### 9.3 Consider Additional Denormalization

For channels, consider storing:
- `last_message_preview` (first 100 chars)
- `last_message_sender_name`

This avoids join for channel list display.

### 9.4 Message Content Search Index

For PostgreSQL full-text search:

```prisma
model messages {
  // Add text search configuration
  @@index([content], type: Gin, ops: raw("gin_trgm_ops"))
}
```

Or use Supabase's full-text search capabilities.

---

## Phase 10: Security Enhancements (Priority: HIGH)

**Estimated Time: 2 days**

### 10.1 Rate Limiting

Already have basic rate limiting. Enhance:

```typescript
// Per-action limits
const rateLimits = {
  sendMessage: { max: 30, window: '1m' },
  createChannel: { max: 5, window: '1m' },
  addReaction: { max: 60, window: '1m' },
}
```

### 10.2 Content Sanitization

Ensure TipTap output is sanitized:

```typescript
import DOMPurify from 'dompurify'

const sanitizedContent = DOMPurify.sanitize(htmlContent, {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
  ALLOWED_ATTR: ['href', 'target', 'rel']
})
```

### 10.3 File Upload Validation

```typescript
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // etc.
]

const MAX_FILE_SIZE = 25 * 1024 * 1024  // 25MB

// Validate on both client and server
```

### 10.4 Audit Logging

Log sensitive actions:
- Channel creation/deletion
- Member additions/removals
- Message deletions (soft delete with audit trail)

---

## Phase 11: Testing & Monitoring (Priority: MEDIUM)

**Estimated Time: 3-4 days**

### 11.1 Unit Tests

```typescript
// __tests__/communication/use-communications.test.ts
describe('useCommunications', () => {
  it('sends message optimistically', async () => { })
  it('handles send failure gracefully', async () => { })
  it('updates read receipts in real-time', async () => { })
})
```

### 11.2 Integration Tests

```typescript
// Test real-time flow
describe('Real-time messaging', () => {
  it('broadcasts message to other users', async () => { })
  it('updates typing indicators', async () => { })
  it('syncs presence state', async () => { })
})
```

### 11.3 Error Monitoring

```typescript
// Integrate Sentry or similar
import * as Sentry from '@sentry/nextjs'

try {
  await sendMessage(data)
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'communication' },
    extra: { channelId, userId }
  })
}
```

### 11.4 Performance Monitoring

```typescript
// Track key metrics
const metrics = {
  messageLatency: [],      // Time from send to receive
  presenceSyncTime: [],    // Time to sync presence
  channelLoadTime: [],     // Time to load channel list
}
```

---

## Implementation Priority Matrix

| Phase | Priority | Effort | Impact | Recommended Order |
|-------|----------|--------|--------|-------------------|
| Phase 1: Bug Fixes | URGENT | Low | High | 1st |
| Phase 2: Message Lifecycle | HIGH | Medium | High | 2nd |
| Phase 3: Channel Management & UI | HIGH | Medium | High | 3rd |
| Phase 4: Loading States | HIGH | Medium | Medium | 4th |
| Phase 6: Reconnection | HIGH | Medium | High | 5th |
| Phase 10: Security | HIGH | Low | High | 6th |
| Phase 5: Cache/React Query | MEDIUM-HIGH | High | High | 7th |
| Phase 7: Performance | MEDIUM | Medium | Medium | 8th |
| Phase 8: Missing Features | MEDIUM | High | Medium | 9th |
| Phase 9: Schema Review | MEDIUM | Low | Medium | 10th |
| Phase 11: Testing | MEDIUM | High | High | Ongoing |

---

## Quick Wins (Do First)

1. ✅ Fix pagination limits (5 minutes)
2. ✅ Remove debug console.logs (30 minutes)
3. ✅ Add loading skeletons (2 hours)
4. ✅ Implement message delete (4 hours)
5. ✅ Add connection status banner (2 hours)
6. ✅ Add empty states (1 hour)
7. ✅ Pin/Archive channel toggles (2 hours)
8. ✅ Add message notification bell in header (3 hours)
9. ✅ Add chat filters panel (3 hours)
10. ✅ Responsive sidebar with resize handle (4 hours)

---

## Appendix: Code Cleanup Checklist

### Files Requiring Attention

- [ ] `hooks/use-communications.ts` - Remove console.logs, fix dependencies
- [ ] `store/slices/communicationSlice.ts` - Unify isOnline/is_online
- [ ] `app/api/communication/messages/search/route.ts` - Remove debug code
- [ ] `components/communication/chat-window.tsx` - Remove console.log line 79
- [ ] `components/communication/channel-list.tsx` - Remove console.log line 57

### New Files to Create (Phase 3)

- [ ] `components/communication/channel-settings-modal.tsx` - Full settings modal
- [ ] `components/communication/chat-filters.tsx` - Filter panel component  
- [ ] `components/communication/message-notification.tsx` - Header notification dropdown
- [ ] `components/communication/notification-settings.tsx` - Settings UI
- [ ] `app/api/communication/channels/[channelId]/pin/route.ts` - Pin/unpin endpoint
- [ ] `app/api/communication/channels/[channelId]/notifications/route.ts` - Notification settings endpoint
- [ ] `public/sounds/notification.mp3` - Notification sound file

### Files to Update (Phase 3)

- [ ] `prisma/schema.prisma` - Add is_pinned, pinned_at to channel_members
- [ ] `components/communication/communication-sidebar.tsx` - Resizable + mobile support
- [ ] `components/layout/header.tsx` - Add MessageNotification component
- [ ] `store/slices/communicationSlice.ts` - Add notification state & actions
- [ ] `hooks/use-communications.ts` - Add pin, archive, notification handlers

### Environment Variables to Add

```env
# Feature flags
NEXT_PUBLIC_ENABLE_MESSAGE_REACTIONS=true
NEXT_PUBLIC_ENABLE_FILE_ATTACHMENTS=true
NEXT_PUBLIC_MAX_FILE_SIZE_MB=25

# Performance
NEXT_PUBLIC_MESSAGE_BATCH_SIZE=50
NEXT_PUBLIC_TYPING_THROTTLE_MS=2000
```

---

*Roadmap created: December 2024*
*Target completion: Follow phase order based on team capacity*
