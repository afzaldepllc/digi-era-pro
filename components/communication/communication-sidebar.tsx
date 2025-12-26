"use client"

import { useState, useCallback, memo, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MessageSquare,
  Users,
  Hash,
  ChevronDown,
  ChevronRight,
  Trash2,
  FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UserDirectory } from "./user-directory"
import { IChannel } from "@/types/communication"
import { ChannelList } from "./channel-list"
import { TrashView } from "./trash-view"
import { AuditLogView } from "./audit-log-view"

interface CommunicationSidebarProps {
  channels: IChannel[]
  activeChannelId?: string | null
  currentUserId: string
  onlineUserIds?: string[] // Real-time online user IDs from Supabase
  onChannelSelect: (channelId: string) => void
  onCreateChannel?: () => void
  onPinChannel?: (channelId: string, isPinned: boolean) => Promise<void>
  loading?: boolean
  className?: string
}

export const CommunicationSidebar = memo(function CommunicationSidebar({
  channels,
  activeChannelId,
  currentUserId,
  onlineUserIds = [],
  onChannelSelect,
  onCreateChannel,
  onPinChannel,
  loading = false,
  className
}: CommunicationSidebarProps) {
  const [showUsers, setShowUsers] = useState(true)
  const [showChannels, setShowChannels] = useState(true)
  const [showTrash, setShowTrash] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)

  const handleStartDM = useCallback(async (userId: string) => {
    // This will be handled by the parent component
    // The UserDirectory component will handle the DM creation
  }, [])

  const content = useMemo(() => (
    loading ? (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="pt-2 pr-0 pl-0 space-y-2">
        {/* Channels Section */}
        <div>
          <div className="px-2">
            <Button
              variant="ghost"
              className="w-full justify-start p-2 h-auto font-medium text-sm"
              onClick={() => setShowChannels(!showChannels)}
            >
              {showChannels ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <Hash className="h-4 w-4 mr-2" />
              Channels ({channels.filter(c => c.type !== 'dm').length})
            </Button>
          </div>

          {showChannels && (
            <div className="mt-2">
              <ChannelList
                channels={channels.filter(c => c.type !== 'dm')}
                activeChannelId={activeChannelId}
                onChannelSelect={onChannelSelect}
                currentUserId={currentUserId}
                onlineUserIds={onlineUserIds}
                onPinChannel={onPinChannel}
                showSearch={false}
                className="border-0 shadow-none"
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Direct Messages Section */}
        <div>
          <div className="px-2">
            <Button
              variant="ghost"
              className="w-full justify-start p-2 h-auto font-medium text-sm"
              onClick={() => setShowUsers(!showUsers)}
            >
              {showUsers ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <Users className="h-4 w-4 mr-2" />
              Direct Messages
            </Button>
          </div>

          <div className={cn("mt-2", !showUsers && "hidden")}>
            {/* All Users - handles both existing DMs and new conversations */}
            <UserDirectory
              onStartDM={handleStartDM}
              onChannelSelect={onChannelSelect}
              className="border-0 shadow-none"
            />
          </div>
        </div>
      </div>
    )
  ), [
    loading,
    showChannels,
    showUsers,
    channels,
    activeChannelId,
    onChannelSelect,
    currentUserId,
    onlineUserIds,
    onPinChannel
  ])

  return (
    <div className={cn("flex flex-col h-full bg-card border-r", className)}>
      {/* Header */}
      <div className="pl-4 pr-10 pt-4 pb-2 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          <div className="flex items-center gap-1">
            {/* Audit Log button (admin only - API will enforce) */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAuditLog(true)}
              title="View Audit Logs"
            >
              <FileText className="h-4 w-4" />
            </Button>
            {/* Trash button */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowTrash(true)}
              title="View Trash"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {onCreateChannel && (
              <Button variant="ghost" size="sm" onClick={onCreateChannel}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {content}
      </div>
      
      {/* Trash View Dialog */}
      <TrashView 
        isOpen={showTrash} 
        onClose={() => setShowTrash(false)} 
      />
      
      {/* Audit Log View Dialog */}
      <AuditLogView 
        isOpen={showAuditLog} 
        onClose={() => setShowAuditLog(false)} 
      />
    </div>
  )
})