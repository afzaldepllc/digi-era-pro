import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { apiLogger as logger } from '@/lib/logger'
import { createClient } from '@supabase/supabase-js'

// POST /api/communication/read-receipts - Mark message(s) as read
// Supports:
// - Single message: { message_id, channel_id }
// - All channel messages: { channel_id, mark_all: true }
export async function POST(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'create')

    const body = await request.json()
    const { message_id, channel_id, mark_all } = body

    // Validate input
    if (!message_id && !mark_all) {
      return NextResponse.json(
        { error: 'Either message_id or mark_all with channel_id is required' },
        { status: 400 }
      )
    }

    if (mark_all && !channel_id) {
      return NextResponse.json(
        { error: 'channel_id is required when using mark_all' },
        { status: 400 }
      )
    }

    // Check if user is member of the channel
    if (channel_id) {
      const membership = await prisma.channel_members.findFirst({
        where: {
          channel_id,
          mongo_member_id: session.user.id,
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied to this channel' },
          { status: 403 }
        )
      }
    }

    // Mark all unread messages in the channel as read
    if (mark_all && channel_id) {
      // Get all messages in the channel not from the current user that don't have a read receipt
      const unreadMessages = await prisma.messages.findMany({
        where: {
          channel_id,
          mongo_sender_id: { not: session.user.id },
          is_trashed: false,
          read_receipts: {
            none: {
              mongo_user_id: session.user.id
            }
          }
        },
        select: { id: true }
      })

      if (unreadMessages.length === 0) {
        return NextResponse.json({ 
          success: true,
          receipts: [],
          count: 0,
          message: 'No unread messages to mark as read'
        })
      }

      // Create read receipts in bulk
      const readReceiptsData = unreadMessages.map(msg => ({
        message_id: msg.id,
        mongo_user_id: session.user.id,
        read_at: new Date()
      }))

      // Use createMany with skipDuplicates to handle any race conditions
      const result = await prisma.read_receipts.createMany({
        data: readReceiptsData,
        skipDuplicates: true
      })

      logger.debug(`Marked ${result.count} messages as read in channel ${channel_id} for user ${session.user.id}`)

      // Broadcast read receipts to channel members (async, fire-and-forget)
      setImmediate(async () => {
        try {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
          )

          const channel = supabaseAdmin.channel(`rt_${channel_id}`)
          await channel.send({
            type: 'broadcast',
            event: 'bulk_message_read',
            payload: {
              userId: session.user.id,
              channelId: channel_id,
              messageIds: unreadMessages.map(m => m.id),
              readAt: new Date().toISOString()
            }
          })
        } catch (error) {
          logger.error('Failed to broadcast bulk read receipt:', error)
        }
      })

      return NextResponse.json({ 
        success: true,
        count: result.count,
        message: `Marked ${result.count} messages as read`
      })
    }

    // Mark single message as read
    const receipt = await messageOperations.markAsRead(message_id, session.user.id)

    // Broadcast read receipt (async, fire-and-forget)
    if (channel_id) {
      setImmediate(async () => {
        try {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
          )

          const channel = supabaseAdmin.channel(`rt_${channel_id}`)
          await channel.send({
            type: 'broadcast',
            event: 'message_read',
            payload: {
              messageId: message_id,
              userId: session.user.id,
              channelId: channel_id,
              readAt: new Date().toISOString()
            }
          })
        } catch (error) {
          logger.error('Failed to broadcast read receipt:', error)
        }
      })
    }

    return NextResponse.json({ success: true, receipt })
  } catch (error) {
    logger.error('Error marking message as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/communication/read-receipts?message_id=... - Get read receipts for a message
export async function GET(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      )
    }

    // Check if user can access this message
    const message = await prisma.messages.findUnique({
      where: { id: messageId },
      include: {
        channels: {
          include: {
            channel_members: {
              where: { mongo_member_id: session.user.id },
            },
          },
        },
      },
    })

    if (!message || message.channels.channel_members.length === 0) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const receipts = await prisma.read_receipts.findMany({
      where: { message_id: messageId },
      include: {
        // Note: We can't directly join with MongoDB users here
        // The frontend will need to resolve user details separately
      },
    })

    return NextResponse.json({ receipts })
  } catch (error) {
    logger.error('Error fetching read receipts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}