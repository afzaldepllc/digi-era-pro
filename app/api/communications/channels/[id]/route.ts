import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Channel from "@/models/Channel"
import { updateChannelSchema, channelIdSchema } from "@/lib/validations/communication"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

interface RouteParams {
    params: { id: string }
}

// GET /api/communications/channels/[id] - Get channel by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const id = channelIdSchema.parse(params.id)

        const channel = await executeGenericDbQuery(async () => {
            return await Channel.findOne({ _id: id, isActive: true })
                .populate('participants', 'name email avatar role isOnline')
                .populate('projectId', 'name status')
                .populate('departmentId', 'name')
                .populate('lastMessage', 'message senderId createdAt communicationType')
                .populate('createdBy', 'name')
                .lean()
        }, `channel-${id}`, 60000) // 1 minute cache

        if (!channel) {
            return NextResponse.json({
                success: false,
                error: 'Channel not found'
            }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            data: channel
        })

    } catch (error: any) {
        console.error('Error fetching channel:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch channel'
        }, { status: 500 })
    }
}

// PUT /api/communications/channels/[id] - Update channel
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const id = channelIdSchema.parse(params.id)
        const body = await request.json()
        const validatedData = updateChannelSchema.parse(body)
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
            const channel = await Channel.findOne({ _id: id, isActive: true })
            if (!channel) {
                throw new Error('Channel not found')
            }

            // Check permissions - only creator or participants can update
            if (!channel.participants.includes(userId) && channel.createdBy.toString() !== userId) {
                throw new Error('Unauthorized to update this channel')
            }

            // Update fields
            Object.assign(channel, validatedData)
            await channel.save()

            // Populate updated channel
            await channel.populate('participants', 'name email avatar role')
            await channel.populate('projectId', 'name')
            await channel.populate('departmentId', 'name')

            return channel
        })

        // Clear cache
        clearCache(`channel-${id}`)
        clearCache('channels')

        return NextResponse.json({
            success: true,
            data: result,
            message: 'Channel updated successfully'
        })

    } catch (error: any) {
        console.error('Error updating channel:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to update channel'
        }, { status: error.message.includes('validation') || error.message.includes('Unauthorized') ? 400 : 500 })
    }
}

// DELETE /api/communications/channels/[id] - Soft delete channel
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const id = channelIdSchema.parse(params.id)
        const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'channels', 'delete')
        // Get current user from middleware
        const userId = user.id;
        if (!userId) {
            return NextResponse.json({
                success: false,
                error: 'User not authenticated'
            }, { status: 401 })
        }

        const result = await executeGenericDbQuery(async () => {
            const channel = await Channel.findOne({ _id: id, isActive: true })
            if (!channel) {
                throw new Error('Channel not found')
            }

            // Check permissions - only creator can delete
            if (channel.createdBy.toString() !== userId) {
                throw new Error('Only channel creator can delete this channel')
            }

            // Soft delete
            channel.isActive = false
            await channel.save()

            return channel
        })

        // Clear cache
        clearCache(`channel-${id}`)
        clearCache('channels')

        return NextResponse.json({
            success: true,
            message: 'Channel deleted successfully'
        })

    } catch (error: any) {
        console.error('Error deleting channel:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to delete channel'
        }, { status: error.message.includes('Unauthorized') ? 403 : 500 })
    }
}