import { type NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { createAPIErrorResponse } from '@/lib/utils/api-responses'
import { getClientInfo } from '@/lib/security/error-handler'
import { apiLogger as logger } from '@/lib/logger'

// Maximum number of users a user can pin
const MAX_PINNED_USERS = 10

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// POST /api/communication/users/[userId]/pin - Toggle pin status for a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { userId } = await params
    const pinnerId = session.user.id

    // Prevent pinning yourself
    if (pinnerId === userId) {
      return createErrorResponse('Cannot pin yourself', 400)
    }

    // Check if already pinned
    const existingPin = await prisma.pinnedUser.findUnique({
      where: {
        pinner_id_pinned_user_id: {
          pinner_id: pinnerId,
          pinned_user_id: userId
        }
      }
    })

    const isPinning = !existingPin

    if (isPinning) {
      // Count current pinned users
      const pinnedCount = await prisma.pinnedUser.count({
        where: {
          pinner_id: pinnerId
        }
      })

      if (pinnedCount >= MAX_PINNED_USERS) {
        return createErrorResponse(
          `You can only pin up to ${MAX_PINNED_USERS} users. Unpin a user first.`,
          400
        )
      }

      // Create pin
      await prisma.pinnedUser.create({
        data: {
          pinner_id: pinnerId,
          pinned_user_id: userId
        }
      })
    } else {
      // Remove pin
      await prisma.pinnedUser.delete({
        where: {
          pinner_id_pinned_user_id: {
            pinner_id: pinnerId,
            pinned_user_id: userId
          }
        }
      })
    }

    // Broadcast pin change via Supabase for real-time updates
    try {
      const rtChannel = supabase.channel(`user:${pinnerId}:pinned-users`)

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          supabase.removeChannel(rtChannel)
          resolve()
        }, 3000)

        rtChannel.subscribe(async (status: string, err?: Error) => {
          if (err) {
            clearTimeout(timeout)
            supabase.removeChannel(rtChannel)
            resolve()
            return
          }
          if (status === 'SUBSCRIBED') {
            await rtChannel.send({
              type: 'broadcast',
              event: 'user_pin_update',
              payload: {
                pinner_id: pinnerId,
                pinned_user_id: userId,
                is_pinned: isPinning
              }
            })
            clearTimeout(timeout)
            await supabase.removeChannel(rtChannel)
            resolve()
          }
        })
      })
    } catch (broadcastError) {
      logger.warn('Failed to broadcast user pin change:', broadcastError)
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: userId,
        is_pinned: isPinning
      },
      message: isPinning ? 'User pinned successfully' : 'User unpinned successfully'
    })
  } catch (error: any) {
    logger.error('Pin user error:', error)
    return createAPIErrorResponse(error.message || 'Failed to update pin status', 500, undefined, getClientInfo(request))
  }
}

// GET /api/communication/users/[userId]/pin - Get pin status for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { userId } = await params
    const pinnerId = session.user.id

    const pin = await prisma.pinnedUser.findUnique({
      where: {
        pinner_id_pinned_user_id: {
          pinner_id: pinnerId,
          pinned_user_id: userId
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        user_id: userId,
        is_pinned: !!pin
      }
    })
  } catch (error: any) {
    logger.error('Get user pin status error:', error)
    return createAPIErrorResponse('Failed to get pin status', 500, undefined, getClientInfo(request))
  }
}