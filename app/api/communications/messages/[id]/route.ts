import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Communication from "@/models/Communication"
import Channel from "@/models/Channel"
import { updateMessageSchema, objectIdSchema } from "@/lib/validations/communication"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

interface RouteParams {
    params: { id: string }
}

// GET /api/communications/messages/[id] - Get message by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const id = objectIdSchema.parse(params.id)

        const message = await executeGenericDbQuery(async () => {
            return await Communication.findById(id)
                .populate('senderId', 'name email avatar role')
                .populate('receiverId', 'name email avatar')
                .populate('parentMessageId', 'message senderId createdAt')
                .populate('projectId', 'name')
                .lean()
        }, `message-${id}`, 60000) // 1 minute cache

        if (!message) {
            return NextResponse.json({
                success: false,
                error: 'Message not found'
            }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: message
        })

    } catch (error: any) {
        console.error('Error fetching message:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch message'
        }, { status: 500 })
    }
}

// PUT /api/communications/messages/[id] - Update message
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const id = objectIdSchema.parse(params.id)
        const body = await request.json()
        const validatedData = updateMessageSchema.parse(body)
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
            const message = await Communication.findById(id)
            if (!message) {
                throw new Error('Message not found')
            }

            // Check permissions - only sender can edit
            if (message.senderId.toString() !== userId) {
                throw new Error('Unauthorized to edit this message')
            }

            // Update fields
            Object.assign(message, validatedData)
            if (validatedData.isRead) {
                message.readAt = new Date()
            }

            await message.save()

            // Populate updated message
            await message.populate('senderId', 'name email avatar role')
            await message.populate('parentMessageId', 'message senderId createdAt')

            return message
        })

        // Clear cache
        clearCache(`message-${id}`)
        clearCache('messages')

        return NextResponse.json({
            success: true,
            data: result,
            message: 'Message updated successfully'
        })

    } catch (error: any) {
        console.error('Error updating message:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to update message'
        }, { status: error.message.includes('validation') || error.message.includes('Unauthorized') ? 400 : 500 })
    }
}

// DELETE /api/communications/messages/[id] - Delete message
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const id = objectIdSchema.parse(params.id)
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
            const message = await Communication.findById(id)
            if (!message) {
                throw new Error('Message not found')
            }

            // Check permissions - only sender can delete
            if (message.senderId.toString() !== userId) {
                throw new Error('Unauthorized to delete this message')
            }

            // Get channel to update last message if needed
            const channel = await Channel.findOne({ channelId: message.channelId })

            // Delete message
            await Communication.findByIdAndDelete(id)

            // Update channel's last message if this was the last message
            if (channel && channel.lastMessage?.toString() === id) {
                const lastMessage = await Communication.findOne({ channelId: message.channelId })
                    .sort({ createdAt: -1 })
                    .select('_id')
                channel.lastMessage = lastMessage?._id || null
                await channel.save()
            }

            return message
        })

        // Clear cache
        clearCache(`message-${id}`)
        clearCache('messages')

        return NextResponse.json({
            success: true,
            message: 'Message deleted successfully'
        })

    } catch (error: any) {
        console.error('Error deleting message:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to delete message'
        }, { status: error.message.includes('Unauthorized') ? 403 : 500 })
    }
}