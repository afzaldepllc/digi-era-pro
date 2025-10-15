import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import jwt from 'jsonwebtoken'
import User from '@/models/User'
import Channel from '@/models/Channel'
import Communication from '@/models/Communication'
import connectDB from '@/lib/mongodb'

interface SocketUser {
  id: string
  name: string
  email: string
  role?: string
  department?: string
}

interface ServerToClientEvents {
  'message:receive': (message: any) => void
  'message:read': (data: { messageId: string; userId: string }) => void
  'message:typing': (data: { channelId: string; userId: string; userName: string }) => void
  'message:stop_typing': (data: { channelId: string; userId: string }) => void
  'channel:updated': (channel: any) => void
  'user:online': (userId: string) => void
  'user:offline': (userId: string) => void
  'notification:new_message': (data: { channelId: string; message: any }) => void
  'error': (error: string) => void
}

interface ClientToServerEvents {
  'user:connect': (data: { token: string; channelIds: string[] }) => void
  'channel:join': (channelId: string) => void
  'channel:leave': (channelId: string) => void
  'message:send': (data: { channelId: string; message: string; attachments?: string[] }) => void
  'message:read': (data: { messageId: string; channelId: string }) => void
  'message:typing': (data: { channelId: string }) => void
  'message:stop_typing': (data: { channelId: string }) => void
  'user:heartbeat': () => void
}

interface InterServerEvents {
  ping: () => void
}

interface SocketData {
  user?: SocketUser
}

// Redis clients for adapter
let pubClient: any
let subClient: any

// Initialize Redis clients
if (process.env.REDIS_URL) {
  pubClient = createClient({ url: process.env.REDIS_URL })
  subClient = pubClient.duplicate()

  pubClient.on('error', (err: any) => console.error('Redis Pub Client Error', err))
  subClient.on('error', (err: any) => console.error('Redis Sub Client Error', err))
}

const io = new ServerIO<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>()

// Use Redis adapter if available
if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient))
}

// Store online users with heartbeat tracking
const onlineUsers = new Map<string, {
  socketId: string
  user: SocketUser
  channels: string[]
  lastHeartbeat: number
}>()

// Clean up inactive users
setInterval(() => {
  const now = Date.now()
  const timeout = 60000 // 1 minute timeout

  for (const [userId, userData] of onlineUsers.entries()) {
    if (now - userData.lastHeartbeat > timeout) {
      console.log(`User ${userData.user.name} timed out`)
      onlineUsers.delete(userId)

      // Notify others that user is offline
      io.emit('user:offline', userId)
    }
  }
}, 30000) // Check every 30 seconds

// JWT verification
async function verifyToken(token: string): Promise<SocketUser | null> {
  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any

    // Get user details from database
    await connectDB()
    const user = await User.findById(decoded.id).select('name email role department')
    if (!user) return null

    return {
      id: (user as any)._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role?.toString(),
      department: user.department?.toString()
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  // User connection
  socket.on('user:connect', async (data) => {
    try {
      const user = await verifyToken(data.token)
      if (!user) {
        socket.emit('error', 'Authentication failed')
        socket.disconnect()
        return
      }

      // Store user data
      socket.data.user = user
      onlineUsers.set(user.id, {
        socketId: socket.id,
        user,
        channels: data.channelIds || [],
        lastHeartbeat: Date.now()
      })

      // Join user's channels
      for (const channelId of data.channelIds) {
        socket.join(channelId)
      }

      // Notify others that user is online
      socket.broadcast.emit('user:online', user.id)
      console.log(`User ${user.name} connected`)

    } catch (error) {
      console.error('User connect error:', error)
      socket.emit('error', 'Connection failed')
    }
  })

  // Join channel
  socket.on('channel:join', (channelId) => {
    if (!socket.data.user) return

    socket.join(channelId)

    // Update user's channels
    const userData = onlineUsers.get(socket.data.user.id)
    if (userData && !userData.channels.includes(channelId)) {
      userData.channels.push(channelId)
    }

    console.log(`User ${socket.data.user.name} joined channel ${channelId}`)
  })

  // Leave channel
  socket.on('channel:leave', (channelId) => {
    if (!socket.data.user) return

    socket.leave(channelId)

    // Update user's channels
    const userData = onlineUsers.get(socket.data.user.id)
    if (userData) {
      userData.channels = userData.channels.filter(id => id !== channelId)
    }

    console.log(`User ${socket.data.user.name} left channel ${channelId}`)
  })

  // Send message
  socket.on('message:send', async (data) => {
    try {
      if (!socket.data.user) {
        socket.emit('error', 'Not authenticated')
        return
      }

      await connectDB()

      // Verify user has access to channel
      const channel = await Channel.findOne({
        channelId: data.channelId,
        isActive: true,
        participants: socket.data.user.id
      })

      if (!channel) {
        socket.emit('error', 'Channel access denied')
        return
      }

      // Create message
      const message = new Communication({
        channelId: data.channelId,
        senderId: socket.data.user.id,
        senderModel: 'User',
        message: data.message,
        attachments: data.attachments || [],
        isInternal: channel.isInternal,
        communicationType: 'chat',
        priority: 'medium'
      })

      await message.save()

      // Update channel's last message
      channel.lastMessage = message._id

      // Update unread counts for other participants
      if (socket.data.user) {
        const userId = socket.data.user.id
        channel.participants.forEach((participantId: any) => {
          if (participantId.toString() !== userId) {
            const currentCount = channel.unreadCounts.get(participantId.toString()) || 0
            channel.unreadCounts.set(participantId.toString(), currentCount + 1)
          }
        })
      }

      await channel.save()

      // Populate message
      await message.populate('senderId', 'name email avatar role')

      // Send to all users in the channel
      io.to(data.channelId).emit('message:receive', message)

      // Send notification to offline users
      const onlineUserIds = Array.from(onlineUsers.keys())
      const offlineParticipants = channel.participants.filter((p: any) =>
        !onlineUserIds.includes(p.toString()) && (!socket.data.user || p.toString() !== socket.data.user.id)
      )

      if (offlineParticipants.length > 0) {
        // Here you could integrate with push notifications
        console.log(`Sending notifications to offline users: ${offlineParticipants.length}`)
      }

    } catch (error) {
      console.error('Message send error:', error)
      socket.emit('error', 'Failed to send message')
    }
  })

  // Mark message as read
  socket.on('message:read', async (data) => {
    try {
      if (!socket.data.user) return

      await connectDB()

      // Update message read status
      const message = await Communication.findById(data.messageId)
      if (message && message.senderId.toString() !== socket.data.user.id) {
        message.isRead = true
        message.readAt = new Date()
        await message.save()

        // Update channel unread count
        const channel = await Channel.findOne({ channelId: data.channelId })
        if (channel) {
          const currentCount = channel.unreadCounts.get(socket.data.user.id) || 0
          if (currentCount > 0) {
            channel.unreadCounts.set(socket.data.user.id, currentCount - 1)
            await channel.save()
          }
        }

        // Notify sender that message was read
        const senderSocket = Array.from(onlineUsers.values())
          .find(u => u.user.id === message.senderId.toString())?.socketId

        if (senderSocket) {
          io.to(senderSocket).emit('message:read', {
            messageId: data.messageId,
            userId: socket.data.user.id
          })
        }
      }

    } catch (error) {
      console.error('Message read error:', error)
    }
  })

  // Typing indicators
  socket.on('message:typing', (data) => {
    if (!socket.data.user) return

    socket.to(data.channelId).emit('message:typing', {
      channelId: data.channelId,
      userId: socket.data.user.id,
      userName: socket.data.user.name
    })
  })

  socket.on('message:stop_typing', (data) => {
    if (!socket.data.user) return

    socket.to(data.channelId).emit('message:stop_typing', {
      channelId: data.channelId,
      userId: socket.data.user.id
    })
  })

  // Heartbeat for presence tracking
  socket.on('user:heartbeat', () => {
    if (socket.data.user) {
      const userData = onlineUsers.get(socket.data.user.id)
      if (userData) {
        userData.lastHeartbeat = Date.now()
      }
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.data.user) {
      const userId = socket.data.user.id
      onlineUsers.delete(userId)

      // Notify others that user is offline
      socket.broadcast.emit('user:offline', userId)
      console.log(`User ${socket.data.user.name} disconnected`)
    }

    console.log(`Socket disconnected: ${socket.id}`)
  })
})

// Next.js API route handler
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket) {
    res.status(500).json({ error: 'Socket not available' })
    return
  }

  // @ts-ignore - Next.js socket typing issue
  const socket = res.socket as any
  if (!socket.server.io) {
    console.log('Initializing Socket.io server...')

    // Initialize Redis clients if available
    if (pubClient && subClient) {
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        console.log('Redis clients connected')
      }).catch(err => {
        console.error('Redis connection failed:', err)
      })
    }

    socket.server.io = io
    socket.server.io.attach(socket.server)
  }

  res.end()
}

export { io }