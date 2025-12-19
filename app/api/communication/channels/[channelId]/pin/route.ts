import { type NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { createAPIErrorResponse } from '@/lib/utils/api-responses'
import { getClientInfo } from '@/lib/security/error-handler'
import { apiLogger as logger } from '@/lib/logger'

// Maximum number of channels a user can pin
const MAX_PINNED_CHANNELS = 5

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// POST /api/communication/channels/[channelId]/pin - Toggle pin status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params
    const userId = session.user.id

    // Find the channel member record using mongo_member_id (MongoDB user ID)
    const channelMember = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: userId
      }
    })

    if (!channelMember) {
      return createErrorResponse('You are not a member of this channel', 404)
    }

    // Check if we're trying to pin
    const isPinning = !channelMember.is_pinned

    if (isPinning) {
      // Count current pinned channels for this user
      const pinnedCount = await prisma.channel_members.count({
        where: {
          mongo_member_id: userId,
          is_pinned: true
        }
      })

      if (pinnedCount >= MAX_PINNED_CHANNELS) {
        return createErrorResponse(
          `You can only pin up to ${MAX_PINNED_CHANNELS} channels. Unpin a channel first.`,
          400
        )
      }
    }

    // Update pin status
    const updated = await prisma.channel_members.update({
      where: {
        id: channelMember.id
      },
      data: {
        is_pinned: isPinning,
        pinned_at: isPinning ? new Date() : null
      }
    })

    // Broadcast pin change via Supabase for real-time updates
    // Note: Pin changes are user-specific, so we broadcast to the user's channel
    try {
      const rtChannel = supabase.channel(`user:${userId}:channels`)
      
      // Subscribe, send, then cleanup
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          supabase.removeChannel(rtChannel)
          resolve() // Don't fail on timeout
        }, 3000)
        
        rtChannel.subscribe(async (status: string, err?: Error) => {
          if (err) {
            clearTimeout(timeout)
            supabase.removeChannel(rtChannel)
            resolve() // Don't fail on error
            return
          }
          if (status === 'SUBSCRIBED') {
            await rtChannel.send({
              type: 'broadcast',
              event: 'channel_update',
              payload: {
                id: channelId,
                type: 'update',
                channel: {
                  id: channelId,
                  is_pinned: isPinning,
                  pinned_at: updated.pinned_at
                }
              }
            })
            clearTimeout(timeout)
            await supabase.removeChannel(rtChannel)
            resolve()
          }
        })
      })
    } catch (broadcastError) {
      logger.warn('Failed to broadcast pin change:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({
      success: true,
      data: {
        channel_id: channelId,
        is_pinned: isPinning,
        pinned_at: updated.pinned_at
      },
      message: isPinning ? 'Channel pinned successfully' : 'Channel unpinned successfully'
    })
  } catch (error: any) {
    logger.error('Pin channel error:', error)
    return createAPIErrorResponse(error.message || 'Failed to update pin status', 500, undefined, getClientInfo(request))
  }
}

// GET /api/communication/channels/[channelId]/pin - Get pin status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params
    const userId = session.user.id

    const channelMember = await prisma.channel_members.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: userId
      },
      select: {
        is_pinned: true,
        pinned_at: true
      }
    })

    if (!channelMember) {
      return createErrorResponse('You are not a member of this channel', 404)
    }

    return NextResponse.json({
      success: true,
      data: {
        channel_id: channelId,
        is_pinned: channelMember.is_pinned || false,
        pinned_at: channelMember.pinned_at
      }
    })
  } catch (error: any) {
    logger.error('Get pin status error:', error)
    return createAPIErrorResponse('Failed to get pin status', 500, undefined, getClientInfo(request))
  }
}
