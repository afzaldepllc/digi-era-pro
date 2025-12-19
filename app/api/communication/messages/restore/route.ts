import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from '@/lib/utils/api-responses'
import { getClientInfo } from '@/lib/security/error-handler'
import { apiLogger as logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'
import { executeGenericDbQuery } from '@/lib/mongodb'
import MessageAuditLog from '@/models/MessageAuditLog'
import mongoose from 'mongoose'
import { z } from 'zod'

// Validation schema
const restoreMessageSchema = z.object({
  messageId: z.string().uuid('Invalid message ID format')
})

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
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
    logger.debug(`Broadcasted ${event} to channel:`, channelId)
  } catch (e) {
    logger.error(`Failed to broadcast ${event}:`, e)
  }
}

/**
 * Transform a Prisma message to include sender object from denormalized fields.
 */
function transformMessageWithSender(message: any) {
  return {
    ...message,
    sender: {
      mongo_member_id: message.mongo_sender_id,
      name: message.sender_name || 'Unknown User',
      email: message.sender_email || '',
      avatar: message.sender_avatar || '',
      role: message.sender_role || 'User',
      userType: 'User' as const,
      isOnline: false,
    }
  }
}

// POST /api/communication/messages/restore - Restore message from trash
export async function POST(request: NextRequest) {
  try {
    const { session, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = restoreMessageSchema.safeParse(body)
    
    if (!validationResult.success) {
      return createErrorResponse('Invalid request body', 400, validationResult.error.errors)
    }

    const { messageId } = validationResult.data

    // Fetch the message
    const message = await prisma.messages.findUnique({
      where: { id: messageId },
      include: {
        channels: {
          select: { id: true, name: true, type: true }
        },
        reactions: true,
        attachments: true,
        read_receipts: true
      }
    })

    if (!message) {
      return createErrorResponse('Message not found', 404)
    }

    // Type assertion for new trash fields (requires `prisma generate` after schema migration)
    const messageWithTrash = message as typeof message & {
      is_trashed?: boolean
      trashed_at?: Date | null
      trashed_by?: string | null
      trash_reason?: string | null
      hidden_by_users?: string[]
      original_content?: string | null
    }

    if (!messageWithTrash.is_trashed) {
      return createErrorResponse('Message is not in trash', 400)
    }

    const userId = session.user.id
    const isOwner = message.mongo_sender_id === userId

    // Permission check - only owner or admin can restore
    if (!isOwner && !isSuperAdmin) {
      return createErrorResponse('You can only restore your own messages', 403)
    }

    // Check 30-day window
    const trashedAt = new Date(messageWithTrash.trashed_at!)
    const now = new Date()
    const daysSinceTrashed = Math.floor((now.getTime() - trashedAt.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceTrashed > 30) {
      return createErrorResponse(
        'Message cannot be restored. It has been in trash for more than 30 days.', 
        400
      )
    }

    // Restore message in Supabase
    const restoredMessage = await prisma.messages.update({
      where: { id: messageId },
      data: {
        is_trashed: false,
        trashed_at: null,
        trashed_by: null,
        trash_reason: null
        // Keep original_content for future reference
      } as any, // Type assertion for new fields
      include: {
        channels: {
          select: { id: true, name: true, type: true }
        },
        reactions: true,
        attachments: true,
        read_receipts: true
      }
    })

    // Create audit log in MongoDB
    await executeGenericDbQuery(async () => {
      return await MessageAuditLog.create({
        supabase_message_id: messageId,
        supabase_channel_id: message.channel_id,
        action: 'restored',
        actor_id: new mongoose.Types.ObjectId(userId),
        actor_name: (session.user as any).name || 'Unknown',
        actor_email: (session.user as any).email || '',
        actor_role: isSuperAdmin ? 'super_admin' : 'user',
        new_content: message.content,
        metadata: {
          days_in_trash: daysSinceTrashed
        }
      })
    })

    // Transform for response
    const transformedMessage = transformMessageWithSender(restoredMessage)

    // Broadcast restoration via Supabase Realtime
    await broadcastMessageEvent(message.channel_id, 'message_restored', {
      messageId,
      channelId: message.channel_id,
      restoredBy: userId,
      message: transformedMessage
    })

    return NextResponse.json({ 
      success: true, 
      data: transformedMessage,
      message: 'Message restored successfully'
    })

  } catch (error: any) {
    logger.error('Error restoring message:', error)
    
    if (error.name === 'ZodError') {
      return createErrorResponse('Invalid request data', 400, error.errors)
    }
    
    return createAPIErrorResponse('Failed to restore message', 500, undefined, getClientInfo(request))
  }
}
