"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChatWindow } from "@/components/ui/chat-window"
import { CommunicationSidebar } from "@/components/ui/communication-sidebar"
import { OnlineIndicator } from "@/components/ui/online-indicator"
import PageHeader from "@/components/ui/page-header"
import {
  MessageSquare,
  Plus,
  Menu,
  X,
  Users,
  Search,
  Settings
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCommunications } from "@/hooks/use-communications"
import { useDepartments } from "@/hooks/use-departments"
import { usePermissions } from "@/hooks/use-permissions"
import { useUsers } from "@/hooks/use-users"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserDirectory } from "@/components/ui/user-directory"
import { handleAPIError } from "@/lib/utils/api-client"

export default function CommunicationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const { canCreate } = usePermissions()
  const lastChannelParam = useRef<string | null>(null)
  
  // Department integration for filtering
  const [availableDepartments, setAvailableDepartments] = useState<Array<{ value: string, label: string }>>([])
  const { allDepartments } = useDepartments()

  const {
    channels,
    activeChannelId,
    selectedChannel,
    loading,
    error,
    currentUser,
    onlineUsers,
    unreadCount,
    hasChannels,
    fetchChannels,
    selectChannel,
    createChannel,
    setError,
    setFilters,
    filters
  } = useCommunications()
  
  // Handle URL params for direct channel access
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const channelParam = url.searchParams.get('channel')
    if (channelParam && channelParam !== lastChannelParam.current && channelParam !== activeChannelId) {
      lastChannelParam.current = channelParam
      selectChannel(channelParam)
    }
  }, [activeChannelId, selectChannel])

  // Update URL when channel changes
  // useEffect(() => {
  //   if (activeChannelId) {
  //     const url = new URL(window.location.href)
  //     const currentChannelParam = url.searchParams.get('channel')
  //     if (currentChannelParam !== activeChannelId) {
  //       url.searchParams.set('channel', activeChannelId)
  //       window.history.replaceState({}, '', url.toString())
  //     }
  //   }
  // }, [activeChannelId])

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsMobileMenuOpen(false)
      }
    }

    handleResize() // Initial check
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch available departments for filter
  const fetchAvailableDepartments = useCallback(async () => {
    try {
      // Use allDepartments from the hook instead of fetching
      const currentAllDepartments = allDepartments
      if (currentAllDepartments && currentAllDepartments.length > 0) {
        const departmentOptions = currentAllDepartments.map((dept: any) => ({
          value: dept._id,
          label: dept.name,
        })) || []
        setAvailableDepartments(departmentOptions)
      }
    } catch (error) {
      console.error('Failed to fetch departments for filter:', error)
      handleAPIError(error, "Failed to load departments for filtering")
    }
  }, []) // Remove allDepartments from dependencies to prevent infinite re-runs

  // Fetch departments for filters on mount
  useEffect(() => {
    if (availableDepartments.length === 0) {
      fetchAvailableDepartments()
    }
  }, [fetchAvailableDepartments])

  // Update available departments when allDepartments changes
  useEffect(() => {
    if (allDepartments && allDepartments.length > 0) {
      const departmentOptions = allDepartments.map((dept: any) => ({
        value: dept._id,
        label: dept.name,
      })) || []
      setAvailableDepartments(departmentOptions)
    }
  }, [allDepartments])

  const handleChannelSelect = (channelId: string) => {
    selectChannel(channelId)
    setIsMobileMenuOpen(false) // Close mobile menu after selection
  }

  const handleCreateChannel = () => {
    setIsCreateChannelOpen(true)
    // TODO: Implement create channel functionality
    console.log('Create new channel')
  }

  const handleRefresh = () => {
    fetchChannels()
  }

  const handleDepartmentFilter = (departmentId: string) => {
    if (departmentId === 'all') {
      setFilters({ ...filters, departmentId: undefined })
    } else {
      setFilters({ ...filters, departmentId })
    }
  }

  const [channelName, setChannelName] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  // const [users, setUsers] = useState<{ _id: string, name: string, email: string }[]>([])
  const { users } = useUsers()
  const [chat_users, setChatUsers] = useState<any[]>(users)
  const [usersLoading, setUsersLoading] = useState(false)


  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions)
    setSelectedMembers(options.map(opt => opt.value))
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Mobile header */}
      <div className="lg:hidden border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Messages Navigation</SheetTitle>
                  <SheetDescription>Navigate through your channels and conversations</SheetDescription>
                </SheetHeader>
                <CommunicationSidebar
                  channels={channels}
                  activeChannelId={activeChannelId}
                  onChannelSelect={handleChannelSelect}
                  currentUserId={currentUser?._id || ''}
                  onCreateChannel={handleCreateChannel}
                  loading={loading}
                />
              </SheetContent>
            </Sheet>

            <h1 className="font-semibold text-lg">Messages</h1>

            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onlineUsers.length > 0 && (
              <OnlineIndicator users={onlineUsers} maxVisible={2} size="sm" />
            )}

            {/* {canCreate('communications', 'create') && ( */}
            <Button variant="outline" size="sm" onClick={handleCreateChannel}>
              <Plus className="h-4 w-4" />
            </Button>
            {/* )} */}
          </div>
        </div>
      </div>

      {/* Desktop header */}
      {/* <div className="hidden lg:block">
        <PageHeader
          title="Communications"
          subtitle="Real-time messaging and collaboration"
          addButtonText="New Channel"
          onAddClick={handleCreateChannel}
        />
      </div> */}

      {/* Error display */}
      {error && (
        <Alert className="m-4 mb-0">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError('')}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:block w-80 border-r shrink-0 overflow-hidden">
          <CommunicationSidebar
            channels={channels}
            activeChannelId={activeChannelId}
            onChannelSelect={handleChannelSelect}
            currentUserId={currentUser?._id || ''}
            onCreateChannel={handleCreateChannel}
            loading={loading}
          />
        </div>



        {/* Chat area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeChannelId ? (
            <ChatWindow
              channelId={activeChannelId}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-muted/10">
              <div className="text-center space-y-4 max-w-md mx-auto p-8">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare className="h-10 w-10 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-semibold text-xl">Welcome to Communications</h2>
                  <p className="text-muted-foreground">
                    Stay connected with your team and clients through real-time messaging
                  </p>
                </div>

                {hasChannels ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Select a conversation from the sidebar to get started
                    </p>

                    <div className="lg:hidden">
                      <Button
                        variant="outline"
                        onClick={() => setIsMobileMenuOpen(true)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Conversations
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No conversations yet. Create a new channel to start messaging.
                    </p>

                    {/* {canCreate('communications', 'create') && ( */}
                    <Button onClick={handleCreateChannel}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Channel
                    </Button>
                    {/* )} */}
                  </div>
                )}

                {/* Quick stats */}
                <div className="flex justify-center gap-6 pt-4 border-t text-sm text-muted-foreground">
                  <div className="text-center">
                    <div className="font-medium text-lg text-foreground">{channels.length}</div>
                    <div>Channels</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-lg text-foreground">{onlineUsers.length}</div>
                    <div>Online</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-lg text-foreground">{unreadCount}</div>
                    <div>Unread</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Start a Conversation</DialogTitle>
            <DialogDescription>
              Choose a user to start a direct message or create a new channel
            </DialogDescription>
          </DialogHeader>

          <UserDirectory
            onStartDM={async (userId: string) => {
              try {
                const channel = await createChannel({
                  type: 'dm',
                  participants: [userId]
                })

                if (channel) {
                  setIsCreateChannelOpen(false)
                  selectChannel(channel.channelId)
                  // Update URL
                  const url = new URL(window.location.href)
                  url.searchParams.set('channel', channel.channelId)
                  window.history.replaceState({}, '', url.toString())
                }
              } catch (error) {
                console.error('Failed to create DM:', error)
                setError('Failed to start conversation. Please try again.')
              }
            }}
            className="max-h-96"
          />

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateChannelOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}