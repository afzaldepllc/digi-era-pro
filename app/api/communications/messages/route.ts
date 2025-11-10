import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Communication from "@/models/Communication"
import Channel from "@/models/Channel"
import User from "@/models/User"
import { createMessageSchema, messageQuerySchema } from "@/lib/validations/communication"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/communications/messages - List messages with pagination and filtering
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const queryData: any = {}

        const channelId = searchParams.get('channelId')
        if (channelId) queryData.channelId = channelId

        const page = searchParams.get('page')
        if (page) queryData.page = page

        const limit = searchParams.get('limit')
        if (limit) queryData.limit = limit

        const communicationType = searchParams.get('communicationType')
        if (communicationType) queryData.communicationType = communicationType

        const priority = searchParams.get('priority')
        if (priority) queryData.priority = priority

        const isRead = searchParams.get('isRead')
        if (isRead !== null) queryData.isRead = isRead === 'true'

        const sortBy = searchParams.get('sortBy')
        if (sortBy) queryData.sortBy = sortBy

        const sortOrder = searchParams.get('sortOrder')
        if (sortOrder) queryData.sortOrder = sortOrder

        const query = messageQuerySchema.parse(queryData)

        const result = await executeGenericDbQuery(async () => {
            // Build filter
            const filter: any = {}

            if (query.channelId) {
                const orConditions = [{ channelId: query.channelId }]
                // Check if channelId is a valid ObjectId for _id filter
                if (/^[0-9a-fA-F]{24}$/.test(query.channelId)) {
                    orConditions.push({ _id: query.channelId as any })
                }
                filter.$or = orConditions
            }
            if (query.isRead !== undefined) filter.isRead = query.isRead

            // Calculate pagination
            const skip = (query.page - 1) * query.limit

            // Get messages with populated data
            const messages = await Communication.find(filter)
                .populate('senderId', 'name email avatar role')
                .populate('receiverId', 'name email avatar')
                .populate('parentMessageId', 'message senderId createdAt')
                .populate('projectId', 'name')
                .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(query.limit)
                .lean()

            // Get total count
            const total = await Communication.countDocuments(filter)

            return {
                messages,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    pages: Math.ceil(total / query.limit)
                }
            }
        }, `messages-${JSON.stringify(query)}`, 30000) // 30 second cache

        return NextResponse.json({
            success: true,
            data: result.messages,
            pagination: result.pagination
        })

    } catch (error: any) {
        console.error('Error fetching messages:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch messages'
        }, { status: 500 })
    }
}

// POST /api/communications/messages - Create new message
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const validatedData = createMessageSchema.parse(body)
        const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'profile', 'read')

        // Get current user from middleware
        const userId = user.id;
        if (!userId) {
            return NextResponse.json({
                success: false,
                error: 'User not authenticated'
            }, { status: 401 })
        }

        const result = await executeGenericDbQuery(async () => {
            // Verify user has access to the channel
            const channel = await Channel.findOne({
                channelId: validatedData.channelId,
                isActive: true,
                participants: userId
            })

            if (!channel) {
                throw new Error('Channel not found or access denied')
            }

            // Create message
            const message = new Communication({
                ...validatedData,
                senderId: userId,
                senderModel: 'User', // Assuming internal users for now
                isInternal: channel.isInternal
            })

            await message.save()

            // Update channel's last message
            channel.lastMessage = message._id

            // Update unread counts for other participants
            channel.participants.forEach((participantId: any) => {
                if (participantId.toString() !== userId) {
                    const currentCount = channel.unreadCounts.get(participantId.toString()) || 0
                    channel.unreadCounts.set(participantId.toString(), currentCount + 1)
                }
            })

            await channel.save()

            // Populate the message
            await message.populate('senderId', 'name email avatar role')
            await message.populate('parentMessageId', 'message senderId createdAt')

            return message
        })

        // Clear cache
        clearCache(`messages-${JSON.stringify({ channelId: validatedData.channelId })}`)
        clearCache('messages')

        return NextResponse.json({
            success: true,
            data: result,
            message: 'Message sent successfully'
        }, { status: 201 })

    } catch (error: any) {
        console.error('Error creating message:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to send message'
        }, { status: error.message.includes('validation') || error.message.includes('access') ? 400 : 500 })
    }
}