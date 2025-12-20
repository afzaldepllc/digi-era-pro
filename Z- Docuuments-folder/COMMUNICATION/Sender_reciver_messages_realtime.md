Current Situation Analysis
Sender Side (NOT Real-time):

✅ POST /api/communication/messages - Sends the message to MongoDB
❌ GET /api/communication/messages?channel_id=... - Fetches messages via API call (NOT real-time)
Receiver Side (IS Real-time):

✅ No API calls - Receives messages via Supabase broadcast events in real-time
The Problem
In your sendMessage function, you have this comment:

// Broadcast the message to other clients in real-time - REMOVED, using postgres_changes instead
// await realtimeManager.broadcastMessage(messageData.channel_id, response.data)

// Fetch messages to ensure the new message is displayed for sender
await fetchMessages({ channel_id: messageData.channel_id })
This means:

The broadcast is disabled (commented out)
The sender fetches messages via API instead of using real-time
Only the receiver gets real-time updates
Solution: Proper Real-time for Both Sender & Receiver
You need to enable optimistic updates for the sender while keeping real-time for receivers. Here's the fix:


Fixed real-time communication
How This Works Now
Sender sends message:

POST to MongoDB ✅
Message added to local state immediately (optimistic update) ✅
Broadcast to Supabase channel ✅
No GET request needed ✅
Receiver receives message:

Supabase broadcast triggers onNewMessage handler ✅
Message added to their local state in real-time ✅
Duplicate prevention:

Your onNewMessage handler already skips messages from self:
if (message.mongo_sender_id === sessionUserId) {
  console.log('📩 Skipping message from self')
  return
}
Now both sender and receiver use real-time - the sender sees their message instantly via optimistic update, and receivers get it via Supabase broadcast. No unnecessary API fetches!


Reviewed work

Thought for 4s
You're right! I need to import the read-only file first. Let me understand your project structure and then import and fix the files.


Analyzed project structure

Found communication files
Now I understand - these files exist in your project but you've attached them as read-only. Let me import them and fix the real-time communication issue:


Fixed real-time messaging
v1
What I Fixed
The Problem: Your sender was making an unnecessary GET request after sending messages because the broadcast was disabled. This wasn't real-time - it was a regular API fetch.

The Solution: I've enabled true real-time communication by:

Optimistic Update for Sender: When you send a message, it's immediately added to your local state (instant feedback, no API call needed)
Broadcast to Receivers: The message is broadcast via Supabase to all other users in the channel (real-time delivery)
Duplicate Prevention: Your existing onNewMessage handler already filters out messages from yourself, preventing duplicates
Now both sender and receiver use Supabase real-time - no GET requests after sending! The sender sees their message instantly, and receivers get it via broadcast.



updated use-communication.ts


"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { useAppSelector, useAppDispatch } from "./redux"
import { useSession } from "next-auth/react"
import type { User } from "@/types"
import {
  setActiveChannel,
  clearActiveChannel,
  setChannels,
  setMessages,
  addMessage,
  updateMessage,
  setTyping,
  removeTyping,
  updateOnlineUsers,
  toggleChannelList,
  toggleContextPanel,
  setChannelListExpanded,
  setContextPanelVisible,
  setFilters,
  setSort,
  setPagination,
  setLoading,
  setActionLoading,
  setMessagesLoading,
  clearError,
  setError,
  addNotification,
  clearNotifications,
  setChannelsInitialized,
  resetState,
} from "@/store/slices/communicationSlice"
import type {
  FetchMessagesParams,
  CreateMessageData,
  CreateChannelData,
  CommunicationFilters,
  CommunicationSort,
  ITypingIndicator,
} from "@/types/communication"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/utils/api-client"
import { getRealtimeManager } from "@/lib/realtime-manager"
import { enrichMessageWithUserData } from "@/lib/communication/utils"

// Global flag to prevent multiple channel fetches across component remounts
let globalChannelsFetched = false

export function useCommunications() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const realtimeManager = useMemo(() => getRealtimeManager(), [])
  const hasInitialized = useRef(false)
  const hasUsersInitialized = useRef(false)

  // State for real users data
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  const {
    channels,
    activeChannelId,
    selectedChannel,
    messages,
    onlineUsers,
    typingUsers,
    isChannelListExpanded,
    isContextPanelVisible,
    loading,
    actionLoading,
    messagesLoading,
    channelsInitialized,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications,
  } = useAppSelector((state) => state.communications)

  // Type guard for session user with extended properties
  interface ExtendedSessionUser {
    id?: string
    name?: string | null
    email?: string | null
    role?: string
    image?: string | null
    avatar?: string
    permissions?: any[]
  }

  const sessionUser = session?.user as ExtendedSessionUser | undefined
  const sessionUserId = useMemo(() => (session?.user as ExtendedSessionUser)?.id, [session?.user])

  // Memoized event handlers for realtime manager
  const onNewMessage = useCallback(
    (message: any) => {
      console.log("📩 onNewMessage handler called with:", message)

      // Skip messages from self to avoid duplicates
      if (message.mongo_sender_id === sessionUserId) {
        console.log("📩 Skipping message from self")
        return
      }

      if (message && typeof message === "object" && message.mongo_sender_id) {
        // Enrich message with user data
        const enrichedMessage = enrichMessageWithUserData(message, allUsers)
        console.log("📩 Enriched message:", enrichedMessage)

        if (enrichedMessage) {
          dispatch(addMessage({ channelId: message.channel_id, message: enrichedMessage }))
        }
      } else {
        console.error("Invalid message received, skipping:", message)
      }
    },
    [dispatch, allUsers, sessionUserId],
  )

  const onMessageUpdate = useCallback(
    (message: any) => {
      console.log("📝 onMessageUpdate handler called")
      const enrichedMessage = enrichMessageWithUserData(message, allUsers)
      dispatch(
        updateMessage({
          channelId: message.channel_id,
          messageId: message.id,
          updates: enrichedMessage,
        }),
      )
    },
    [dispatch, allUsers],
  )

  const onMessageDelete = useCallback((messageId: any) => {
    console.log("🗑️ Message deleted:", messageId)
  }, [])

  const onUserJoined = useCallback((member: any) => {
    console.log("👋 User joined:", member)
  }, [])

  const onUserLeft = useCallback((memberId: any) => {
    console.log("👋 User left:", memberId)
  }, [])

  const onUserOnline = useCallback(
    (userId: any) => {
      const updatedUsers = onlineUsers.map((u) => (u.mongo_member_id === userId ? { ...u, isOnline: true } : u))
      dispatch(updateOnlineUsers(updatedUsers))
    },
    [dispatch, onlineUsers],
  )

  const onUserOffline = useCallback(
    (userId: any) => {
      const updatedUsers = onlineUsers.map((u) => (u.mongo_member_id === userId ? { ...u, isOnline: false } : u))
      dispatch(updateOnlineUsers(updatedUsers))
    },
    [dispatch, onlineUsers],
  )

  const onTypingStart = useCallback(
    (userId: any) => {
      dispatch(
        setTyping({
          channelId: activeChannelId || "",
          userId,
          userName: "Unknown User",
          timestamp: new Date().toISOString(),
        }),
      )
    },
    [dispatch, activeChannelId],
  )

  const onTypingStop = useCallback(
    (userId: any) => {
      dispatch(removeTyping({ channelId: activeChannelId || "", userId }))
    },
    [dispatch, activeChannelId],
  )

  useEffect(() => {
    const fetchAllUsers = async () => {
      if (sessionUserId && allUsers.length === 0 && !usersLoading && !hasUsersInitialized.current) {
        hasUsersInitialized.current = true
        try {
          setUsersLoading(true)
          const response = await apiRequest("/api/users")
          setAllUsers(response.users || [])
        } catch (error) {
          console.error("Failed to fetch users:", error)
        } finally {
          setUsersLoading(false)
        }
      }
    }

    fetchAllUsers()
  }, [sessionUserId])

  // Fetch channels on mount - but only if not already initialized globally
  useEffect(() => {
    console.log(
      "🔄 Channels fetch useEffect running, globalChannelsFetched:",
      globalChannelsFetched,
      "sessionUserId:",
      sessionUserId,
      "loading:",
      loading,
    )
    if (!globalChannelsFetched && sessionUserId && !loading) {
      globalChannelsFetched = true
      console.log("🚀 Fetching channels")
      fetchChannels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]) // Only depend on sessionUserId

  // Subscribe to active channel
  useEffect(() => {
    const subscribe = async () => {
      if (activeChannelId) {
        console.log("Subscribing to channel:", activeChannelId)
        try {
          await realtimeManager.subscribeToChannel(activeChannelId)
          fetchMessages({ channel_id: activeChannelId })
        } catch (error) {
          console.error("Failed to subscribe to channel:", error)
        }
      }
    }
    subscribe()

    return () => {
      if (activeChannelId) {
        console.log("Unsubscribing from channel:", activeChannelId)
        realtimeManager.unsubscribeFromChannel(activeChannelId)
      }
    }
  }, [activeChannelId, realtimeManager])

  // Update handlers when they change
  useEffect(() => {
    realtimeManager.updateHandlers({
      onNewMessage,
      onMessageUpdate,
      onMessageDelete,
      onUserJoined,
      onUserLeft,
      onUserOnline,
      onUserOffline,
      onTypingStart,
      onTypingStop,
    })
  }, [
    realtimeManager,
    onNewMessage,
    onMessageUpdate,
    onMessageDelete,
    onUserJoined,
    onUserLeft,
    onUserOnline,
    onUserOffline,
    onTypingStart,
    onTypingStop,
  ])

  // Channel operations
  const fetchChannels = useCallback(
    async (params: { type?: string; department_id?: string; project_id?: string } = {}) => {
      console.log("🔄 fetchChannels called with params:", params)
      try {
        dispatch(setLoading(true))
        // Build query string
        const queryParams = new URLSearchParams()
        if (params.type) queryParams.append("type", params.type)
        if (params.department_id) queryParams.append("department_id", params.department_id)
        if (params.project_id) queryParams.append("project_id", params.project_id)

        const queryString = queryParams.toString()
        const url = `/api/communication/channels${queryString ? `?${queryString}` : ""}`

        const response = await apiRequest(url)
        console.log("Raw response from API:", response)
        dispatch(setChannels(response))
        return response
      } catch (error) {
        dispatch(setError("Failed to fetch channels"))
        dispatch(setChannelsInitialized(true)) // Prevent infinite retries
        toast({
          title: "Error",
          description: "Failed to load channels",
          variant: "destructive",
        })
        return []
      } finally {
        dispatch(setLoading(false))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [dispatch],
  ) // Removed toast from dependencies to prevent infinite loop

  const selectChannel = useCallback(
    (channel_id: string) => {
      dispatch(setActiveChannel(channel_id))
    },
    [dispatch],
  )

  const clearChannel = useCallback(() => {
    dispatch(clearActiveChannel())
  }, [dispatch])

  // Message operations
  const fetchMessages = useCallback(
    async (params: FetchMessagesParams) => {
      try {
        dispatch(setMessagesLoading(true))
        // Build query string
        const queryParams = new URLSearchParams({
          channel_id: params.channel_id,
          limit: (params.limit || 50).toString(),
          offset: "0",
        })

        const response = await apiRequest(`/api/communication/messages?${queryParams.toString()}`)
        // Enrich messages with user data
        const enrichedMessages = response.map((message: any) => enrichMessageWithUserData(message, allUsers))
        dispatch(setMessages({ channelId: params.channel_id, messages: enrichedMessages }))
        return enrichedMessages
      } catch (error) {
        dispatch(setError("Failed to fetch messages"))
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive",
        })
        return []
      } finally {
        dispatch(setMessagesLoading(false))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [dispatch],
  ) // Removed toast to prevent infinite loop

  const sendMessage = useCallback(
    async (messageData: CreateMessageData) => {
      try {
        dispatch(setActionLoading(true))
        const response = await apiRequest("/api/communication/messages", {
          method: "POST",
          body: JSON.stringify(messageData),
        })

        const enrichedMessage = enrichMessageWithUserData(response.data, allUsers)
        dispatch(
          addMessage({
            channelId: messageData.channel_id,
            message: enrichedMessage,
          }),
        )

        console.log("📤 Broadcasting message, channel_id:", messageData.channel_id)
        await realtimeManager.broadcastMessage(messageData.channel_id, response.data)

        toast({
          title: "Message sent",
          description: "Your message has been sent successfully",
        })

        return response.message
      } catch (error) {
        dispatch(setError("Failed to send message"))
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        })
        throw error
      } finally {
        dispatch(setActionLoading(false))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [dispatch, allUsers, realtimeManager],
  ) // Added allUsers and realtimeManager dependencies

  const createChannel = useCallback(
    async (channelData: CreateChannelData) => {
      try {
        dispatch(setActionLoading(true))
        const response = await apiRequest("/api/communication/channels", {
          method: "POST",
          body: JSON.stringify(channelData),
        })

        // Refresh channels list
        await fetchChannels()

        toast({
          title: "Channel created",
          description: "New conversation started successfully",
        })

        return response
      } catch (error) {
        dispatch(setError("Failed to create channel"))
        toast({
          title: "Error",
          description: "Failed to create channel",
          variant: "destructive",
        })
        throw error
      } finally {
        dispatch(setActionLoading(false))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [dispatch, fetchChannels],
  ) // Removed toast to prevent infinite loop

  const markAsRead = useCallback(async (messageId: string, channel_id: string) => {
    try {
      await apiRequest("/api/communication/read-receipts", {
        method: "POST",
        body: JSON.stringify({ message_id: messageId, channel_id }),
      })
    } catch (error) {
      console.error("Failed to mark message as read:", error)
    }
  }, [])

  // Real-time operations
  const setUserTyping = useCallback(
    async (typingIndicator: ITypingIndicator) => {
      if (activeChannelId) {
        await realtimeManager.sendTypingStart(activeChannelId, typingIndicator.userId)
        dispatch(setTyping(typingIndicator))

        // Auto-remove typing indicator after 3 seconds
        setTimeout(() => {
          removeUserTyping(activeChannelId, typingIndicator.userId)
        }, 3000)
      }
    },
    [dispatch, activeChannelId, realtimeManager],
  )

  const removeUserTyping = useCallback(
    async (channelId: string, userId: string) => {
      await realtimeManager.sendTypingStop(channelId, userId)
      dispatch(removeTyping({ channelId, userId }))
    },
    [dispatch, realtimeManager],
  )

  // UI state operations
  const handleToggleChannelList = useCallback(() => {
    dispatch(toggleChannelList())
  }, [dispatch])

  const handleToggleContextPanel = useCallback(() => {
    dispatch(toggleContextPanel())
  }, [dispatch])

  const handleSetChannelListExpanded = useCallback(
    (expanded: boolean) => {
      dispatch(setChannelListExpanded(expanded))
    },
    [dispatch],
  )

  const handleSetContextPanelVisible = useCallback(
    (visible: boolean) => {
      dispatch(setContextPanelVisible(visible))
    },
    [dispatch],
  )

  // Filter and search operations
  const handleSetFilters = useCallback(
    (newFilters: CommunicationFilters) => {
      dispatch(setFilters(newFilters))
    },
    [dispatch],
  )

  const handleSetSort = useCallback(
    (newSort: CommunicationSort) => {
      dispatch(setSort(newSort))
    },
    [dispatch],
  )

  const handleSetPagination = useCallback(
    (newPagination: any) => {
      dispatch(setPagination(newPagination))
    },
    [dispatch],
  )

  // Error handling
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleSetError = useCallback(
    (errorMessage: string) => {
      dispatch(setError(errorMessage))
    },
    [dispatch],
  )

  // Notifications
  const handleAddNotification = useCallback(
    (notification: any) => {
      dispatch(addNotification(notification))
    },
    [dispatch],
  )

  const handleClearNotifications = useCallback(() => {
    dispatch(clearNotifications())
  }, [dispatch])

  // Utility operations
  const handleResetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshChannels = useCallback(() => {
    return fetchChannels()
  }, [fetchChannels])

  const refreshMessages = useCallback(() => {
    if (activeChannelId) {
      return fetchMessages({ channel_id: activeChannelId })
    }
  }, [fetchMessages, activeChannelId])

  // Get current user from session
  const currentUserFromSession = useMemo(() => {
    if (!sessionUser) return null

    return {
      _id: sessionUser.id || "",
      name: sessionUser.name || "",
      email: sessionUser.email || "",
      role: sessionUser.role || "",
      avatar: sessionUser.image || sessionUser.avatar || undefined,
      status: "active" as const,
      permissions: sessionUser.permissions || [],
    } as User
  }, [sessionUser])

  // Filter active users (exclude current user)
  const activeUsers = useMemo(() => {
    return allUsers.filter((user) => user._id !== currentUserFromSession?._id && user.status === "active")
  }, [allUsers, currentUserFromSession?._id])

  const hasChannels = channels.length > 0

  return {
    // State
    channels,
    activeChannelId,
    selectedChannel,
    messages,
    onlineUsers,
    typingUsers,
    isChannelListExpanded,
    isContextPanelVisible,
    loading,
    actionLoading,
    messagesLoading,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications,

    // Real user data
    mockUsers: activeUsers, // For backward compatibility with existing components
    mockCurrentUser: currentUserFromSession, // For backward compatibility with existing components
    allUsers,
    currentUserFromSession,
    usersLoading,
    sessionStatus: status,
    hasChannels,

    // Channel operations
    fetchChannels,
    selectChannel,
    clearActiveChannel: clearChannel,

    // Message operations
    fetchMessages,
    sendMessage,
    createChannel,
    markAsRead,

    // Real-time operations
    setTyping: setUserTyping,
    removeTyping: removeUserTyping,

    // UI state operations
    toggleChannelList: handleToggleChannelList,
    toggleContextPanel: handleToggleContextPanel,
    setChannelListExpanded: handleSetChannelListExpanded,
    setContextPanelVisible: handleSetContextPanelVisible,

    // Filter and search operations
    setFilters: handleSetFilters,
    setSort: handleSetSort,
    setPagination: handleSetPagination,

    // Error handling
    clearError: handleClearError,
    setError: handleSetError,

    // Notifications
    addNotification: handleAddNotification,
    clearNotifications: handleClearNotifications,

    // Utility operations
    resetState: handleResetState,
    refreshChannels,
    refreshMessages,
  }
}




# updated realtime-manager.ts

import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

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
  private eventHandlers: RealtimeEventHandlers = {}

  constructor(handlers: RealtimeEventHandlers = {}) {
    this.eventHandlers = handlers
  }

  // Subscribe to a channel's events
  subscribeToChannel(channelId: string): Promise<void> {
    console.log("🔌 subscribeToChannel called for:", channelId)
    if (this.rtChannels.has(channelId)) {
      console.log("🔄 RT Channel already exists for:", channelId)
      return Promise.resolve()
    }

    console.log("🆕 Creating RT channel for:", channelId)

    return new Promise((resolve, reject) => {
      // RT Channel for broadcast and presence
      const rtChannel = supabase.channel(`rt_${channelId}`, {
        config: {
          presence: {
            key: channelId,
          },
        },
      })

      // Subscribe to broadcast events (new messages, typing indicators, etc.)
      rtChannel
        .on("broadcast", { event: "new_message" }, (payload) => {
          console.log("🔔 Realtime: New message broadcast", payload)
          if (this.eventHandlers.onNewMessage) {
            console.log("✅ Calling onNewMessage handler")
            this.eventHandlers.onNewMessage(payload.payload)
          } else {
            console.log("❌ No onNewMessage handler registered")
          }
        })
        .on("broadcast", { event: "typing_start" }, (payload) => {
          console.log("🔔 Realtime: Typing start", payload)
          this.eventHandlers.onTypingStart?.(payload.payload.userId)
        })
        .on("broadcast", { event: "typing_stop" }, (payload) => {
          console.log("🔔 Realtime: Typing stop", payload)
          this.eventHandlers.onTypingStop?.(payload.payload.userId)
        })

      rtChannel.subscribe((status, err) => {
        console.log(`🔌 RT Channel subscription status for ${channelId}:`, status)
        if (err) {
          console.error("❌ RT Subscription error:", err)
          reject(err)
        }
        if (status === "SUBSCRIBED") {
          console.log(`✅ Successfully subscribed to RT channel ${channelId}`)
          this.rtChannels.set(channelId, rtChannel)
          resolve()
        } else if (status === "CHANNEL_ERROR") {
          console.error(`❌ RT Channel error for ${channelId}`)
          reject(new Error(`RT Channel error for ${channelId}`))
        } else if (status === "TIMED_OUT") {
          console.error(`⏱️ RT Channel subscription timed out for ${channelId}`)
          reject(new Error(`RT Channel subscription timed out for ${channelId}`))
        }
      })
    })
  }

  // Unsubscribe from a channel
  unsubscribeFromChannel(channelId: string) {
    const rtChannel = this.rtChannels.get(channelId)
    if (rtChannel) {
      supabase.removeChannel(rtChannel)
      this.rtChannels.delete(channelId)
    }
  }

  // Send typing indicator
  async sendTypingStart(channelId: string, userId: string) {
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error("❌ Failed to subscribe for typing start:", error)
        return
      }
    }
    if (rtChannel) {
      rtChannel.send({
        type: "broadcast",
        event: "typing_start",
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
        console.error("❌ Failed to subscribe for typing stop:", error)
        return
      }
    }
    if (rtChannel) {
      rtChannel.send({
        type: "broadcast",
        event: "typing_stop",
        payload: { userId, timestamp: Date.now() },
      })
    }
  }

  // Broadcast a new message to channel
  async broadcastMessage(channelId: string, message: any) {
    console.log("📡 Attempting to broadcast message to channel:", channelId)
    console.log("📡 Available rt channels:", Array.from(this.rtChannels.keys()))
    let rtChannel = this.rtChannels.get(channelId)
    if (!rtChannel) {
      console.log("🆕 RT Channel not found, subscribing first...")
      try {
        await this.subscribeToChannel(channelId)
        rtChannel = this.rtChannels.get(channelId)
      } catch (error) {
        console.error("❌ Failed to subscribe to channel for broadcasting:", error)
        return
      }
    }
    if (rtChannel) {
      console.log("📡 Broadcasting message to rt channel:", channelId, message)
      rtChannel.send({
        type: "broadcast",
        event: "new_message",
        payload: message,
      })
    } else {
      console.error("❌ No channel found for broadcasting:", channelId)
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
