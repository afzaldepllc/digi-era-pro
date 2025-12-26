"use client"

import { useState, memo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Hash, 
  MessageSquare, 
  Users, 
  Phone, 
  Plus,
  Settings,
  Filter,
  Archive,
  Pin,
  PinOff
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
import HtmlTextRenderer from "../shared/html-text-renderer"
import { useToast } from "@/hooks/use-toast"

interface ChannelListProps {
  channels: IChannel[]
  activeChannelId?: string | null
  onChannelSelect: (channelId: string) => void
  currentUserId: string
  onlineUserIds?: string[] // Real-time online user IDs from Supabase
  showSearch?: boolean
  onCreateChannel?: () => void
  onPinChannel?: (channelId: string, isPinned: boolean) => Promise<void>
  className?: string
}

export const ChannelList = memo(function ChannelList({
  channels,
  activeChannelId,
  onChannelSelect,
  currentUserId,
  onlineUserIds = [],
  showSearch = true,
  onCreateChannel,
  onPinChannel,
  className
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<'all' | 'dm' | 'project' | 'client-support'>('all')
  const [pinLoading, setPinLoading] = useState<string | null>(null)
  const { toast } = useToast()

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

  // Separate pinned and unpinned channels, then sort each group
  const pinnedChannels = filteredChannels.filter((ch: any) => ch.is_pinned)
  const unpinnedChannels = filteredChannels.filter((ch: any) => !ch.is_pinned)

  // Handle pin toggle
  const handlePinToggle = useCallback(async (e: React.MouseEvent, channel: IChannel) => {
    e.stopPropagation()
    if (!onPinChannel) return
    
    const isPinned = (channel as any).is_pinned || false
    setPinLoading(channel.id)
    
    try {
      await onPinChannel(channel.id, isPinned)
    } catch (error: any) {
      toast({
        title: "Failed to update pin",
        description: error.message || "Something went wrong",
        variant: "destructive"
      })
    } finally {
      setPinLoading(null)
    }
  }, [onPinChannel, toast])

  const ChannelItem = ({ channel }: { channel: IChannel }) => {
    const isActive = channel.id === activeChannelId
    const avatar = getChannelAvatar(channel)
    const displayName = getChannelDisplayName(channel)
    const subtitle = getChannelSubtitle(channel)
    const hasUnread = (channel.unreadCount || 0) > 0
    const isArchived = (channel as any).is_archived || false
    const isPinned = (channel as any).is_pinned || false
    const isPinLoading = pinLoading === channel.id
    
    // Check if user is online using real-time onlineUserIds from Supabase
    const isAvatarUserOnline = avatar ? (
      onlineUserIds.length > 0 
        ? onlineUserIds.includes(avatar.mongo_member_id)
        : avatar.isOnline
    ) : false

    return (
      <div
        onClick={() => onChannelSelect(channel.id)}
        className={cn(
          "flex items-center gap-4 p-2 cursor-pointer transition-all duration-300 rounded-md group relative",
          "hover:shadow-lg hover:scale-[1.02]",
          "border-2 border-transparent hover:border-accent/30",
          isActive && "shadow-md border-primary/20",
          hasUnread && "border-secondary-200/50",
          isArchived && "opacity-60 bg-muted/30",
          isPinned && "bg-primary/5 border-primary/10"
        )}
      >
        {/* Pin indicator */}
        {isPinned && (
          <div className="absolute top-1 right-1">
            <Pin className="h-3 w-3 text-primary fill-primary rotate-45" />
          </div>
        )}
        
        {/* Pin/Unpin button - visible on hover */}
        {onPinChannel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  isPinned && "opacity-100"
                )}
                onClick={(e) => handlePinToggle(e, channel)}
                disabled={isPinLoading}
              >
                {isPinLoading ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : isPinned ? (
                  <PinOff className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                ) : (
                  <Pin className="h-3 w-3 text-muted-foreground hover:text-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPinned ? 'Unpin channel' : 'Pin channel'}</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {/* Avatar or Icon */}
        <div className="relative shrink-0">
          {avatar ? (
            <>
              <Avatar className={cn(
                "h-10 w-10 transition-transform duration-200 group-hover:scale-110",
                // WhatsApp-style green ring for online users
                isAvatarUserOnline && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
              )}>
                <AvatarImage src={avatar.avatar} alt={avatar.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/40 text-primary font-semibold">
                  {avatar.name ? (() => {
                      const parts = avatar.name.trim().split(' ');
                      if (parts.length === 1) {
                        return parts[0][0].toUpperCase();
                      }
                      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    })()
                  : ''}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator dot */}
              {isAvatarUserOnline && (
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
                // <p className={cn(
                //   "text-sm truncate leading-tight transition-colors",
                //   hasUnread ? "text-foreground font-medium" : "text-muted-foreground/80"
                // )}>
                   <HtmlTextRenderer
                        content={channel.last_message.content}
                        fallbackText="No description"
                        showFallback={true}
                        renderAsHtml={true}
                        className="line-clamp-1"
                        truncateHtml={true}
                      />
                // </p>
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
            
            {isArchived && (
              <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
            
            {!channel.is_private && !isArchived && (
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
        <div className="flex-1 w-full max-w-full overflow-auto">
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
                {/* Pinned Channels Section */}
                {pinnedChannels.length > 0 && (
                  <>
                    <div className="py-2 px-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Pin className="h-3 w-3" />
                        <span>Pinned ({pinnedChannels.length}/5)</span>
                      </div>
                    </div>
                    {pinnedChannels.map((channel) => (
                      <ChannelItem key={channel.id} channel={channel} />
                    ))}
                    {/* Separator after pinned */}
                    <div className="py-3 px-2">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border/40" />
                        </div>
                        <div className="relative flex justify-center text-xs text-muted-foreground">
                          <span className="bg-card px-2 font-medium">All Chats</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Unpinned Channels - DM and Other */}
                {(() => {
                  const dmChannels = unpinnedChannels.filter(channel => channel.type === 'dm')
                  const otherChannels = unpinnedChannels.filter(channel => channel.type !== 'dm')
                  
                  return (
                    <>
                      {/* DM Unread */}
                      {dmChannels
                        .filter(channel => (channel.unreadCount || 0) > 0)
                        .map((channel) => (
                          <ChannelItem key={channel.id} channel={channel} />
                        ))
                      }
                      
                      {/* DM Read */}
                      {dmChannels
                        .filter(channel => (channel.unreadCount || 0) === 0)
                        .map((channel) => (
                          <ChannelItem key={channel.id} channel={channel} />
                        ))
                      }
                      
                      {/* Separator between DM and other channels */}
                      {dmChannels.length > 0 && otherChannels.length > 0 && (
                        <div className="py-3 px-2">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-border/40" />
                            </div>
                            <div className="relative flex justify-center text-xs text-muted-foreground">
                              <span className="bg-card px-2 font-medium">Channels</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Other Channels Unread */}
                      {otherChannels
                        .filter(channel => (channel.unreadCount || 0) > 0)
                        .map((channel) => (
                          <ChannelItem key={channel.id} channel={channel} />
                        ))
                      }
                      
                      {/* Other Channels Read */}
                      {otherChannels
                        .filter(channel => (channel.unreadCount || 0) === 0)
                        .map((channel) => (
                          <ChannelItem key={channel.id} channel={channel} />
                        ))
                      }
                    </>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
})
