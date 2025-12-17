import { prisma } from './prisma'
import type { Channel, Message, ChannelMember, ReadReceipt, Reaction, Attachment } from '@prisma/client'

// Channel operations
export const channelOperations = {
  // Create a new channel
  create: async (data: {
    type: string
    name?: string
    mongo_department_id?: string
    mongo_project_id?: string
    mongo_creator_id: string
    is_private?: boolean
  }) => {
    return await prisma.channel.create({
      data: {
        type: data.type,
        name: data.name,
        mongo_department_id: data.mongo_department_id,
        mongo_project_id: data.mongo_project_id,
        mongo_creator_id: data.mongo_creator_id,
        is_private: data.is_private ?? false,
        member_count: 0,
      },
    })
  },

  // Get channels for a user
  getUserChannels: async (mongo_user_id: string) => {
    return await prisma.channel.findMany({
      where: {
        channel_members: {
          some: {
            mongo_member_id: mongo_user_id,
          },
        },
      },
      include: {
        channel_members: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { updated_at: 'desc' },
    })
  },

  // Add member to channel
  addMember: async (channel_id: string, mongo_member_id: string, role: string = 'member') => {
    return await prisma.channelMember.create({
      data: {
        channel_id,
        mongo_member_id,
        role,
      },
    })
  },
}

// Message operations
export const messageOperations = {
  // Create a new message
  create: async (data: {
    channel_id: string
    mongo_sender_id: string
    content: string
    content_type?: string
    thread_id?: string
    mongo_mentioned_user_ids?: string[]
  }) => {
    return await prisma.message.create({
      data: {
        channel_id: data.channel_id,
        mongo_sender_id: data.mongo_sender_id,
        content: data.content,
        content_type: data.content_type ?? 'text',
        thread_id: data.thread_id,
        mongo_mentioned_user_ids: data.mongo_mentioned_user_ids ?? [],
      },
    })
  },

  // Get messages for a channel
  getChannelMessages: async (channel_id: string, limit: number = 50, offset: number = 0) => {
    return await prisma.message.findMany({
      where: { channel_id },
      include: {
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    })
  },

  // Mark message as read
  markAsRead: async (message_id: string, mongo_user_id: string) => {
    return await prisma.readReceipt.upsert({
      where: {
        message_id_mongo_user_id: {
          message_id,
          mongo_user_id,
        },
      },
      update: { read_at: new Date() },
      create: {
        message_id,
        mongo_user_id,
        read_at: new Date(),
      },
    })
  },
}

// Channel member operations
export const memberOperations = {
  // Update online status
  updateOnlineStatus: async (channel_id: string, mongo_member_id: string, is_online: boolean) => {
    return await prisma.channelMember.updateMany({
      where: {
        channel_id,
        mongo_member_id,
      },
      data: {
        is_online,
        last_seen_at: new Date(),
      },
    })
  },

  // Get online members
  getOnlineMembers: async (channel_id: string) => {
    return await prisma.channelMember.findMany({
      where: {
        channel_id,
        is_online: true,
      },
    })
  },
}

// Utility functions
export const dbUtils = {
  // Health check
  healthCheck: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'healthy', timestamp: new Date() }
    } catch (error) {
      return { status: 'unhealthy', error: (error as any).message, timestamp: new Date() }
    }
  },

  // Clean up old data (optional)
  cleanup: async (daysOld: number = 30) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    // This is just an example - implement based on your retention policy
    return {
      deletedMessages: 0,
      deletedReadReceipts: 0,
      timestamp: new Date(),
    }
  },
}

// Helper function to enrich channels with MongoDB user data
export async function enrichChannelWithUserData(channel: any, userModel: any) {
  try {
    // Get all unique member IDs
    const memberIds = channel.channel_members?.map((m: any) => m.mongo_member_id) || []
    
    // Fetch user details from MongoDB
    const users = await userModel.find({ _id: { $in: memberIds } }).lean()
    
    // Map users to participants format
    const participants = users.map((user: any) => ({
      mongo_member_id: user._id.toString(),
      name: user.name || user.email,
      email: user.email,
      avatar: user.avatar,
      isOnline: false, // Will be updated from channel_members
      userType: user.isClient ? 'Client' : 'User',
      role: typeof user.role === 'string' ? user.role : user.role?.name || 'User'
    }))
    
    // Update online status from channel_members
    channel.channel_members?.forEach((member: any) => {
      const participant = participants.find((p: any) => p.mongo_member_id === member.mongo_member_id)
      if (participant) {
        participant.isOnline = member.is_online || false
      }
    })
    
    return {
      ...channel,
      participants
    }
  } catch (error) {
    console.error('Error enriching channel with user data:', error)
    return {
      ...channel,
      participants: []
    }
  }
}