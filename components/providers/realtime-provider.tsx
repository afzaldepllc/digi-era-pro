"use client"

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { getRealtimeManager, RealtimeEventHandlers } from '@/lib/realtime-manager'
import { useToast } from '@/hooks/use-toast'
import { useAppDispatch } from '@/hooks/redux'
import { addNotification } from '@/store/slices/communicationSlice'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const dispatch = useAppDispatch()
  const hasInitialized = useRef(false)

  useEffect(() => {
    const sessionUser = session?.user as any
    const userId = sessionUser?.id
    const userName = sessionUser?.name || sessionUser?.email || 'Unknown'
    const userAvatar = sessionUser?.image || sessionUser?.avatar

    if (userId && !hasInitialized.current) {
      hasInitialized.current = true

      // Create event handlers for global notifications
      const eventHandlers: RealtimeEventHandlers = {
        onNewMessageNotification: (data: { message: any }) => {
          const message = data.message
          // Only show notification if user is not currently viewing the channel
          const currentPath = window.location.pathname
          const isOnCommunicationsPage = currentPath.includes('/communications')

          if (!isOnCommunicationsPage) {
            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`New message`, {
                body: message.content?.slice(0, 100) || 'New message',
                icon: userAvatar || '/favicon.ico'
              })
            }

            // Show toast notification
            toast({
              title: "New Message",
              description: message.content?.slice(0, 50) || 'You have a new message',
            })
          }
        },

        onMentionNotification: (data: any) => {
          // Show mention notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`@${data.sender_name} mentioned you`, {
              body: data.content_preview,
              icon: data.sender_avatar || '/favicon.ico'
            })
          }

          // Add to Redux notifications
          dispatch(addNotification({
            id: `mention_${data.message_id}`,
            type: 'mention',
            title: `${data.sender_name} mentioned you`,
            channelId: data.channel_id,
            messageId: data.message_id,
            preview: data.content_preview,
            read: false
          }))

          // Show toast
          toast({
            title: `@${data.sender_name} mentioned you`,
            description: data.content_preview.slice(0, 60) + (data.content_preview.length > 60 ? '...' : ''),
          })
        }
      }

      const realtimeManager = getRealtimeManager(eventHandlers)

      // Initialize presence and notifications
      const initRealtime = async () => {
        try {
          await realtimeManager.initializePresence(userId, userName, userAvatar)
          await realtimeManager.subscribeToNotifications(userId)
          console.log('✅ Global realtime initialized for user:', userId)
        } catch (error) {
          console.error('❌ Failed to initialize global realtime:', error)
        }
      }

      initRealtime()

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }

    // Cleanup on unmount
    return () => {
      // Don't cleanup realtime on component unmount to keep notifications active
    }
  }, [session, toast, dispatch])

  return <>{children}</>
}