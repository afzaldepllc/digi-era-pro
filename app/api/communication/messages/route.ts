import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { createMessageSchema, messageQuerySchema } from "@/lib/validations/channel"
import { getClientInfo } from '@/lib/security/error-handler'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from "@/lib/utils/api-responses"
import { createClient } from '@supabase/supabase-js'
import { executeGenericDbQuery } from '@/lib/mongodb'
import { default as User } from '@/models/User'
import type { IParticipant } from '@/types/communication'

// ============================================
// Type Definitions
// ============================================

/** Sender data structure for messages */
interface ISenderData {
  mongo_member_id: string
  name: string
  email: string
  avatar: string
  role: string
  userType: 'User' | 'Client'
  isOnline: boolean
}

/** Message with sender data included */
interface IMessageWithSender {
  id: string
  channel_id: string
  mongo_sender_id: string
  content: string
  content_type: string
  sender_name: string
  sender_email: string
  sender_avatar?: string
  sender_role: string
  created_at: Date
  sender: ISenderData
  [key: string]: unknown // Allow additional Prisma fields
}

/** MongoDB user document (lean) */
interface IMongoUser {
  _id: string
  name?: string
  email?: string
  avatar?: string
  isClient?: boolean
  role?: string | { name?: string } | unknown
}

// ============================================
// Helper Functions
// ============================================

/** Create consistent error responses */
function createErrorResponse(
  message: string, 
  status: number, 
  details?: Record<string, unknown> | string | null
): NextResponse {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  }, { status })
}

/**
 * Transform a Prisma message to include sender object from denormalized fields.
 * This avoids MongoDB lookups for real-time performance.
 */
function transformMessageWithSender(message: Record<string, unknown>): IMessageWithSender {
  return {
    ...message,
    sender: {
      mongo_member_id: String(message.mongo_sender_id || ''),
      name: String(message.sender_name || 'Unknown User'),
      email: String(message.sender_email || ''),
      avatar: String(message.sender_avatar || ''),
      role: String(message.sender_role || 'User'),
      userType: 'User' as const,
      isOnline: false,
    }
  } as IMessageWithSender
}

/**
 * Extract role name from MongoDB role field.
 * Handles: string, ObjectId, or populated {name: string} object
 */
function extractRoleName(role: unknown): string {
  if (!role) return 'User'
  
  if (typeof role === 'string') {
    return role
  }
  
  if (typeof role === 'object' && role !== null) {
    // Populated role object with name field
    const roleObj = role as { name?: string }
    if (roleObj.name && typeof roleObj.name === 'string') {
      return roleObj.name
    }
  }
  
  // ObjectId or unknown - default to 'User'
  return 'User'
}

// GET /api/communication/messages?channel_id=... - Get messages for a channel
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters properly
    const queryParams = {
      channel_id: searchParams.get('channel_id') || '',
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    }

    // Convert and validate parameters
    const parsedParams = {
      channel_id: queryParams.channel_id,
      limit: parseInt(queryParams.limit),
      offset: parseInt(queryParams.offset),
    }

    const validatedParams = messageQuerySchema.parse(parsedParams)

    // Check if user is member of the channel
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: validatedParams.channel_id,
        mongo_member_id: session.user.id,
      },
    })

    if (!membership) {
      return createErrorResponse('Access denied to this channel', 403)
    }

    const messages = await messageOperations.getChannelMessages(
      validatedParams.channel_id,
      validatedParams.limit,
      validatedParams.offset
    )

    // Transform messages using denormalized sender fields (NO MongoDB lookup needed!)
    const transformedMessages = messages.map((message: any) => transformMessageWithSender(message))

    return NextResponse.json({
      success: true,
      data: transformedMessages.reverse(), // Reverse to show oldest first
      meta: {
        total: transformedMessages.length,
        limit: validatedParams.limit,
        offset: validatedParams.offset
      }
    })
  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return createAPIErrorResponse('Failed to fetch messages', 500, undefined, getClientInfo(request))
  }
}

// POST /api/communication/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'create')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Create Supabase admin client for broadcasting
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createMessageSchema.parse(body)

    // Check if user is member of the channel
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: validatedData.channel_id,
        mongo_member_id: session.user.id,
      },
    })

    if (!membership) {
      return createErrorResponse('Access denied to this channel', 403)
    }

    // Fetch sender info ONCE from MongoDB (this is the only MongoDB call needed)
    const senderData = await executeGenericDbQuery(async () => {
      return await User.findById(session.user.id)
        .select('_id name email avatar isClient role')
        .populate('role', 'name') // Populate role to get role name if it's a reference
        .lean() as IMongoUser | null
    })

    // Extract sender details for denormalization (ensure all values are strings)
    const senderName: string = String(senderData?.name || senderData?.email || 'Unknown User')
    const senderEmail: string = String(senderData?.email || '')
    const senderAvatar: string | undefined = senderData?.avatar ? String(senderData.avatar) : undefined
    const senderRole: string = extractRoleName(senderData?.role)

    // Create the message with denormalized sender data (no MongoDB call needed on read)
    const message = await messageOperations.create({
      channel_id: validatedData.channel_id,
      mongo_sender_id: session.user.id,
      content: validatedData.content,
      content_type: validatedData.content_type,
      thread_id: validatedData.thread_id,
      parent_message_id: validatedData.parent_message_id,
      mongo_mentioned_user_ids: validatedData.mongo_mentioned_user_ids,
      // Denormalized sender fields - stored directly in Supabase
      sender_name: senderName,
      sender_email: senderEmail,
      sender_avatar: senderAvatar,
      sender_role: senderRole,
    })

    // Update channel's last_message_at
    await prisma.channels.update({
      where: { id: validatedData.channel_id },
      data: { last_message_at: new Date() },
    })

    // Transform message to include sender object (for frontend compatibility)
    const messageWithSender = transformMessageWithSender(message)

    // Broadcast the message with sender data to realtime subscribers
    try {
      const channel = supabaseAdmin.channel(`rt_${validatedData.channel_id}`)
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: messageWithSender
      })
      console.log('📡 Message broadcasted to channel:', validatedData.channel_id)

      // Broadcast mention notifications to mentioned users
      if (validatedData.mongo_mentioned_user_ids && validatedData.mongo_mentioned_user_ids.length > 0) {
        const mentionNotification = {
          type: 'mention',
          message_id: message.id,
          channel_id: validatedData.channel_id,
          sender_name: senderName,
          sender_avatar: senderAvatar,
          content_preview: validatedData.content.replace(/<[^>]*>/g, '').slice(0, 100),
          created_at: message.created_at
        }

        // Broadcast to each mentioned user's personal notification channel
        for (const mentionedUserId of validatedData.mongo_mentioned_user_ids) {
          try {
            const userChannel = supabaseAdmin.channel(`notifications_${mentionedUserId}`)
            await userChannel.send({
              type: 'broadcast',
              event: 'mention_notification',
              payload: mentionNotification
            })
            console.log('📬 Mention notification sent to user:', mentionedUserId)
          } catch (notifError) {
            console.error('Failed to send mention notification to:', mentionedUserId, notifError)
          }
        }
      }
    } catch (broadcastError) {
      console.error('❌ Failed to broadcast message:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({
      success: true,
      data: messageWithSender,
      message: 'Message sent successfully'
    })
  } catch (error: unknown) {
    console.error('Error sending message:', error)
    
    // Extract error details for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Log detailed error for server-side debugging
    console.error('Detailed error:', {
      message: errorMessage,
      stack: errorStack,
      error
    })
    
    // Return error with details in development (stringify for compatibility)
    const isDev = process.env.NODE_ENV === 'development'
    return createAPIErrorResponse(
      `Failed to send message${isDev ? `: ${errorMessage}` : ''}`, 
      500, 
      undefined, 
      getClientInfo(request)
    )
  }
}