"use client"

import { useState, memo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Search, 
  Hash, 
  MessageSquare, 
  Users, 
  Phone, 
  Plus,
  Settings,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import { IChannel, IParticipant } from "@/types/communication"
import { formatDistanceToNow } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ChannelListProps {
  channels: IChannel[]
  activeChannelId?: string | null
  onChannelSelect: (channelId: string) => void
  currentUserId: string
  showSearch?: boolean
  onCreateChannel?: () => void
  className?: string
}

export const ChannelList = memo(function ChannelList({
  channels,
  activeChannelId,
  onChannelSelect,
  currentUserId,
  showSearch = true,
  onCreateChannel,
  className
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<'all' | 'dm' | 'project' | 'client-support'>('all')

  const getChannelIcon = (channel: IChannel) => {
    switch (channel.type) {
      case 'dm':
        return <MessageSquare className="h-4 w-4" />
      case 'project':
        return <Hash className="h-4 w-4" />
      case 'client-support':
        return <Phone className="h-4 w-4" />
      case 'group':
        return <Users className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getChannelDisplayName = (channel: IChannel) => {
    if (channel.type === 'dm') {
      // For DM, show the other participant's name
      const otherParticipant = channel.channel_members.find(p => p.mongo_member_id !== currentUserId)
      return otherParticipant?.name || 'Unknown User'
    }
    return channel.name || 'Unnamed Channel'
  }

  const getChannelSubtitle = (channel: IChannel) => {
    if (channel.type === 'dm') {
      const otherParticipant = channel.channel_members.find(p => p.mongo_member_id !== currentUserId)
      return otherParticipant?.userRole || otherParticipant?.userType || ''
    }
    
    if (channel.type === 'project') {
      return `${channel.channel_members.length} members`
    }
    
    if (channel.type === 'client-support') {
      return 'Client Support'
    }
    
    return `${channel.channel_members.length} members`
  }

  const getChannelAvatar = (channel: IChannel): IParticipant | null => {
    if (channel.type === 'dm') {
      return channel.channel_members.find(p => p.mongo_member_id !== currentUserId) as IParticipant || null
    }
    return null
  }

  const formatLastMessageTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  }

  const filteredChannels = channels.filter(channel => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const channelName = getChannelDisplayName(channel).toLowerCase()
      const matchesName = channelName.includes(query)
      const matchesChannelMembers = channel.channel_members.some(p => 
        p.name.toLowerCase().includes(query)
      )
      const matchesLastMessage = channel.last_message?.content.toLowerCase().includes(query)
      
      if (!matchesName && !matchesChannelMembers && !matchesLastMessage) {
        return false
      }
    }

    // Type filter
    if (filterType !== 'all' && channel.type !== filterType) {
      return false
    }

    return true
  })

  const ChannelItem = ({ channel }: { channel: IChannel }) => {
    const isActive = channel.id === activeChannelId
    const avatar = getChannelAvatar(channel)
    const displayName = getChannelDisplayName(channel)
    const subtitle = getChannelSubtitle(channel)
    const hasUnread = (channel.unreadCount || 0) > 0

    console.log("channel  info 142",channel);

    return (
      <div
        onClick={() => onChannelSelect(channel.id)}
        className={cn(
          "flex items-center gap-4 p-2 cursor-pointer transition-all duration-300 rounded-md group relative",
          "hover:shadow-lg hover:scale-[1.02]",
          "border-2 border-transparent hover:border-accent/30",
          isActive && "shadow-md border-primary/20",
          hasUnread && "border-secondary-200/50"
        )}
      >
        {/* Avatar or Icon */}
        <div className="relative shrink-0">
          {avatar ? (
            <>
              <Avatar className="h-10 w-10 transition-transform duration-200 group-hover:scale-110">
                <AvatarImage src={avatar.avatar} alt={avatar.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/40 text-primary font-semibold">
                  {avatar.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              {avatar.isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
              )}
            </>
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-muted to-accent/30 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-primary/20 group-hover:to-accent/40">
              {getChannelIcon(channel)}
            </div>
          )}
        </div>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={cn(
              "font-semibold text-base truncate tracking-tight transition-colors",
              hasUnread && "font-bold text-primary",
              isActive && "text-primary"
            )}>
              {displayName}
            </h3>
            
            {channel.last_message && (
              <span className={cn(
                "text-xs font-medium ml-3 shrink-0 transition-colors",
                hasUnread ? "text-primary" : "text-muted-foreground"
              )}>
                {formatLastMessageTime(channel.last_message.created_at)}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            {/* Subtitle or last message */}
            <div className="flex-1 min-w-0">
              {channel.last_message ? (
                <p className={cn(
                  "text-sm truncate leading-tight transition-colors",
                  hasUnread ? "text-foreground font-medium" : "text-muted-foreground/80"
                )}>
                  {channel.last_message.content}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/60 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
            
            {/* Unread count */}
            {hasUnread && (
              <Badge 
                variant="default" 
                className="ml-3 h-6 min-w-[24px] flex items-center justify-center text-xs font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md animate-pulse hover:animate-none transition-all hover:scale-110"
              >
                {(channel.unreadCount || 0) > 99 ? '99+' : (channel.unreadCount || 0)}
              </Badge>
            )}
          </div>

          {/* Channel type indicator */}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs font-medium px-2 py-0.5 bg-gradient-to-r from-background to-accent/20 border-accent/30">
              {channel.type === 'dm' ? 'Direct' : channel.type === 'client-support' ? 'Support' : channel.type.replace('-', ' ')}
            </Badge>
            
            {!channel.is_private && (
              <Badge variant="secondary" className="text-xs">
                External
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full w-full max-w-full bg-gradient-to-b from-card to-card/95 border-r border-border/50 shadow-sm overflow-hidden", className)}>
        {/* Header */}
        <div className="p-2 pr-4 border-b border-border/30 bg-gradient-to-r from-background via-accent/5 to-primary/5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg tracking-tight">Messages</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Filter dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hover:bg-accent/50 transition-colors">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterType('all')}>
                    All Channels
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('dm')}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Direct Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('project')}>
                    <Hash className="h-4 w-4 mr-2" />
                    Project Channels
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType('client-support')}>
                    <Phone className="h-4 w-4 mr-2" />
                    Client Support
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Create channel button */}
              {onCreateChannel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={onCreateChannel}
                      className="hover:bg-primary hover:text-primary-foreground transition-all duration-200 hover:shadow-md hover:scale-105"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create new channel</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Search */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/30"
              />
            </div>
          )}

          {/* Active filter indicator */}
          {filterType !== 'all' && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                Showing: {filterType.replace('-', ' ')}
              </Badge>
            </div>
          )}
        </div>

        {/* Channel list */}
        <ScrollArea className="flex-1 w-full max-w-full overflow-hidden">
          <div className="p-3 space-y-2 w-full max-w-full">
            {filteredChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations found</p>
                {searchQuery && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Unread channels first */}
                {filteredChannels
                  .filter(channel => (channel.unreadCount || 0) > 0)
                  .map((channel) => (
                    <ChannelItem key={channel.id} channel={channel} />
                  ))
                }
                
                {/* Separator if there are both unread and read channels */}
                {filteredChannels.some(c => (c.unreadCount || 0) > 0) && 
                 filteredChannels.some(c => c.unreadCount === 0) && (
                  <div className="py-3 px-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/40" />
                      </div>
                      <div className="relative flex justify-center text-xs text-muted-foreground">
                        <span className="bg-card px-2 font-medium">Recent</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Read channels */}
                {filteredChannels
                  .filter(channel => (channel.unreadCount || 0) === 0)
                  .map((channel) => (
                    <ChannelItem key={channel.id} channel={channel} />
                  ))
                }
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
})
