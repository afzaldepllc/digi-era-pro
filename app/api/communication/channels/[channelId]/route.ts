import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { channelOps } from '@/lib/communication/operations'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { apiLogger as logger } from '@/lib/logger'

// GET /api/communication/channels/[channelId] - Get channel details
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ channelId: string }> }
) {
  try {
    const params = await paramsPromise
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.channelId

    // Check if user is member of the channel using Phase 1 channelOps
    const isMember = await channelOps.isMember(channelId, session.user.id)

    if (!isMember) {
      return NextResponse.json(
        { error: 'Access denied to this channel' },
        { status: 403 }
      )
    }

    // Fetch channel with details using channelOps
    const channel = await channelOps.getById(channelId, { includeMembers: true })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ channel })
  } catch (error) {
    logger.error('Error fetching channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/communication/channels/[channelId] - Update channel
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ channelId: string }> }
) {
  try {
    const params = await paramsPromise
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'update')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.channelId
    const body = await request.json()
    const { name, is_private } = body

    // Check if user is admin of the channel using Phase 1 channelOps
    const role = await channelOps.getMemberRole(channelId, session.user.id)

    if (!role || !['admin', 'owner'].includes(role)) {
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
    const { executeGenericDbQuery } = await import('@/lib/mongodb')
    const { enrichChannelWithUserData } = await import('@/lib/communication/utils')
    
    const allUsers = await executeGenericDbQuery(async () => {
      return await User.find({ isDeleted: { $ne: true } }).select('_id name email avatar isClient role').lean()
    })
    
    const enrichedChannel = await enrichChannelWithUserData(updatedChannel, allUsers)

    return NextResponse.json({ channel: enrichedChannel })
  } catch (error) {
    logger.error('Error updating channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/communication/channels/[channelId] - Delete channel
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ channelId: string }> }
) {
  try {
    const params = await paramsPromise
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.channelId

    // Check if user is creator or admin using Phase 1 channelOps
    const channel = await channelOps.getById(channelId)

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const isCreator = channel.mongo_creator_id === session.user.id
    const role = await channelOps.getMemberRole(channelId, session.user.id)
    const isAdminOrOwner = role && ['admin', 'owner'].includes(role)

    if (!isCreator && !isAdminOrOwner && !isSuperAdmin) {
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
    logger.error('Error deleting channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
