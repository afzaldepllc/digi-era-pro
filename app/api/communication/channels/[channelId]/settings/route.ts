import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ channelId: string }>
}

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
  auto_sync_enabled: z.boolean().optional(),
  allow_external_members: z.boolean().optional(),
  admin_only_post: z.boolean().optional(),
  admin_only_add: z.boolean().optional(),
  is_private: z.boolean().optional()
})

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/communication/channels/[channelId]/settings
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params

    // Verify membership
    const membership = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: session.user.id }
    })

    if (!membership) {
      return createErrorResponse('Access denied', 403)
    }

    // Get channel - select all fields and use any for new fields
    const channel = await prisma.channels.findUnique({
      where: { id: channelId }
    }) as any

    if (!channel) {
      return createErrorResponse('Channel not found', 404)
    }

    // Determine user's permissions
    const isOwner = membership.role === 'owner' || channel.mongo_creator_id === session.user.id
    const isAdmin = membership.role === 'admin' || isOwner

    return NextResponse.json({
      success: true,
      data: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        avatar_url: channel.avatar_url,
        auto_sync_enabled: channel.auto_sync_enabled ?? true,
        allow_external_members: channel.allow_external_members ?? false,
        admin_only_post: channel.admin_only_post ?? false,
        admin_only_add: channel.admin_only_add ?? false,
        is_private: channel.is_private,
        mongo_creator_id: channel.mongo_creator_id,
        mongo_department_id: channel.mongo_department_id,
        mongo_project_id: channel.mongo_project_id,
        member_count: channel.member_count,
        created_at: channel.created_at,
        updated_at: channel.updated_at,
        isAdmin,
        isOwner,
        currentUserRole: membership.role
      }
    })
  } catch (error: any) {
    console.error('Error fetching channel settings:', error)
    return createErrorResponse('Failed to fetch settings', 500)
  }
}

// PUT /api/communication/channels/[channelId]/settings
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params
    const body = await request.json()
    
    const validation = updateSettingsSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse('Invalid settings', 400, { errors: validation.error.errors })
    }
    
    const validated = validation.data

    // Check admin permission
    const membership = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: session.user.id }
    })

    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return createErrorResponse('Admin permission required', 403)
    }

    const channel = await prisma.channels.findUnique({ where: { id: channelId } })
    if (!channel) {
      return createErrorResponse('Channel not found', 404)
    }

    // DM channels cannot be modified
    if (channel.type === 'dm') {
      return createErrorResponse('Cannot modify DM channel settings', 400)
    }

    // Update settings
    const updatedChannel = await prisma.channels.update({
      where: { id: channelId },
      data: {
        ...validated,
        updated_at: new Date()
      }
    })

    // Broadcast settings update to channel members
    try {
      const rtChannel = supabase.channel(`rt_${channelId}`)
      await rtChannel.send({
        type: 'broadcast',
        event: 'channel_settings_updated',
        payload: {
          channelId,
          settings: validated,
          updatedBy: session.user.id
        }
      })
      await supabase.removeChannel(rtChannel)
    } catch (broadcastError) {
      console.warn('Failed to broadcast settings update:', broadcastError)
    }

    return NextResponse.json({
      success: true,
      data: updatedChannel,
      message: 'Settings updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating channel settings:', error)
    return createErrorResponse('Failed to update settings', 500)
  }
}
