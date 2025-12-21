# Generic Realtime Notifications & Task Management - Implementation Plan

## Overview

Implement a generic realtime notification system using Supabase for project/task lifecycle events while keeping MongoDB as the primary database.

---

## Architecture Strategy

### Hybrid Approach (MongoDB + Supabase)
- **MongoDB**: Primary database for projects, tasks, users (existing)
- **Supabase PostgreSQL**: Notification queue and delivery tracking
- **Supabase Realtime**: WebSocket delivery to online users

### Data Flow
```
Action (Create/Update) → MongoDB API → Success → Supabase Broadcast → User Notification
```

---

## Phase 1: Notification Infrastructure (2-3 days)

### 1.1 Supabase Schema for Notifications

**Create Prisma Schema:**
```prisma
// Notification types: project_created, project_approved, task_assigned, task_updated
model notifications {
  id                String   @id @default(uuid())
  mongo_user_id     String   // Recipient MongoDB user ID
  type              String   // Enum: project_created, project_approved, etc.
  title             String
  message           String
  mongo_entity_id   String   // Project/Task MongoDB ID
  entity_type       String   // 'project' or 'task'
  metadata          Json?    // Additional data (project name, assignee, etc.)
  is_read           Boolean  @default(false)
  read_at           DateTime?
  created_at        DateTime @default(now())
  
  @@index([mongo_user_id, is_read, created_at])
  @@index([created_at])
}
```

### 1.2 Generic Notification Manager

**Create: `lib/notification-manager.ts`**
```typescript
class NotificationManager {
  // Send notification to specific user(s)
  async sendNotification(params: {
    userIds: string[]
    type: NotificationType
    title: string
    message: string
    entityId: string
    entityType: 'project' | 'task'
    metadata?: any
  })
  
  // Broadcast via Supabase Realtime
  async broadcastToUsers(userIds: string[], notification: any)
  
  // Get user's unread count
  async getUnreadCount(userId: string)
  
  // Mark as read
  async markAsRead(notificationId: string)
}
```

### 1.3 Notification Types Enum

**Create: `types/notifications.ts`**
```typescript
export type NotificationType = 
  | 'project_created'
  | 'project_approved'
  | 'project_updated'
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'task_due_soon'

export interface NotificationMetadata {
  projectName?: string
  taskTitle?: string
  assigneeName?: string
  departmentName?: string
  priority?: string
  dueDate?: string
}
```

---

## Phase 2: Project Lifecycle Notifications (2 days)

### 2.1 Notification Triggers

**Modify: `app/api/projects/route.ts` (POST)**
```typescript
// After successful project creation
const project = await Project.create(validatedData)

// Notify department head
const deptHead = await User.findOne({ 
  departmentId: project.departmentIds[0], 
  role: 'department_head' 
})

if (deptHead) {
  await notificationManager.sendNotification({
    userIds: [deptHead._id.toString()],
    type: 'project_created',
    title: 'New Project Created',
    message: `${project.name} requires your review`,
    entityId: project._id.toString(),
    entityType: 'project',
    metadata: { projectName: project.name, priority: project.priority }
  })
}
```

**Modify: `app/api/projects/[id]/route.ts` (PUT - Approval)**
```typescript
// When project.status changes to 'approved'
if (oldStatus !== 'approved' && project.status === 'approved') {
  await notificationManager.sendNotification({
    userIds: [project.createdBy.toString()],
    type: 'project_approved',
    title: 'Project Approved',
    message: `${project.name} has been approved`,
    entityId: project._id.toString(),
    entityType: 'project',
    metadata: { projectName: project.name }
  })
}
```

### 2.2 Realtime Subscription (Frontend)

**Extend: `lib/realtime-manager.ts`**
```typescript
subscribeToNotifications(userId: string, callback: (notification: any) => void) {
  const channel = supabase.channel(`user_notifications_${userId}`)
    .on('broadcast', { event: 'new_notification' }, ({ payload }) => {
      callback(payload)
    })
    .subscribe()
    
  return () => channel.unsubscribe()
}
```

---

## Phase 3: Task Assignment Notifications (2 days)

### 3.1 Task Assignment Hook

**Modify: `app/api/tasks/route.ts` (POST)**
```typescript
// After task creation with assignee
if (task.assigneeId) {
  const assignee = await User.findById(task.assigneeId)
  
  await notificationManager.sendNotification({
    userIds: [task.assigneeId.toString()],
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: `You've been assigned: ${task.title}`,
    entityId: task._id.toString(),
    entityType: 'task',
    metadata: {
      taskTitle: task.title,
      projectName: project.name,
      priority: task.priority,
      dueDate: task.dueDate
    }
  })
}
```

### 3.2 Drag-and-Drop Optimistic Update

**Create: `hooks/use-task-realtime.ts`**
```typescript
export function useTaskRealtime(projectId: string) {
  const dispatch = useDispatch()
  
  // Optimistic update for drag-drop
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    // 1. Update Redux immediately (optimistic)
    dispatch(updateTaskInStore({ taskId, status: newStatus }))
    
    // 2. Call MongoDB API
    try {
      await apiRequest.put(`/api/tasks/${taskId}`, { status: newStatus })
      // API will broadcast to other users via Supabase
    } catch (error) {
      // Rollback on error
      dispatch(revertTaskUpdate(taskId))
    }
  }
  
  // Subscribe to task updates from other users
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribeToChannel(
      `project_${projectId}`,
      (event) => {
        if (event.type === 'task_updated') {
          dispatch(updateTaskFromRealtime(event.payload))
        }
      }
    )
    return unsubscribe
  }, [projectId])
  
  return { updateTaskStatus }
}
```

---

## Phase 4: Notification UI Components (2 days)

### 4.1 Header Notification Bell

**Modify: `components/layout/header.tsx`**
```typescript
// Add notification bell icon with badge
const { notifications, unreadCount } = useNotifications()

<DropdownMenu>
  <DropdownMenuTrigger>
    <Bell className="h-5 w-5" />
    {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {notifications.map(notif => (
      <NotificationItem key={notif.id} notification={notif} />
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

### 4.2 Notification Hook

**Create: `hooks/use-notifications.ts`**
```typescript
export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const session = useSession()
  
  // Fetch initial notifications
  useEffect(() => {
    fetchNotifications()
  }, [])
  
  // Subscribe to realtime
  useEffect(() => {
    if (!session?.user?.id) return
    
    const unsubscribe = realtimeManager.subscribeToNotifications(
      session.user.id,
      (newNotif) => {
        setNotifications(prev => [newNotif, ...prev])
        setUnreadCount(c => c + 1)
        toast.info(newNotif.title)
      }
    )
    
    return unsubscribe
  }, [session])
  
  return { notifications, unreadCount, markAsRead }
}
```

---

## Phase 5: Task Board Realtime (2 days)

### 5.1 Board Subscription

**Create: `hooks/use-task-board.ts`**
```typescript
export function useTaskBoard(projectId: string) {
  const dispatch = useDispatch()
  const tasks = useSelector(selectTasksByProject(projectId))
  
  useEffect(() => {
    // Subscribe to project task channel
    const unsubscribe = realtimeManager.subscribeToChannel(
      `project_tasks_${projectId}`,
      (event) => {
        switch(event.type) {
          case 'task_created':
            dispatch(addTask(event.payload))
            break
          case 'task_updated':
            dispatch(updateTask(event.payload))
            break
          case 'task_deleted':
            dispatch(removeTask(event.payload.taskId))
            break
        }
      }
    )
    
    return unsubscribe
  }, [projectId])
  
  return { tasks }
}
```

### 5.2 API Broadcast Integration

**Modify: `app/api/tasks/route.ts`**
```typescript
// After creating/updating task
await supabase.channel(`project_tasks_${task.projectId}`)
  .send({
    type: 'broadcast',
    event: 'task_created', // or 'task_updated'
    payload: {
      ...task.toObject(),
      assignee: assignee ? { name, email, avatar } : null
    }
  })
```

---

## Phase 6: Testing & Optimization (1-2 days)

### 6.1 Test Scenarios
- [ ] Project creation notifies department head
- [ ] Project approval notifies creator
- [ ] Task assignment notifies assignee
- [ ] Drag-drop updates all connected clients
- [ ] Offline users receive notifications on reconnect
- [ ] Notification bell updates in real-time

### 6.2 Performance Checks
- [ ] Supabase connection pooling
- [ ] Notification query pagination
- [ ] Unsubscribe cleanup on unmount
- [ ] Debounce for rapid status changes

---

## Implementation Checklist

### Database
- [ ] Create Supabase `notifications` table with Prisma
- [ ] Add indexes for performance
- [ ] Run migration

### Backend
- [ ] Create `NotificationManager` class
- [ ] Modify project API routes for notifications
- [ ] Modify task API routes for notifications
- [ ] Add Supabase broadcast after MongoDB operations

### Frontend
- [ ] Extend `RealtimeManager` for notifications
- [ ] Create `useNotifications` hook
- [ ] Create `useTaskRealtime` hook
- [ ] Update Header component with notification bell
- [ ] Update task board with realtime subscriptions

### Testing
- [ ] Test notification delivery
- [ ] Test realtime task updates
- [ ] Test offline/reconnection scenarios
- [ ] Test notification marking as read

---

## Files to Create/Modify

### New Files
1. `lib/notification-manager.ts` - Notification logic
2. `types/notifications.ts` - Type definitions
3. `hooks/use-notifications.ts` - Notification hook
4. `hooks/use-task-realtime.ts` - Task realtime hook
5. `hooks/use-task-board.ts` - Task board hook
6. `components/layout/notification-bell.tsx` - UI component
7. `app/api/notifications/route.ts` - Notification API
8. `app/api/notifications/[id]/route.ts` - Mark as read

### Modified Files
1. `prisma/schema.prisma` - Add notifications table
2. `lib/realtime-manager.ts` - Add notification subscriptions
3. `app/api/projects/route.ts` - Add notification triggers
4. `app/api/projects/[id]/route.ts` - Add approval notifications
5. `app/api/tasks/route.ts` - Add task assignment notifications
6. `app/api/tasks/[id]/route.ts` - Add update broadcasts
7. `components/layout/header.tsx` - Add notification bell

---

## Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Infrastructure | 2-3 days | HIGH |
| Phase 2: Project Notifications | 2 days | HIGH |
| Phase 3: Task Notifications | 2 days | HIGH |
| Phase 4: UI Components | 2 days | MEDIUM |
| Phase 5: Task Board Realtime | 2 days | MEDIUM |
| Phase 6: Testing | 1-2 days | HIGH |

**Total: 11-15 days**

---

## Success Criteria

✅ Users receive real-time notifications for:
- Project creation (to department heads)
- Project approval (to creators)
- Task assignment (to assignees)

✅ Task board updates in real-time across all connected clients

✅ Notification bell shows unread count and updates live

✅ MongoDB remains primary database, Supabase handles realtime only

✅ Optimistic updates provide instant feedback

✅ Offline users receive notifications on reconnect
