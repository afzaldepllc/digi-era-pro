"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAppDispatch } from "@/hooks/redux"
import { addChannel } from "@/store/slices/communicationSlice"
import { Button } from "@/components/ui/button"
import { ChatWindow } from "@/components/communication/chat-window"
import { CommunicationSidebar } from "@/components/communication/communication-sidebar"
import { OnlineIndicator } from "@/components/communication/online-indicator"
import PageHeader from "@/components/shared/page-header"
import {
  MessageSquare,
  Plus,
  Menu,
  X,
  Users,
  Search,
  Settings,
  AlignLeft,
  AlignRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCommunications } from "@/hooks/use-communications"
import { useDepartments } from "@/hooks/use-departments"
import { usePermissions } from "@/hooks/use-permissions"
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
import { handleAPIError } from "@/lib/utils/api-client"
import { CreateChannelModal } from "@/components/communication/create-channel-modal"
import { ResizableSidebar } from "@/components/communication/resizable-sidebar"
import FullscreenToggle, { FullscreenToggleRef } from '@/components/shared/FullscreenToggle';

export default function CommunicationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const { canCreate } = usePermissions()
  const lastChannelParam = useRef<string | null>(null)

  // Department integration for filtering
  const { allDepartments } = useDepartments()

  // Memoize available departments to prevent unnecessary re-renders
  const availableDepartments = useMemo(() => {
    if (allDepartments && allDepartments.length > 0) {
      return allDepartments.map((dept: any) => ({
        value: dept._id,
        label: dept.name,
      }))
    }
    return []
  }, [allDepartments])

  const {
    channels,
    activeChannelId,
    selectedChannel,
    loading,
    error,
    currentUser,
    onlineUsers,
    onlineUserIds,
    unreadCount,
    hasChannels,
    fetchChannels,
    selectChannel,
    createChannel,
    setError,
    setFilters,
    filters,
    mockUsers,
    mockCurrentUser,
    pinChannel
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
  const fullscreenRef = useRef<FullscreenToggleRef>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    // No longer needed since we use the memoized value directly
  }, [])

  const handleChannelSelect = useCallback((channelId: string) => {
    selectChannel(channelId)
    setIsMobileMenuOpen(false) // Close mobile menu after selection
  }, [selectChannel])

  const handleCreateChannel = useCallback(() => {
    setIsCreateChannelOpen(true)
    // TODO: Implement create channel functionality
    console.log('Create new channel')
  }, [])

  const handleRefresh = () => {
    fetchChannels()
  }

  const handleDepartmentFilter = (departmentId: string) => {
    if (departmentId === 'all') {
      setFilters({ ...filters, mongoDepartmentId: undefined })
    } else {
      setFilters({ ...filters, mongoDepartmentId: departmentId })
    }
  }

  const [channelName, setChannelName] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  // const [users, setUsers] = useState<{ _id: string, name: string, email: string }[]>([])
  const [chat_users, setChatUsers] = useState<any[]>(mockUsers)
  const [usersLoading, setUsersLoading] = useState(false)

  console.log("fullscreenRef154", fullscreenRef);
  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions)
    setSelectedMembers(options.map(opt => opt.value))
  }
  console.log("isFullscreen150", isFullscreen)
  return (
    <div className={`${isFullscreen ? 'h-[100vh]' : 'h-[calc(100vh-64px)]'}  flex flex-col bg-background`}>
    {/* <div className={`h-[calc(100vh-64px)]  flex flex-col bg-background`}> */}
      {/* Mobile header */}
      <div className="lg:hidden border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="h-9 w-9  border-0 shadow-sm hover:text-primary transition-all duration-300  flex items-center justify-center hover:scale-110">
                  {/* <AlignLeft className="h-6 w-6" /> */}
                  <svg
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="3" y="5" width="18" height="3" rx="1.5" />
                    <rect x="11" y="10.5" width="10" height="3" rx="1.5" />
                    <rect x="3" y="16" width="18" height="3" rx="1.5" />
                  </svg>
                </button>
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
                  currentUserId={mockCurrentUser?._id || ''}
                  onlineUserIds={onlineUserIds}
                  onCreateChannel={handleCreateChannel}
                  onPinChannel={pinChannel}
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
        {/* Desktop sidebar - Resizable */}
        <ResizableSidebar
          defaultWidth={300}
          minWidth={200}
          // Convert 50vw to px before passing as maxWidth
          maxWidth={typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.5) : 500}
          storageKey="communication-sidebar"
          className="hidden lg:flex border-r"
        >
          <CommunicationSidebar
            channels={channels}
            activeChannelId={activeChannelId}
            onChannelSelect={handleChannelSelect}
            currentUserId={mockCurrentUser?._id || ''}
            onlineUserIds={onlineUserIds}
            onCreateChannel={handleCreateChannel}
            onPinChannel={pinChannel}
            loading={loading}
          />
        </ResizableSidebar>



        {/* Chat area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeChannelId ? (
            <ChatWindow
              channelId={activeChannelId}
              fullscreenRef={fullscreenRef}
              onFullscreenChange={setIsFullscreen}
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

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onChannelCreatedRaw={async (channel) => {
          // Optimistic update: Add channel to Redux store immediately
          // This ensures the channel appears in the list instantly without waiting for realtime
          console.log('🔄 Adding channel to Redux store immediately:', channel.id)
          dispatch(addChannel(channel))
        }}
        onChannelCreated={(channel) => {
          if (channel) {
            console.log('📢 Channel created, selecting channel:', channel.id)
            selectChannel(channel.id)
            // Update URL
            const url = new URL(window.location.href)
            url.searchParams.set('channel', channel.id)
            window.history.replaceState({}, '', url.toString())
          }
        }}
      />
    </div>
  )
}