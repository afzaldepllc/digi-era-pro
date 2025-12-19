"use client"

import { useEffect } from "react"
import { useParams, notFound } from "next/navigation"
import { ChatWindow } from "@/components/communication/chat-window"
import { useCommunications } from "@/hooks/use-communications"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ChannelPage() {
  const params = useParams()
  const router = useRouter()
  const channelId = params?.channelId as string

  if (!channelId) {
    notFound()
  }

  const {
    channels,
    selectedChannel,
    loading,
    error,
    selectChannel,
    fetchChannels
  } = useCommunications()

  useEffect(() => {
    if (channelId) {
      selectChannel(channelId)
    }
  }, [channelId, selectChannel])

  if (loading && !selectedChannel) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Header skeleton */}
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-6 w-48 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>

        {/* Messages skeleton */}
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-16 w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Input skeleton */}
        <div className="border-t bg-card p-2">
          <div className="flex items-end gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => fetchChannels()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!loading && !selectedChannel) {
    notFound()
  }

  return (
    <div className="h-[calc(100vh-64px)]">
      <ChatWindow channelId={channelId} />
    </div>
  )
}