import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeGenericDbQuery } from '@/lib/mongodb'
import User from '@/models/User'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ channelId: string }>
}

// Validation schemas
const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'member']).default('member')
})

const updateMemberSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  role: z.enum(['admin', 'member'])
})

// Helper to create consistent error responses
function createErrorResponse(message: string, status: number, details?: any) {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status })
}

// GET /api/communication/channels/[channelId]/members - List members
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params

    // Verify user is a member
    const isMember = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: session.user.id }
    })

    if (!isMember) {
      return createErrorResponse('Access denied', 403)
    }

    const members = await prisma.channel_members.findMany({
      where: { channel_id: channelId },
      orderBy: [
        { role: 'asc' }, // owner first, then admin, then member
        { joined_at: 'asc' }
      ]
    })

    // Enrich with MongoDB user data
    const memberIds = members.map(m => m.mongo_member_id)
    const users = await executeGenericDbQuery(async () => {
      return await User.find({ _id: { $in: memberIds } })
        .select('_id name email avatar role department')
        .populate('department', 'name')
        .lean()
    })

    const userMap = new Map((users as any[]).map((u: any) => [u._id.toString(), u]))

    const enrichedMembers = members.map(member => ({
      ...member,
      user: userMap.get(member.mongo_member_id) || {
        _id: member.mongo_member_id,
        name: 'Unknown User',
        email: ''
      }
    }))

    return NextResponse.json({
      success: true,
      data: enrichedMembers
    })
  } catch (error: any) {
    logger.error('Error fetching channel members:', error)
    return createErrorResponse('Failed to fetch members', 500)
  }
}

// POST /api/communication/channels/[channelId]/members - Add member
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'create')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params
    const body = await request.json()
    
    const validation = addMemberSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse('Invalid request data', 400, { errors: validation.error.errors })
    }
    
    const validated = validation.data

    // Get channel
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: { channel_members: true }
    })

    if (!channel) {
      return createErrorResponse('Channel not found', 404)
    }

    // Check requester permissions
    const requester = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: session.user.id }
    })

    if (!requester) {
      return createErrorResponse('You are not a member of this channel', 403)
    }

    // Check if admin-only-add is enabled (use any to handle field that might not exist yet)
    const channelAny = channel as any
    if (channelAny.admin_only_add) {
      if (requester.role !== 'admin' && requester.role !== 'owner') {
        return createErrorResponse('Only admins can add members to this channel', 403)
      }
    }

    // Check if allow_external_members is disabled
    if (channelAny.allow_external_members === false && (channel.mongo_department_id || channel.mongo_project_id)) {
      // Verify user belongs to same department/project
      const newUser = await executeGenericDbQuery(async () => {
        return await User.findById(validated.userId).select('department').lean()
      }) as any

      if (channel.mongo_department_id) {
        if (newUser?.department?.toString() !== channel.mongo_department_id) {
          return createErrorResponse('External members are not allowed in this channel', 403)
        }
      }
    }

    // Check if already a member
    const existingMember = channel.channel_members.find(
      (m: any) => m.mongo_member_id === validated.userId
    )
    
    if (existingMember) {
      return createErrorResponse('User is already a member of this channel', 400)
    }

    // Get user data
    const user = await executeGenericDbQuery(async () => {
      return await User.findById(validated.userId)
        .select('_id name email avatar role')
        .lean()
    }) as any

    if (!user) {
      return createErrorResponse('User not found', 404)
    }

    // Add member - use any to bypass type checking until migration is run
    const member = await prisma.channel_members.create({
      data: {
        id: crypto.randomUUID(),
        channel_id: channelId,
        mongo_member_id: validated.userId,
        role: validated.role,
        joined_at: new Date(),
        added_by: session.user.id,
        added_via: 'manual_add'
      } as any
    })

    // Update member count
    await prisma.channels.update({
      where: { id: channelId },
      data: { 
        member_count: { increment: 1 },
        updated_at: new Date()
      }
    })

    // Broadcast to new member
    try {
      const rtUserChannel = supabase.channel(`user:${validated.userId}:channels`)
      await rtUserChannel.send({
        type: 'broadcast',
        event: 'channel_update',
        payload: { id: channelId, type: 'new_channel' }
      })
      await supabase.removeChannel(rtUserChannel)

      // Broadcast to channel
      const rtChannel = supabase.channel(`rt_${channelId}`)
      await rtChannel.send({
        type: 'broadcast',
        event: 'member_update',
        payload: {
          channelId,
          memberId: validated.userId,
          type: 'member_added',
          user: {
            mongo_member_id: user._id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar
          }
        }
      })
      await supabase.removeChannel(rtChannel)
    } catch (broadcastError) {
      logger.warn('Failed to broadcast member add:', broadcastError)
    }

    return NextResponse.json({
      success: true,
      data: { ...member, user },
      message: 'Member added successfully'
    })
  } catch (error: any) {
    logger.error('Error adding channel member:', error)
    return createErrorResponse('Failed to add member', 500)
  }
}

// PUT /api/communication/channels/[channelId]/members - Update member role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params
    const body = await request.json()
    
    const validation = updateMemberSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse('Invalid request data', 400, { errors: validation.error.errors })
    }
    
    const { memberId, role } = validation.data

    const channel = await prisma.channels.findUnique({ where: { id: channelId } })
    if (!channel) {
      return createErrorResponse('Channel not found', 404)
    }

    // Check requester is admin/owner
    const requester = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: session.user.id }
    })

    if (!requester || (requester.role !== 'admin' && requester.role !== 'owner')) {
      return createErrorResponse('Admin permission required', 403)
    }

    // Cannot change owner role
    const target = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: memberId }
    })

    if (!target) {
      return createErrorResponse('Member not found', 404)
    }

    if (target.role === 'owner') {
      return createErrorResponse('Cannot change owner role', 403)
    }

    // Update role
    const updatedMember = await prisma.channel_members.update({
      where: { id: target.id },
      data: { role }
    })

    // Broadcast update
    try {
      const rtChannel = supabase.channel(`rt_${channelId}`)
      await rtChannel.send({
        type: 'broadcast',
        event: 'member_update',
        payload: { channelId, memberId, type: 'member_updated', role }
      })
      await supabase.removeChannel(rtChannel)
    } catch (broadcastError) {
      logger.warn('Failed to broadcast role update:', broadcastError)
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedMember,
      message: 'Role updated successfully' 
    })
  } catch (error: any) {
    logger.error('Error updating member role:', error)
    return createErrorResponse('Failed to update role', 500)
  }
}

// DELETE /api/communication/channels/[channelId]/members - Remove member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'delete')
    
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401)
    }

    const { channelId } = await params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return createErrorResponse('memberId query parameter is required', 400)
    }

    const channel = await prisma.channels.findUnique({ where: { id: channelId } })
    if (!channel) {
      return createErrorResponse('Channel not found', 404)
    }

    // Check requester permissions
    const requester = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: session.user.id }
    })

    if (!requester || (requester.role !== 'admin' && requester.role !== 'owner')) {
      return createErrorResponse('Admin permission required', 403)
    }

    // Cannot remove owner
    const target = await prisma.channel_members.findFirst({
      where: { channel_id: channelId, mongo_member_id: memberId }
    })

    if (!target) {
      return createErrorResponse('Member not found', 404)
    }

    if (target.role === 'owner') {
      return createErrorResponse('Cannot remove channel owner', 403)
    }

    // Remove member
    await prisma.channel_members.delete({ where: { id: target.id } })

    // Update member count
    await prisma.channels.update({
      where: { id: channelId },
      data: { member_count: { decrement: 1 } }
    })

    // Broadcast to removed user
    try {
      const rtUserChannel = supabase.channel(`user:${memberId}:channels`)
      await rtUserChannel.send({
        type: 'broadcast',
        event: 'channel_update',
        payload: { id: channelId, type: 'channel_removed' }
      })
      await supabase.removeChannel(rtUserChannel)

      // Broadcast to channel
      const rtChannel = supabase.channel(`rt_${channelId}`)
      await rtChannel.send({
        type: 'broadcast',
        event: 'member_update',
        payload: { channelId, memberId, type: 'member_removed' }
      })
      await supabase.removeChannel(rtChannel)
    } catch (broadcastError) {
      logger.warn('Failed to broadcast member removal:', broadcastError)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Member removed successfully' 
    })
  } catch (error: any) {
    logger.error('Error removing channel member:', error)
    return createErrorResponse('Failed to remove member', 500)
  }
}
