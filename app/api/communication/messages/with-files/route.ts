/**
 * Messages with Files API Route - CONSOLIDATED (Phase 2)
 * 
 * Uses centralized services from Phase 1:
 * - channelOps.isMember() for membership checks
 * - broadcastNewMessage, broadcastToChannel from broadcast.ts
 */
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { S3Service } from '@/lib/services/s3-service'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { apiLogger as logger } from '@/lib/logger'
// Phase 2: Use centralized services from Phase 1
import { channelOps } from '@/lib/communication/operations'
import { broadcastNewMessage, broadcastToChannel, broadcastToUser } from '@/lib/communication/broadcast'

// ============================================
// Type Definitions
// ============================================

interface ISenderData {
  mongo_member_id: string
  name: string
  email: string
  avatar: string
  role: string
  userType: 'User' | 'Client'
  isOnline: boolean
}

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

function createErrorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  }, { status })
}

function extractRoleName(role: unknown): string {
  if (!role) return 'User'
  if (typeof role === 'string') return role
  if (typeof role === 'object' && role !== null) {
    const roleObj = role as { name?: string }
    if (roleObj.name && typeof roleObj.name === 'string') {
      return roleObj.name
    }
  }
  return 'User'
}

function transformMessageWithSender(message: Record<string, unknown>) {
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
  }
}

// ============================================
// POST /api/communication/messages/with-files - Send message with file attachments
// ============================================
export async function POST(request: NextRequest) {
  try {
    const { session, user, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'create')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Parse form data
    const formData = await request.formData()
    const channelId = formData.get('channel_id') as string
    const content = formData.get('content') as string || ''
    const contentType = (formData.get('content_type') as string) || 'text'
    const threadId = formData.get('thread_id') as string | null
    const parentMessageId = formData.get('parent_message_id') as string | null
    const mentionedUserIds = formData.get('mongo_mentioned_user_ids') as string | null
    const files = formData.getAll('files') as File[]

    // Parse mentioned user IDs
    let parsedMentionedUserIds: string[] = []
    if (mentionedUserIds) {
      try {
        parsedMentionedUserIds = JSON.parse(mentionedUserIds)
      } catch {
        // If not JSON, try comma-separated
        parsedMentionedUserIds = mentionedUserIds.split(',').map(id => id.trim()).filter(Boolean)
      }
    }

    // Validate
    if (!channelId) {
      return createErrorResponse('channel_id is required', 400)
    }

    if (!content.trim() && files.length === 0) {
      return createErrorResponse('Message must have content or at least one file', 400)
    }

    // Check if user is member of the channel
    const isMember = await channelOps.isMember(channelId, session.user.id)
    if (!isMember) {
      return createErrorResponse('Access denied to this channel', 403)
    }

    // Use sender info from middleware (already fetched from MongoDB)
    const senderData = user

    const senderName: string = String(senderData?.name || senderData?.email || 'Unknown User')
    const senderEmail: string = String(senderData?.email || '')
    const senderAvatar: string | undefined = senderData?.avatar ? String(senderData.avatar) : undefined
    const senderRole: string = extractRoleName(senderData?.role)

    // Create the message first
    const message = await messageOperations.create({
      channel_id: channelId,
      mongo_sender_id: session.user.id,
      content: content,
      content_type: files.length > 0 ? 'file' : contentType,
      thread_id: threadId || undefined,
      parent_message_id: parentMessageId || undefined,
      mongo_mentioned_user_ids: parsedMentionedUserIds,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_avatar: senderAvatar,
      sender_role: senderRole,
    })

    // Update channel's last_message_at
    await prisma.channels.update({
      where: { id: channelId },
      data: { last_message_at: new Date() },
    })

    // Transform message with sender (attachments will be added later)
    const messageWithSender = {
      ...transformMessageWithSender(message),
      attachments: [] // Empty initially
    }

    // Send response immediately for fast user experience
    const response = NextResponse.json({
      success: true,
      data: messageWithSender,
      message: files.length > 0 ? 'Message sent, uploading files...' : 'Message sent successfully'
    })

    // Upload files asynchronously if any
    if (files.length > 0) {
      setImmediate(async () => {
        const uploadedAttachments = []
        const uploadErrors: string[] = []

        for (const file of files) {
          try {
            if (file.size > 25 * 1024 * 1024) {
              uploadErrors.push(`${file.name}: File too large (max 25MB)`)
              continue
            }

            const buffer = Buffer.from(await file.arrayBuffer())

            const uploadResult = await S3Service.uploadFile({
              file: buffer,
              fileName: file.name,
              contentType: file.type,
              fileType: 'CHAT_ATTACHMENTS',
              userId: session.user.id,
              metadata: {
                channelId,
                messageId: message.id,
                uploadSource: 'chat-inline'
              }
            })

            if (!uploadResult.success || !uploadResult.data) {
              uploadErrors.push(`${file.name}: ${uploadResult.error || 'Upload failed'}`)
              continue
            }

            const attachment = await prisma.attachments.create({
              data: {
                message_id: message.id,
                channel_id: channelId,
                mongo_uploader_id: session.user.id,
                file_name: file.name,
                file_url: uploadResult.data.url,
                s3_key: uploadResult.data.key,
                s3_bucket: process.env.AWS_S3_BUCKET_NAME,
                file_size: uploadResult.data.size,
                file_type: uploadResult.data.contentType
              }
            })

            uploadedAttachments.push({
              id: attachment.id,
              message_id: attachment.message_id,
              file_name: attachment.file_name,
              file_url: attachment.file_url,
              s3_key: attachment.s3_key,
              file_size: attachment.file_size,
              file_type: attachment.file_type,
              created_at: attachment.created_at.toISOString()
            })
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            uploadErrors.push(`${file.name}: ${errorMessage}`)
          }
        }

        // Broadcast message update with attachments using Phase 1 service
        broadcastToChannel({
          channelId,
          event: 'attachments_added',
          payload: {
            messageId: message.id,
            attachments: uploadedAttachments,
            uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined
          }
        }).catch(err => logger.error('Failed to broadcast attachments update:', err))
      })
    }

    // Broadcast asynchronously (fire-and-forget for performance)
    setImmediate(async () => {
      try {
        // Broadcast using Phase 1 service
        await broadcastNewMessage(channelId, messageWithSender)
        logger.debug('Message with attachments broadcasted to channel:', channelId)

        // Broadcast mention notifications using Phase 1 service
        if (parsedMentionedUserIds.length > 0) {
          const mentionPromises = parsedMentionedUserIds.map((mentionedUserId) =>
            broadcastToUser({
              userId: mentionedUserId,
              event: 'mention_notification',
              payload: {
                type: 'mention',
                message_id: message.id,
                channel_id: channelId,
                sender_name: senderName,
                sender_avatar: senderAvatar,
                content_preview: content.slice(0, 100),
                has_attachments: files.length > 0,
                created_at: message.created_at
              }
            })
          )
          await Promise.all(mentionPromises)
        }
      } catch (broadcastError) {
        logger.error('Failed to broadcast message:', broadcastError)
      }
    })

    return response

  } catch (error: unknown) {
    logger.error('Error sending message with files:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
    return createErrorResponse(errorMessage, 500)
  }
}
