"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import CustomModal from "@/components/shared/custom-modal"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Settings,
  Users,
  Archive,
  LogOut,
  Shield,
  Crown,
  Trash2,
  UserMinus,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { IChannel, IParticipant } from "@/types/communication"
import { useCommunications } from "@/hooks/use-communications"
import { useSession } from "next-auth/react"

interface ChannelSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  channel: IChannel
  className?: string
}

export function ChannelSettingsModal({
  isOpen,
  onClose,
  channel,
  className
}: ChannelSettingsModalProps) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id
  
  const {
    leaveChannel,
    archiveChannel,
    actionLoading
  } = useCommunications()

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Get current user's membership
  const currentMembership = channel.channel_members.find(
    m => m.mongo_member_id === currentUserId
  )
  
  const isAdmin = currentMembership?.channelRole === 'admin' || channel.mongo_creator_id === currentUserId
  const isCreator = channel.mongo_creator_id === currentUserId
  const isArchived = (channel as any).is_archived || false

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Get role badge
  const getRoleBadge = (channelRole: 'admin' | 'member', isOwner: boolean) => {
    if (isOwner) {
      return <Badge variant="default" className="ml-2"><Crown className="h-3 w-3 mr-1" />Owner</Badge>
    }
    if (channelRole === 'admin') {
      return <Badge variant="secondary" className="ml-2"><Shield className="h-3 w-3 mr-1" />Admin</Badge>
    }
    return null
  }

  // Handle leave channel
  const handleLeave = useCallback(async () => {
    setIsProcessing(true)
    const result = await leaveChannel(channel.id)
    setIsProcessing(false)
    
    if (result.success) {
      setShowLeaveConfirm(false)
      onClose()
    }
    // Error already handled in hook with toast
  }, [leaveChannel, channel.id, onClose])

  // Handle archive/unarchive channel
  const handleArchive = useCallback(async () => {
    setIsProcessing(true)
    const result = await archiveChannel(channel.id, isArchived ? 'unarchive' : 'archive')
    setIsProcessing(false)
    
    if (result.success) {
      setShowArchiveConfirm(false)
      onClose()
    }
    // Error already handled in hook with toast
  }, [archiveChannel, channel.id, isArchived, onClose])

  // Don't show for DM channels
  if (channel.type === 'dm') {
    return null
  }

  return (
    <>
      <CustomModal
        isOpen={isOpen}
        onClose={onClose}
        title="Channel Settings"
        modalSize="lg"
        className={className}
      >
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({channel.channel_members.length})
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6 mt-4">
            {/* Channel Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Channel Name</Label>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium">{channel.name || 'Unnamed Channel'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Channel Type</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{channel.type}</Badge>
                  {channel.is_private && <Badge variant="secondary">Private</Badge>}
                  {isArchived && <Badge variant="destructive">Archived</Badge>}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Created</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(channel.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Actions</Label>
              
              {/* Archive/Unarchive - Admin only */}
              {(isAdmin || isCreator) && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowArchiveConfirm(true)}
                  disabled={actionLoading}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {isArchived ? 'Unarchive Channel' : 'Archive Channel'}
                </Button>
              )}

              {/* Leave Channel - Not for admins without other admins */}
              {!isCreator && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setShowLeaveConfirm(true)}
                  disabled={actionLoading}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Channel
                </Button>
              )}

              {isCreator && (
                <p className="text-xs text-muted-foreground">
                  As the channel creator, you cannot leave. Transfer ownership or archive the channel instead.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {channel.channel_members.map((member) => {
                  const isCurrentUser = member.mongo_member_id === currentUserId
                  const isMemberOwner = member.mongo_member_id === channel.mongo_creator_id
                  
                  return (
                    <div
                      key={member.mongo_member_id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg",
                        "hover:bg-muted/50 transition-colors",
                        isCurrentUser && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(member.name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center">
                            <p className="font-medium text-sm">
                              {member.name || 'Unknown User'}
                              {isCurrentUser && <span className="text-muted-foreground ml-1">(You)</span>}
                            </p>
                            {getRoleBadge(member.channelRole, isMemberOwner)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {member.email || member.userRole || 'Member'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CustomModal>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Channel?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{channel.name}"? 
              You'll no longer receive messages from this channel.
              {isAdmin && (
                <span className="block mt-2 text-amber-600">
                  Note: As an admin, leaving will transfer your role to another member.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Leave Channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchived ? 'Unarchive Channel?' : 'Archive Channel?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchived ? (
                <>
                  This will restore the channel and make it visible to all members again.
                  Members will be able to send messages.
                </>
              ) : (
                <>
                  Archiving will hide this channel from the channel list.
                  Members won't be able to send new messages, but message history will be preserved.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isArchived ? 'Unarchive' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default ChannelSettingsModal
