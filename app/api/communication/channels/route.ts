import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { channelOperations } from '@/lib/db-utils'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/communication/channels - Get user's channels
export async function GET(request: NextRequest) {
    try {
        const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'departments', 'read')

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const departmentId = searchParams.get('department_id')
        const projectId = searchParams.get('project_id')

        let where: any = {
            channel_members: {
                some: {
                    mongo_member_id: session.user.id,
                },
            },
        }

        if (type) where.type = type
        if (departmentId) where.mongo_department_id = departmentId
        if (projectId) where.mongo_project_id = projectId

        const channels = await prisma.channel.findMany({
            where,
            include: {
                channel_members: true,
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1,
                    include: {
                        read_receipts: true,
                    },
                },
                _count: {
                    select: { messages: true },
                },
            },
            orderBy: { updated_at: 'desc' },
        })

        // Import User model dynamically to avoid circular dependencies
        const { default: User } = await import('@/models/User')
        const { enrichChannelWithUserData } = await import('@/lib/db-utils')
        
        // Enrich channels with user data from MongoDB
        const enrichedChannels = await Promise.all(
            channels.map(channel => enrichChannelWithUserData(channel, User))
        )

        return NextResponse.json({ channels: enrichedChannels })
    } catch (error) {
        console.error('Error fetching channels:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// POST /api/communication/channels - Create a new channel
export async function POST(request: NextRequest) {
    try {
            const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'departments', 'read')

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { type, name, participants, mongo_department_id, mongo_project_id, is_private } = body

        if (!type || !participants || participants.length === 0) {
            return NextResponse.json(
                { error: 'Type and participants are required' },
                { status: 400 }
            )
        }

        // Create the channel
        const channel = await channelOperations.create({
            type,
            name: name || undefined,
            mongo_department_id,
            mongo_project_id,
            mongo_creator_id: session.user.id,
            is_private: is_private || false,
        })

        // Add creator as member
        await channelOperations.addMember(channel.id, session.user.id, 'admin')

        // Add other participants
        for (const participantId of participants) {
            if (participantId !== session.user.id) {
                await channelOperations.addMember(channel.id, participantId, 'member')
            }
        }

        // Update member count
        await prisma.channel.update({
            where: { id: channel.id },
            data: { member_count: participants.length },
        })

        // Fetch the complete channel with members
        const completeChannel = await prisma.channel.findUnique({
            where: { id: channel.id },
            include: {
                channel_members: true,
            },
        })

        // Enrich channel with user data from MongoDB
        const { default: User } = await import('@/models/User')
        const { enrichChannelWithUserData } = await import('@/lib/db-utils')
        const enrichedChannel = await enrichChannelWithUserData(completeChannel, User)

        return NextResponse.json({ channel: enrichedChannel })
    } catch (error) {
        console.error('Error creating channel:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}