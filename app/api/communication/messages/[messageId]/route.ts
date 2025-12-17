import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { messageOperations } from '@/lib/db-utils'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { supabase } from '@/lib/supabase'

// PUT /api/communication/messages/[messageId] - Update message
export async function PUT(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const messageId = params.messageId
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Check if user owns the message
    const message = await prisma.messages.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.mongo_sender_id !== session.user.id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Access denied - you can only edit your own messages' },
        { status: 403 }
      )
    }

    // Update message using messageOperations
    const updatedMessage = await messageOperations.update(messageId, content)

    // Note: Supabase Realtime with Postgres Changes will automatically
    // notify all subscribers about the message update
    // No need for manual broadcast for database operations

    return NextResponse.json({ message: updatedMessage })
  } catch (error) {
    console.error('Error updating message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/communication/messages/[messageId] - Delete message
export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const messageId = params.messageId

    // Check if user owns the message
    const message = await prisma.messages.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.mongo_sender_id !== session.user.id && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Access denied - you can only delete your own messages' },
        { status: 403 }
      )
    }

    // Delete message using messageOperations (handles reply_count decrement)
    await messageOperations.delete(messageId)

    // Note: Supabase Realtime with Postgres Changes will automatically
    // notify all subscribers about the message deletion
    // No need for manual broadcast for database operations

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
