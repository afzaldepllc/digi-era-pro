import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimeEventHandlers {
  onNewMessage?: (message: any) => void
  onMessageUpdate?: (message: any) => void
  onMessageDelete?: (messageId: string) => void
  onUserJoined?: (member: any) => void
  onUserLeft?: (memberId: string) => void
  onUserOnline?: (userId: string) => void
  onUserOffline?: (userId: string) => void
  onTypingStart?: (userId: string) => void
  onTypingStop?: (userId: string) => void
  onReactionAdd?: (reaction: any) => void
  onReactionRemove?: (reactionId: string) => void
}

export class RealtimeManager {
  private rtChannels: Map<string, RealtimeChannel> = new Map()
  private subscriptionPromises: Map<string, Promise<void>> = new Map()
  private eventHandlers: RealtimeEventHandlers = {}

  constructor(handlers: RealtimeEventHandlers = {}) {
    this.eventHandlers = handlers
  }

  // Subscribe to a channel's events
  subscribeToChannel(channelId: string): Promise<void> {
    const existingPromise = this.subscriptionPromises.get(channelId)
    if (existingPromise) {
      console.log("🔄 Returning existing subscription promise for:", channelId)
      return existingPromise
    }

    if (this.rtChannels.has(channelId)) {
      console.log("🔄 RT Channel already exists for:", channelId)
      return Promise.resolve()
    }

    console.log("🆕 Creating RT channel for:", channelId)

    const subscriptionPromise = new Promise<void>((resolve, reject) => {
      // RT Channel for broadcast and presence
      const rtChannel = supabase.channel(`rt_${channelId}`, {
        config: {
          broadcast: {
            self: false, // Prevent sender from receiving own broadcasts
          },
          presence: {
            key: channelId,
          },
        },
      })

      // Subscribe to broadcast events (new messages, typing indicators, etc.)
      rtChannel
        .on('broadcast', { event: 'new_message' }, (payload) => {
          console.log('🔔 Realtime: New message broadcast', payload)
          if (this.eventHandlers.onNewMessage) {
            console.log('✅ Calling onNewMessage handler')
            this.eventHandlers.onNewMessage(payload.payload)
          } else {
            console.log('❌ No onNewMessage handler registered')
          }
        })
        .on('broadcast', { event: 'typing_start' }, (payload) => {
          console.log('🔔 Realtime: Typing start', payload)
          this.eventHandlers.onTypingStart?.(payload.payload.userId)
        })
        .on('broadcast', { event: 'typing_stop' }, (payload) => {
          console.log('🔔 Realtime: Typing stop', payload)
          this.eventHandlers.onTypingStop?.(payload.payload.userId)
        })

      rtChannel.subscribe((status, err) => {
        console.log(`🔌 RT Channel subscription status for ${channelId}:`, status)
        if (err) {
          console.error('❌ RT Subscription error:', err)
          this.subscriptionPromises.delete(channelId) // Clean up on error
          reject(err)
        }
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to RT channel ${channelId}`)
          this.rtChannels.set(channelId, rtChannel)
          this.subscriptionPromises.delete(channelId) // Clean up after success
          resolve()
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ RT Channel error for ${channelId}`)
          this.subscriptionPromises.delete(channelId)
          reject(new Error(`RT Channel error for ${channelId}`))
        } else if (status === 'TIMED_OUT') {
          console.error(`⏱️ RT Channel subscription timed out for ${channelId}`)
          this.subscriptionPromises.delete(channelId)
          reject(new Error(`RT Channel subscription timed out for ${channelId}`))
        }
      })
    })

    this.subscriptionPromises.set(channelId, subscriptionPromise)
    return subscriptionPromise
  }

  // Unsubscribe from a channel
  unsubscribeFromChannel(channelId: string) {
    const rtChannel = this.rtChannels.get(channelId)
    if (rtChannel) {
      supabase.removeChannel(rtChannel)
      this.rtChannels.delete(channelId)
    }
    this.subscriptionPromises.delete(channelId)
  }

  // Send typing indicator
  async sendTypingStart(channelId: string, userId: string) {
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error('❌ Failed to subscribe for typing start:', error)
        return
      }
    }
    if (rtChannel) {
      rtChannel.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: { userId, timestamp: Date.now() },
      })
    }
  }

  async sendTypingStop(channelId: string, userId: string) {
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error('❌ Failed to subscribe for typing stop:', error)
        return
      }
    }
    if (rtChannel) {
      rtChannel.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: { userId, timestamp: Date.now() },
      })
    }
  }

  // Broadcast a new message to channel
  async broadcastMessage(channelId: string, message: any) {
    console.log('📡 Attempting to broadcast message to channel:', channelId)
    console.log('📡 Available rt channels:', Array.from(this.rtChannels.keys()))
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      console.log('🆕 RT Channel not found, subscribing first...')
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error('❌ Failed to subscribe to channel for broadcasting:', error)
        return
      }
    }
    if (rtChannel) {
      console.log('📡 Broadcasting message to rt channel:', channelId, message)
      rtChannel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: message
      })
    } else {
      console.error('❌ No channel found for broadcasting:', channelId)
    }
  }

  // Update event handlers
  updateHandlers(handlers: Partial<RealtimeEventHandlers>) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  // Cleanup all subscriptions
  cleanup() {
    for (const [channelId, rtChannel] of this.rtChannels) {
      supabase.removeChannel(rtChannel)
    }
    this.rtChannels.clear()
    this.subscriptionPromises.clear()
  }
}
  
// Singleton instance
let realtimeManager: RealtimeManager | null = null

export const getRealtimeManager = (handlers?: RealtimeEventHandlers): RealtimeManager => {
  if (!realtimeManager) {
    realtimeManager = new RealtimeManager(handlers)
  } else if (handlers) {
    realtimeManager.updateHandlers(handlers)
  }
  return realtimeManager
}