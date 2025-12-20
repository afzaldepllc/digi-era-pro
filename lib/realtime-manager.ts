import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

// ============================================
// Type Definitions
// ============================================

export interface RealtimeEventHandlers {
  onNewMessage?: (message: any) => void
  onMessageUpdate?: (message: any) => void
  onMessageDelete?: (messageId: string) => void
  onMessageRead?: (data: { messageId: string; userId: string; channelId: string; readAt: string }) => void
  onMessageDelivered?: (data: { messageId: string; channelId: string }) => void
  onUserJoined?: (member: any) => void
  onUserLeft?: (memberId: string) => void
  onUserOnline?: (userId: string) => void
  onUserOffline?: (userId: string) => void
  onTypingStart?: (data: { userId: string; userName: string; channelId: string }) => void
  onTypingStop?: (data: { userId: string; channelId: string }) => void
  onPresenceSync?: (presenceState: Record<string, any[]>) => void
  onReactionAdd?: (reaction: any) => void
  onReactionRemove?: (reactionId: string) => void
  onChannelUpdate?: (channel: any) => void
  onAttachmentsAdded?: (data: { channelId: string; messageId?: string; attachments: any[] }) => void
  onMentionNotification?: (data: { 
    type: string
    message_id: string
    channel_id: string
    sender_name: string
    sender_avatar?: string
    content_preview: string
    created_at: string
  }) => void
}

export interface PresenceState {
visitorId: string
  userName: string
  userAvatar?: string
  channelId?: string
  online_at: string
}

// ============================================
// RealtimeManager Class - Optimized for Performance
// ============================================

export class RealtimeManager {
  private rtChannels: Map<string, RealtimeChannel> = new Map()
  private subscriptionPromises: Map<string, Promise<void>> = new Map()
  private eventHandlers: RealtimeEventHandlers = {}
  private presenceChannel: RealtimeChannel | null = null
  private currentUserId: string | null = null
  private currentUserName: string | null = null
  private currentUserAvatar: string | null = null
  private presenceInitialized: boolean = false
  
  // Typing debounce management - optimized for smooth experience
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private lastTypingSent: Map<string, number> = new Map()
  private isTyping: Map<string, boolean> = new Map()
  
  // Remote typing indicators (from other users)
  private remoteTypingTimeouts: Map<string, NodeJS.Timeout> = new Map()
  
  // Constants for typing optimization
  private readonly TYPING_THROTTLE_MS = 2000 // Only send typing every 2 seconds
  private readonly TYPING_TIMEOUT_MS = 3500 // Auto-stop typing after 3.5 seconds of inactivity
  private readonly REMOTE_TYPING_TIMEOUT_MS = 4000 // Remove remote typing after 4 seconds

  constructor(handlers: RealtimeEventHandlers = {}) {
    this.eventHandlers = handlers
  }

  // ============================================
  // User Identification
  // ============================================
  
  setCurrentUser(userId: string, userName: string, userAvatar?: string) {
    this.currentUserId = userId
    this.currentUserName = userName
    this.currentUserAvatar = userAvatar || null
  }

  getCurrentUserId(): string | null {
    return this.currentUserId
  }

  // ============================================
  // Global Presence Channel (Online Status)
  // ============================================

  async initializePresence(userId: string, userName: string, userAvatar?: string): Promise<void> {
    if (this.presenceInitialized && this.presenceChannel) {
      console.log('🔄 Presence already initialized')
      return
    }

    this.setCurrentUser(userId, userName, userAvatar)
    
    console.log('🌐 Initializing global presence for user:', userId)

    return new Promise((resolve, reject) => {
      this.presenceChannel = supabase.channel('global_presence', {
        config: {
          presence: {
            key: userId,
          },
        },
      })

      this.presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = this.presenceChannel?.presenceState() || {}
          console.log('🔄 Presence sync - Online users:', Object.keys(state).length)
          this.eventHandlers.onPresenceSync?.(state)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('👋 User came online:', key)
          this.eventHandlers.onUserOnline?.(key)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('👋 User went offline:', key)
          this.eventHandlers.onUserOffline?.(key)
        })

      this.presenceChannel.subscribe(async (status, err) => {
        if (err) {
          console.error('❌ Presence subscription error:', err)
          this.presenceInitialized = false
          reject(err)
          return
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Presence channel subscribed')
          this.presenceInitialized = true
          
          // Track this user's presence
          try {
            await this.presenceChannel?.track({
              visitorId: userId,
              userName: userName,
              userAvatar: userAvatar || '',
              online_at: new Date().toISOString(),
            })
            resolve()
          } catch (trackError) {
            console.error('❌ Failed to track presence:', trackError)
            reject(trackError)
          }
        }
      })
    })
  }

  async updatePresence(updates: Partial<PresenceState>): Promise<void> {
    if (this.presenceChannel && this.currentUserId) {
      try {
        await this.presenceChannel.track({
          visitorId: this.currentUserId,
          userName: this.currentUserName || '',
          userAvatar: this.currentUserAvatar || '',
          online_at: new Date().toISOString(),
          ...updates,
        })
      } catch (error) {
        console.error('❌ Failed to update presence:', error)
      }
    }
  }

  getOnlineUsers(): string[] {
    if (!this.presenceChannel) return []
    const state = this.presenceChannel.presenceState()
    return Object.keys(state)
  }

  getPresenceState(): Record<string, any[]> {
    if (!this.presenceChannel) return {}
    return this.presenceChannel.presenceState()
  }

  // ============================================
  // User Notification Channel (for @mentions)
  // ============================================
  
  private notificationChannel: RealtimeChannel | null = null

  async subscribeToNotifications(userId: string): Promise<void> {
    if (this.notificationChannel) {
      console.log('🔔 Already subscribed to notifications')
      return
    }

    console.log('🔔 Subscribing to notifications for user:', userId)

    return new Promise((resolve, reject) => {
      this.notificationChannel = supabase.channel(`notifications_${userId}`)

      this.notificationChannel
        .on('broadcast', { event: 'mention_notification' }, (payload) => {
          console.log('📬 Received mention notification:', payload.payload)
          this.eventHandlers.onMentionNotification?.(payload.payload)
        })

      this.notificationChannel.subscribe((status, err) => {
        if (err) {
          console.error('❌ Notification subscription error:', err)
          reject(err)
          return
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Notification channel subscribed')
          resolve()
        }
      })
    })
  }

  async unsubscribeFromNotifications(): Promise<void> {
    if (this.notificationChannel) {
      await supabase.removeChannel(this.notificationChannel)
      this.notificationChannel = null
      console.log('🔔 Unsubscribed from notifications')
    }
  }

  isUserOnline(userId: string): boolean {
    if (!this.presenceChannel) return false
    const state = this.presenceChannel.presenceState()
    return !!state[userId]
  }

  // ============================================
  // Channel Subscription
  // ============================================

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
      const rtChannel = supabase.channel(`rt_${channelId}`, {
        config: {
          broadcast: {
            self: false, // Prevent sender from receiving own broadcasts
          },
        },
      })

      // Subscribe to broadcast events
      rtChannel
        .on('broadcast', { event: 'new_message' }, (payload) => {
          console.log('🔔 Realtime: New message broadcast', payload)
          if (this.eventHandlers.onNewMessage) {
            console.log('✅ Calling onNewMessage handler')
            this.eventHandlers.onNewMessage(payload.payload)
          }
        })
        .on('broadcast', { event: 'message_update' }, (payload) => {
          console.log('🔔 Realtime: Message update', payload)
          this.eventHandlers.onMessageUpdate?.(payload.payload)
        })
        .on('broadcast', { event: 'message_delete' }, (payload) => {
          console.log('🔔 Realtime: Message delete', payload)
          this.eventHandlers.onMessageDelete?.(payload.payload.messageId)
        })
        .on('broadcast', { event: 'typing_start' }, (payload) => {
          const { userId, userName, channelId: typingChannelId } = payload.payload
          // Skip own typing indicators
          if (userId !== this.currentUserId) {
            console.log('⌨️ Realtime: Typing start from', userName)
            
            // Set up auto-removal timeout for remote typing
            this.handleRemoteTypingStart(userId, channelId)
            
            this.eventHandlers.onTypingStart?.({ 
              userId, 
              userName: userName || 'Someone', 
              channelId: typingChannelId || channelId 
            })
          }
        })
        .on('broadcast', { event: 'typing_stop' }, (payload) => {
          const { userId, channelId: typingChannelId } = payload.payload
          if (userId !== this.currentUserId) {
            console.log('⌨️ Realtime: Typing stop from', userId)
            
            // Clear remote typing timeout
            this.handleRemoteTypingStop(userId)
            
            this.eventHandlers.onTypingStop?.({ 
              userId, 
              channelId: typingChannelId || channelId 
            })
          }
        })
        .on('broadcast', { event: 'channel_update' }, (payload) => {
          console.log('🔔 Realtime: Channel update', payload)
          this.eventHandlers.onChannelUpdate?.(payload.payload)
        })
        .on('broadcast', { event: 'message_read' }, (payload) => {
          console.log('👁️ Realtime: Message read', payload)
          this.eventHandlers.onMessageRead?.(payload.payload)
        })
        .on('broadcast', { event: 'message_delivered' }, (payload) => {
          console.log('📨 Realtime: Message delivered', payload)
          this.eventHandlers.onMessageDelivered?.(payload.payload)
        })
        .on('broadcast', { event: 'attachments_added' }, (payload) => {
          console.log('📎 Realtime: Attachments added', payload)
          this.eventHandlers.onAttachmentsAdded?.(payload.payload)
        })
        .on('broadcast', { event: 'reaction_added' }, (payload) => {
          console.log('👍 Realtime: Reaction added', payload)
          this.eventHandlers.onReactionAdd?.(payload.payload)
        })
        .on('broadcast', { event: 'reaction_removed' }, (payload) => {
          console.log('👎 Realtime: Reaction removed', payload)
          this.eventHandlers.onReactionRemove?.(payload.payload)
        })

      rtChannel.subscribe((status, err) => {
        console.log(`🔌 RT Channel subscription status for ${channelId}:`, status)
        if (err) {
          console.error('❌ RT Subscription error:', err)
          this.subscriptionPromises.delete(channelId)
          reject(err)
        }
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to RT channel ${channelId}`)
          this.rtChannels.set(channelId, rtChannel)
          this.subscriptionPromises.delete(channelId)
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

  unsubscribeFromChannel(channelId: string) {
    const rtChannel = this.rtChannels.get(channelId)
    if (rtChannel) {
      supabase.removeChannel(rtChannel)
      this.rtChannels.delete(channelId)
    }
    this.subscriptionPromises.delete(channelId)
    
    // Clean up typing state for this channel
    this.clearTypingState(channelId)
  }

  // ============================================
  // Remote Typing Management (from other users)
  // ============================================

  private handleRemoteTypingStart(userId: string, channelId: string) {
    // Clear any existing timeout for this user
    const existingTimeout = this.remoteTypingTimeouts.get(userId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout to auto-clear typing indicator if no update received
    const timeout = setTimeout(() => {
      console.log('⌨️ Auto-removing stale typing indicator for:', userId)
      this.eventHandlers.onTypingStop?.({ userId, channelId })
      this.remoteTypingTimeouts.delete(userId)
    }, this.REMOTE_TYPING_TIMEOUT_MS)

    this.remoteTypingTimeouts.set(userId, timeout)
  }

  private handleRemoteTypingStop(userId: string) {
    const timeout = this.remoteTypingTimeouts.get(userId)
    if (timeout) {
      clearTimeout(timeout)
      this.remoteTypingTimeouts.delete(userId)
    }
  }

  // ============================================
  // Optimized Typing Indicators (for current user)
  // ============================================

  /**
   * Send typing indicator with throttling to prevent flooding.
   * Uses smart debouncing: sends immediately on first keystroke, 
   * then throttles subsequent sends.
   */
  async sendTypingStart(channelId: string, userId: string, userName?: string): Promise<void> {
    const now = Date.now()
    const lastSent = this.lastTypingSent.get(channelId) || 0
    const timeSinceLastSent = now - lastSent

    // Clear any existing auto-stop timeout
    const existingTimeout = this.typingTimeouts.get(channelId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set auto-stop timeout (will fire if user stops typing)
    const timeout = setTimeout(() => {
      this.sendTypingStop(channelId, userId)
    }, this.TYPING_TIMEOUT_MS)
    this.typingTimeouts.set(channelId, timeout)

    // Check if we should throttle (don't flood the network)
    if (this.isTyping.get(channelId) && timeSinceLastSent < this.TYPING_THROTTLE_MS) {
      // Already sent recently, skip to avoid flooding
      return
    }

    // Mark as typing and send
    this.isTyping.set(channelId, true)
    this.lastTypingSent.set(channelId, now)

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
        payload: { 
          userId, 
          userName: userName || this.currentUserName || 'Someone',
          channelId,
          timestamp: now 
        },
      })
    }
  }

  async sendTypingStop(channelId: string, userId: string): Promise<void> {
    // Clear auto-stop timeout
    const existingTimeout = this.typingTimeouts.get(channelId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      this.typingTimeouts.delete(channelId)
    }

    // Check if we were typing
    if (!this.isTyping.get(channelId)) {
      return // Wasn't typing, no need to send stop
    }

    this.isTyping.set(channelId, false)

    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      // Don't subscribe just to send stop - not critical
      return
    }

    rtChannel.send({
      type: 'broadcast',
      event: 'typing_stop',
      payload: { 
        userId, 
        channelId,
        timestamp: Date.now() 
      },
    })
  }

  private clearTypingState(channelId: string) {
    const timeout = this.typingTimeouts.get(channelId)
    if (timeout) {
      clearTimeout(timeout)
      this.typingTimeouts.delete(channelId)
    }
    this.isTyping.delete(channelId)
    this.lastTypingSent.delete(channelId)
  }

  // ============================================
  // Message Broadcasting
  // ============================================

  async broadcastMessage(channelId: string, message: any): Promise<void> {
    console.log('📡 Attempting to broadcast message to channel:', channelId)
    
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
      console.log('📡 Broadcasting message to rt channel:', channelId)
      rtChannel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: message
      })
    } else {
      console.error('❌ No channel found for broadcasting:', channelId)
    }
  }

  async broadcastChannelUpdate(channelId: string, update: any): Promise<void> {
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error('❌ Failed to subscribe for channel update:', error)
        return
      }
    }

    if (rtChannel) {
      rtChannel.send({
        type: 'broadcast',
        event: 'channel_update',
        payload: update
      })
    }
  }

  async broadcastMessageRead(channelId: string, messageId: string, userId: string): Promise<void> {
    console.log('👁️ Broadcasting message read:', { channelId, messageId, userId })
    
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error('❌ Failed to subscribe for message read broadcast:', error)
        return
      }
    }

    if (rtChannel) {
      rtChannel.send({
        type: 'broadcast',
        event: 'message_read',
        payload: {
          messageId,
          userId,
          channelId,
          readAt: new Date().toISOString()
        }
      })
    }
  }

  async broadcastMessageDelivered(channelId: string, messageId: string): Promise<void> {
    console.log('📨 Broadcasting message delivered:', { channelId, messageId })
    
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error('❌ Failed to subscribe for message delivered broadcast:', error)
        return
      }
    }

    if (rtChannel) {
      rtChannel.send({
        type: 'broadcast',
        event: 'message_delivered',
        payload: {
          messageId,
          channelId
        }
      })
    }
  }

  // ============================================
  // Handler Management
  // ============================================

  updateHandlers(handlers: Partial<RealtimeEventHandlers>) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  // ============================================
  // Cleanup
  // ============================================

  cleanup() {
    // Clean up all channel subscriptions
    for (const [channelId, rtChannel] of this.rtChannels) {
      supabase.removeChannel(rtChannel)
    }
    this.rtChannels.clear()
    this.subscriptionPromises.clear()

    // Clean up presence
    if (this.presenceChannel) {
      supabase.removeChannel(this.presenceChannel)
      this.presenceChannel = null
      this.presenceInitialized = false
    }

    // Clean up local typing state
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.typingTimeouts.clear()
    this.isTyping.clear()
    this.lastTypingSent.clear()

    // Clean up remote typing state
    for (const timeout of this.remoteTypingTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.remoteTypingTimeouts.clear()
  }
}

// ============================================
// Singleton Instance
// ============================================

let realtimeManager: RealtimeManager | null = null

export const getRealtimeManager = (handlers?: RealtimeEventHandlers): RealtimeManager => {
  if (!realtimeManager) {
    realtimeManager = new RealtimeManager(handlers)
  } else if (handlers) {
    realtimeManager.updateHandlers(handlers)
  }
  return realtimeManager
}

export const resetRealtimeManager = () => {
  if (realtimeManager) {
    realtimeManager.cleanup()
    realtimeManager = null
  }
}