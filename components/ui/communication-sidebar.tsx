"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MessageSquare,
  Users,
  Hash,
  ChevronDown,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ChannelList } from "./channel-list"
import { UserDirectory } from "./user-directory"
import { IChannel } from "@/types/communication"

interface CommunicationSidebarProps {
  channels: IChannel[]
  activeChannelId?: string | null
  currentUserId: string
  onChannelSelect: (channelId: string) => void
  onCreateChannel?: () => void
  loading?: boolean
  className?: string
}

export function CommunicationSidebar({
  channels,
  activeChannelId,
  currentUserId,
  onChannelSelect,
  onCreateChannel,
  loading = false,
  className
}: CommunicationSidebarProps) {
  const [showUsers, setShowUsers] = useState(true)
  const [showChannels, setShowChannels] = useState(true)

  return (
    <div className={cn("flex flex-col h-full bg-card border-r", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          {onCreateChannel && (
            <Button variant="ghost" size="sm" onClick={onCreateChannel}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
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
          <div className="p-2 space-y-4">
            {/* Channels Section */}
            <div>
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
                Channels ({channels.length})
              </Button>

              {showChannels && (
                <div className="mt-2">
                  <ChannelList
                    channels={channels}
                    activeChannelId={activeChannelId}
                    onChannelSelect={onChannelSelect}
                    currentUserId={currentUserId}
                    showSearch={false}
                    className="border-0 shadow-none"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Users Section */}
            <div>
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

              <div className={cn("mt-2", !showUsers && "hidden")}>
                <UserDirectory
                  onStartDM={async (userId: string) => {
                    // This will be handled by the parent component
                    // The UserDirectory component will handle the DM creation
                  }}
                  className="border-0 shadow-none max-h-96"
                />
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}