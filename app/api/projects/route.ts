import { type NextRequest, NextResponse } from "next/server"
import { executeGenericDbQuery, clearCache } from "@/lib/mongodb"
import Project from "@/models/Project"
import User from "@/models/User"
import Lead from "@/models/Lead"
import { createProjectSchema, createProjectFormSchema, projectQuerySchema } from "@/lib/validations/project"
import { genericApiRoutesMiddleware } from '@/lib/middleware/route-middleware'
import mongoose from 'mongoose'

// GET /api/projects - List with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Security & Authentication - Support team can read projects
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'projects', 'read')

    // Parse & validate query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      priority: searchParams.get('priority') || '',
      clientId: searchParams.get('clientId') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }

    const validatedParams = projectQuerySchema.parse(queryParams)

    // Build MongoDB filter
    const filter: any = {}

    if (validatedParams.search) {
      filter.$or = [
        { name: { $regex: validatedParams.search, $options: 'i' } },
        { description: { $regex: validatedParams.search, $options: 'i' } },
        { requirements: { $regex: validatedParams.search, $options: 'i' } }
      ]
    }

    if (validatedParams.status) {
      filter.status = validatedParams.status
    }

    if (validatedParams.priority) {
      filter.priority = validatedParams.priority
    }

    if (validatedParams.clientId) {
      filter.clientId = new mongoose.Types.ObjectId(validatedParams.clientId)
    }

    if (validatedParams.departmentId) {
      filter.departmentIds = new mongoose.Types.ObjectId(validatedParams.departmentId)
    }

    // Department-based filtering for non-support users
    if (user.departmentId && !['support', 'admin'].includes(user.department?.name?.toLowerCase())) {
      filter.departmentIds = user.departmentId
    }

    // Build sort
    const sort: any = {}
    sort[validatedParams.sortBy] = validatedParams.sortOrder === 'asc' ? 1 : -1

    // Execute parallel queries with automatic connection management and caching
    const [projects, total, stats] = await Promise.all([
      executeGenericDbQuery(async () => {
        return await Project.find(filter)
          .populate('client', 'name email status')
          .populate('departments', 'name status')
          .populate('creator', 'name email')
          .sort(sort)
          .skip((validatedParams.page - 1) * validatedParams.limit)
          .limit(validatedParams.limit)
          .lean()
      }, `projects-list-${JSON.stringify({ filter, sort, page: validatedParams.page, limit: validatedParams.limit })}`, 60000), // 1-minute cache

      executeGenericDbQuery(async () => {
        return await Project.countDocuments(filter)
      }, `projects-count-${JSON.stringify(filter)}`, 60000), // 1-minute cache

      executeGenericDbQuery(async () => {
        const pipeline = [
          { $match: filter },
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              pendingProjects: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
              activeProjects: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
              completedProjects: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
              approvedProjects: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
              inactiveProjects: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },

              lowPriorityProjects: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } },
              mediumPriorityProjects: { $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] } },
              highPriorityProjects: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
              urgentPriorityProjects: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } },

              totalBudget: { $sum: "$budget" },
              averageBudget: { $avg: "$budget" }
            }
          }
        ]

        const result = await Project.aggregate(pipeline)
        return result[0] || {
          totalProjects: 0,
          pendingProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          approvedProjects: 0,
          inactiveProjects: 0,
          lowPriorityProjects: 0,
          mediumPriorityProjects: 0,
          highPriorityProjects: 0,
          urgentPriorityProjects: 0,
          totalBudget: 0,
          averageBudget: 0
        }
      }, `projects-stats-${JSON.stringify(filter)}`, 300000) // 5-minute cache for stats
    ])

    console.log('Projects fetched:', projects)

    return NextResponse.json({
      success: true,
      data: projects,
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
        clientId: validatedParams.clientId,
        departmentId: validatedParams.departmentId
      },
      sort: {
        field: validatedParams.sortBy,
        direction: validatedParams.sortOrder
      },
      message: 'Projects retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch projects'
    }, { status: 500 })
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    // Security & Authentication - Support team can create projects
    const { session, user, userEmail } = await genericApiRoutesMiddleware(request, 'projects', 'create')

    // Parse & validate request body
    const body = await request.json()

    // First validate with form schema (which accepts strings)
    const formData = createProjectFormSchema.parse(body)

    // Then convert to proper API format
    const validatedData = {
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate) : undefined,
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      createdBy: user.id,
    }

    // Create project with automatic connection management
    const project = await executeGenericDbQuery(async () => {
      // Verify client exists and is qualified
      const client = await User.findOne({
        _id: validatedData.clientId,
        isClient: true,
        // status: 'qualified'
      })

      // if (!client) {
      //   throw new Error('Client not found or not qualified')
      // }

      // Create the project
      const newProject = new Project({
        ...validatedData,
        createdBy: user.id,
        status: 'pending' // All projects start as pending
      })

      return await newProject.save()
    })

    // Clear relevant cache patterns after creation
    clearCache('projects')

    return NextResponse.json({
      success: true,
      data: project,
      message: 'Project created successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating project:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create project'
    }, { status: 500 })
  }
}