"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  X, 
  Users, 
  Hash, 
  Calendar, 
  FileText, 
  ExternalLink,
  Settings,
  Bell,
  BellOff,
  Pin,
  Archive
} from "lucide-react"
import { cn } from "@/lib/utils"
import { IChannel, IParticipant } from "@/types/communication"
import { format } from "date-fns"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ContextPanelProps {
  channel?: IChannel
  isVisible: boolean
  onToggle: () => void
  onClose?: () => void
  className?: string
}

export function ContextPanel({
  channel,
  isVisible,
  onToggle,
  onClose,
  className
}: ContextPanelProps) {
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true)
  const [isPinned, setIsPinned] = useState(false)

  if (!isVisible || !channel) {
    return null
  }

  const getChannelTypeLabel = (type: string) => {
    switch (type) {
      case 'dm': return 'Direct Message'
      case 'project': return 'Project Channel'
      case 'client-support': return 'Client Support'
      case 'group': return 'Group Channel'
      default: return 'Channel'
    }
  }

  const mockProjectInfo = channel.mongo_project_id ? {
    name: 'Digi Era Pro CRM Development',
    description: 'Complete CRM system with advanced features',
    status: 'In Progress',
    deadline: '2025-12-31'
  } : null

  const mockFiles = [
    {
      id: '1',
      name: 'ui-designs-v2.pdf',
      size: '2.4 MB',
      uploadedBy: 'Sarah Wilson',
      uploadedAt: new Date('2025-10-09T15:45:00Z'),
      type: 'pdf'
    },
    {
      id: '2', 
      name: 'project-requirements.docx',
      size: '1.2 MB',
      uploadedBy: 'Afzal Habib',
      uploadedAt: new Date('2025-10-08T10:30:00Z'),
      type: 'document'
    },
    {
      id: '3',
      name: 'screenshot-2025-10-07.png',
      size: '845 KB',
      uploadedBy: 'Talha',
      uploadedAt: new Date('2025-10-07T14:20:00Z'),
      type: 'image'
    }
  ]

  return (
    <TooltipProvider>
      <div className={cn(
        "w-80 bg-card border-l flex flex-col h-full",
        className
      )}>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Channel Info</h3>
          <Button
            variant="ghost"
            size="sm" 
            onClick={onClose || onToggle}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Channel Overview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">{channel.name}</h4>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline">{getChannelTypeLabel(channel.type)}</Badge>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(channel.created_at), 'MMM d, yyyy')}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Members:</span>
                  <span>{channel.participants.length}</span>
                </div>
                
                {!channel.is_private && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility:</span>
                    <Badge variant="secondary">External</Badge>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsNotificationEnabled(!isNotificationEnabled)}
                    >
                      {isNotificationEnabled ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isNotificationEnabled ? 'Mute' : 'Unmute'} notifications</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsPinned(!isPinned)}
                    >
                      <Pin className={cn("h-4 w-4", isPinned && "text-primary")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isPinned ? 'Unpin' : 'Pin'} channel</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Channel settings</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Separator />

            {/* Project Info (if applicable) */}
            {mockProjectInfo && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-medium">Project Details</h4>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium">{mockProjectInfo.name}</p>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <p>{mockProjectInfo.description}</p>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="default">{mockProjectInfo.status}</Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deadline:</span>
                      <span>{format(new Date(mockProjectInfo.deadline), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Project
                  </Button>
                </div>

                <Separator />
              </>
            )}

            {/* Members */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">Members ({channel.participants.length})</h4>
              </div>
              
              <div className="space-y-2">
                {channel.participants.map((participant) => (
                  <div key={participant.mongo_member_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.avatar} alt={participant.name} />
                        <AvatarFallback className="text-xs">
                          {participant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {participant.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{participant.name}</p>
                      <div className="flex items-center gap-2">
                        {participant.role && (
                          <Badge variant="outline" className="text-xs">
                            {participant.role}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {participant.userType}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Shared Files */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-medium">Shared Files</h4>
                </div>
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </div>
              
              <div className="space-y-2">
                {mockFiles.slice(0, 3).map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{file.size}</span>
                        <span>•</span>
                        <span>{file.uploadedBy}</span>
                        <span>•</span>
                        <span>{format(new Date(file.uploadedAt), 'MMM d')}</span>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Channel Settings */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Channel Settings</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Notifications</span>
                  <Badge variant={isNotificationEnabled ? "default" : "secondary"}>
                    {isNotificationEnabled ? "On" : "Off"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pinned</span>
                  <Badge variant={isPinned ? "default" : "secondary"}>
                    {isPinned ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full">
                <Archive className="h-4 w-4 mr-2" />
                Archive Channel
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
}
