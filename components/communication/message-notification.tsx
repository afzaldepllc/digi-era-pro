"use client"

import { useState, memo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Bell,
  MessageSquare,
  X,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCommunications } from "@/hooks/use-communications"
import { formatDistanceToNow } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


interface MessageNotificationProps {
  className?: string
  showBadge?: boolean
}

export const MessageNotification = memo(function MessageNotification({
  className,
  showBadge = true
}: MessageNotificationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id

  const {
    channels,
    unreadCount,
    notifications,
    selectChannel,
    clearNotifications,
    removeNotification,
    markAsRead,
    markAllChannelMessagesAsRead
  } = useCommunications()

  // Get channels with unread messages (exclude channels where the last message is from self)
  const unreadChannels = channels.filter(channel => {
    const hasUnread = (channel.unreadCount || 0) > 0
    // Also filter out channels where the last message is from current user
    const lastMessageFromSelf = channel.last_message?.mongo_sender_id === currentUserId
    return hasUnread && !lastMessageFromSelf
  })

  // Navigate to the channel and mark messages as read
  const handleNotificationClick = useCallback((channelId: string, messageId?: string) => {
    // Select the channel first
    selectChannel(channelId)
    
    // Navigate to communications page with the channel
    router.push(`/communications?channel=${channelId}`)
    
    // Mark message as read if provided (this happens via selectChannel which calls markAllChannelMessagesAsRead)
    // Notifications are cleared by selectChannel -> clearNotificationsForChannel
    
    setIsOpen(false)
  }, [selectChannel, router])

  const handleMarkAllRead = useCallback(async () => {
    // Mark all messages in all unread channels as read
    await Promise.all(
      unreadChannels.map(channel => 
        markAllChannelMessagesAsRead(channel.id)
      )
    )
    // clearNotifications is now handled by markAllChannelMessagesAsRead via clearNotificationsForChannel
  }, [unreadChannels, markAllChannelMessagesAsRead])

  // Get user info from notification message data
  const getUserInfo = useCallback((notification: any) => {
    // For new message notifications, use the message's sender data
    if (notification.message) {
      return {
        name: notification.message.sender_name || notification.message.sender?.name || notification.title || 'Unknown User',
        avatar: notification.message.sender_avatar || notification.message.sender?.avatar || undefined
      }
    }
    // For mention notifications, use the title
    return { 
      name: notification.title?.replace('Mention from ', '')?.replace(' mentioned you', '') || 'System', 
      avatar: undefined 
    }
  }, [])

  // Get display name for a channel
  const getChannelDisplayName = useCallback((channel: any) => {
    if (channel.type === 'dm') {
      const otherParticipant = channel.channel_members?.find((p: any) => p.mongo_member_id !== currentUserId)
      return otherParticipant?.name || 'Unknown User'
    }
    return channel.name || 'Channel'
  }, [currentUserId])

  // Filter out notifications from self (should already be filtered on server, but double-check)
  const filteredNotifications = notifications.filter(n => {
    const senderId = n.message?.mongo_sender_id
    return senderId !== currentUserId
  })

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("relative", className)}
        >
          <Bell className="h-4 w-4" />

          {showBadge && unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center text-xs px-1"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Message Notifications</h4>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-7 px-2 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-auto">
          {unreadChannels.length === 0 && filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new messages</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {/* Recent notifications */}
              {filteredNotifications.slice(0, 5).map((notification) => {
                const sender = getUserInfo(notification);
                const content = notification.message?.content || notification.preview || '';
                const messageId = notification.messageId || notification.message?.id;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.channelId, messageId)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Avatar className="h-8 w-8 mt-0.5">
                      <AvatarImage src={sender.avatar} alt={sender.name} />
                      <AvatarFallback className="text-xs">
                        {sender.name
                          ? (() => {
                            const parts = sender.name.trim().split(' ');
                            if (parts.length === 1) {
                              return parts[0][0].toUpperCase();
                            }
                            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                          })()
                          : ''}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{sender.name}</span>
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {content}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Channels with unread messages */}
              {unreadChannels.map((channel) => {
                const displayName = getChannelDisplayName(channel)
                const last_message = channel.last_message
                // Get sender info from last message
                const senderName = last_message?.sender_name || last_message?.sender?.name || ''

                return (
                  <div
                    key={channel.id}
                    onClick={() => handleNotificationClick(channel.id)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    {channel.type === 'dm' && channel.channel_members?.length > 0 ? (
                      <Avatar className="h-8 w-8 mt-0.5">
                        <AvatarImage
                          src={channel.channel_members.find((p: any) => p.mongo_member_id !== currentUserId)?.avatar}
                          alt={displayName}
                        />
                        <AvatarFallback className="text-xs">
                          {displayName
                            ? (() => {
                              const parts = displayName.trim().split(' ');
                              if (parts.length === 1) {
                                return parts[0][0].toUpperCase();
                              }
                              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                            })()
                            : ''}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mt-0.5">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{displayName}</span>
                        <Badge variant="default" className="text-xs">
                          {channel.unreadCount || 0}
                        </Badge>
                      </div>

                      {last_message && (
                        <div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {senderName && channel.type !== 'dm' && `${senderName}: `}
                            {last_message.content}
                          </p>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(last_message.created_at), { addSuffix: true })}
                            </span>

                            {channel.type !== 'dm' && (
                              <Badge variant="outline" className="text-xs">
                                {channel.type.replace('-', ' ')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              )
              })}
            </div>
          )}
        </div>

        {(unreadChannels.length > 0 || filteredNotifications.length > 0) && (
          <div className="border-t p-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                router.push('/communications')
                setIsOpen(false)
              }}
              className="w-full"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              View All Messages
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})