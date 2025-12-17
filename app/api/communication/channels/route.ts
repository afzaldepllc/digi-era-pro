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
        const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(request, 'communication', 'create')

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            type,
            name,
            participants,
            mongo_department_id,
            mongo_project_id,
            is_private,
            category,
            categories,
            client_id
        } = body

        // Validate required fields based on type
        if (!type) {
            return NextResponse.json(
                { error: 'Channel type is required' },
                { status: 400 }
            )
        }

        // Import channel helpers
        const {
            getChannelMembers,
            generateChannelName
        } = await import('@/lib/communication/channel-helpers')

        // Get channel members based on type
        const memberIds = await getChannelMembers({
            type,
            creator_id: session.user.id,
            name,
            department_id: mongo_department_id,
            project_id: mongo_project_id,
            participants,
            category,
            categories,
            client_id,
            is_private
        })

        if (memberIds.length === 0) {
            return NextResponse.json(
                { error: 'No members found for this channel' },
                { status: 400 }
            )
        }

        // Generate channel name
        const channelName = await generateChannelName({
            type,
            creator_id: session.user.id,
            name,
            department_id: mongo_department_id,
            project_id: mongo_project_id,
            category,
            categories,
            client_id
        })

        // Create the channel with categories field
        const channel = await prisma.channel.create({
            data: {
                type,
                name: channelName,
                mongo_department_id,
                mongo_project_id,
                mongo_creator_id: session.user.id,
                is_private: is_private || false,
                member_count: memberIds.length,
                categories: categories || [], // Store categories for multi-category channels
                channel_members: {
                    create: memberIds.map((memberId) => ({
                        mongo_member_id: memberId,
                        role: memberId === session.user.id ? 'owner' : 'member',
                        is_online: false,
                    })),
                },
            },
            include: {
                channel_members: true,
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1,
                },
            },
        })

        // Enrich with user data
        const { enrichChannelWithUserData } = await import('@/lib/db-utils')
        const { default: User } = await import('@/models/User')
        const enrichedChannel = await enrichChannelWithUserData(channel, User)

        return NextResponse.json({ channel: enrichedChannel }, { status: 201 })
    } catch (error) {
        console.error('Error creating channel:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}