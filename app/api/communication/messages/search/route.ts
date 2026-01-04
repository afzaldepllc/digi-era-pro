import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { z } from 'zod'
import { apiLogger as logger } from '@/lib/logger'
// Phase 2: Use centralized services from Phase 1
import { channelOps } from '@/lib/communication/operations'

// Search query validation
const searchQuerySchema = z.object({
  channel_id: z.string().uuid(),
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
})

// Helper to create error responses
function createErrorResponse(message: string, status: number) {
  return NextResponse.json({
    success: false,
    error: message
  }, { status })
}

/**
 * Transform a message with denormalized sender fields to include sender object.
 */
function transformMessageWithSender(message: any) {
  if (!message || typeof message !== 'object') {
    return null
  }

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

// GET /api/communication/messages/search?channel_id=...&query=...
export async function GET(request: NextRequest) {
  try {
    // Apply middleware (rate limiting + authentication + permissions)
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      channel_id: searchParams.get('channel_id') || '',
      query: searchParams.get('query') || '',
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    }

    logger.debug('[Search API] Raw query params:', {
      channel_id: searchParams.get('channel_id'),
      query: searchParams.get('query'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset')
    })

    // Validate
    const validatedParams = searchQuerySchema.parse(queryParams)
    
    logger.debug('[Search API] Validated params:', validatedParams)

    // Check if user is member of the channel
    const isMember = await channelOps.isMember(validatedParams.channel_id, session.user.id)
    if (!isMember) {
      return createErrorResponse('Access denied to this channel', 403)
    }

    // First, let's get ALL messages for this channel to debug
    const allMessages = await prisma.messages.findMany({
      where: { channel_id: validatedParams.channel_id },
      take: 10,
      orderBy: { created_at: 'desc' },
      select: { id: true, content: true }
    })
    logger.debug('[Search API] Sample messages in channel:', allMessages.map(m => ({ id: m.id, content: m.content?.substring(0, 100) })))
    logger.debug('[Search API] Searching for query:', JSON.stringify(validatedParams.query))

    // Search messages using raw SQL for case-insensitive substring search (ILIKE)
    const messages = await prisma.$queryRaw<any[]>`
      SELECT m.*,
        COALESCE(json_agg(DISTINCT r) FILTER (WHERE r.id IS NOT NULL), '[]'::json) as read_receipts,
        COALESCE(json_agg(DISTINCT a) FILTER (WHERE a.id IS NOT NULL), '[]'::json) as attachments
      FROM messages m
      LEFT JOIN read_receipts r ON r.message_id = m.id
      LEFT JOIN attachments a ON a.message_id = m.id
      WHERE m.channel_id = ${validatedParams.channel_id}
      AND m.content ILIKE ${'%' + validatedParams.query + '%'}
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT ${validatedParams.limit}
      OFFSET ${validatedParams.offset}
    `
    
    logger.debug('[Search API] Found messages count:', messages.length)
    if (messages.length > 0) {
      logger.debug('[Search API] First match:', messages[0].content?.substring(0, 100))
    }

    // Get total count for pagination using raw SQL
    const totalResult = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM messages
      WHERE channel_id = ${validatedParams.channel_id}
      AND content ILIKE ${'%' + validatedParams.query + '%'}
    `
    const totalCount = parseInt(totalResult[0].count)

    // Transform messages (no need to parse, as json_agg returns arrays)
    const transformedMessages = messages.map(msg => transformMessageWithSender(msg)).filter(Boolean)

    return NextResponse.json({
      success: true,
      data: transformedMessages,
      meta: {
        total: totalCount,
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        query: validatedParams.query,
        hasMore: validatedParams.offset + messages.length < totalCount
      }
    })
  } catch (error: any) {
    logger.error('Error searching messages:', error)
    
    if (error.name === 'ZodError') {
      return createErrorResponse('Invalid search parameters', 400)
    }
    
    return createErrorResponse('Failed to search messages', 500)
  }
}
