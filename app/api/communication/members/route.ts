import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { memberOperations } from '@/lib/db-utils'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/communication/members?channel_id=... - Get channel members
export async function GET(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')
   

    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channel_id')

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    // Check if user is member of the channel
    const membership = await prisma.channelMember.findFirst({
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

    const members = await prisma.channelMember.findMany({
      where: { channel_id: channelId },
      orderBy: { joined_at: 'asc' },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching channel members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/communication/members - Add member to channel or update status
export async function POST(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')
    

    const body = await request.json()
    const { channel_id, mongo_member_id, action } = body

    if (!channel_id) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to manage this channel
    const userMembership = await prisma.channelMember.findFirst({
      where: {
        channel_id,
        mongo_member_id: session.user.id,
        role: { in: ['admin', 'owner'] },
      },
    })

    if (!userMembership) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    if (action === 'add' && mongo_member_id) {
      // Add new member
      const member = await prisma.channelMember.create({
        data: {
          channel_id,
          mongo_member_id,
          role: 'member',
        },
      })

      // Update member count
      await prisma.channel.update({
        where: { id: channel_id },
        data: {
          member_count: { increment: 1 },
        },
      })

      return NextResponse.json({ member })
    }

    if (action === 'update_status') {
      // Update online status
      const is_online = body.is_online ?? false
      await memberOperations.updateOnlineStatus(channel_id, session.user.id, is_online)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error managing channel member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/communication/members - Remove member from channel
export async function DELETE(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'read')

    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channel_id')
    const memberId = searchParams.get('member_id')

    if (!channelId || !memberId) {
      return NextResponse.json(
        { error: 'Channel ID and member ID are required' },
        { status: 400 }
      )
    }

    // Check if user has permission to remove members
    const userMembership = await prisma.channelMember.findFirst({
      where: {
        channel_id: channelId,
        mongo_member_id: session.user.id,
        role: { in: ['admin', 'owner'] },
      },
    })

    if (!userMembership) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Remove member
    await prisma.channelMember.deleteMany({
      where: {
        channel_id: channelId,
        mongo_member_id: memberId,
      },
    })

    // Update member count
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        member_count: { decrement: 1 },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing channel member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}