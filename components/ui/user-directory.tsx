"use client"

import { useState, useEffect } from "react"
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
import { useUsers } from "@/hooks/use-users"
import { useCommunications } from "@/hooks/use-communications"
import { useAuthUser } from "@/hooks/use-auth-user"
import { User } from "@/types"

interface UserDirectoryProps {
  onStartDM?: (userId: string) => void
  className?: string
}

export function UserDirectory({ onStartDM, className }: UserDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { users, loading: usersLoading, fetchUsers } = useUsers()
  const { createChannel, loading: channelLoading, selectChannel } = useCommunications()
  const { user: currentUser } = useAuthUser()

  // Fetch users on mount
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])
  console.log('Users36:', users);
  // Filter active users (exclude current user and inactive users, and clients)
  const activeUsers = users.filter(user =>
    user._id !== currentUser?.id
    //  &&
    // user.isClient === false
  );
  console.log('ActiveUsers42:', activeUsers);
  // Filter users based on search
  const filteredUsers = activeUsers.filter(user => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      (typeof user.role === 'string' && user.role.toLowerCase().includes(query))
    )
  })

  const handleStartDM = async (user: User) => {
    if (!currentUser || !currentUser.id) {
      console.error('No current user found or user id missing')
      return
    }

    try {
      // Create DM channel
      const channel = await createChannel({
        type: 'dm',
        participants: [currentUser.id, user._id as string],
        name: `DM with ${user.name || user.email}`
      })

      if (channel) {
        // Select the new channel
        selectChannel(channel.channelId)
      }
    } catch (error) {
      console.error('Failed to create DM:', error)
    }
  }

  const getUserStatus = (user: User) => {
    // TODO: Implement online status checking
    return 'offline'
  }

  const getUserInitials = (user: User) => {
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    }
    return user.email?.[0]?.toUpperCase() || 'U'
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
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5" />
          <h3 className="font-semibold">Start a Conversation</h3>
        </div>

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
      <ScrollArea className="flex-1">
        <div className="p-2">
          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No users found matching your search.' : 'No active users available.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => (
                <div
                  key={user._id as string}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name || user.email} />
                      <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
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
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Action Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStartDM(user)}
                    disabled={channelLoading}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredUsers.length} active user{filteredUsers.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            <span>Start a conversation</span>
          </div>
        </div>
      </div>
    </div>
  )
}