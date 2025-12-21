import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { apiLogger as logger } from '@/lib/logger'
import type { channels } from '@prisma/client'

// Extended channel type with archive fields (until Prisma client is regenerated)
type ChannelWithArchive = channels & {
  is_archived?: boolean
  archived_at?: Date | null
  archived_by?: string | null
}

// POST /api/communication/channels/[channelId]/archive - Archive or unarchive a channel
export async function POST(
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
    const userId = session.user.id
    
    // Get request body for action type
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'archive' // 'archive' or 'unarchive'

    // Check if channel exists
    const channelResult = await prisma.channels.findUnique({
      where: { id: channelId }
    })
    
    if (!channelResult) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    // Cast to include archive fields (until Prisma client is regenerated)
    const channel = channelResult as ChannelWithArchive

    // Only admins/owners or super admins can archive/unarchive
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: userId,
        role: { in: ['admin', 'owner'] }
      }
    })

    const isCreator = channel.mongo_creator_id === userId

    if (!membership && !isCreator && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only channel admins can archive/unarchive channels' },
        { status: 403 }
      )
    }

    if (action === 'archive') {
      if (channel.is_archived) {
        return NextResponse.json({ error: 'Channel is already archived' }, { status: 400 })
      }

      // Archive the channel
      // Note: is_archived fields require Prisma client regeneration after schema update
      const updatedChannel = await prisma.channels.update({
        where: { id: channelId },
        data: {
          is_archived: true,
          archived_at: new Date(),
          archived_by: userId,
          updated_at: new Date()
        } as any, // Type assertion until Prisma client is regenerated
        include: {
          channel_members: true
        }
      })

      return NextResponse.json({ 
        success: true, 
        action: 'archived',
        channel: updatedChannel,
        message: 'Channel has been archived' 
      })
    } else if (action === 'unarchive') {
      if (!channel.is_archived) {
        return NextResponse.json({ error: 'Channel is not archived' }, { status: 400 })
      }

      // Unarchive the channel
      // Note: is_archived fields require Prisma client regeneration after schema update
      const updatedChannel = await prisma.channels.update({
        where: { id: channelId },
        data: {
          is_archived: false,
          archived_at: null,
          archived_by: null,
          updated_at: new Date()
        } as any, // Type assertion until Prisma client is regenerated
        include: {
          channel_members: true
        }
      })

      return NextResponse.json({ 
        success: true, 
        action: 'unarchived',
        channel: updatedChannel,
        message: 'Channel has been unarchived' 
      })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "archive" or "unarchive"' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error archiving/unarchiving channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
