import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { supabase } from '@/lib/supabase'

// GET /api/communication/messages?channel_id=... - Get messages for a channel
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channel_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    // Check if user is member of the channel
    const membership = await prisma.channelMember.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this channel' },
        { status: 403 }
      )
    }

    const messages = await messageOperations.getChannelMessages(channelId, limit, offset)

    return NextResponse.json({ messages: messages.reverse() }) // Reverse to show oldest first
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/communication/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channel_id, content, content_type, thread_id, mongo_mentioned_user_ids } = body

    if (!channel_id || !content) {
      return NextResponse.json(
        { error: 'Channel ID and content are required' },
        { status: 400 }
      )
    }

    // Check if user is member of the channel
    const membership = await prisma.channelMember.findFirst({
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

    // Create the message
    const message = await messageOperations.create({
      channel_id,
      mongo_sender_id: session.user.id,
      content,
      content_type: content_type || 'text',
      thread_id,
      mongo_mentioned_user_ids: mongo_mentioned_user_ids || [],
    })

    // Update channel's last_message_at
    await prisma.channel.update({
      where: { id: channel_id },
      data: { last_message_at: new Date() },
    })

    // Broadcast via Supabase realtime
    try {
      await supabase
        .channel(`channel_${channel_id}`)
        .send({
          type: 'broadcast',
          event: 'new_message',
          payload: { message },
        })
    } catch (realtimeError) {
      console.warn('Realtime broadcast failed:', realtimeError)
    }

    // Fetch complete message with relations
    const completeMessage = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
    })

    return NextResponse.json({ message: completeMessage })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}