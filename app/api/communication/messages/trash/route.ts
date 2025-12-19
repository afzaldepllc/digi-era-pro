import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from '@/lib/utils/api-responses'
import { getClientInfo } from '@/lib/security/error-handler'
import { apiLogger as logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schema for query params
const trashQuerySchema = z.object({
  channelId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
})

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
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

// GET /api/communication/messages/trash - Get trashed messages for current user
export async function GET(request: NextRequest) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const userId = session.user.id

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      channelId: searchParams.get('channelId') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20'
    }

    // Validate
    const validationResult = trashQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return createErrorResponse('Invalid query parameters', 400, validationResult.error.errors)
    }

    const { channelId, page, limit } = validationResult.data

    // Build where clause - only user's own trashed messages
    const where: any = {
      mongo_sender_id: userId,
      is_trashed: true
    }

    if (channelId) {
      where.channel_id = channelId
    }

    // Get messages with channel info
    // Note: Type assertions needed until `prisma generate` is run after migration
    const [messages, total] = await Promise.all([
      prisma.messages.findMany({
        where,
        orderBy: { trashed_at: 'desc' } as any, // Type assertion for new field
        skip: (page - 1) * limit,
        take: limit,
        include: {
          channels: {
            select: { id: true, name: true, type: true }
          },
          attachments: {
            select: { id: true, file_name: true, file_type: true }
          }
        }
      }),
      prisma.messages.count({ where })
    ])

    // Type for messages with trash fields
    type MessageWithTrash = typeof messages[0] & {
      trashed_at?: Date | null
      trashed_by?: string | null
      trash_reason?: string | null
      channels: { id: string; name: string | null; type: string }
    }

    // Calculate remaining days for each message and transform
    const now = new Date()
    const messagesWithExpiry = (messages as MessageWithTrash[]).map(msg => {
      const trashedAt = new Date(msg.trashed_at || now)
      const daysSinceTrashed = Math.floor((now.getTime() - trashedAt.getTime()) / (1000 * 60 * 60 * 24))
      const daysRemaining = Math.max(0, 30 - daysSinceTrashed)
      const expiresAt = new Date(trashedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const transformed = transformMessageWithSender(msg)
      
      return {
        ...transformed,
        trashed_at: msg.trashed_at?.toISOString() || now.toISOString(),
        trashed_by: msg.trashed_by || '',
        trash_reason: msg.trash_reason,
        days_remaining: daysRemaining,
        expires_at: expiresAt.toISOString(),
        is_expiring_soon: daysRemaining <= 7,
        channel: msg.channels
      }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: messagesWithExpiry,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    })

  } catch (error: any) {
    logger.error('Error fetching trashed messages:', error)
    return createAPIErrorResponse('Failed to fetch trashed messages', 500, undefined, getClientInfo(request))
  }
}
