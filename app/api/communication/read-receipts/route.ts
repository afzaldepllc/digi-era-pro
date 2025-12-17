import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// POST /api/communication/read-receipts - Mark message as read
export async function POST(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'create')

    const body = await request.json()
    const { message_id, channel_id } = body

    if (!message_id) {
      return NextResponse.json(
        { error: 'Message ID is required' },
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

    // Mark as read
    const receipt = await messageOperations.markAsRead(message_id, session.user.id)

    return NextResponse.json({ receipt })
  } catch (error) {
    console.error('Error marking message as read:', error)
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
    console.error('Error fetching read receipts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}