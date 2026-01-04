import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { apiLogger as logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

// POST /api/communication/channels/[channelId]/leave - Leave a channel
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

    // Check if channel exists
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        channel_members: true
      }
    })

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Check if user is a member
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: userId
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this channel' }, { status: 400 })
    }

    // Check if user is the only admin/owner
    const isAdminOrOwner = membership.role === 'admin' || membership.role === 'owner'
    
    if (isAdminOrOwner) {
      // Count other admins/owners
      const otherAdmins = await prisma.channel_members.count({
        where: {
          channel_id: channelId,
          mongo_member_id: { not: userId },
          role: { in: ['admin', 'owner'] }
        }
      })

      if (otherAdmins === 0) {
        // Check if there are other members to transfer admin role
        const otherMembers = await prisma.channel_members.findMany({
          where: {
            channel_id: channelId,
            mongo_member_id: { not: userId }
          },
          orderBy: { joined_at: 'asc' },
          take: 1
        })

        if (otherMembers.length === 0) {
          // Last member - archive channel instead of leaving
          // Note: is_archived fields require Prisma client regeneration after schema update
          await prisma.channels.update({
            where: { id: channelId },
            data: { 
              is_archived: true, 
              archived_at: new Date(),
              archived_by: userId
            } as any // Type assertion until Prisma client is regenerated
          })
          
          // Remove the member
          await prisma.channel_members.delete({
            where: {
              channel_id_mongo_member_id: {
                channel_id: channelId,
                mongo_member_id: userId
              }
            }
          })

          return NextResponse.json({ 
            success: true, 
            archived: true,
            message: 'You were the last member. Channel has been archived.' 
          })
        }

        // Transfer admin role to the oldest member before leaving
        await prisma.channel_members.update({
          where: {
            channel_id_mongo_member_id: {
              channel_id: channelId,
              mongo_member_id: otherMembers[0].mongo_member_id
            }
          },
          data: { role: 'admin' }
        })
      }
    }

    // Remove user from channel_members
    await prisma.channel_members.delete({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: userId
        }
      }
    })

    // Broadcast member_left event for real-time sync
    try {
      const rtChannel = supabase.channel(`rt_${channelId}`)
      await rtChannel.send({
        type: 'broadcast',
        event: 'channel_update',
        payload: {
          id: channelId,
          type: 'member_left',
          member_id: userId
        }
      })
      await supabase.removeChannel(rtChannel)
    } catch (broadcastError) {
      logger.warn('Failed to broadcast member left:', broadcastError)
    }

    // Update member count
    await prisma.channels.update({
      where: { id: channelId },
      data: { 
        member_count: { decrement: 1 },
        updated_at: new Date()
      }
    })

    // Check if no members left - archive the channel
    const remainingMembers = await prisma.channel_members.count({
      where: { channel_id: channelId }
    })

    if (remainingMembers === 0) {
      // Note: is_archived fields require Prisma client regeneration after schema update
      await prisma.channels.update({
        where: { id: channelId },
        data: { 
          is_archived: true, 
          archived_at: new Date(),
          archived_by: userId
        } as any // Type assertion until Prisma client is regenerated
      })
      
      return NextResponse.json({ 
        success: true, 
        archived: true,
        message: 'Channel has been archived (no members left).' 
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully left the channel' 
    })
  } catch (error) {
    logger.error('Error leaving channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
