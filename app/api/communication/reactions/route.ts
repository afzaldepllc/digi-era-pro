import { type NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { apiLogger as logger } from '@/lib/logger'

// ============================================
// Supabase Client for Broadcasting
// ============================================
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// Validation Schemas
// ============================================
const addReactionSchema = z.object({
  message_id: z.string().uuid(),
  channel_id: z.string().uuid(),
  emoji: z.string().min(1).max(50) // Emoji can be multi-codepoint (flags, ZWJ sequences, skin tones)
})

const removeReactionSchema = z.object({
  reaction_id: z.string().uuid().optional(),
  message_id: z.string().uuid().optional(),
  emoji: z.string().min(1).max(50).optional()
})

// ============================================
// Helper Functions
// ============================================
function createErrorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  }, { status })
}

// ============================================
// POST /api/communication/reactions - Add reaction to a message
// ============================================
export async function POST(request: NextRequest) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'create')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const body = await request.json()
    
    // Validate request body
    const validationResult = addReactionSchema.safeParse(body)
    if (!validationResult.success) {
      return createErrorResponse('Invalid request data', 400, validationResult.error.flatten())
    }

    const { message_id, channel_id, emoji } = validationResult.data
    const userId = session.user.id

    // Check if user is member of the channel
    const membership = await prisma.channel_members.findFirst({
      where: {
        channel_id,
        mongo_member_id: userId
      }
    })

    if (!membership) {
      return createErrorResponse('Access denied - not a channel member', 403)
    }

    // Check if message exists in the channel
    const message = await prisma.messages.findFirst({
      where: {
        id: message_id,
        channel_id
      }
    })

    if (!message) {
      return createErrorResponse('Message not found', 404)
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.reactions.findFirst({
      where: {
        message_id,
        mongo_user_id: userId,
        emoji
      }
    })

    if (existingReaction) {
      // Remove existing reaction (toggle behavior)
      await prisma.reactions.delete({
        where: { id: existingReaction.id }
      })

      // Broadcast reaction removed (non-blocking)
      try {
        const channel = supabaseAdmin.channel(`rt_${channel_id}`)
        await channel.send({
          type: 'broadcast',
          event: 'reaction_removed',
          payload: {
            id: existingReaction.id,
            message_id,
            channel_id,
            mongo_user_id: userId,
            emoji
          }
        })
        logger.debug('Reaction removed broadcasted to channel:', channel_id)
      } catch (broadcastError) {
        logger.error('Failed to broadcast reaction removal:', broadcastError)
        // Don't fail the request if broadcast fails
      }

      return NextResponse.json({
        success: true,
        action: 'removed',
        data: existingReaction,
        message: 'Reaction removed successfully'
      })
    }

    // Add new reaction
    // Get user info for storing (denormalized)
    const userName = (session.user as any)?.name || 'Unknown'
    
    const newReaction = await prisma.reactions.create({
      data: {
        message_id,
        channel_id,
        mongo_user_id: userId,
        user_name: userName,
        emoji
      }
    })

    // Broadcast reaction added (non-blocking)
    try {
      const channel = supabaseAdmin.channel(`rt_${channel_id}`)
      await channel.send({
        type: 'broadcast',
        event: 'reaction_added',
        payload: {
          id: newReaction.id,
          message_id,
          channel_id,
          mongo_user_id: userId,
          user_name: userName,
          emoji,
          created_at: newReaction.created_at.toISOString()
        }
      })
      logger.debug('Reaction added broadcasted to channel:', channel_id)
    } catch (broadcastError) {
      logger.error('Failed to broadcast reaction addition:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({
      success: true,
      action: 'added',
      data: newReaction,
      message: 'Reaction added successfully'
    })

  } catch (error: unknown) {
    logger.error('Error adding reaction:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error ? error.stack : String(error)
    return createErrorResponse('Failed to add reaction', 500, { message: errorMessage, details: errorDetails })
  }
}

// ============================================
// DELETE /api/communication/reactions - Remove a reaction
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'delete')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const reactionId = searchParams.get('reaction_id')
    const messageId = searchParams.get('message_id')
    const emoji = searchParams.get('emoji')

    const userId = session.user.id

    let reaction

    if (reactionId) {
      // Delete by reaction ID
      reaction = await prisma.reactions.findUnique({
        where: { id: reactionId }
      })
    } else if (messageId && emoji) {
      // Delete by message_id + user + emoji
      reaction = await prisma.reactions.findFirst({
        where: {
          message_id: messageId,
          mongo_user_id: userId,
          emoji
        }
      })
    }

    if (!reaction) {
      return createErrorResponse('Reaction not found', 404)
    }

    // Only allow user to delete their own reactions
    if (reaction.mongo_user_id !== userId) {
      return createErrorResponse('Cannot delete other users reactions', 403)
    }

    // Delete the reaction
    await prisma.reactions.delete({
      where: { id: reaction.id }
    })

    // Broadcast reaction removed (non-blocking)
    try {
      const channel = supabaseAdmin.channel(`rt_${reaction.channel_id}`)
      await channel.send({
        type: 'broadcast',
        event: 'reaction_removed',
        payload: {
          id: reaction.id,
          message_id: reaction.message_id,
          channel_id: reaction.channel_id,
          mongo_user_id: userId,
          emoji: reaction.emoji
        }
      })
      logger.debug('Reaction removed broadcasted to channel:', reaction.channel_id)
    } catch (broadcastError) {
      logger.error('Failed to broadcast reaction removal:', broadcastError)
      // Don't fail the request if broadcast fails
    }

    return NextResponse.json({
      success: true,
      message: 'Reaction removed successfully'
    })

  } catch (error: unknown) {
    logger.error('Error removing reaction:', error)
    return createErrorResponse('Failed to remove reaction', 500)
  }
}

// ============================================
// GET /api/communication/reactions?message_id=xxx - Get reactions for a message
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')
    const channelId = searchParams.get('channel_id')

    if (!messageId && !channelId) {
      return createErrorResponse('message_id or channel_id is required', 400)
    }

    // Build query
    const where: { message_id?: string; channel_id?: string } = {}
    if (messageId) where.message_id = messageId
    if (channelId) where.channel_id = channelId

    const reactions = await prisma.reactions.findMany({
      where,
      orderBy: { created_at: 'asc' }
    })

    // Group reactions by emoji with user counts
    const groupedReactions = reactions.reduce((acc, reaction) => {
      const key = `${reaction.message_id}_${reaction.emoji}`
      if (!acc[key]) {
        acc[key] = {
          message_id: reaction.message_id,
          emoji: reaction.emoji,
          count: 0,
          users: [] as { id: string; mongo_user_id: string; name: string }[],
          hasCurrentUserReacted: false
        }
      }
      acc[key].count++
      acc[key].users.push({
        id: reaction.id,
        mongo_user_id: reaction.mongo_user_id,
        name: reaction.user_name
      })
      if (reaction.mongo_user_id === session.user.id) {
        acc[key].hasCurrentUserReacted = true
      }
      return acc
    }, {} as Record<string, { message_id: string; emoji: string; count: number; users: { id: string; mongo_user_id: string; name: string }[]; hasCurrentUserReacted: boolean }>)

    return NextResponse.json({
      success: true,
      data: {
        reactions,
        grouped: Object.values(groupedReactions)
      }
    })

  } catch (error: unknown) {
    logger.error('Error fetching reactions:', error)
    return createErrorResponse('Failed to fetch reactions', 500)
  }
}
