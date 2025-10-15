import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Task from "@/models/Task"
import Project from "@/models/Project"
import User from "@/models/User"
import { createTaskSchema, taskQuerySchema, taskHierarchyQuerySchema } from "@/lib/validations/task"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import mongoose from 'mongoose'

// GET /api/tasks - List with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Security & Authentication
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'tasks', 'read')

    const searchParams = request.nextUrl.searchParams
    
    // Check if it's a hierarchy request
    if (searchParams.get('hierarchy') === 'true') {
      return getTaskHierarchy(request, user)
    }

    // Regular task listing
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      priority: searchParams.get('priority') || '',
      type: searchParams.get('type') || '',
      projectId: searchParams.get('projectId') || '',
      departmentId: searchParams.get('departmentId') || '',
      assigneeId: searchParams.get('assigneeId') || '',
      parentTaskId: searchParams.get('parentTaskId') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }

    const validatedParams = taskQuerySchema.parse(queryParams)

    // Build MongoDB filter
    const filter: any = {}
    
    if (validatedParams.search) {
      filter.$or = [
        { title: { $regex: validatedParams.search, $options: 'i' } },
        { description: { $regex: validatedParams.search, $options: 'i' } }
      ]
    }
    
    if (validatedParams.status) {
      filter.status = validatedParams.status
    }
    
    if (validatedParams.priority) {
      filter.priority = validatedParams.priority
    }
    
    if (validatedParams.type) {
      filter.type = validatedParams.type
    }
    
    if (validatedParams.projectId) {
      filter.projectId = new mongoose.Types.ObjectId(validatedParams.projectId)
    }
    
    if (validatedParams.departmentId) {
      filter.departmentId = new mongoose.Types.ObjectId(validatedParams.departmentId)
    }
    
    if (validatedParams.assigneeId) {
      filter.assigneeId = new mongoose.Types.ObjectId(validatedParams.assigneeId)
    }
    
    if (validatedParams.parentTaskId) {
      filter.parentTaskId = new mongoose.Types.ObjectId(validatedParams.parentTaskId)
    }

    // Department-based filtering for non-support users
    if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
      filter.departmentId = user.departmentId
    }

    // User-specific filtering for assigned tasks
    if (user.role === 'team_member') {
      filter.$or = [
        { assigneeId: user.id },
        { createdBy: user.id }
      ]
    }

    // Build sort
    const sort: any = {}
    sort[validatedParams.sortBy] = validatedParams.sortOrder === 'asc' ? 1 : -1

    // Execute parallel queries
    const [tasks, total, stats] = await Promise.all([
      executeGenericDbQuery(async () => {
        return await Task.find(filter)
          .populate('project', 'name clientId')
          .populate('department', 'name status')
          .populate('assignee', 'name email')
          .populate('creator', 'name email')
          .populate('parentTask', 'title')
          .sort(sort)
          .skip((validatedParams.page - 1) * validatedParams.limit)
          .limit(validatedParams.limit)
          .lean()
      }, `tasks-list-${JSON.stringify({ filter, sort, page: validatedParams.page, limit: validatedParams.limit })}`, 60000),

      executeGenericDbQuery(async () => {
        return await Task.countDocuments(filter)
      }, `tasks-count-${JSON.stringify(filter)}`, 60000),

      executeGenericDbQuery(async () => {
        const pipeline = [
          { $match: filter },
          {
            $group: {
              _id: null,
              totalTasks: { $sum: 1 },
              pendingTasks: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
              inProgressTasks: { $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] } },
              completedTasks: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
              onHoldTasks: { $sum: { $cond: [{ $eq: ["$status", "on-hold"] }, 1, 0] } },
              cancelledTasks: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
              
              mainTasks: { $sum: { $cond: [{ $eq: ["$type", "task"] }, 1, 0] } },
              subTasks: { $sum: { $cond: [{ $eq: ["$type", "sub-task"] }, 1, 0] } },
              
              lowPriorityTasks: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } },
              mediumPriorityTasks: { $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] } },
              highPriorityTasks: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
              urgentPriorityTasks: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } },
              
              totalEstimatedHours: { $sum: "$estimatedHours" },
              totalActualHours: { $sum: "$actualHours" }
            }
          }
        ]

        const result = await Task.aggregate(pipeline)
        return result[0] || {
          totalTasks: 0,
          pendingTasks: 0,
          inProgressTasks: 0,
          completedTasks: 0,
          onHoldTasks: 0,
          cancelledTasks: 0,
          mainTasks: 0,
          subTasks: 0,
          lowPriorityTasks: 0,
          mediumPriorityTasks: 0,
          highPriorityTasks: 0,
          urgentPriorityTasks: 0,
          totalEstimatedHours: 0,
          totalActualHours: 0
        }
      }, `tasks-stats-${JSON.stringify(filter)}`, 300000) // 5-minute cache for stats
    ])

    return NextResponse.json({
      success: true,
      data: tasks,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        total,
        pages: Math.ceil(total / validatedParams.limit)
      },
      stats,
      filters: {
        search: validatedParams.search,
        status: validatedParams.status,
        priority: validatedParams.priority,
        type: validatedParams.type,
        projectId: validatedParams.projectId,
        departmentId: validatedParams.departmentId,
        assigneeId: validatedParams.assigneeId,
        parentTaskId: validatedParams.parentTaskId
      },
      sort: {
        field: validatedParams.sortBy,
        direction: validatedParams.sortOrder
      },
      message: 'Tasks retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch tasks'
    }, { status: 500 })
  }
}

// POST /api/tasks - Create new task or sub-task
export async function POST(request: NextRequest) {
  try {
    // Security & Authentication
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'tasks', 'create')

    const body = await request.json()
    
    // Convert string dates and numbers
    const processedData = {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      estimatedHours: body.estimatedHours ? parseFloat(body.estimatedHours) : undefined,
      actualHours: body.actualHours ? parseFloat(body.actualHours) : undefined,
    }

    const validatedData = createTaskSchema.parse(processedData)

    // Create task with automatic connection management
    const task = await executeGenericDbQuery(async () => {
      // Verify project exists and is approved
      const project = await Project.findOne({
        _id: validatedData.projectId,
        status: { $in: ['approved', 'active'] }
      })

      if (!project) {
        throw new Error('Project not found or not approved')
      }

      // Verify department is assigned to the project
      if (!project.departmentIds.some((deptId: any) => deptId.toString() === validatedData.departmentId)) {
        throw new Error('Department is not assigned to this project')
      }

      // For sub-tasks, verify parent task exists and belongs to same project/department
      if (validatedData.type === 'sub-task' && validatedData.parentTaskId) {
        const parentTask = await Task.findOne({
          _id: validatedData.parentTaskId,
          projectId: validatedData.projectId,
          departmentId: validatedData.departmentId,
          type: 'task'
        })

        if (!parentTask) {
          throw new Error('Parent task not found or invalid')
        }
      }

      // Verify assignee belongs to the department (if provided)
      if (validatedData.assigneeId) {
        const assignee = await User.findOne({
          _id: validatedData.assigneeId,
          departmentId: validatedData.departmentId,
          status: 'active'
        })

        if (!assignee) {
          throw new Error('Assignee not found or not in the task department')
        }
      }

      // Permission checks
      const userDepartment = user.department?.name?.toLowerCase()
      const isSupport = ['support', 'admin'].includes(userDepartment)
      const isLeadOrManager = ['department_lead', 'manager'].includes(user.role)
      
      // Only support, department leads, and managers can create main tasks
      if (validatedData.type === 'task' && !isSupport && !isLeadOrManager) {
        throw new Error('Only support team and department leads can create main tasks')
      }

      // Department leads can only create tasks in their department
      if (!isSupport && user.departmentId?.toString() !== validatedData.departmentId) {
        throw new Error('You can only create tasks in your department')
      }

      // Create the task
      const newTask = new Task({
        ...validatedData,
        createdBy: user.id,
        assignedBy: validatedData.assigneeId ? user.id : undefined
      })

      return await newTask.save()
    })

    // Clear relevant cache patterns after creation
    clearCache('tasks')
    clearCache(`project-${validatedData.projectId}`)

    return NextResponse.json({
      success: true,
      data: task,
      message: `${validatedData.type === 'task' ? 'Task' : 'Sub-task'} created successfully`
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating task:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create task'
    }, { status: 500 })
  }
}

// Helper function to get task hierarchy for a project
async function getTaskHierarchy(request: NextRequest, user: any) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      projectId: searchParams.get('projectId') || '',
      departmentId: searchParams.get('departmentId') || '',
    }

    const validatedParams = taskHierarchyQuerySchema.parse(queryParams)

    const hierarchy = await executeGenericDbQuery(async () => {
      // Verify project exists and user has access
      const project = await Project.findById(validatedParams.projectId)
      
      if (!project) {
        throw new Error('Project not found')
      }

      // Department-based filtering
      if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        if (!project.departmentIds.some((deptId: any) => deptId.toString() === user.departmentId)) {
          throw new Error('Access denied to this project')
        }
      }

      // Build filter for hierarchy
      const filter: any = { projectId: validatedParams.projectId }
      
      if (validatedParams.departmentId) {
        filter.departmentId = validatedParams.departmentId
      } else if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
        filter.departmentId = user.departmentId
      }

      // Get task hierarchy using the static method
      return await Task.getTaskHierarchy(validatedParams.projectId)
    }, `task-hierarchy-${validatedParams.projectId}-${validatedParams.departmentId || 'all'}`, 120000) // 2-minute cache

    return NextResponse.json({
      success: true,
      data: hierarchy,
      message: 'Task hierarchy retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching task hierarchy:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch task hierarchy'
    }, { status: 500 })
  }
}