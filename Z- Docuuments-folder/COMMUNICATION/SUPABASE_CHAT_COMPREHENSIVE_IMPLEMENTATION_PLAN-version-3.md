# Supabase Real-Time Chat - Comprehensive Implementation Plan

## Document Version: 1.0
**Date:** December 17, 2025  
**Status:** Planning Phase

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Missing Features](#missing-features)
4. [Architecture & Design Principles](#architecture--design-principles)
5. [Implementation Phases](#implementation-phases)
6. [Detailed Implementation Steps](#detailed-implementation-steps)
7. [Testing Strategy](#testing-strategy)


---

## Overview

This document outlines the comprehensive implementation of a fully-featured Supabase real-time communication system for Digi Era Pro CRM. The implementation follows existing CRUD patterns and integrates seamlessly with the MongoDB-based architecture.

### Key Objectives
- ✅ Complete channel creation system (department, project, category-based)
- ✅ Full message features (reply, mention, edit, delete, reactions)
- ✅ Intelligent member management with auto-population
- ✅ Client communication support
- ✅ Permissions handled via API (no RLS)
- ✅ Optimal performance and best practices

---

## Current State Analysis

### ✅ Already Implemented
1. **Database Schema** - Prisma schema with all tables (channels, messages, channel_members, reactions, attachments, read_receipts)
2. **Basic API Routes** - Channels, messages, members CRUD operations
3. **Real-time Manager** - Supabase real-time subscription handler
4. **Redux Store** - Communication slice with state management
5. **Basic UI Components** - ChatWindow, MessageList, ChannelList, CommunicationSidebar
6. **DM Functionality** - Direct messaging between users

### ❌ Missing / Incomplete Features
1. **Advanced Channel Creation**
   - Department-wise channels
   - Department category-wise channels  
   - Multi-category channels
   - Project-wise channels with auto-collaborator addition
   - Client support channels

2. **Message Features**
   - Reply/Thread functionality
   - User mentions (@user)
   - Message editing (UI incomplete)
   - Message deletion (UI incomplete)
   - Reactions (backend ready, UI missing)

3. **Member Management**
   - Auto-population logic for different channel types
   - Manual member addition to existing channels
   - Member role management
   - Member removal with proper validation

4. **UI Components**
   - Enhanced channel creation modal with all options
   - Reply/thread UI
   - Mention picker/autocomplete
   - Reaction picker
   - Member management UI

---

## Architecture & Design Principles

### 1. **Follow Existing Patterns**
```typescript
// API Routes Pattern (from COMPLETE-CRUD-IMPLEMENTATION-FINAL-VERSIONE.md)
- Use genericApiRoutesMiddleware for authentication & permissions
- Return consistent JSON responses
- Proper error handling with try-catch
- Include validation for all inputs
```

### 2. **Permission Strategy**
```typescript
// All permissions handled in API, not Supabase RLS
const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(
  request, 
  'communication', 
  'create' // or 'read', 'update', 'delete'
)
```

### 3. **Data Enrichment Pattern**
```typescript
// Enrich Supabase data with MongoDB user data
import { enrichChannelWithUserData } from '@/lib/db-utils'
const enrichedChannel = await enrichChannelWithUserData(channel, User)
```

### 4. **Auto-Population Logic**
```typescript
// Channel Type → Member Population Strategy
{
  'dm': [user1, user2],
  'department': getAllUsersInDepartment(departmentId),
  'department-category': getAllUsersInCategory(category),
  'multi-category': getAllUsersInCategories([...categories]),
  'project': getProjectCollaborators(projectId),
  'client-support': [client, ...supportTeam]
}
```

---

## Implementation Phases

### **Phase 1: Enhanced Channel Creation System** ⏱️ 2-3 hours
- API endpoints for advanced channel creation
- Auto-population logic for all channel types
- Validation and error handling
- Testing

### **Phase 2: Message Feature Completion** ⏱️ 2-3 hours
- Reply/thread functionality
- User mentions with autocomplete
- Edit message (complete UI)
- Delete message (complete UI)
- Testing

### **Phase 3: Member Management** ⏱️ 1-2 hours
- Manual add members to existing channels
- Remove members with validation
- Update member roles
- Testing

### **Phase 4: Reactions & Advanced Features** ⏱️ 1-2 hours
- Reaction picker UI
- Add/remove reactions
- Reaction display in messages
- Testing

### **Phase 5: UI Components & Polish** ⏱️ 2-3 hours
- Enhanced channel creation modal
- Mention picker component
- Thread/reply UI
- Member management modal
- Testing & bug fixes

---

## Detailed Implementation Steps

---

## PHASE 1: Enhanced Channel Creation System

### Step 1.1: Update Database Schema (if needed)
**File:** `prisma/schema.prisma`

```prisma
model Channel {
  // Add category field for multi-category channels
  categories            String[] // For multi-category channels: ['sales', 'support']
  // Existing fields...
}
```

### Step 1.2: Create Channel Helper Functions
**New File:** `lib/communication/channel-helpers.ts`

```typescript
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import Department from '@/models/Department'

export type ChannelType = 'dm' | 'group' | 'department' | 'department-category' | 'multi-category' | 'project' | 'client-support'
export type DepartmentCategory = 'sales' | 'support' | 'it' | 'management'

interface ChannelCreationParams {
  type: ChannelType
  creator_id: string
  name?: string
  
  // For department channels
  department_id?: string
  
  // For category channels
  category?: DepartmentCategory
  categories?: DepartmentCategory[] // For multi-category
  
  // For project channels
  project_id?: string
  
  // For DM/group channels
  channel_members?: string[]
  
  // For client support
  client_id?: string
  
  is_private?: boolean
}

/**
 * Get all users for a department
 */
export async function getDepartmentUsers(departmentId: string): Promise<string[]> {
  await connectDB()
  const users = await User.find({ 
    department: departmentId,
    isActive: true 
  }).select('_id')
  
  return users.map(u => u._id.toString())
}

/**
 * Get all users with a specific department category
 */
export async function getCategoryUsers(category: DepartmentCategory): Promise<string[]> {
  await connectDB()
  
  // First get all departments with this category
  const departments = await Department.find({ 
    category: category 
  }).select('_id')
  
  const departmentIds = departments.map(d => d._id.toString())
  
  // Then get all users in these departments
  const users = await User.find({
    department: { $in: departmentIds },
    isActive: true
  }).select('_id')
  
  return users.map(u => u._id.toString())
}

/**
 * Get all users with any of the specified categories
 */
export async function getMultiCategoryUsers(categories: DepartmentCategory[]): Promise<string[]> {
  await connectDB()
  
  const departments = await Department.find({ 
    category: { $in: categories }
  }).select('_id')
  
  const departmentIds = departments.map(d => d._id.toString())
  
  const users = await User.find({
    department: { $in: departmentIds },
    isActive: true
  }).select('_id')
  
  return users.map(u => u._id.toString())
}

/**
 * Get all project collaborators (users assigned to any task in project)
 */
export async function getProjectCollaborators(projectId: string): Promise<string[]> {
  await connectDB()
  
  const Project = (await import('@/models/Project')).default
  const project = await Project.findById(projectId).select('departmentTasks clientId')
  
  if (!project) return []
  
  const collaborators = new Set<string>()
  
  // Add client
  if (project.clientId) {
    collaborators.add(project.clientId.toString())
  }
  
  // Add all assignees from department tasks
  if (project.departmentTasks && Array.isArray(project.departmentTasks)) {
    project.departmentTasks.forEach((dept: any) => {
      if (dept.tasks && Array.isArray(dept.tasks)) {
        dept.tasks.forEach((task: any) => {
          if (task.assigneeId) {
            collaborators.add(task.assigneeId.toString())
          }
        })
      }
    })
  }
  
  return Array.from(collaborators)
}

/**
 * Get support team users (users in support category)
 */
export async function getSupportTeamUsers(): Promise<string[]> {
  return getCategoryUsers('support')
}

/**
 * Main function to get channel members based on channel type
 */
export async function getChannelMembers(params: ChannelCreationParams): Promise<string[]> {
  const members = new Set<string>()
  
  // Always include creator
  members.add(params.creator_id)
  
  switch (params.type) {
    case 'dm':
    case 'group':
      // Direct channel_members
      if (params.channel_members) {
        params.channel_members.forEach(p => members.add(p))
      }
      break
      
    case 'department':
      // All users in department
      if (params.department_id) {
        const deptUsers = await getDepartmentUsers(params.department_id)
        deptUsers.forEach(u => members.add(u))
      }
      break
      
    case 'department-category':
      // All users with this category
      if (params.category) {
        const categoryUsers = await getCategoryUsers(params.category)
        categoryUsers.forEach(u => members.add(u))
      }
      break
      
    case 'multi-category':
      // All users with any of these categories
      if (params.categories && params.categories.length > 0) {
        const multiCategoryUsers = await getMultiCategoryUsers(params.categories)
        multiCategoryUsers.forEach(u => members.add(u))
      }
      break
      
    case 'project':
      // All project collaborators
      if (params.project_id) {
        const collaborators = await getProjectCollaborators(params.project_id)
        collaborators.forEach(u => members.add(u))
      }
      break
      
    case 'client-support':
      // Client + support team
      if (params.client_id) {
        members.add(params.client_id)
        const supportTeam = await getSupportTeamUsers()
        supportTeam.forEach(u => members.add(u))
      }
      break
  }
  
  return Array.from(members)
}

/**
 * Generate channel name based on type
 */
export async function generateChannelName(params: ChannelCreationParams): Promise<string> {
  if (params.name) return params.name
  
  await connectDB()
  
  switch (params.type) {
    case 'dm':
      return 'Direct Message'
      
    case 'department':
      if (params.department_id) {
        const dept = await Department.findById(params.department_id).select('name')
        return `${dept?.name || 'Department'} Channel`
      }
      return 'Department Channel'
      
    case 'department-category':
      return `${params.category?.toUpperCase() || 'Category'} Team Channel`
      
    case 'multi-category':
      if (params.categories && params.categories.length > 0) {
        const cats = params.categories.map(c => c.toUpperCase()).join(' + ')
        return `${cats} Teams Channel`
      }
      return 'Multi-Category Channel'
      
    case 'project':
      if (params.project_id) {
        const Project = (await import('@/models/Project')).default
        const project = await Project.findById(params.project_id).select('name')
        return `Project: ${project?.name || 'Unknown'}`
      }
      return 'Project Channel'
      
    case 'client-support':
      if (params.client_id) {
        const client = await User.findById(params.client_id).select('name')
        return `Support: ${client?.name || 'Client'}`
      }
      return 'Client Support'
      
    default:
      return 'New Channel'
  }
}
```

### Step 1.3: Update Channel Creation API
**File:** `app/api/communication/channels/route.ts`

```typescript
// POST /api/communication/channels - Enhanced channel creation
export async function POST(request: NextRequest) {
  try {
    const { session, user, userEmail, isSuperAdmin } = await genericApiRoutesMiddleware(
      request, 
      'communication', 
      'create'
    )

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type,
      name,
      channel_members,
      mongo_department_id,
      mongo_project_id,
      is_private,
      category,
      categories,
      client_id
    } = body

    // Validate required fields based on type
    if (!type) {
      return NextResponse.json(
        { error: 'Channel type is required' },
        { status: 400 }
      )
    }

    // Import channel helpers
    const { 
      getChannelMembers, 
      generateChannelName 
    } = await import('@/lib/communication/channel-helpers')

    // Get channel members based on type
    const memberIds = await getChannelMembers({
      type,
      creator_id: session.user.id,
      name,
      department_id: mongo_department_id,
      project_id: mongo_project_id,
      channel_members,
      category,
      categories,
      client_id,
      is_private
    })

    if (memberIds.length === 0) {
      return NextResponse.json(
        { error: 'No members found for this channel' },
        { status: 400 }
      )
    }

    // Generate channel name
    const channelName = await generateChannelName({
      type,
      creator_id: session.user.id,
      name,
      department_id: mongo_department_id,
      project_id: mongo_project_id,
      category,
      categories,
      client_id
    })

    // Create the channel with categories field
    const channel = await prisma.channel.create({
      data: {
        type,
        name: channelName,
        mongo_department_id,
        mongo_project_id,
        mongo_creator_id: session.user.id,
        is_private: is_private || false,
        member_count: memberIds.length,
        categories: categories || [], // Store categories for multi-category channels
        channel_members: {
          create: memberIds.map((memberId, index) => ({
            mongo_member_id: memberId,
            role: memberId === session.user.id ? 'owner' : 'member',
            is_online: false,
          })),
        },
      },
      include: {
        channel_members: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    })

    // Enrich with user data
    const { enrichChannelWithUserData } = await import('@/lib/db-utils')
    const { default: User } = await import('@/models/User')
    const enrichedChannel = await enrichChannelWithUserData(channel, User)

    return NextResponse.json({ channel: enrichedChannel }, { status: 201 })
  } catch (error) {
    console.error('Error creating channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Step 1.4: Update Prisma Schema
**File:** `prisma/schema.prisma`

```prisma
model Channel {
  id                    String   @id @default(uuid()) @db.Uuid
  type                  String   // 'dm' | 'group' | 'department' | 'department-category' | 'multi-category' | 'project' | 'client-support'
  name                  String?
  avatar_url            String?
  mongo_department_id   String?
  mongo_project_id      String?
  mongo_creator_id      String
  is_private            Boolean  @default(false)
  member_count          Int      @default(0)
  last_message_at       DateTime? @db.Timestamptz
  categories            String[] // For multi-category channels
  created_at            DateTime @default(now()) @db.Timestamptz
  updated_at            DateTime @updatedAt @db.Timestamptz

  messages              Message[]
  channel_members       ChannelMember[]
  reactions             Reaction[]
  attachments           Attachment[]

  @@map("channels")
}
```

### Step 1.5: Create Channel Creation UI Component
**New File:** `components/communication/create-channel-modal.tsx`

```typescript
"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Users, Building, FolderKanban, MessageSquare, UserCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type ChannelType = 'group' | 'department' | 'department-category' | 'multi-category' | 'project' | 'client-support'
type DepartmentCategory = 'sales' | 'support' | 'it' | 'management'

interface CreateChannelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChannelCreated?: (channel: any) => void
  departments?: any[]
  projects?: any[]
  users?: any[]
}

export function CreateChannelModal({
  open,
  onOpenChange,
  onChannelCreated,
  departments = [],
  projects = [],
  users = []
}: CreateChannelModalProps) {
  const [channelType, setChannelType] = useState<ChannelType>('group')
  const [channelName, setChannelName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<DepartmentCategory>('sales')
  const [selectedCategories, setSelectedCategories] = useState<DepartmentCategory[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const categories: DepartmentCategory[] = ['sales', 'support', 'it', 'management']

  const clientUsers = users.filter(u => u.isClient === true)
  const regularUsers = users.filter(u => u.isClient !== true)

  const handleCategoryToggle = (category: DepartmentCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleMemberToggle = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleCreateChannel = async () => {
    try {
      setLoading(true)

      // Validation
      if (!channelType) {
        toast({ title: 'Error', description: 'Please select a channel type', variant: 'destructive' })
        return
      }

      const payload: any = {
        type: channelType,
        name: channelName || undefined,
        is_private: isPrivate
      }

      // Add type-specific fields
      switch (channelType) {
        case 'group':
          if (selectedMembers.length === 0) {
            toast({ title: 'Error', description: 'Please select at least one member', variant: 'destructive' })
            return
          }
          payload.channel_members = selectedMembers
          break

        case 'department':
          if (!selectedDepartment) {
            toast({ title: 'Error', description: 'Please select a department', variant: 'destructive' })
            return
          }
          payload.mongo_department_id = selectedDepartment
          break

        case 'department-category':
          payload.category = selectedCategory
          break

        case 'multi-category':
          if (selectedCategories.length === 0) {
            toast({ title: 'Error', description: 'Please select at least one category', variant: 'destructive' })
            return
          }
          payload.categories = selectedCategories
          break

        case 'project':
          if (!selectedProject) {
            toast({ title: 'Error', description: 'Please select a project', variant: 'destructive' })
            return
          }
          payload.mongo_project_id = selectedProject
          break

        case 'client-support':
          if (!selectedClient) {
            toast({ title: 'Error', description: 'Please select a client', variant: 'destructive' })
            return
          }
          payload.client_id = selectedClient
          break
      }

      // Call API
      const response = await fetch('/api/communication/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create channel')
      }

      const data = await response.json()

      toast({
        title: 'Success',
        description: 'Channel created successfully'
      })

      onChannelCreated?.(data.channel)
      onOpenChange(false)

      // Reset form
      setChannelName('')
      setIsPrivate(false)
      setSelectedDepartment('')
      setSelectedCategory('sales')
      setSelectedCategories([])
      setSelectedProject('')
      setSelectedClient('')
      setSelectedMembers([])

    } catch (error: any) {
      console.error('Error creating channel:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create channel',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Channel</DialogTitle>
          <DialogDescription>
            Choose a channel type and configure its settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Channel Type Selection */}
          <div className="space-y-3">
            <Label>Channel Type</Label>
            <RadioGroup value={channelType} onValueChange={(value) => setChannelType(value as ChannelType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="group" id="group" />
                <Label htmlFor="group" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Group Channel - Select specific members
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="department" id="department" />
                <Label htmlFor="department" className="flex items-center gap-2 cursor-pointer">
                  <Building className="h-4 w-4" />
                  Department Channel - All users in a department
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="department-category" id="department-category" />
                <Label htmlFor="department-category" className="flex items-center gap-2 cursor-pointer">
                  <Building className="h-4 w-4" />
                  Category Channel - All users with same category
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multi-category" id="multi-category" />
                <Label htmlFor="multi-category" className="flex items-center gap-2 cursor-pointer">
                  <Building className="h-4 w-4" />
                  Multi-Category Channel - Users from multiple categories
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="project" id="project" />
                <Label htmlFor="project" className="flex items-center gap-2 cursor-pointer">
                  <FolderKanban className="h-4 w-4" />
                  Project Channel - All project collaborators
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="client-support" id="client-support" />
                <Label htmlFor="client-support" className="flex items-center gap-2 cursor-pointer">
                  <UserCheck className="h-4 w-4" />
                  Client Support - Client + support team
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Channel Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Channel Name (Optional)</Label>
            <Input
              id="name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Leave empty for auto-generated name"
            />
          </div>

          {/* Privacy Setting */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="private"
              checked={isPrivate}
              onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
            />
            <Label htmlFor="private" className="cursor-pointer">
              Private Channel (hidden from non-members)
            </Label>
          </div>

          {/* Type-Specific Fields */}
          {channelType === 'group' && (
            <div className="space-y-2">
              <Label>Select Members</Label>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                {regularUsers.map(user => (
                  <div key={user._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${user._id}`}
                      checked={selectedMembers.includes(user._id)}
                      onCheckedChange={() => handleMemberToggle(user._id)}
                    />
                    <Label htmlFor={`user-${user._id}`} className="cursor-pointer flex-1">
                      {user.name} ({user.email})
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {channelType === 'department' && (
            <div className="space-y-2">
              <Label htmlFor="department">Select Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Choose a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {channelType === 'department-category' && (
            <div className="space-y-2">
              <Label htmlFor="category">Select Category</Label>
              <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as DepartmentCategory)}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {channelType === 'multi-category' && (
            <div className="space-y-2">
              <Label>Select Categories</Label>
              <div className="border rounded-md p-4 space-y-2">
                {categories.map(cat => (
                  <div key={cat} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${cat}`}
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={() => handleCategoryToggle(cat)}
                    />
                    <Label htmlFor={`cat-${cat}`} className="cursor-pointer">
                      {cat.toUpperCase()}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {channelType === 'project' && (
            <div className="space-y-2">
              <Label htmlFor="project">Select Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(proj => (
                    <SelectItem key={proj._id} value={proj._id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {channelType === 'client-support' && (
            <div className="space-y-2">
              <Label htmlFor="client">Select Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clientUsers.map(client => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.name} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreateChannel} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Channel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## PHASE 2: Message Features (Reply, Mention, Edit, Delete)

### Step 2.1: Update Message Schema for Replies
**File:** `prisma/schema.prisma`

```prisma
model Message {
  id                      String   @id @default(uuid()) @db.Uuid
  channel_id              String   @db.Uuid
  mongo_sender_id         String
  content                 String
  content_type            String   @default("text")
  thread_id               String?  @db.Uuid
  parent_message_id       String?  @db.Uuid // For replies
  reply_count             Int      @default(0)
  mongo_mentioned_user_ids String[]
  is_edited               Boolean  @default(false)
  edited_at               DateTime? @db.Timestamptz
  created_at              DateTime @default(now()) @db.Timestamptz

  channel                 Channel     @relation(fields: [channel_id], references: [id], onDelete: Cascade)
  parent_message          Message?    @relation("MessageReplies", fields: [parent_message_id], references: [id], onDelete: Cascade)
  replies                 Message[]   @relation("MessageReplies")
  read_receipts           ReadReceipt[]
  reactions               Reaction[]
  attachments             Attachment[]

  @@map("messages")
}
```

### Step 2.2: Create Message Operations Helper
**New File:** `lib/communication/message-operations.ts`

```typescript
import { prisma } from '@/lib/prisma'

export const messageOperations = {
  /**
   * Create a new message
   */
  async create(data: {
    channel_id: string
    mongo_sender_id: string
    content: string
    content_type?: string
    parent_message_id?: string // For replies
    mongo_mentioned_user_ids?: string[]
  }) {
    const message = await prisma.message.create({
      data: {
        ...data,
        content_type: data.content_type || 'text',
        mongo_mentioned_user_ids: data.mongo_mentioned_user_ids || [],
      },
      include: {
        parent_message: true,
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
    })

    // If this is a reply, increment parent's reply_count
    if (data.parent_message_id) {
      await prisma.message.update({
        where: { id: data.parent_message_id },
        data: { reply_count: { increment: 1 } },
      })
    }

    return message
  },

  /**
   * Update a message (edit)
   */
  async update(messageId: string, content: string) {
    return prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        is_edited: true,
        edited_at: new Date(),
      },
      include: {
        parent_message: true,
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
    })
  },

  /**
   * Delete a message
   */
  async delete(messageId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { parent_message_id: true },
    })

    // If this is a reply, decrement parent's reply_count
    if (message?.parent_message_id) {
      await prisma.message.update({
        where: { id: message.parent_message_id },
        data: { reply_count: { decrement: 1 } },
      })
    }

    return prisma.message.delete({
      where: { id: messageId },
    })
  },

  /**
   * Get messages for a channel with replies
   */
  async getChannelMessages(channelId: string, limit = 50, offset = 0) {
    return prisma.message.findMany({
      where: {
        channel_id: channelId,
        parent_message_id: null, // Only get top-level messages
      },
      include: {
        replies: {
          take: 3, // Get first 3 replies
          orderBy: { created_at: 'asc' },
          include: {
            read_receipts: true,
            reactions: true,
          },
        },
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    })
  },

  /**
   * Get replies for a message
   */
  async getReplies(messageId: string, limit = 50, offset = 0) {
    return prisma.message.findMany({
      where: { parent_message_id: messageId },
      include: {
        read_receipts: true,
        reactions: true,
        attachments: true,
      },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: offset,
    })
  },

  /**
   * Add reaction to message
   */
  async addReaction(messageId: string, userId: string, emoji: string) {
    return prisma.reaction.create({
      data: {
        message_id: messageId,
        mongo_user_id: userId,
        emoji,
      },
    })
  },

  /**
   * Remove reaction from message
   */
  async removeReaction(reactionId: string) {
    return prisma.reaction.delete({
      where: { id: reactionId },
    })
  },
}
```

### Step 2.3: Update Message API Routes
**File:** `app/api/communication/messages/route.ts`

Update to use message operations helper with reply support.

### Step 2.4: Create Reply UI Component
**New File:** `components/communication/message-reply.tsx`

Shows parent message context in reply thread.

### Step 2.5: Create Mention Picker Component
**New File:** `components/communication/mention-picker.tsx`

Autocomplete component for @mentions in message input.

### Step 2.6: Update Message Input Component
**File:** `components/ui/message-input.tsx`

Add support for:
- Mention picker
- Reply mode
- Edit mode

### Step 2.7: Add Message Actions Menu
**File:** `components/communication/message-actions.tsx`

Context menu with Edit, Delete, Reply options.

---

## PHASE 3: Member Management

### Step 3.1: Add Members API Endpoint
**File:** `app/api/communication/channels/[channelId]/members/route.ts`

```typescript
// POST - Add members to existing channel
// PUT - Update member role
// DELETE - Remove member
```

### Step 3.2: Create Member Management Modal
**New File:** `components/communication/manage-members-modal.tsx`

UI to add/remove members and change roles.

### Step 3.3: Update Channel Context Panel
**File:** `components/communication/channel-context-panel.tsx`

Show members with management options.

---

## PHASE 4: Reactions & Advanced Features

### Step 4.1: Create Reaction Picker Component
**New File:** `components/communication/reaction-picker.tsx`

Emoji picker for message reactions.

### Step 4.2: Update Message Display with Reactions
**File:** `components/ui/message-list.tsx`

Show reactions below messages with counts.

### Step 4.3: Add Reaction API Routes
**File:** `app/api/communication/reactions/route.ts`

POST/DELETE for reactions.

---

## PHASE 5: UI Polish & Integration

### Step 5.1: Integrate Create Channel Modal
Update [CommunicationSidebar](d:\digi-era-pro\components\ui\communication-sidebar.tsx) to use new modal.

### Step 5.2: Update Message List with All Features
Complete integration of reply, mention, edit, delete, reactions.

### Step 5.3: Add Loading States & Error Handling
Polish all components with proper loading and error states.

### Step 5.4: Testing & Bug Fixes
Comprehensive testing of all features.

---

## Testing Strategy

### Unit Testing
- Channel member population logic
- Message operations (create, edit, delete, reply)
- Permission validation

### Integration Testing
- Full channel creation flow for each type
- Message features (reply, mention, edit, delete)
- Member management operations

### UI Testing
- All modals and components
- Real-time updates
- Error states

### Performance Testing
- Large channels (100+ members)
- Message pagination
- Real-time subscription handling

---

## Success Criteria

✅ **Channel Creation**
- All channel types work correctly
- Auto-population adds correct members
- Manual member addition works

✅ **Message Features**
- Reply/threading works
- Mentions trigger notifications
- Edit/delete with proper permissions
- Reactions display correctly

✅ **Member Management**
- Add members to existing channels
- Remove members with validation
- Role updates work

✅ **Performance**
- No lag with real-time updates
- Efficient database queries
- Proper error handling

✅ **Security**
- All permissions via API
- No unauthorized access
- Proper validation

---
hjg
## Timeline Estimate

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Enhanced Channels | 2-3 hours | HIGH |
| Phase 2: Message Features | 2-3 hours | HIGH |
| Phase 3: Member Management | 1-2 hours | MEDIUM |
| Phase 4: Reactions | 1-2 hours | MEDIUM |
| Phase 5: UI Polish | 2-3 hours | HIGH |

**Total: 8-13 hours**

---

## Next Steps

1. ✅ Review and approve this plan
2. 🔄 Run Prisma migration for schema updates
3. 🔄 Implement Phase 1 (Channel Creation)
4. 🔄 Test Phase 1 thoroughly
5. 🔄 Continue with remaining phases

---

**Document End**




