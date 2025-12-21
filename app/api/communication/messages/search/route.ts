import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { z } from 'zod'
import { apiLogger as logger } from '@/lib/logger'

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
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: validatedParams.channel_id,
        mongo_member_id: session.user.id,
      },
    })

    if (!membership) {
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

    // Search messages using PostgreSQL full-text search or ILIKE
    const messages = await prisma.messages.findMany({
      where: {
        channel_id: validatedParams.channel_id,
        content: {
          contains: validatedParams.query,
          mode: 'insensitive'
        }
      },
      orderBy: { created_at: 'desc' },
      take: validatedParams.limit,
      skip: validatedParams.offset,
      include: {
        read_receipts: true,
        attachments: true
      }
    })
    
    logger.debug('[Search API] Found messages count:', messages.length)
    if (messages.length > 0) {
      logger.debug('[Search API] First match:', messages[0].content?.substring(0, 100))
    }

    // Get total count for pagination
    const totalCount = await prisma.messages.count({
      where: {
        channel_id: validatedParams.channel_id,
        content: {
          contains: validatedParams.query,
          mode: 'insensitive'
        }
      }
    })

    // Transform messages
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
