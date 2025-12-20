"use client"

import { useState, useEffect, useMemo, memo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search,
  MessageSquare,
  Users,
  UserCheck,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCommunications } from "@/hooks/use-communications"
import { useUsers } from "@/hooks/use-users"
import { useSession } from "next-auth/react"
import { User } from "@/types"

interface UserDirectoryProps {
  onStartDM?: (userId: string) => void
  onChannelSelect?: (channelId: string) => void
  className?: string
}

export const UserDirectory = memo(function UserDirectory({ onStartDM, onChannelSelect, className }: UserDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { channels, createChannel, loading: channelLoading, selectChannel } = useCommunications()
  const { users, loading: usersLoading } = useUsers()
  const { data: session } = useSession()

  // Filter active users (exclude current user)
  const activeUsers = useMemo(() => {
    return users.filter(user =>
      user._id.toString() !== (session?.user as any)?.id
      //  &&
      // user.isClient === false
    )
  }, [users, (session?.user as any)?.id]);
  console.log("activeUsers42",activeUsers);
  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return activeUsers.filter(user => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        (typeof user.role === 'string' && user.role.toLowerCase().includes(query))
      )
    })
  }, [activeUsers, searchQuery])

  const handleStartDM = async (user: User) => {
    if (!(session?.user as any)?.id) {
      console.error('No current user found or user id missing')
      return
    }

    try {
      // Check if DM channel already exists
      const existingChannel = channels.find(channel => {
        if (channel.type !== 'dm') return false
        const memberIds = channel.channel_members.map(m => m.mongo_member_id)
        return memberIds.includes((session?.user as any)?.id) && memberIds.includes(user._id.toString())
      })

      if (existingChannel) {
        // Open existing channel
        selectChannel(existingChannel.id)
        if (onChannelSelect) {
          onChannelSelect(existingChannel.id)
        }
      } else {
        // Create new DM channel
        const channel = await createChannel({
          type: 'dm',
          channel_members: [(session?.user as any)?.id, user._id as string],
          is_private: true
        })

        if (channel && onChannelSelect) {
          // Select the new channel
          selectChannel(channel.id)
          onChannelSelect(channel.id)
        }
      }
    } catch (error) {
      console.error('Failed to create DM:', error)
    }
  }

  const getUserStatus = (user: User) => {
    // TODO: Implement online status checking
    return 'offline'
  }

  const getRoleColor = (role?: string | any) => {
    const roleStr = typeof role === 'string' ? role : 'user'
    switch (roleStr?.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'manager':
        return 'bg-blue-100 text-blue-800'
      case 'employee':
        return 'bg-green-100 text-green-800'
      case 'client':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."   
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* User List */}
      <ScrollArea>
        <div className="p-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No users found matching your search.' : 'No active users available.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto pb-6">
            {/* <div className="space-y-1"> */}
              {filteredUsers.map((user) => (
                <div
                  key={user._id as string}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => !channelLoading && handleStartDM(user)}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name || user.email} />
                      <AvatarFallback>{user.name
                        ? (() => {
                          const parts = user.name.trim().split(' ');
                          if (parts.length === 1) {
                            return parts[0][0].toUpperCase();
                          }
                          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                        })()
                        : user.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background",
                      getUserStatus(user) === 'online' ? 'bg-green-500' : 'bg-gray-400'
                    )} />
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {user.name || user.email}
                      </p>
                      {user.role && (
                        <Badge variant="secondary" className={cn("text-xs", getRoleColor(user.role))}>
                          {typeof user.role === 'string' ? user.role : 'user'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
})