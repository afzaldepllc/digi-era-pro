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
  private channels: Map<string, RealtimeChannel> = new Map()
  private eventHandlers: RealtimeEventHandlers = {}

  constructor(handlers: RealtimeEventHandlers = {}) {
    this.eventHandlers = handlers
  }

  // Subscribe to a channel's events
  subscribeToChannel(channelId: string): RealtimeChannel {
    if (this.channels.has(channelId)) {
      return this.channels.get(channelId)!
    }

    const channel = supabase.channel(`channel_${channelId}`, {
      config: {
        presence: {
          key: channelId,
        },
      },
    })

    // Subscribe to messages table changes
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('🔔 Realtime: New message detected', payload)
          if (this.eventHandlers.onNewMessage) {
            console.log('✅ Calling onNewMessage handler')
            this.eventHandlers.onNewMessage(payload.new)
          } else {
            console.log('❌ No onNewMessage handler registered')
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('🔔 Realtime: Message updated', payload)
          if (this.eventHandlers.onMessageUpdate) {
            this.eventHandlers.onMessageUpdate(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          console.log('🔔 Realtime: Message deleted', payload)
          if (this.eventHandlers.onMessageDelete) {
            this.eventHandlers.onMessageDelete(payload.old.id)
          }
        }
      )
      // Subscribe to channel members changes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_members',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          this.eventHandlers.onUserJoined?.(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channel_members',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          this.eventHandlers.onUserLeft?.(payload.old.mongo_member_id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_members',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.new.is_online && !payload.old.is_online) {
            this.eventHandlers.onUserOnline?.(payload.new.mongo_member_id)
          } else if (!payload.new.is_online && payload.old.is_online) {
            this.eventHandlers.onUserOffline?.(payload.new.mongo_member_id)
          }
        }
      )
      // Subscribe to reactions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reactions',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          this.eventHandlers.onReactionAdd?.(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'reactions',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          this.eventHandlers.onReactionRemove?.(payload.old.id)
        }
      )
      // Subscribe to broadcast events (typing indicators, etc.)
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        this.eventHandlers.onTypingStart?.(payload.payload.userId)
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        this.eventHandlers.onTypingStop?.(payload.payload.userId)
      })

    // Subscribe to the channel
    channel.subscribe(async (status, err) => {
      console.log(`🔌 Channel subscription status for ${channelId}:`, status)
      if (err) {
        console.error('❌ Subscription error:', err)
      }
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Successfully subscribed to channel ${channelId}`)
        console.log('📡 Active handlers:', Object.keys(this.eventHandlers))
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Channel error for ${channelId}`)
      } else if (status === 'TIMED_OUT') {
        console.error(`⏱️ Channel subscription timed out for ${channelId}`)
      }
    })

    this.channels.set(channelId, channel)
    return channel
  }

  // Unsubscribe from a channel
  unsubscribeFromChannel(channelId: string) {
    const channel = this.channels.get(channelId)
    if (channel) {
      supabase.removeChannel(channel)
      this.channels.delete(channelId)
    }
  }

  // Send typing indicator
  sendTypingStart(channelId: string, userId: string) {
    const channel = this.channels.get(channelId)
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: { userId, timestamp: Date.now() },
      })
    }
  }

  sendTypingStop(channelId: string, userId: string) {
    const channel = this.channels.get(channelId)
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: { userId, timestamp: Date.now() },
      })
    }
  }

  // Update event handlers
  updateHandlers(handlers: Partial<RealtimeEventHandlers>) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  // Cleanup all subscriptions
  cleanup() {
    for (const [channelId, channel] of this.channels) {
      supabase.removeChannel(channel)
    }
    this.channels.clear()
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