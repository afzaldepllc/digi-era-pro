# Advanced Channel Management & Auto-Sync - Implementation Plan

## Overview

Implement advanced channel management with auto-sync members, admin controls, channel settings, project/department integration, and voice messaging.

---

## Architecture Strategy

### Current Channel Types
```typescript
type ChannelType = 'group' | 'department' | 'department-category' | 'multi-category' | 'project' | 'client-support'
```

### Auto-Sync Strategy
- **Department Channels**: Auto-add users when they join a department
- **Project Channels**: Auto-add assignees when tasks are assigned
- **Configurable**: Can be enabled/disabled per channel

---

## Phase 1: Database Schema Updates (2 days)

### 1.1 Update Prisma Schema for Channels

**Modify: `prisma/schema.prisma`**

```prisma
model channels {
  id                    String            @id @default(uuid())
  name                  String
  description           String?
  type                  String            // 'group' | 'department' | 'project' | 'client-support'
  
  // MongoDB references
  mongo_created_by      String
  mongo_project_id      String?           // For project channels
  mongo_department_id   String?           // For department channels
  
  // NEW: Auto-sync settings
  auto_sync_enabled     Boolean           @default(false)   // Auto-add new members
  allow_external_members Boolean          @default(true)    // Allow non-dept/project members
  admin_only_post       Boolean           @default(false)   // Only admins can send messages
  admin_only_add        Boolean           @default(false)   // Only admins can add members
  
  // Channel settings
  avatar_url            String?           // S3 URL for channel avatar
  is_pinned             Boolean           @default(false)
  is_archived           Boolean           @default(false)
  archived_at           DateTime?
  
  created_at            DateTime          @default(now())
  updated_at            DateTime          @updatedAt
  
  channel_members       channel_members[]
  messages              messages[]
  
  @@index([mongo_project_id])
  @@index([mongo_department_id])
  @@index([type, created_at])
}

model channel_members {
  id                    String    @id @default(uuid())
  channel_id            String
  mongo_member_id       String
  
  // NEW: Member roles
  role                  String    @default("member")  // 'admin' | 'member'
  
  // Denormalized member data
  member_name           String
  member_email          String
  member_avatar         String?
  
  joined_at             DateTime  @default(now())
  last_read_at          DateTime?
  
  channel               channels  @relation(fields: [channel_id], references: [id], onDelete: Cascade)
  
  @@unique([channel_id, mongo_member_id])
  @@index([mongo_member_id])
  @@index([channel_id, role])
}
```

**Run migration:**
```bash
npx prisma migrate dev --name add_channel_advanced_features
npx prisma generate
```

---

## Phase 2: Auto-Sync Infrastructure (3 days)

### 2.1 Channel Sync Manager

**Create: `lib/channel-sync-manager.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import User from '@/models/User'


class ChannelSyncManager {
  /**
   * Sync user to department channels when user joins department
   */
  async syncUserToDepartmentChannels(userId: string, departmentId: string) {
    try {
      // Find all department channels with auto-sync enabled
      const channels = await prisma.channels.findMany({
        where: {
          mongo_department_id: departmentId,
          auto_sync_enabled: true,
          is_archived: false,
        }
      })

      if (channels.length === 0) return

      // Get user data from MongoDB
      const user = await User.findById(userId).select('name email avatar')
      if (!user) throw new Error('User not found')

      // Add user to all auto-sync channels
      const memberPromises = channels.map(channel =>
        prisma.channel_members.upsert({
          where: {
            channel_id_mongo_member_id: {
              channel_id: channel.id,
              mongo_member_id: userId,
            }
          },
          create: {
            channel_id: channel.id,
            mongo_member_id: userId,
            member_name: user.name,
            member_email: user.email,
            member_avatar: user.avatar || null,
            role: 'member',
          },
          update: {
            member_name: user.name,
            member_email: user.email,
            member_avatar: user.avatar || null,
          }
        })
      )

      await Promise.all(memberPromises)
      
      // Broadcast channel updates via Supabase Realtime
      await this.broadcastChannelUpdates(channels.map(c => c.id), userId)
      
    } catch (error) {
      console.error('Error syncing user to department channels:', error)
      throw error
    }
  }

  /**
   * Sync assignee to project channel when task assigned
   */
  async syncAssigneeToProjectChannel(assigneeId: string, projectId: string) {
    try {
      // Find project channel with auto-sync enabled
      const channel = await prisma.channels.findFirst({
        where: {
          mongo_project_id: projectId,
          type: 'project',
          auto_sync_enabled: true,
          is_archived: false,
        }
      })

      if (!channel) return // No auto-sync channel for this project

      // Get assignee data from MongoDB
      const user = await User.findById(assigneeId).select('name email avatar')
      if (!user) throw new Error('Assignee not found')

      // Add assignee to channel
      await prisma.channel_members.upsert({
        where: {
          channel_id_mongo_member_id: {
            channel_id: channel.id,
            mongo_member_id: assigneeId,
          }
        },
        create: {
          channel_id: channel.id,
          mongo_member_id: assigneeId,
          member_name: user.name,
          member_email: user.email,
          member_avatar: user.avatar || null,
          role: 'member',
        },
        update: {
          member_name: user.name,
          member_email: user.email,
          member_avatar: user.avatar || null,
        }
      })

      // Broadcast update
      await this.broadcastChannelUpdates([channel.id], assigneeId)
      
    } catch (error) {
      console.error('Error syncing assignee to project channel:', error)
      throw error
    }
  }

  /**
   * Remove user from channels when removed from department
   */
  async removeUserFromDepartmentChannels(userId: string, departmentId: string) {
    try {
      // Find all department channels
      const channels = await prisma.channels.findMany({
        where: {
          mongo_department_id: departmentId,
          allow_external_members: false, // Only remove from restricted channels
        },
        select: { id: true }
      })

      if (channels.length === 0) return

      // Remove user from channels
      await prisma.channel_members.deleteMany({
        where: {
          channel_id: { in: channels.map(c => c.id) },
          mongo_member_id: userId,
          role: 'member', // Don't auto-remove admins
        }
      })

      // Broadcast updates
      await this.broadcastChannelUpdates(channels.map(c => c.id), userId)
      
    } catch (error) {
      console.error('Error removing user from department channels:', error)
      throw error
    }
  }

  /**
   * Broadcast channel updates via Supabase
   */
  private async broadcastChannelUpdates(channelIds: string[], affectedUserId: string) {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    for (const channelId of channelIds) {
      await supabase.channel(`rt_${channelId}`).send({
        type: 'broadcast',
        event: 'member_sync',
        payload: { channelId, affectedUserId }
      })
    }
  }

  /**
   * Check if user can be added to channel based on settings
   */
  async canAddUserToChannel(channelId: string, userId: string, requesterId: string): Promise<{
    allowed: boolean
    reason?: string
  }> {
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      include: {
        channel_members: {
          where: { mongo_member_id: requesterId }
        }
      }
    })

    if (!channel) return { allowed: false, reason: 'Channel not found' }

    // Check if requester is admin
    const requesterMember = channel.channel_members[0]
    const isAdmin = requesterMember?.role === 'admin'

    // Admin-only add restriction
    if (channel.admin_only_add && !isAdmin) {
      return { allowed: false, reason: 'Only admins can add members' }
    }

    // External members restriction
    if (!channel.allow_external_members) {
      // Check if user belongs to department/project
      if (channel.mongo_department_id) {
        const user = await User.findById(userId).select('departmentId')
        if (user?.departmentId?.toString() !== channel.mongo_department_id) {
          return { allowed: false, reason: 'User must belong to the channel department' }
        }
      }
    }

    return { allowed: true }
  }
}

export const channelSyncManager = new ChannelSyncManager()
```

### 2.2 Integrate with User Creation

**Modify: `app/api/users/route.ts` (POST)**

```typescript
import { channelSyncManager } from '@/lib/channel-sync-manager'

// After user creation
const user = await User.create(validatedData)

// Auto-sync to department channels
if (user.departmentId) {
  await channelSyncManager.syncUserToDepartmentChannels(
    user._id.toString(),
    user.departmentId.toString()
  )
}
```

### 2.3 Integrate with Task Assignment

**Modify: `app/api/tasks/route.ts` (POST) and `app/api/tasks/[id]/route.ts` (PUT)**

```typescript
import { channelSyncManager } from '@/lib/channel-sync-manager'

// After task creation/update with assignee
if (task.assigneeId && task.projectId) {
  await channelSyncManager.syncAssigneeToProjectChannel(
    task.assigneeId.toString(),
    task.projectId.toString()
  )
}
```

---

## Phase 3: Channel Admin Management (2 days)

### 3.1 Channel Admin API

**Create: `app/api/communication/channels/[id]/members/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { channelSyncManager } from '@/lib/channel-sync-manager'
import { z } from 'zod'
import User from '@/models/User'

// Add member to channel
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'create')
    const channelId = params.id
    
    const body = await request.json()
    const { userId, role = 'member' } = z.object({
      userId: z.string(),
      role: z.enum(['admin', 'member']).default('member')
    }).parse(body)

    // Check if requester can add users
    const canAdd = await channelSyncManager.canAddUserToChannel(
      channelId,
      userId,
      session.user.id
    )

    if (!canAdd.allowed) {
      return NextResponse.json({
        success: false,
        error: canAdd.reason
      }, { status: 403 })
    }

    // Get user data from MongoDB
    const user = await User.findById(userId).select('name email avatar')
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    // Add member
    const member = await prisma.channel_members.create({
      data: {
        channel_id: channelId,
        mongo_member_id: userId,
        member_name: user.name,
        member_email: user.email,
        member_avatar: user.avatar || null,
        role,
      }
    })

    return NextResponse.json({
      success: true,
      data: member
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')
    const channelId = params.id
    
    const body = await request.json()
    const { memberId, role } = z.object({
      memberId: z.string(),
      role: z.enum(['admin', 'member'])
    }).parse(body)

    // Check if requester is admin
    const requesterMember = await prisma.channel_members.findUnique({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: session.user.id
        }
      }
    })

    if (requesterMember?.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Only admins can change member roles'
      }, { status: 403 })
    }

    // Update role
    const updatedMember = await prisma.channel_members.update({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: memberId
        }
      },
      data: { role }
    })

    return NextResponse.json({
      success: true,
      data: updatedMember
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Remove member from channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'delete')
    const channelId = params.id
    
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({
        success: false,
        error: 'memberId is required'
      }, { status: 400 })
    }

    // Check if requester is admin or removing themselves
    const requesterMember = await prisma.channel_members.findUnique({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: session.user.id
        }
      }
    })

    const isSelf = memberId === session.user.id
    const isAdmin = requesterMember?.role === 'admin'

    if (!isSelf && !isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Only admins can remove other members'
      }, { status: 403 })
    }

    // Remove member
    await prisma.channel_members.delete({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: memberId
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

## Phase 4: Channel Settings (2 days)

### 4.1 Channel Settings API

**Create: `app/api/communication/channels/[id]/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { uploadToS3 } from '@/lib/services/s3.service'

const settingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  auto_sync_enabled: z.boolean().optional(),
  allow_external_members: z.boolean().optional(),
  admin_only_post: z.boolean().optional(),
  admin_only_add: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  is_archived: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')
    const channelId = params.id

    // Check if user is admin
    const member = await prisma.channel_members.findUnique({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: session.user.id
        }
      }
    })

    if (member?.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Only admins can update channel settings'
      }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = settingsSchema.parse(body)

    // Update channel
    const updatedChannel = await prisma.channels.update({
      where: { id: channelId },
      data: {
        ...validatedData,
        archived_at: validatedData.is_archived ? new Date() : null,
        updated_at: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedChannel
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

### 4.2 Channel Avatar Upload

**Create: `app/api/communication/channels/[id]/avatar/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import { prisma } from '@/lib/prisma'
import { uploadToS3, deleteFromS3 } from '@/lib/services/s3.service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await genericApiRoutesMiddleware(request, 'communication', 'update')
    const channelId = params.id

    // Check if user is admin
    const member = await prisma.channel_members.findUnique({
      where: {
        channel_id_mongo_member_id: {
          channel_id: channelId,
          mongo_member_id: session.user.id
        }
      }
    })

    if (member?.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Only admins can update channel avatar'
      }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    // Get current channel
    const channel = await prisma.channels.findUnique({
      where: { id: channelId },
      select: { avatar_url: true }
    })

    // Delete old avatar if exists
    if (channel?.avatar_url) {
      await deleteFromS3(channel.avatar_url)
    }

    // Upload new avatar
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `channel-avatars/${channelId}-${Date.now()}-${file.name}`
    const uploadResult = await uploadToS3(buffer, fileName, file.type)

    // Update channel
    const updatedChannel = await prisma.channels.update({
      where: { id: channelId },
      data: { avatar_url: uploadResult.url }
    })

    return NextResponse.json({
      success: true,
      data: { avatar_url: updatedChannel.avatar_url }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

## Phase 5: Generic Channel Creation (2 days)

### 5.1 Generic Channel Creation Hook

**Create: `hooks/use-channel-creation.ts`**

```typescript
import { useState } from 'react'
import { apiRequest } from '@/lib/utils/api-client'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface CreateChannelParams {
  name: string
  description?: string
  type: 'group' | 'department' | 'project' | 'client-support'
  projectId?: string
  departmentId?: string
  memberIds?: string[]
  auto_sync_enabled?: boolean
  allow_external_members?: boolean
  admin_only_post?: boolean
}

export function useChannelCreation() {
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const createChannel = async (params: CreateChannelParams) => {
    try {
      setIsCreating(true)

      const response = await apiRequest.post('/api/communication/channels', params)

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Channel created successfully',
        })
        return response.data
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create channel',
        variant: 'destructive',
      })
      throw error
    } finally {
      setIsCreating(false)
    }
  }

  const createProjectChannel = async (projectId: string, projectName: string) => {
    return createChannel({
      name: `${projectName} - Project Chat`,
      type: 'project',
      projectId,
      auto_sync_enabled: true,
      allow_external_members: true,
    })
  }

  const createDepartmentChannel = async (departmentId: string, departmentName: string) => {
    return createChannel({
      name: `${departmentName} - Department`,
      type: 'department',
      departmentId,
      auto_sync_enabled: true,
      allow_external_members: false,
    })
  }

  const navigateToChannel = (channelId: string) => {
    router.push(`/communications?channel=${channelId}`)
  }

  return {
    createChannel,
    createProjectChannel,
    createDepartmentChannel,
    navigateToChannel,
    isCreating,
  }
}
```

### 5.2 Project Page Integration

**Modify: `app/projects/[id]/page.tsx`**

```typescript
import { useChannelCreation } from '@/hooks/use-channel-creation'
import { MessageSquare, Plus } from 'lucide-react'

export default function ProjectDetailsPage() {
  const [projectChannel, setProjectChannel] = useState<any>(null)
  const { createProjectChannel, navigateToChannel, isCreating } = useChannelCreation()

  // Fetch project channel on load
  useEffect(() => {
    async function fetchProjectChannel() {
      if (!projectId) return
      try {
        const response = await fetch(`/api/communication/channels?projectId=${projectId}`)
        const result = await response.json()
        if (result.success && result.data.length > 0) {
          setProjectChannel(result.data[0])
        }
      } catch (error) {
        console.error('Error fetching project channel:', error)
      }
    }
    fetchProjectChannel()
  }, [projectId])

  const handleCreateChannel = async () => {
    if (!project) return
    const channel = await createProjectChannel(projectId, project.name)
    setProjectChannel(channel)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title={project.name}
        subtitle={project.description}
        actions={
          <div className="flex items-center gap-2">
            {projectChannel ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToChannel(projectChannel.id)}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Open Chat
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateChannel}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Channel
              </Button>
            )}
            {/* Other actions */}
          </div>
        }
      />

      {/* Show channel attachments in Overview tab */}
      {projectChannel && (
        <Card>
          <CardHeader>
            <CardTitle>Channel Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectChannelAttachments channelId={projectChannel.id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### 5.3 Project Channel Attachments Component

**Create: `components/projects/ProjectChannelAttachments.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { FileIcon, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Attachment {
  id: string
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  created_at: string
}

export function ProjectChannelAttachments({ channelId }: { channelId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAttachments() {
      try {
        const response = await fetch(`/api/communication/channels/${channelId}/attachments`)
        const result = await response.json()
        if (result.success) {
          setAttachments(result.data)
        }
      } catch (error) {
        console.error('Error fetching attachments:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAttachments()
  }, [channelId])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No attachments yet</p>
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <FileIcon className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{attachment.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {(attachment.file_size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href={attachment.file_url} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      ))}
    </div>
  )
}
```

---

## Phase 6: Voice Messages (3 days)

### 6.1 Voice Recording Hook

**Create: `hooks/use-voice-recording.ts`**

```typescript
import { useState, useRef, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  const { toast } = useToast()

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Best for web
      })
      
      chunksRef.current = []
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
      }
      
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      
      // Start duration timer
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not access microphone',
        variant: 'destructive'
      })
      console.error('Error starting recording:', error)
    }
  }, [toast])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setAudioBlob(null)
      setDuration(0)
    }
  }, [isRecording])

  const resetRecording = useCallback(() => {
    setAudioBlob(null)
    setDuration(0)
  }, [])

  return {
    isRecording,
    audioBlob,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  }
}
```

### 6.2 Voice Message Component

**Create: `components/communication/voice-message-recorder.tsx`**

```typescript
'use client'

import { Mic, Square, Trash2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVoiceRecording } from '@/hooks/use-voice-recording'
import { cn } from '@/lib/utils'

interface VoiceMessageRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => Promise<void>
  disabled?: boolean
}

export function VoiceMessageRecorder({ onSend, disabled }: VoiceMessageRecorderProps) {
  const {
    isRecording,
    audioBlob,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useVoiceRecording()

  const handleSend = async () => {
    if (audioBlob) {
      await onSend(audioBlob, duration)
      resetRecording()
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-2">
      {!isRecording && !audioBlob && (
        <Button
          variant="ghost"
          size="icon"
          onClick={startRecording}
          disabled={disabled}
          className="h-9 w-9"
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}

      {isRecording && (
        <>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-950 rounded-full">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-mono">{formatDuration(duration)}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={stopRecording}
            className="h-9 w-9"
          >
            <Square className="h-5 w-5 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-9 w-9 text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </>
      )}

      {!isRecording && audioBlob && (
        <>
          <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
            <Mic className="h-4 w-4" />
            <span className="text-sm font-mono">{formatDuration(duration)}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-9 w-9 text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSend}
            className="h-9 w-9 text-primary"
          >
            <Send className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  )
}
```

### 6.3 Integrate Voice Messages

**Modify: `components/communication/message-input.tsx`**

```typescript
import { VoiceMessageRecorder } from './voice-message-recorder'
import { uploadToS3 } from '@/lib/services/s3.service'

// Add to component
const handleVoiceSend = async (audioBlob: Blob, duration: number) => {
  try {
    // Upload to S3
    const buffer = Buffer.from(await audioBlob.arrayBuffer())
    const fileName = `voice-messages/${channelId}-${Date.now()}.webm`
    const uploadResult = await uploadToS3(buffer, fileName, 'audio/webm')

    // Create message with voice attachment
    await sendMessage({
      type: 'voice',
      content: `Voice message (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
      attachments: [{
        file_url: uploadResult.url,
        file_name: fileName,
        file_type: 'audio/webm',
        file_size: audioBlob.size,
        duration,
      }]
    })
  } catch (error) {
    toast({
      title: 'Error',
      description: 'Failed to send voice message',
      variant: 'destructive'
    })
  }
}

// In render
<div className="flex items-center gap-2">
  <VoiceMessageRecorder onSend={handleVoiceSend} disabled={adminOnlyPost && !isAdmin} />
  {/* ... rest of input */}
</div>
```

---

## Phase 7: Permission Checks (1 day)

### 7.1 Message Send Permission Check

**Modify: `app/api/communication/messages/route.ts`**

```typescript
// Before creating message
const channel = await prisma.channels.findUnique({
  where: { id: channel_id },
  include: {
    channel_members: {
      where: { mongo_member_id: session.user.id }
    }
  }
})

if (!channel) {
  return NextResponse.json({
    success: false,
    error: 'Channel not found'
  }, { status: 404 })
}

const member = channel.channel_members[0]
if (!member) {
  return NextResponse.json({
    success: false,
    error: 'You are not a member of this channel'
  }, { status: 403 })
}

// Admin-only post check
if (channel.admin_only_post && member.role !== 'admin') {
  return NextResponse.json({
    success: false,
    error: 'Only admins can post in this channel'
  }, { status: 403 })
}
```

---

## Implementation Checklist

### Database
- [ ] Update Prisma schema with new channel fields
- [ ] Add channel_members role field
- [ ] Run migrations
- [ ] Add indexes for performance

### Backend
- [ ] Create `ChannelSyncManager` class
- [ ] Integrate auto-sync with user creation
- [ ] Integrate auto-sync with task assignment
- [ ] Create channel admin management APIs
- [ ] Create channel settings API
- [ ] Create channel avatar upload API
- [ ] Add permission checks to message creation
- [ ] Create channel attachments API

### Frontend
- [ ] Create `useChannelCreation` hook
- [ ] Create `useVoiceRecording` hook
- [ ] Create voice message recorder component
- [ ] Integrate channel creation in project pages
- [ ] Create channel settings modal
- [ ] Create project channel attachments component
- [ ] Update message input with voice recorder
- [ ] Add admin badge to channel members
- [ ] Add channel settings button (admins only)

### Testing
- [ ] Test auto-sync on user creation
- [ ] Test auto-sync on task assignment
- [ ] Test admin role assignment
- [ ] Test admin-only posting
- [ ] Test admin-only member adding
- [ ] Test external members restriction
- [ ] Test voice message recording and playback
- [ ] Test channel avatar upload
- [ ] Test project channel integration

---

## Files to Create

1. `lib/channel-sync-manager.ts` - Auto-sync logic
2. `app/api/communication/channels/[id]/members/route.ts` - Member management
3. `app/api/communication/channels/[id]/settings/route.ts` - Settings API
4. `app/api/communication/channels/[id]/avatar/route.ts` - Avatar upload
5. `app/api/communication/channels/[id]/attachments/route.ts` - Attachments list
6. `hooks/use-channel-creation.ts` - Channel creation hook
7. `hooks/use-voice-recording.ts` - Voice recording hook
8. `components/communication/voice-message-recorder.tsx` - Voice UI
9. `components/projects/ProjectChannelAttachments.tsx` - Attachments display
10. `components/communication/channel-settings-modal.tsx` - Settings UI

---

## Files to Modify

1. `prisma/schema.prisma` - Add new fields
2. `app/api/users/route.ts` - Add auto-sync on user creation
3. `app/api/tasks/route.ts` - Add auto-sync on task creation
4. `app/api/tasks/[id]/route.ts` - Add auto-sync on task update
5. `app/api/communication/messages/route.ts` - Add permission checks
6. `app/projects/[id]/page.tsx` - Add channel integration
7. `components/communication/message-input.tsx` - Add voice recorder
8. `components/communication/channel-list.tsx` - Show admin badges
9. `types/communication.ts` - Update types

---

## Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Database Schema | 2 days | HIGH |
| Phase 2: Auto-Sync Infrastructure | 3 days | HIGH |
| Phase 3: Admin Management | 2 days | HIGH |
| Phase 4: Channel Settings | 2 days | MEDIUM |
| Phase 5: Generic Creation | 2 days | MEDIUM |
| Phase 6: Voice Messages | 3 days | MEDIUM |
| Phase 7: Permission Checks | 1 day | HIGH |

**Total: 15 days**

---

## Success Criteria

✅ Users auto-added to department channels when joining department

✅ Assignees auto-added to project channels when tasks assigned

✅ Channel creator is admin by default

✅ Admins can assign other admins

✅ Admin-only posting works (announcement channels)

✅ External member restrictions enforced

✅ Channel creation from project/department pages

✅ Channel avatar upload working

✅ Voice messages record, upload, and playback

✅ Project channel attachments displayed in project overview

✅ Permissions properly checked on all operations
