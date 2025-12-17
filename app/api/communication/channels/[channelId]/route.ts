import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { channelOperations } from '@/lib/db-utils'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/communication/channels/[channelId] - Get channel details
export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.channelId

    // Check if user is member of the channel
    const membership = await prisma.channel_members.findFirst({
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

    // Fetch channel with details
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        channel_members: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ channel })
  } catch (error) {
    console.error('Error fetching channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/communication/channels/[channelId] - Update channel
export async function PUT(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.channelId
    const body = await request.json()
    const { name, is_private } = body

    // Check if user is admin of the channel
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: session.user.id,
        role: { in: ['admin', 'owner'] },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied - admin required' },
        { status: 403 }
      )
    }

    // Update channel
    const updatedChannel = await prisma.channels.update({
      where: { id: channelId },
      data: {
        name,
        is_private,
        updated_at: new Date(),
      },
      include: {
        channel_members: true,
      },
    })

    // Enrich channel with user data from MongoDB
    const { default: User } = await import('@/models/User')
    const { enrichChannelWithUserData } = await import('@/lib/db-utils')
    const enrichedChannel = await enrichChannelWithUserData(updatedChannel, User)

    return NextResponse.json({ channel: enrichedChannel })
  } catch (error) {
    console.error('Error updating channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/communication/channels/[channelId] - Delete channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.channelId

    // Check if user is creator or admin
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const isCreator = channel.mongo_creator_id === session.user.id
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: session.user.id,
        role: { in: ['admin', 'owner'] },
      },
    })

    if (!isCreator && !membership && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Access denied - admin required' },
        { status: 403 }
      )
    }

    // Delete channel (cascade will delete related data)
    await prisma.channels.delete({
      where: { id: channelId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
