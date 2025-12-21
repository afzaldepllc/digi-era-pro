import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { updateMessageSchema, messageIdSchema } from "@/lib/validations/channel"
import { SecurityUtils } from '@/lib/security/validation'
import { getClientInfo } from '@/lib/security/error-handler'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from "@/lib/utils/api-responses"
import { apiLogger as logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'
import { executeGenericDbQuery } from '@/lib/mongodb'
import MessageAuditLog from '@/models/MessageAuditLog'
import mongoose from 'mongoose'

// Delete types for the trash system
type DeleteType = 'trash' | 'self' | 'permanent'

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

// Type for messages with trash fields (until prisma generate is run)
type MessageWithTrash = {
  id: string
  channel_id: string
  mongo_sender_id: string
  content: string
  is_trashed?: boolean
  trashed_at?: Date | null
  trashed_by?: string | null
  trash_reason?: string | null
  hidden_by_users?: string[]
  original_content?: string | null
  sender_name: string
  sender_email: string
  created_at: Date
}

// PUT /api/communication/messages/[messageId] - Update message
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ messageId: string }> }
) {
  try {
    const params = await paramsPromise
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Validate message ID
    const validatedParams = messageIdSchema.parse(params)

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateMessageSchema.parse(body)

    // Check if user owns the message
    const message = await prisma.messages.findUnique({
      where: { id: validatedParams.messageId },
    })

    if (!message) {
      return createErrorResponse('Message not found', 404)
    }

    if (message.mongo_sender_id !== session.user.id && !isSuperAdmin) {
      return createErrorResponse('Access denied - you can only edit your own messages', 403)
    }

    // Update message using messageOperations
    const updatedMessage = await messageOperations.update(validatedParams.messageId, validatedData.content)

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      message: 'Message updated successfully'
    })
  } catch (error: any) {
    logger.error('Error updating message:', error)
    return createAPIErrorResponse('Failed to update message', 500, undefined, getClientInfo(request))
  }
}

// DELETE /api/communication/messages/[messageId] - Trash or hide message
// Query params:
//   - deleteType: 'trash' (default) | 'self' | 'permanent'
//   - reason: optional reason for trashing
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ messageId: string }> }
) {
  try {
    const params = await paramsPromise
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Validate message ID
    const validatedParams = messageIdSchema.parse(params)
    const messageId = validatedParams.messageId

    // Parse query params for delete type and reason
    const searchParams = request.nextUrl.searchParams
    const deleteType = (searchParams.get('deleteType') || 'trash') as DeleteType
    const reason = searchParams.get('reason') || ''

    // Fetch the message
    const messageRaw = await prisma.messages.findUnique({
      where: { id: messageId },
    })

    if (!messageRaw) {
      return createErrorResponse('Message not found', 404)
    }

    // Type assertion for trash fields (until prisma generate runs after migration)
    const message = messageRaw as unknown as MessageWithTrash

    // Check if already trashed (for trash operation)
    if (deleteType === 'trash' && message.is_trashed) {
      return createErrorResponse('Message is already in trash', 400)
    }

    const userId = session.user.id
    const isOwner = message.mongo_sender_id === userId

    // Permission check - only owner or admin can trash/delete
    if (!isOwner && !isSuperAdmin) {
      return createErrorResponse('You can only delete your own messages', 403)
    }

    // "Hide for Me" - just add user to hidden_by_users array
    if (deleteType === 'self') {
      // Check if already hidden for this user
      const hiddenUsers = message.hidden_by_users || []
      if (hiddenUsers.includes(userId)) {
        return createErrorResponse('Message is already hidden', 400)
      }

      await prisma.messages.update({
        where: { id: messageId },
        data: {
          hidden_by_users: {
            push: userId
          }
        } as any // Type assertion for new field
      })

      // Broadcast hide event (only to the user who hid it - via notifications channel)
      await broadcastMessageEvent(message.channel_id, 'message_hidden', {
        messageId,
        channelId: message.channel_id,
        hiddenBy: userId
      })

      return NextResponse.json({ 
        success: true, 
        deleteType: 'self',
        message: 'Message hidden successfully'
      })
    }

    // "Move to Trash" - can be restored within 30 days
    if (deleteType === 'trash') {
      await prisma.messages.update({
        where: { id: messageId },
        data: {
          is_trashed: true,
          trashed_at: new Date(),
          trashed_by: userId,
          trash_reason: reason || null,
          original_content: message.content // Preserve for restoration
        } as any // Type assertion for new fields
      })

      // Create audit log in MongoDB (for compliance)
      await executeGenericDbQuery(async () => {
        return await MessageAuditLog.create({
          supabase_message_id: messageId,
          supabase_channel_id: message.channel_id,
          action: 'trashed',
          actor_id: new mongoose.Types.ObjectId(userId),
          actor_name: (session.user as any).name || 'Unknown',
          actor_email: (session.user as any).email || '',
          actor_role: isSuperAdmin ? 'super_admin' : 'user',
          previous_content: message.content,
          metadata: {
            trash_reason: reason || undefined,
            message_created_at: message.created_at,
            sender_mongo_id: message.mongo_sender_id,
            sender_name: message.sender_name,
            sender_email: message.sender_email
          }
        })
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

    // "Permanent Delete" - only for super admins or already trashed messages
    if (deleteType === 'permanent') {
      if (!isSuperAdmin && !message.is_trashed) {
        return createErrorResponse('Only trashed messages can be permanently deleted', 403)
      }

      // Create final audit log before permanent deletion
      await executeGenericDbQuery(async () => {
        return await MessageAuditLog.create({
          supabase_message_id: messageId,
          supabase_channel_id: message.channel_id,
          action: 'permanently_deleted',
          actor_id: new mongoose.Types.ObjectId(userId),
          actor_name: (session.user as any).name || 'Unknown',
          actor_email: (session.user as any).email || '',
          actor_role: isSuperAdmin ? 'super_admin' : 'user',
          previous_content: message.original_content || message.content,
          metadata: {
            trashed_at: message.trashed_at,
            trashed_by: message.trashed_by,
            trash_reason: message.trash_reason,
            message_created_at: message.created_at,
            sender_mongo_id: message.mongo_sender_id,
            sender_name: message.sender_name,
            sender_email: message.sender_email
          }
        })
      })

      // Delete message permanently (cascade deletes reactions, attachments, etc.)
      await messageOperations.delete(messageId)

      // Broadcast permanent deletion
      await broadcastMessageEvent(message.channel_id, 'message_deleted', {
        messageId,
        channelId: message.channel_id,
        deletedBy: userId
      })

      return NextResponse.json({
        success: true,
        deleteType: 'permanent',
        message: 'Message permanently deleted'
      })
    }

    return createErrorResponse('Invalid delete type', 400)
  } catch (error: any) {
    logger.error('Error deleting message:', error)
    return createAPIErrorResponse('Failed to delete message', 500, undefined, getClientInfo(request))
  }
}
