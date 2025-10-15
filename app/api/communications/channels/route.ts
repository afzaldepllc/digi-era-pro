import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Channel from "@/models/Channel"
import User from "@/models/User"
import Department from "@/models/Department"
import Project from "@/models/Project"
import { createChannelSchema, channelQuerySchema } from "@/lib/validations/communication"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'

// GET /api/communications/channels - List channels with pagination and filtering
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'profile', 'read')

        // Build query object with proper defaults
        const queryData: any = {}

        const page = searchParams.get('page')
        if (page) queryData.page = parseInt(page)

        const limit = searchParams.get('limit')
        if (limit) queryData.limit = parseInt(limit)

        const type = searchParams.get('type')
        if (type) queryData.type = type

        const search = searchParams.get('search')
        if (search) queryData.search = search

        const isInternal = searchParams.get('isInternal')
        if (isInternal !== null) queryData.isInternal = isInternal === 'true'

        const sortBy = searchParams.get('sortBy')
        if (sortBy) queryData.sortBy = sortBy

        const sortOrder = searchParams.get('sortOrder')
        if (sortOrder) queryData.sortOrder = sortOrder

        const query = channelQuerySchema.parse(queryData)

        const result = await executeGenericDbQuery(async () => {
            // Build filter
            const filter: any = { isActive: true }

            if (query.type) filter.type = query.type
            if (query.isInternal !== undefined) filter.isInternal = query.isInternal
            if (query.search) {
                filter.$or = [
                    { name: new RegExp(query.search, 'i') },
                    { channelId: new RegExp(query.search, 'i') }
                ]
            }

            // Get current user from middleware
            const userId = user.id;
            if (userId) {
                filter.participants = userId // Only show channels user is part of
            }

            // Calculate pagination
            const skip = (query.page - 1) * query.limit

            // Get channels with populated data
            const channels = await Channel.find(filter)
                .populate('participants', 'name email avatar role')
                .populate('projectId', 'name')
                .populate('departmentId', 'name')
                .populate('lastMessage', 'message senderId createdAt')
                .populate('createdBy', 'name')
                .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(query.limit)
                .lean()

            // Get total count
            const total = await Channel.countDocuments(filter)

            return {
                channels,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    pages: Math.ceil(total / query.limit)
                }
            }
        }, `channels-${JSON.stringify(query)}`, 30000) // 30 second cache

        return NextResponse.json({
            success: true,
            data: result.channels,
            pagination: result.pagination
        })

    } catch (error: any) {
        console.error('Error fetching channels:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch channels'
        }, { status: 500 })
    }
}

// POST /api/communications/channels - Create new channel
export async function POST(request: NextRequest) {
    try {

        const body = await request.json()
        const validatedData = createChannelSchema.parse(body)
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
            let channel

            // Handle different channel types
            switch (validatedData.type) {
                case 'dm':
                    if (validatedData.participants.length !== 2) {
                        throw new Error('DM channels must have exactly 2 participants')
                    }
                    channel = await (Channel as any).findOrCreateDM(validatedData.participants[0], validatedData.participants[1])
                    break

                case 'department':
                    if (!validatedData.departmentId) {
                        throw new Error('Department ID required for department channels')
                    }
                    // Get department details
                    const department = await Department.findById(validatedData.departmentId)
                    if (!department) {
                        throw new Error('Department not found')
                    }
                    // Get all users in this department
                    const deptUsers = await User.find({ department: validatedData.departmentId, status: 'active' })
                    const participantIds = deptUsers.map((u: any) => u._id.toString())
                    channel = await (Channel as any).createDepartmentChannel(
                        validatedData.departmentId,
                        department.name,
                        participantIds
                    )
                    break

                case 'project':
                    if (!validatedData.projectId) {
                        throw new Error('Project ID required for project channels')
                    }
                    // Get project details
                    const project = await Project.findById(validatedData.projectId)
                    if (!project) {
                        throw new Error('Project not found')
                    }
                    channel = await (Channel as any).createProjectChannel(
                        validatedData.projectId,
                        project.name,
                        validatedData.participants,
                        userId
                    )
                    break

                case 'general':
                    channel = await (Channel as any).getOrCreateGeneralChannel()
                    // Add participants to general channel
                    if (validatedData.participants.length > 0) {
                        channel.participants = validatedData.participants
                        await channel.save()
                    }
                    break

                default:
                    // Create regular group channel
                    channel = new Channel({
                        ...validatedData,
                        channelId: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        createdBy: userId
                    })
                    await channel.save()
            }

            // Populate the created channel
            await channel.populate('participants', 'name email avatar role')
            await channel.populate('projectId', 'name')
            await channel.populate('departmentId', 'name')

            return channel
        })

        // Clear cache
        clearCache('channels')

        return NextResponse.json({
            success: true,
            data: result,
            message: 'Channel created successfully'
        }, { status: 201 })

    } catch (error: any) {
        console.error('Error creating channel:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to create channel'
        }, { status: error.message.includes('validation') ? 400 : 500 })
    }
}