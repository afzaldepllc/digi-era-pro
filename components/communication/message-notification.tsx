"use client"

import { useState, useEffect, memo } from "react"
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

  // Get channels with unread messages
  const unreadChannels = channels.filter(channel => (channel.unreadCount || 0) > 0)

  const handleNotificationClick = (channelId: string, messageId?: string) => {
    selectChannel(channelId)
    if (messageId) {
      markAsRead(messageId, channelId)
      // Remove the notification for this message
      const notificationId = `mention_${messageId}`
      removeNotification(notificationId)
    }
    setIsOpen(false)
  }

  const handleMarkAllRead = async () => {
    // Mark all messages in all unread channels as read
    await Promise.all(
      unreadChannels.map(channel => 
        markAllChannelMessagesAsRead(channel.id)
      )
    )
    clearNotifications()
  }

  const handleClearNotifications = () => {
    clearNotifications()
  }

  // Mock user lookup function (in real app, this would come from a users context)
  const getUserInfo = (senderId: string) => {
    const mockUsers: Record<string, any> = {
      'user1': { name: 'John Doe', avatar: undefined },
      'user2': { name: 'Jane Smith', avatar: undefined },
      'user3': { name: 'Bob Johnson', avatar: undefined },
      'user4': { name: 'Alice Brown', avatar: undefined }
    }
    return mockUsers[senderId] || { name: 'Unknown User', avatar: '' }
  }

  const getChannelDisplayName = (channel: any, currentUserId: string) => {
    if (channel.type === 'dm') {
      const otherParticipant = channel.channel_members.find((p: any) => p.mongo_member_id !== currentUserId)
      return otherParticipant?.name || 'Unknown User'
    }
    return channel.name
  }

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
          {unreadChannels.length === 0 && notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new messages</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {/* Recent notifications */}
              {notifications.slice(0, 3).map((notification) => {
                const sender = notification.message 
                  ? getUserInfo(notification.message.mongo_sender_id)
                  : { name: notification.title?.replace('Mention from ', '') || 'System', avatar: undefined };
                const content = notification.message?.content || notification.preview || '';
                const messageId = notification.message?.id;

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
                const displayName = getChannelDisplayName(channel, 'user1') // Mock current user ID
                const last_message = channel.last_message
                const sender = last_message ? getUserInfo(last_message.mongo_sender_id) : null

                return (
                  <div
                    key={channel.id}
                    onClick={() => handleNotificationClick(channel.id)}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    {channel.type === 'dm' && channel.channel_members.length > 0 ? (
                      <Avatar className="h-8 w-8 mt-0.5">
                        <AvatarImage
                          src={channel.channel_members.find((p) => p.mongo_member_id !== 'user1')?.avatar}
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
                            {sender && `${sender.name}: `}
                            {last_message.content}
                          </p>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(last_message.created_at), { addSuffix: true })}
                            </span>

                            <Badge variant="outline" className="text-xs">
                              {channel.type.replace('-', ' ')}
                            </Badge>
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

        {(unreadChannels.length > 0 || notifications.length > 0) && (
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  selectChannel('')
                  setIsOpen(false)
                }}
                className="flex-1"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                View All Messages
              </Button>

              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearNotifications}
                  className="px-3"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})