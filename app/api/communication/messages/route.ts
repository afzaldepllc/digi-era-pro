import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { createMessageSchema, messageQuerySchema } from "@/lib/validations/channel"
import { SecurityUtils } from '@/lib/security/validation'
import { getClientInfo } from '@/lib/security/error-handler'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createAPIErrorResponse } from "@/lib/utils/api-responses"


// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
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

    return NextResponse.json({
      success: true,
      data: messages.reverse(), // Reverse to show oldest first
      meta: {
        total: messages.length,
        limit: validatedParams.limit,
        offset: validatedParams.offset
      }
    })
  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return createAPIErrorResponse(error, 'Failed to fetch messages', getClientInfo(request))
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

    // Create the message (with optional reply support)
    const message = await messageOperations.create({
      channel_id: validatedData.channel_id,
      mongo_sender_id: session.user.id,
      content: validatedData.content,
      content_type: validatedData.content_type,
      thread_id: validatedData.thread_id,
      parent_message_id: validatedData.parent_message_id, // For replies
      mongo_mentioned_user_ids: validatedData.mongo_mentioned_user_ids,
    })

    // Update channel's last_message_at
    await prisma.channels.update({
      where: { id: validatedData.channel_id },
      data: { last_message_at: new Date() },
    })

    // Fetch complete message with relations
    const completeMessage = await prisma.messages.findUnique({
      where: { id: message.id },
      include: {
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: completeMessage,
      message: 'Message sent successfully'
    })
  } catch (error: any) {
    console.error('Error sending message:', error)
    return createAPIErrorResponse(error, 'Failed to send message', getClientInfo(request))
  }
}