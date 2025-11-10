# Project & Task Module Implementation Plan - DepLLC CRM

## 📋 Executive Summary

This document outlines the comprehensive implementation plan for enhancing the Project and Task modules in DepLLC CRM following the generic CRUD pattern. The focus is on professional-grade features including project categorization, task/sub-task hierarchies, task assignment, time tracking, comments, and advanced collaboration features.

**Note:** File attachments will be implemented in a future phase after S3 integration is complete. This plan focuses on core functionality that can be implemented immediately.

**Current State:**
- ✅ Basic Project CRUD implemented
- ✅ Basic Task CRUD implemented  
- ✅ Generic hooks and components in place
- ✅ Permission system implemented
- ⚠️ Missing professional features (categorization, comments, advanced assignment)
- ⚠️ Media/S3 integration not yet implemented

**Target State (Current Phase):**
- Professional project management with department categorization
- Hierarchical task system (tasks → sub-tasks)
- Advanced task assignment and tracking
- Comments and collaboration with @mentions
- Time tracking and reporting
- Activity logging and audit trail
- Email notifications (fields prepared, integration later)
- Permission-based access control

**Future Phase (After S3 Integration):**
- File attachments for projects and tasks
- Media management with S3 storage
- Document versioning
- Preview and download features

---

## 🎯 Core Objectives

1. **Project Categorization System** - Department-based project organization
2. **Task Hierarchy** - Parent tasks with nested sub-tasks
3. **Advanced Task Assignment** - Role-based assignment with notifications
4. **Collaboration Features** - Comments, mentions, activity tracking
5. **Time Tracking** - Estimated vs actual hours with reporting
6. **Permission Control** - Granular access based on roles and departments
7. **Activity Logging** - Complete audit trail
8. **~~File Management~~** - ⏸️ **DEFERRED** - Will be implemented after S3 integration

---

## 📊 Module Architecture

```
Project Module
├── Project Setup (Basic Info)
├── Department Categorization
│   ├── Assign Departments to Project
│   └── Department-specific Task Groups
├── Project Phases & Milestones
├── Budget & Resource Management
├── Project Activity Timeline
└── [FUTURE] Project Files & Documents (after S3 integration)

Task Module
├── Task Creation (Department-specific)
├── Sub-task Creation (Nested under Tasks) 
├── Task Assignment
│   ├── Single Assignee
│   ├── Department-based Assignment
│   └── Notification System
├── Task Status Management
├── Task Comments & Collaboration
│   ├── Add Comments
│   ├── @Mention Team Members
│   └── Edit/Delete Comments
├── Time Tracking
│   ├── Estimated Hours
│   ├── Actual Hours (Time Logs)
│   └── Progress Tracking
├── Activity & Audit Trail
└── [FUTURE] Task Attachments (after S3 integration)
└── [FUTURE] Task Dependencies
```

---

## 🔐 Permission Matrix

### Super Admin (Full Access)
- ✅ All CRUD operations on projects and tasks
- ✅ Assign/unassign any user
- ✅ Access all departments
- ✅ Approve projects
- ✅ Modify any task status

### Admin
- ✅ Create/update/delete projects
- ✅ Create/assign tasks across departments
- ✅ View all projects and tasks
- ❌ Cannot delete super admin created items (conditional)

### Department Head/Manager
- ✅ View projects assigned to their department
- ✅ Create/assign tasks within their department
- ✅ Update task status for their department
- ✅ View department team member tasks
- ❌ Cannot access other department tasks (unless assigned)

### Team Member
- ✅ View projects they're assigned to
- ✅ View tasks assigned to them
- ✅ Update their assigned task status
- ✅ Add comments to their tasks
- ✅ Log time on their tasks
- ❌ Cannot assign tasks
- ❌ Cannot delete tasks

### Client (Read-Only with Exceptions)
- ✅ View their own projects
- ✅ View project progress
- ✅ Add comments on project level
- ❌ Cannot see internal task details
- ❌ Cannot modify anything

---

## 📐 Implementation Steps

### Phase 1: Enhanced Database Schema & Validations ✅ (Already Done)

**Status:** COMPLETED
- Project model with categorization fields
- Task model with hierarchy support
- Validation schemas in place

---

### Phase 2: Project Categorization System 🔄 (Current Focus)

#### 2.1 Backend API Enhancements

**Files to Modify:**
- `app/api/projects/[id]/route.ts` - Already has categorize operation ✅
- `app/api/projects/[id]/departments/route.ts` - NEW (Optional, inline is fine)

**What Exists:**
```typescript
// Already in route.ts
if (body.operation === 'categorize') {
  return handleCategorizeDepartments(validatedParams.id, body, user)
}
```

**Required Improvements:**
1. Ensure categorization validates department existence
2. Add permission checks (only managers+ can categorize)
3. Return updated project with department details populated
4. Clear relevant cache after categorization

#### 2.2 Frontend Categorization UI

**Files to Modify:**
- `app/projects/edit/[id]/categorization/page.tsx` - Already exists ✅

**Current State:** Basic structure present
**Required Improvements:**
1. Better UI for department selection (checkboxes with search)
2. Show currently selected departments prominently
3. Add "Quick Add" for common department combinations
4. Display task count per department
5. Show department contact/lead information

**Component Structure:**
```tsx
<ProjectCategorizationPage>
  <SelectedDepartmentsCard>
    - Show active departments
    - Show task count per department
    - Quick action to create task in department
  </SelectedDepartmentsCard>
  
  <DepartmentSelectionCard>
    - Searchable department list
    - Multi-select with checkboxes
    - Department templates (Web + Design + SEO)
  </DepartmentSelectionCard>
  
  <TasksByDepartmentSection>
    {selectedDepartments.map(dept => (
      <DepartmentTaskGroup key={dept.id}>
        - Show tasks for this department
        - Add task button
        - Task list with sub-tasks
      </DepartmentTaskGroup>
    ))}
  </TasksByDepartmentSection>
</ProjectCategorizationPage>
```

---

### Phase 3: Advanced Task Creation & Hierarchy 🆕

#### 3.1 Task Creation Enhancements

**Current Implementation Review:**
- ✅ Basic task creation exists
- ✅ Parent-child relationship supported in schema
- ⚠️ UI needs improvement for sub-task creation

**Files to Enhance:**
- `app/projects/edit/[id]/categorization/page.tsx` - Task modal already exists
- `components/projects/TaskForm.tsx` - NEW (Extract from page)
- `components/projects/TaskCard.tsx` - NEW
- `components/projects/SubTaskList.tsx` - NEW

**Required Features:**

**A. Task Creation Modal (Enhanced)**
```typescript
interface TaskFormProps {
  projectId: string
  departmentId: string
  parentTaskId?: string // For sub-task creation
  editingTask?: Task | null
  onSuccess: () => void
  onCancel: () => void
}
```

Fields:
- Title (required)
- Description (rich text with basic formatting)
- Department (pre-selected, read-only when creating from dept context)
- Assignee (dropdown - users from that department)
- Priority (low, medium, high, urgent)
- Status (pending, in-progress, completed, on-hold, cancelled)
- Type (task/sub-task - auto-set based on parentTaskId)
- Estimated Hours
- Due Date
- Start Date (optional)
- Tags (future)

**B. Sub-Task Creation**
- Add "Add Sub-Task" button on task cards
- Sub-task modal pre-fills: projectId, departmentId, parentTaskId
- Sub-tasks inherit department from parent
- Sub-tasks can have different assignees
- Visual hierarchy in UI (indented, different styling)

#### 3.2 Task Display & Hierarchy

**Task Card Component:**
```tsx
<TaskCard task={task}>
  <TaskHeader>
    - Title with status badge
    - Priority indicator
    - Assignee avatar
    - Due date with warning if overdue
  </TaskHeader>
  
  <TaskBody>
    - Description preview
    - Progress bar (based on sub-tasks or manual)
    - Estimated vs Actual hours
  </TaskBody>
  
  <TaskActions>
    - Edit button (permission-based)
    - Add sub-task button
    - Quick status change
    - Delete button (permission-based)
  </TaskActions>
  
  <SubTasksList collapsed={true}>
    {task.subTasks?.map(subTask => (
      <SubTaskItem key={subTask._id}>
        - Checkbox for quick complete
        - Title with assignee
        - Status indicator
      </SubTaskItem>
    ))}
  </SubTasksList>
</TaskCard>
```

#### 3.3 Backend Task Hierarchy API

**Current API Review:**
- ✅ GET /api/tasks?hierarchy=true exists
- ✅ Validates parent-child relationship in model

**Required Improvements:**
1. Optimize hierarchy query (already uses aggregation ✅)
2. Add depth limit validation (max 1 level: task → sub-task only)
3. Prevent circular dependencies
4. Cascade operations (e.g., completing parent auto-completes sub-tasks option)

**New Helper Functions:**
```typescript
// In app/api/tasks/[id]/route.ts or utils
async function validateTaskHierarchy(taskId, parentTaskId) {
  // Ensure parent is a task, not sub-task
  // Ensure no circular reference
  // Return validation result
}

async function getTaskWithHierarchy(taskId) {
  // Get task with all sub-tasks populated
  // Include assignee, department info
}

async function updateTaskStatusCascade(taskId, newStatus, options) {
  // Update task status
  // Optionally cascade to sub-tasks
  // Log activity
}
```

---

### Phase 4: Task Assignment System 🆕

#### 4.1 Assignment Logic

**Files to Create/Modify:**
- `app/api/tasks/[id]/assign/route.ts` - NEW (or keep inline in [id]/route.ts)
- `hooks/use-task-assignment.ts` - NEW
- `components/tasks/AssignTaskModal.tsx` - NEW

**Assignment Rules:**
1. **Department-based filtering:** Only show users from task's department
2. **Role validation:** Assignee must have permission to work on tasks
3. **Workload check:** Show assignee's current task count (optional warning)
4. **Notification:** Send email/in-app notification (prepare fields)
5. **Activity log:** Record who assigned to whom and when

**API Endpoint:**
```typescript
PUT /api/tasks/[id]
Body: { operation: 'assign', assigneeId: string, assignedBy: string }

Response:
{
  success: true,
  data: updatedTask,
  message: "Task assigned to John Doe",
  notification: {
    sent: false, // Will be true when email integrated
    recipient: "john@example.com",
    type: "task_assigned"
  }
}
```

**Assignment Modal UI:**
```tsx
<AssignTaskModal task={task}>
  <UserSelector>
    - Search users by name/email
    - Filter by department (auto-filtered)
    - Show user avatar, name, role
    - Show current task count badge
  </UserSelector>
  
  <AssignmentOptions>
    - Send notification (checkbox - prepared for future)
    - Due date reminder (optional)
    - Priority override option
    - Add assignment note
  </AssignmentOptions>
  
  <AssignButton>
    - Validate permissions
    - Call assign API
    - Show success toast
    - Refresh task list
  </AssignButton>
</AssignTaskModal>
```

#### 4.2 Bulk Assignment (Future)

Prepare structure for bulk assignment:
- Select multiple tasks
- Assign to same user or distribute among team
- Not implemented in MVP but structure ready

---

### Phase 5: Comments & Collaboration System 🆕

#### 5.1 Comment Database Schema

**New Model: `models/Comment.ts`**

```typescript
interface IComment {
  _id: ObjectId
  content: string // Rich text content
  entityType: 'project' | 'task' // What is being commented on
  entityId: ObjectId // Project or Task ID
  
  createdBy: ObjectId // User who commented
  parentCommentId?: ObjectId // For nested replies (future feature)
  
  mentions: ObjectId[] // Array of user IDs mentioned (@user)
  // attachments: string[] // FUTURE: After S3 integration
  
  isEdited: boolean
  editedAt?: Date
  isDeleted: boolean // Soft delete
  
  reactions?: { // FUTURE: Emoji reactions
    userId: ObjectId
    type: 'like' | 'love' | 'celebrate'
  }[]
  
  createdAt: Date
  updatedAt: Date
}

// Indexes
- { entityType: 1, entityId: 1, createdAt: -1 }
- { createdBy: 1 }
- { mentions: 1 } // For notification queries
```

**Validation Schema: `lib/validations/comment.ts`**

```typescript
export const COMMENT_CONSTANTS = {
  CONTENT: { MIN_LENGTH: 1, MAX_LENGTH: 5000 },
  ENTITY_TYPE: { VALUES: ['project', 'task'] },
  SORT: { ALLOWED_FIELDS: ['createdAt', 'updatedAt'] }
}

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000).transform(val => val.trim()),
  entityType: z.enum(['project', 'task']),
  entityId: objectIdSchema,
  mentions: z.array(objectIdSchema).optional().default([]),
  parentCommentId: optionalObjectIdSchema,
})

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000).transform(val => val.trim()),
})
```

#### 5.2 Comment API Endpoints

**New Files:**
- `app/api/comments/route.ts` - List & Create comments
- `app/api/comments/[id]/route.ts` - Update & Delete comment

**API Routes:**

```typescript
// GET /api/comments?entityType=task&entityId=123&page=1&limit=20
export async function GET(request: NextRequest) {
  // Parse query params (entityType, entityId, page, limit)
  // Validate user has access to view entity
  // Fetch comments with pagination
  // Populate createdBy (user name, avatar)
  // Populate mentions
  // Sort by createdAt desc
  // Return with pagination
}

// POST /api/comments
export async function POST(request: NextRequest) {
  // Validate request body
  // Check user has permission to comment on entity
  // Validate entity exists (project or task)
  // Create comment with createdBy = current user
  // Process mentions (validate users exist)
  // Prepare notifications for mentions (don't send yet)
  // Clear entity cache
  // Return created comment
}

// PUT /api/comments/[id]
export async function PUT(request: NextRequest, { params }) {
  // Validate comment belongs to current user
  // Update content only
  // Set isEdited = true, editedAt = now
  // Clear cache
  // Return updated comment
}

// DELETE /api/comments/[id]
export async function DELETE(request: NextRequest, { params }) {
  // Validate comment belongs to current user OR user is admin
  // Soft delete: set isDeleted = true
  // Clear cache
  // Return success
}
```

#### 5.3 Comment UI Components

**New Components:**
- `components/comments/CommentSection.tsx` - Main comment container
- `components/comments/CommentList.tsx` - List of comments
- `components/comments/CommentItem.tsx` - Single comment display
- `components/comments/CommentForm.tsx` - Add/edit comment form
- `components/comments/MentionInput.tsx` - Input with @mention support

**CommentSection Component:**
```tsx
<CommentSection entityType="task" entityId={taskId}>
  <CommentForm onSubmit={handleCreateComment}>
    <MentionInput 
      users={projectUsers} 
      onMention={handleMention}
      placeholder="Add a comment... Use @ to mention team members"
    />
    <FileAttachButton /> {/* Future */}
    <SubmitButton>Comment</SubmitButton>
  </CommentForm>
  
  <CommentList comments={comments} loading={loading}>
    {comments.map(comment => (
      <CommentItem key={comment._id} comment={comment}>
        <CommentHeader>
          <UserAvatar user={comment.createdBy} />
          <UserName>{comment.createdBy.name}</UserName>
          <Timestamp>{formatRelative(comment.createdAt)}</Timestamp>
          {comment.isEdited && <EditedBadge />}
        </CommentHeader>
        
        <CommentContent>
          {parseContentWithMentions(comment.content)}
        </CommentContent>
        
        {/* Show mentions */}
        {comment.mentions.length > 0 && (
          <MentionsList mentions={comment.mentions} />
        )}
        
        <CommentActions>
          {canEdit && <EditButton />}
          {canDelete && <DeleteButton />}
          <ReplyButton /> {/* Future: nested comments */}
        </CommentActions>
      </CommentItem>
    ))}
  </CommentList>
  
  <LoadMoreButton /> {/* If has more pages */}
</CommentSection>
```

#### 5.4 Mention System

**Implementation:**
1. Use a library like `react-mentions` or build simple @ detection
2. On typing "@", show dropdown of project/task team members
3. Store mentioned user IDs in comment.mentions array
4. Render mentions as highlighted links in comment display
5. Prepare notification records (don't send yet, wait for email integration)

**Helper Functions:**
```typescript
// lib/utils/mentions.ts
export function extractMentions(content: string): string[] {
  // Parse content for @[userId] patterns
  // Return array of user IDs
}

export function renderContentWithMentions(
  content: string, 
  mentions: User[]
): ReactNode {
  // Replace @[userId] with <Mention user={user} />
  // Return rendered content
}

export async function notifyMentionedUsers(
  mentions: string[], 
  comment: Comment,
  entityType: string,
  entityId: string
) {
  // Create notification records in DB
  // When email is integrated, send emails
  // For now, just create in-app notifications
}
```

#### 5.5 Comment Hooks

**New Hook: `hooks/use-comments.ts`**

```typescript
export function useComments(entityType: 'project' | 'task', entityId: string) {
  // Fetch comments for entity
  // Provide createComment, updateComment, deleteComment functions
  // Handle pagination
  // Return loading, error, comments, mutations
}

// Usage in component:
const {
  comments,
  loading,
  createComment,
  updateComment,
  deleteComment,
  loadMore,
  hasMore
} = useComments('task', taskId)
```

---

### Phase 6: ⏸️ File Attachments System - DEFERRED (After S3 Integration)

> **Note:** This phase will be implemented after S3 storage is integrated. For now, we'll prepare the database structure and interfaces, but skip the actual file upload/download implementation.

#### 6.1 Attachment Database Schema - PREPARED FOR FUTURE

**Approach:** We'll prepare the schema structure now, implement after S3 is ready.

**Option 1: Extend Media Model (Recommended for Future)**
```typescript
// models/Media.ts - Fields to ADD in future
interface IMedia {
  // ... existing fields
  entityType?: 'project' | 'task' | 'comment' | 'user' // FUTURE
  entityId?: ObjectId // FUTURE - Reference to project/task/comment
  uploadedBy: ObjectId // FUTURE
  description?: string // FUTURE
  isPublic: boolean // FUTURE - For client visibility
  s3Key?: string // FUTURE - S3 object key
  s3Bucket?: string // FUTURE - S3 bucket name
}
```

**Option 2: Separate Model (Cleaner Approach for Future)**
```typescript
// models/Attachment.ts - TO BE CREATED AFTER S3 INTEGRATION
interface IAttachment {
  _id: ObjectId
  fileName: string
  originalName: string
  s3Key: string // S3 object key
  s3Bucket: string // S3 bucket name
  fileSize: number
  mimeType: string
  
  entityType: 'project' | 'task' | 'comment'
  entityId: ObjectId
  
  uploadedBy: ObjectId
  description?: string
  isPublic: boolean // Can clients see this?
  
  thumbnailS3Key?: string // For image thumbnails
  
  createdAt: Date
  updatedAt: Date
}
```

#### 6.2 File Upload API - TO BE IMPLEMENTED LATER

**Future Endpoints (After S3):**
```typescript
// POST /api/attachments - FUTURE
// PUT /api/attachments/[id] - FUTURE  
// DELETE /api/attachments/[id] - FUTURE
// GET /api/attachments/[id]/download - FUTURE
```

**Current Action:** Skip implementation, add placeholder comments in code where attachments will be integrated.

#### 6.3 UI Preparation

**Current Phase:**
- Add "Attachments" section placeholder in UI (disabled state)
- Show "Coming Soon - After S3 Integration" message
- Prepare TypeScript interfaces for attachment types

**Future Components (After S3):**
- `components/attachments/AttachmentSection.tsx` - To be created
- `components/attachments/AttachmentUploader.tsx` - To be created
- `components/attachments/AttachmentList.tsx` - To be created

---

### Phase 7: Time Tracking & Progress ✅ (CURRENT FOCUS)

#### 7.1 Time Log Schema

**New Model: `models/TimeLog.ts`**

```typescript
interface ITimeLog {
  _id: ObjectId
  taskId: ObjectId
  userId: ObjectId
  
  hours: number // Decimal (e.g., 2.5 hours)
  date: Date // Date of work
  description?: string // What was done
  
  // Optional: Start/End time for more detailed tracking
  startTime?: Date
  endTime?: Date
  
  isBillable: boolean // For client billing
  hourlyRate?: number // For billing calculations
  
  createdAt: Date
  updatedAt: Date
}

// Indexes
- { taskId: 1, date: -1 }
- { userId: 1, date: -1 }
- { taskId: 1, userId: 1 }
```

**Validation Schema:**
```typescript
export const TIME_LOG_CONSTANTS = {
  HOURS: { MIN: 0.1, MAX: 24 },
  DESCRIPTION: { MAX_LENGTH: 500 }
}

export const createTimeLogSchema = z.object({
  taskId: objectIdSchema,
  hours: z.number().min(0.1).max(24),
  date: z.date(),
  description: z.string().max(500).optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  isBillable: z.boolean().default(true),
})
```

#### 7.2 Time Tracking API

**New Files:**
- `app/api/time-logs/route.ts` - List & Create time logs
- `app/api/time-logs/[id]/route.ts` - Update & Delete
- `app/api/tasks/[id]/time-logs/route.ts` - Get time logs for specific task

**Key Endpoints:**

```typescript
// POST /api/time-logs
export async function POST(request: NextRequest) {
  // Validate user is assigned to task or has permission
  // Create time log
  // Auto-update task.actualHours (sum of all logs)
  // Update task progress if needed
  // Return created log
}

// GET /api/tasks/[id]/time-logs
export async function GET(request: NextRequest, { params }) {
  // Validate user has access to task
  // Fetch all time logs for task
  // Calculate totals
  // Return with user info populated
}

// GET /api/time-logs/report?userId=X&startDate=Y&endDate=Z
export async function GET(request: NextRequest) {
  // Generate time report for user/project/task
  // Group by date/task/project
  // Calculate totals and billable amounts
  // Return formatted report data
}
```

#### 7.3 Time Tracking UI

**New Components:**
- `components/time-tracking/TimeLogForm.tsx`
- `components/time-tracking/TimeLogList.tsx`
- `components/time-tracking/TimeLogItem.tsx`
- `components/time-tracking/TimeReport.tsx`

**Time Log Form (Add to Task Detail):**
```tsx
<TimeLogForm taskId={taskId}>
  <DatePicker 
    label="Date" 
    defaultValue={today}
  />
  
  <HoursInput 
    label="Hours Worked"
    min={0.1}
    max={24}
    step={0.5}
  />
  
  {/* Optional: Time Range Picker */}
  <TimeRangePicker 
    startLabel="Start Time"
    endLabel="End Time"
    onCalculateHours={setHours}
  />
  
  <TextArea
    label="Description"
    placeholder="What did you work on?"
    maxLength={500}
  />
  
  <Checkbox
    label="Billable"
    defaultChecked={true}
  />
  
  <SubmitButton>Log Time</SubmitButton>
</TimeLogForm>

{/* Time Log List */}
<TimeLogList logs={timeLogs}>
  <TotalHours>
    Total: {totalHours} hours
    {showBillable && `(${billableHours} billable)`}
  </TotalHours>
  
  {logs.map(log => (
    <TimeLogItem key={log._id} log={log}>
      <Date>{formatDate(log.date)}</Date>
      <Hours>{log.hours}h</Hours>
      <User>{log.user.name}</User>
      <Description>{log.description}</Description>
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
    </TimeLogItem>
  ))}
</TimeLogList>
```

#### 7.4 Progress Calculation

**Auto-calculate task progress:**

```typescript
// In Task model or utils
async function calculateTaskProgress(taskId: string): Promise<number> {
  const task = await Task.findById(taskId)
  
  // Method 1: Based on estimated vs actual hours
  if (task.estimatedHours && task.actualHours) {
    return Math.min((task.actualHours / task.estimatedHours) * 100, 100)
  }
  
  // Method 2: Based on sub-task completion
  if (task.type === 'task') {
    const subTasks = await Task.find({ parentTaskId: taskId })
    if (subTasks.length > 0) {
      const completedCount = subTasks.filter(st => st.status === 'completed').length
      return (completedCount / subTasks.length) * 100
    }
  }
  
  // Method 3: Based on status
  const statusProgress = {
    'pending': 0,
    'in-progress': 50,
    'completed': 100,
    'on-hold': 25,
    'cancelled': 0
  }
  return statusProgress[task.status] || 0
}

// Update task progress after time log or sub-task status change
```

---

### Phase 8: Activity & Audit Logging 🆕

#### 8.1 Activity Log Schema

**New Model: `models/Activity.ts`**

```typescript
interface IActivity {
  _id: ObjectId
  
  entityType: 'project' | 'task' | 'user' | 'department'
  entityId: ObjectId
  
  action: 'created' | 'updated' | 'deleted' | 'assigned' | 'status_changed' | 
          'commented' | 'file_uploaded' | 'time_logged' | 'mentioned'
  
  performedBy: ObjectId // User who did the action
  
  description: string // Human-readable description
  
  // Store what changed (for updates)
  changes?: {
    field: string
    oldValue: any
    newValue: any
  }[]
  
  metadata?: any // Additional context
  
  createdAt: Date
}

// Indexes
- { entityType: 1, entityId: 1, createdAt: -1 }
- { performedBy: 1, createdAt: -1 }
- { action: 1, createdAt: -1 }
```

#### 8.2 Activity Logging Utility

**New File: `lib/utils/activity-logger.ts`**

```typescript
export async function logActivity(params: {
  entityType: 'project' | 'task' | 'user' | 'department'
  entityId: string
  action: string
  performedBy: string
  description: string
  changes?: any[]
  metadata?: any
}) {
  // Create activity record
  // Don't throw errors - log activity should never break main flow
  try {
    await Activity.create(params)
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

// Usage in API routes:
await logActivity({
  entityType: 'task',
  entityId: taskId,
  action: 'assigned',
  performedBy: user.id,
  description: `Assigned task to ${assignee.name}`,
  metadata: { assigneeId: assignee.id }
})
```

#### 8.3 Activity Timeline UI

**New Component: `components/activity/ActivityTimeline.tsx`**

```tsx
<ActivityTimeline entityType="project" entityId={projectId}>
  {activities.map(activity => (
    <ActivityItem key={activity._id} activity={activity}>
      <ActivityIcon action={activity.action} />
      
      <ActivityContent>
        <ActivityHeader>
          <UserLink user={activity.performedBy} />
          <ActivityAction>{activity.description}</ActivityAction>
          <TimeAgo date={activity.createdAt} />
        </ActivityHeader>
        
        {/* Show changes for updates */}
        {activity.changes && (
          <ChangesList changes={activity.changes} />
        )}
      </ActivityContent>
    </ActivityItem>
  ))}
</ActivityTimeline>
```

---

### Phase 9: Email Notification Preparation 📧

**Note:** Email integration is future work, but we'll prepare the structure now.

#### 9.1 Notification Schema

**New Model: `models/Notification.ts`**

```typescript
interface INotification {
  _id: ObjectId
  
  recipientId: ObjectId // User to notify
  
  type: 'task_assigned' | 'task_status_changed' | 'task_comment' | 
        'task_due_soon' | 'mentioned' | 'project_updated'
  
  title: string
  message: string
  
  // Link to relevant entity
  entityType: 'project' | 'task' | 'comment'
  entityId: ObjectId
  
  // Email status (for future email integration)
  emailSent: boolean
  emailSentAt?: Date
  emailError?: string
  
  // In-app notification status
  isRead: boolean
  readAt?: Date
  
  // Action link
  actionUrl?: string
  
  createdAt: Date
  expiresAt?: Date // Auto-delete old notifications
}

// Indexes
- { recipientId: 1, isRead: 1, createdAt: -1 }
- { expiresAt: 1 } // For TTL index
```

#### 9.2 Notification Helper

**New File: `lib/utils/notifications.ts`**

```typescript
export async function createNotification(params: {
  recipientId: string
  type: string
  title: string
  message: string
  entityType: string
  entityId: string
  actionUrl?: string
}) {
  // Create in-app notification
  const notification = await Notification.create({
    ...params,
    emailSent: false, // Will be true when email is integrated
    isRead: false
  })
  
  // TODO: When email is integrated, queue email job here
  // await emailQueue.add('send-notification-email', { notificationId: notification._id })
  
  return notification
}

// Usage when assigning task:
await createNotification({
  recipientId: assigneeId,
  type: 'task_assigned',
  title: 'New task assigned to you',
  message: `${assigner.name} assigned you a task: ${task.title}`,
  entityType: 'task',
  entityId: taskId,
  actionUrl: `/tasks/${taskId}`
})
```

#### 9.3 In-App Notification UI

**New Components:**
- `components/notifications/NotificationBell.tsx` - Bell icon with count
- `components/notifications/NotificationDropdown.tsx` - Dropdown list
- `components/notifications/NotificationItem.tsx` - Single notification

Add to main layout header for logged-in users.

---

### Phase 10: Permission & Security Enhancements 🔐

#### 10.1 Enhanced Permission Checks

**Modify: `lib/api-permissions.ts`** (or create if doesn't exist)

```typescript
export function canUserAccessProject(user: any, project: any): boolean {
  // Super admin can access all
  if (user.role === 'super_admin') return true
  
  // Admin can access all
  if (user.role === 'admin') return true
  
  // Project creator can access
  if (project.createdBy === user.id) return true
  
  // User's department is assigned to project
  if (project.departmentIds.includes(user.departmentId)) return true
  
  // Client can access their own projects
  if (user.isClient && project.clientId === user.id) return true
  
  return false
}

export function canUserModifyTask(user: any, task: any): boolean {
  // Super admin can modify all
  if (user.role === 'super_admin') return true
  
  // Admin can modify all
  if (user.role === 'admin') return true
  
  // Task creator can modify
  if (task.createdBy === user.id) return true
  
  // Assignee can modify (status, time logs, comments)
  if (task.assigneeId === user.id) return true
  
  // Department head can modify tasks in their department
  if (user.role === 'manager' && task.departmentId === user.departmentId) return true
  
  return false
}

export function canUserAssignTask(user: any, task: any): boolean {
  // Super admin can assign all
  if (user.role === 'super_admin') return true
  
  // Admin can assign all
  if (user.role === 'admin') return true
  
  // Department head/manager can assign in their department
  if (['manager', 'head'].includes(user.role) && 
      task.departmentId === user.departmentId) {
    return true
  }
  
  return false
}

export function canUserDeleteTask(user: any, task: any): boolean {
  // Only super admin and admin can delete
  if (['super_admin', 'admin'].includes(user.role)) return true
  
  // Task creator can delete if no time logged and no comments
  if (task.createdBy === user.id && 
      task.actualHours === 0 && 
      task.commentCount === 0) {
    return true
  }
  
  return false
}
```

#### 10.2 Apply Permissions in API Routes

**Example in `app/api/tasks/[id]/route.ts`:**

```typescript
import { canUserModifyTask, canUserDeleteTask } from '@/lib/api-permissions'

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { user } = await genericApiRoutesMiddleware(request, 'tasks', 'update')
  
  const task = await Task.findById(params.id)
  
  // Enhanced permission check
  if (!canUserModifyTask(user, task)) {
    return NextResponse.json({
      success: false,
      error: 'You do not have permission to modify this task'
    }, { status: 403 })
  }
  
  // Continue with update...
}
```

#### 10.3 Frontend Permission Guards

**Usage in Components:**

```tsx
const { canUpdate, canDelete, canAssign } = usePermissions()

function TaskCard({ task }) {
  const canEdit = canUpdate('tasks') // Generic permission
  const canRemove = canDelete('tasks')
  const canAssignTask = canAssign('tasks')
  
  // Additional custom check
  const isAssignee = user.id === task.assigneeId
  const canEditStatus = isAssignee || canEdit
  
  return (
    <Card>
      {/* ... */}
      {canEditStatus && <StatusChangeButton />}
      {canAssignTask && <AssignButton />}
      {canRemove && <DeleteButton />}
    </Card>
  )
}
```

---

## 📦 File Structure Summary

### New Files to Create (Current Phase)

```
models/
├── Comment.ts ✅ NEW
├── TimeLog.ts ✅ NEW
├── Activity.ts ✅ NEW
├── Notification.ts ✅ NEW
└── Attachment.ts ⏸️ DEFERRED (After S3 integration)

lib/validations/
├── comment.ts ✅ NEW
├── time-log.ts ✅ NEW
├── activity.ts ✅ NEW
└── attachment.ts ⏸️ DEFERRED

lib/utils/
├── activity-logger.ts ✅ NEW
├── notifications.ts ✅ NEW
└── mentions.ts ✅ NEW

app/api/
├── comments/
│   ├── route.ts ✅ NEW
│   └── [id]/route.ts ✅ NEW
├── time-logs/
│   ├── route.ts ✅ NEW
│   └── [id]/route.ts ✅ NEW
├── activities/
│   └── route.ts ✅ NEW (optional, can query directly)
├── notifications/
│   ├── route.ts ✅ NEW
│   └── [id]/route.ts ✅ NEW
└── attachments/ ⏸️ DEFERRED
    ├── route.ts (After S3)
    └── [id]/route.ts (After S3)

components/
├── projects/
│   ├── TaskForm.tsx ⚠️ EXTRACT (from categorization page)
│   ├── TaskCard.tsx ✅ NEW
│   ├── SubTaskList.tsx ✅ NEW
│   └── ProjectActivityTimeline.tsx ✅ NEW
├── tasks/
│   ├── AssignTaskModal.tsx ✅ NEW
│   ├── TaskDetailDrawer.tsx ✅ NEW
│   └── TaskStatusBadge.tsx ✅ NEW
├── comments/
│   ├── CommentSection.tsx ✅ NEW
│   ├── CommentList.tsx ✅ NEW
│   ├── CommentItem.tsx ✅ NEW
│   ├── CommentForm.tsx ✅ NEW
│   └── MentionInput.tsx ✅ NEW
├── time-tracking/
│   ├── TimeLogForm.tsx ✅ NEW
│   ├── TimeLogList.tsx ✅ NEW
│   ├── TimeLogItem.tsx ✅ NEW
│   └── TimeReport.tsx ✅ NEW
├── activity/
│   ├── ActivityTimeline.tsx ✅ NEW
│   └── ActivityItem.tsx ✅ NEW
├── notifications/
│   ├── NotificationBell.tsx ✅ NEW
│   ├── NotificationDropdown.tsx ✅ NEW
│   └── NotificationItem.tsx ✅ NEW
└── attachments/ ⏸️ DEFERRED
    ├── AttachmentSection.tsx (Placeholder UI only)
    ├── AttachmentList.tsx (After S3)
    └── AttachmentUploader.tsx (After S3)

hooks/
├── use-comments.ts ✅ NEW
├── use-time-logs.ts ✅ NEW
├── use-task-assignment.ts ✅ NEW
├── use-notifications.ts ✅ NEW
└── use-attachments.ts ⏸️ DEFERRED
├── use-task-assignment.ts ✅ NEW
└── use-notifications.ts ✅ NEW

store/slices/
├── commentSlice.ts ✅ NEW (minimal, mostly use TanStack Query)
├── activitySlice.ts ✅ NEW (minimal)
└── notificationSlice.ts ✅ NEW
```

### Files to Modify

```
✏️ app/projects/edit/[id]/categorization/page.tsx
   - Enhance department selection UI
   - Improve task creation modal
   - Add department-wise task grouping
   
✏️ app/api/projects/[id]/route.ts
   - Add better error handling for categorization
   - Add permission checks
   
✏️ app/api/tasks/route.ts
   - Add hierarchy optimization
   - Enhance filtering
   
✏️ app/api/tasks/[id]/route.ts
   - Add cascade operations
   - Enhance permission checks
   
✏️ hooks/use-tasks.ts
   - Add assignment helpers
   - Add status change helpers
   
✏️ hooks/use-projects.ts
   - Add categorization helpers
   
✏️ components/layout/Header.tsx (or Navbar)
   - Add NotificationBell component
   
✏️ types/index.ts
   - Add Comment, Attachment, TimeLog, Activity, Notification types
```

---

## 🎯 Implementation Priority

### **PHASE 1 (Week 1): Core Enhancements** 
**Priority: HIGHEST** ⭐

1. ✅ Enhance Project Categorization UI
   - Improve department selection
   - Show task counts per department
   - Better visual hierarchy

2. ✅ Task/Sub-Task Creation Flow
   - Extract TaskForm component
   - Add sub-task creation button
   - Improve task modal UX

3. ✅ Task Assignment System
   - Create AssignTaskModal
   - Implement assignment API
   - Add permission checks

### **PHASE 2 (Week 2): Collaboration** 
**Priority: HIGH** ⭐

4. ✅ Comments System
   - Create Comment model & API
   - Build CommentSection component
   - Add to task and project pages

5. ✅ Mention System
   - Implement @mention parsing
   - Create MentionInput component
   - Prepare notification records

### **PHASE 3 (Week 2-3): Time Tracking & Activity**
**Priority: HIGH** ⭐

6. ✅ Time Tracking
   - Create TimeLog model
   - Build time logging API
   - Create TimeLogForm component
   - Auto-update task.actualHours

7. ✅ Activity Logging
   - Create Activity model
   - Implement logger utility
   - Build ActivityTimeline component
   - Integrate with all CRUD operations

### **PHASE 4 (Week 3-4): Notifications & Polish**
**Priority: MEDIUM**

8. ✅ Notification System
   - Create Notification model
   - Build notification API
   - Create NotificationBell UI
   - In-app notifications only (email later)

9. ✅ Permission Enhancements
   - Refine permission checks
   - Add granular access controls
   - Test all role scenarios

10. ✅ Testing & Refinement
    - Test all CRUD operations
    - Test permission scenarios
    - Optimize queries and caching
    - Fix bugs
    - Polish UI/UX

### **PHASE 5 (FUTURE): File Attachments** ⏸️
**Priority: DEFERRED** (After S3 Integration)

11. ⏸️ File Attachments System
    - Complete after S3 is integrated
    - Create Attachment model with S3 fields
    - Build upload/download API with S3
    - Create AttachmentSection component
    - Support multiple file types
    - Add preview functionality

---

## 🔍 Testing Checklist

### Project Categorization
- [ ] Super admin can categorize any project
- [ ] Admin can categorize projects
- [ ] Team members cannot categorize
- [ ] Departments show correct task counts
- [ ] Removing department doesn't delete tasks (validation)

### Task Creation
- [ ] Can create task with department selection
- [ ] Can create sub-task under parent task
- [ ] Sub-tasks inherit project and department
- [ ] Cannot create sub-task of sub-task (max 1 level)
- [ ] Estimated hours validation works

### Task Assignment
- [ ] Only department users shown in assignee dropdown
- [ ] Notification created on assignment (in DB)
- [ ] Activity logged on assignment
- [ ] Permission checks work (manager can assign in dept)
- [ ] Team member cannot assign tasks

### Task Status Management
- [ ] Assignee can change their task status
- [ ] Manager can change team member task status
- [ ] Status change logged in activity
- [ ] Completing task auto-calculates hours worked

### Comments
- [ ] Can add comment to task
- [ ] Can add comment to project
- [ ] @mentions parsed correctly
- [ ] Mentioned users get notification record
- [ ] Can edit own comment
- [ ] Cannot edit others' comments (unless admin)
- [ ] Soft delete works
- [ ] Comment count updates on entity

### Time Tracking
- [ ] Can log time on assigned task
- [ ] Time log updates task.actualHours automatically
- [ ] Cannot log negative hours
- [ ] Cannot log more than 24 hours/day
- [ ] Time report shows correct totals
- [ ] Can edit own time logs
- [ ] Can delete own time logs (if allowed)
- [ ] Progress calculation works based on hours

### Activity Logging
- [ ] All CRUD operations logged
- [ ] Assignment changes logged
- [ ] Status changes logged
- [ ] Activity timeline displays correctly
- [ ] Activity filtering works
- [ ] Performer info populated correctly

### Notifications
- [ ] Notification created on task assignment
- [ ] Notification created on mention
- [ ] Notification created on status change
- [ ] Notification bell shows unread count
- [ ] Can mark notification as read
- [ ] Can view notification history
- [ ] Notification links to correct entity

### ⏸️ Attachments (FUTURE - After S3)
- [ ] DEFERRED: Will be tested after S3 integration
- [ ] File upload/download
- [ ] File type validation
- [ ] File size limits
- [ ] Preview functionality
- [ ] Delete permissions

### Permissions
- [ ] Super admin can do everything
- [ ] Admin can do almost everything
- [ ] Manager can manage their department
- [ ] Team member can only manage assigned tasks
- [ ] Client can view but not modify

---

## 🚀 Performance Optimizations

1. **Caching Strategy**
   - Use `executeGenericDbQuery` for all DB operations
   - Cache task lists: 60s TTL
   - Cache project lists: 60s TTL
   - Cache single resources: 5min TTL
   - Clear cache on mutations

2. **Query Optimizations**
   - Use lean() for read-only queries
   - Limit populated fields
   - Use select() to fetch only needed fields
   - Implement pagination everywhere
   - Use aggregation for complex queries

3. **Frontend Optimizations**
   - Use TanStack Query for data fetching
   - Implement optimistic updates
   - Debounce search inputs
   - Lazy load components
   - Virtual scroll for long lists

---

## 📝 Notes & Best Practices

1. **Follow Generic Pattern**
   - Use generic hooks (useGenericQuery, useGenericCreate, etc.)
   - Reuse components where possible
   - Keep Redux minimal (only UI state)
   - Let TanStack Query handle server state

2. **Security First**
   - Always validate user permissions in API
   - Use middleware for authentication
   - Validate all inputs with Zod
   - Sanitize user content (XSS prevention)
   - Log security-relevant actions

3. **Error Handling**
   - Use try-catch in all API routes
   - Return consistent error format
   - Show user-friendly error messages
   - Log errors for debugging
   - Don't expose sensitive info in errors

4. **Code Quality**
   - Keep components small and focused
   - Extract reusable logic to hooks
   - Use TypeScript strictly
   - Comment complex logic
   - Follow existing code style

5. **Future Email Integration**
   - All notification records prepared
   - Just need to add email sending service
   - Use queue system (Bull/BullMQ) for emails
   - Template system for email content

---

## 🎨 UI/UX Guidelines

1. **Consistency**
   - Use existing UI components (shadcn)
   - Follow color scheme (task status colors)
   - Maintain spacing consistency
   - Use existing icon library

2. **Responsiveness**
   - Mobile-first design
   - Test on tablet and desktop
   - Responsive tables/grids
   - Touch-friendly interactions

3. **Accessibility**
   - Proper ARIA labels
   - Keyboard navigation
   - Screen reader friendly
   - Color contrast compliance

4. **User Feedback**
   - Loading states everywhere
   - Success/error toasts
   - Confirmation dialogs for destructive actions
   - Progress indicators

---

## 📊 Metrics & KPIs (Future)

Track these metrics once implemented:

- Average time to complete tasks
- Task assignment response time
- Comment activity per project
- File upload volume
- Time logged vs estimated
- User engagement (comments, activity)
- Department workload distribution

---

## 🔄 Migration Path

No database migrations needed - all new schemas are additive.

**Steps:**
1. Deploy new models (Comment, Attachment, TimeLog, Activity, Notification)
2. Deploy API routes
3. Deploy UI components
4. Test thoroughly in staging
5. Deploy to production
6. Monitor for errors
7. Gather user feedback

---

## 📞 Support & Resources

- **ClickUp** - Reference for task management UX
- **Asana** - Reference for project hierarchy
- **Linear** - Reference for clean task UI
- **shadcn/ui** - Component library
- **TanStack Query** - Data fetching
- **Zod** - Validation

---

## ✅ Definition of Done

Each feature is "done" when:

- [ ] Database schema created with proper indexes
- [ ] Zod validation schemas defined
- [ ] API routes implemented with error handling
- [ ] Permission checks in place
- [ ] Generic hooks created
- [ ] UI components built and responsive
- [ ] Integration with existing flow working
- [ ] Basic tests passed
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] User acceptance testing completed
- [ ] Documentation updated

---

## 🎯 Success Criteria

The implementation is successful when:

1. **Functionality**
   - All planned features work correctly
   - No critical bugs in core flows
   - Performance is acceptable (< 2s page loads)

2. **Usability**
   - Users can create tasks without confusion
   - Assignment flow is intuitive
   - Comments and mentions work smoothly
   - Time tracking is straightforward

3. **Security**
   - Permissions enforced correctly
   - No unauthorized access possible
   - Data integrity maintained

4. **Maintainability**
   - Code follows existing patterns
   - Generic components reused
   - Well-documented for future devs

---

## 🚀 Next Steps

**Ready to implement?** Let's start with **Phase 1**:

1. First, I'll enhance the Project Categorization UI
2. Then improve Task/Sub-Task creation flow
3. Finally implement Task Assignment system

After Phase 1 is complete and tested, we'll move to Phase 2 (Comments & Collaboration), then Phase 3 (Time Tracking & Activity).

**Would you like me to start implementing Phase 1 now?** Let me know and I'll begin with the categorization UI improvements! 🎉

---

## 📌 Future Enhancement: File Attachments with S3

### When S3 is Integrated:

**Step 1: S3 Setup**
- Configure AWS S3 bucket
- Set up environment variables (AWS credentials, bucket name, region)
- Install AWS SDK (`@aws-sdk/client-s3`)
- Create S3 upload/download utilities

**Step 2: Database Schema**
- Create `models/Attachment.ts` with S3 fields
- Add `attachmentCount` virtual field to Task and Project models
- Create validation schema in `lib/validations/attachment.ts`

**Step 3: API Implementation**
- `POST /api/attachments` - Upload to S3 and create DB record
- `GET /api/attachments` - List attachments for entity
- `GET /api/attachments/[id]/download` - Generate signed S3 URL
- `DELETE /api/attachments/[id]` - Delete from S3 and DB

**Step 4: UI Components**
- Create `AttachmentUploader` with drag & drop
- Create `AttachmentList` with preview/download
- Add attachment sections to task and project detail pages
- Support multiple file types with icons

**Step 5: Integration**
- Add attachment support to comments (optional)
- Add attachment count badges
- Implement file preview for images/PDFs
- Add file versioning (optional)

**Would you like me to start implementing Phase 1 now?** Let me know and I'll begin with the categorization UI improvements! 🎉
