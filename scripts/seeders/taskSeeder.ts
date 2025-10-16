import { connectToDatabase, disconnectFromDatabase } from '../migrations/migrationUtils'
import Task from '../../models/Task'
import Project from '../../models/Project'
import User from '../../models/User'
import Department from '../../models/Department'

export interface ITaskSeed {
  title: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: 'task' | 'sub-task'
  estimatedHours?: number
  actualHours?: number
  startDate?: Date
  dueDate?: Date
  completedAt?: Date
}

export const taskSeeds: ITaskSeed[] = [
  // E-commerce Website Redesign Tasks
  {
    title: 'UI/UX Design Mockups',
    description: 'Create wireframes and high-fidelity mockups for the new e-commerce design',
    status: 'completed',
    priority: 'high',
    type: 'task',
    estimatedHours: 40,
    actualHours: 35,
    startDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    completedAt: new Date('2024-02-10')
  },
  {
    title: 'Frontend Development',
    description: 'Implement responsive React components for product catalog and checkout',
    status: 'in-progress',
    priority: 'high',
    type: 'task',
    estimatedHours: 80,
    actualHours: 60,
    startDate: new Date('2024-02-16'),
    dueDate: new Date('2024-03-16')
  },
  {
    title: 'Backend API Development',
    description: 'Build RESTful APIs for product management and order processing',
    status: 'pending',
    priority: 'high',
    type: 'task',
    estimatedHours: 60,
    startDate: new Date('2024-03-01'),
    dueDate: new Date('2024-03-31')
  },
  {
    title: 'Payment Integration',
    description: 'Integrate Stripe payment gateway with security measures',
    status: 'pending',
    priority: 'urgent',
    type: 'task',
    estimatedHours: 20,
    startDate: new Date('2024-04-01'),
    dueDate: new Date('2024-04-10')
  },

  // Mobile App Development Tasks
  {
    title: 'App Architecture Design',
    description: 'Design React Native app architecture and navigation flow',
    status: 'completed',
    priority: 'high',
    type: 'task',
    estimatedHours: 30,
    actualHours: 28,
    startDate: new Date('2024-02-01'),
    dueDate: new Date('2024-02-20'),
    completedAt: new Date('2024-02-18')
  },
  {
    title: 'User Authentication',
    description: 'Implement user login, registration, and profile management',
    status: 'in-progress',
    priority: 'high',
    type: 'task',
    estimatedHours: 25,
    actualHours: 15,
    startDate: new Date('2024-02-21'),
    dueDate: new Date('2024-03-10')
  },
  {
    title: 'Health Data Integration',
    description: 'Integrate Apple Health and Google Fit APIs for fitness tracking',
    status: 'pending',
    priority: 'medium',
    type: 'task',
    estimatedHours: 35,
    startDate: new Date('2024-03-15'),
    dueDate: new Date('2024-04-15')
  },

  // Inventory Management Tasks
  {
    title: 'Database Schema Design',
    description: 'Design MongoDB schema for inventory, products, and transactions',
    status: 'completed',
    priority: 'urgent',
    type: 'task',
    estimatedHours: 20,
    actualHours: 18,
    startDate: new Date('2024-01-01'),
    dueDate: new Date('2024-01-15'),
    completedAt: new Date('2024-01-12')
  },
  {
    title: 'Barcode Scanner Integration',
    description: 'Implement barcode scanning functionality for inventory management',
    status: 'in-progress',
    priority: 'high',
    type: 'task',
    estimatedHours: 30,
    actualHours: 20,
    startDate: new Date('2024-01-20'),
    dueDate: new Date('2024-02-20')
  },
  {
    title: 'Real-time Inventory Updates',
    description: 'Implement real-time inventory synchronization across multiple locations',
    status: 'pending',
    priority: 'high',
    type: 'task',
    estimatedHours: 40,
    startDate: new Date('2024-02-25'),
    dueDate: new Date('2024-04-01')
  },

  // Business Website Tasks
  {
    title: 'WordPress Setup',
    description: 'Install and configure WordPress with required plugins',
    status: 'completed',
    priority: 'medium',
    type: 'task',
    estimatedHours: 8,
    actualHours: 6,
    startDate: new Date('2023-12-01'),
    dueDate: new Date('2023-12-05'),
    completedAt: new Date('2023-12-03')
  },
  {
    title: 'Content Migration',
    description: 'Migrate existing content and images to new WordPress site',
    status: 'completed',
    priority: 'medium',
    type: 'task',
    estimatedHours: 12,
    actualHours: 10,
    startDate: new Date('2023-12-06'),
    dueDate: new Date('2023-12-15'),
    completedAt: new Date('2023-12-12')
  },

  // CRM Customization Tasks
  {
    title: 'Requirements Analysis',
    description: 'Analyze current CRM usage and gather customization requirements',
    status: 'completed',
    priority: 'medium',
    type: 'task',
    estimatedHours: 16,
    actualHours: 14,
    startDate: new Date('2024-03-01'),
    dueDate: new Date('2024-03-10'),
    completedAt: new Date('2024-03-08')
  },
  {
    title: 'Custom Fields Implementation',
    description: 'Add custom fields and forms to CRM system',
    status: 'pending',
    priority: 'medium',
    type: 'task',
    estimatedHours: 25,
    startDate: new Date('2024-03-15'),
    dueDate: new Date('2024-04-01')
  }
]

export default async function seedTasks(): Promise<void> {
  try {
    console.log('🌱 Starting task seeding...')

    await connectToDatabase()

    // Clear existing tasks
    const deletedCount = await Task.countDocuments()
    await Task.deleteMany({})
    console.log(`🗑️  Cleared ${deletedCount} existing tasks`)

    // Get projects to assign tasks to
    const projects = await Project.find({}).populate('departmentIds')

    // Get users for assignment
    const executives = await User.find({
      $or: [
        { 'role.name': { $regex: /executive/i } },
        { 'legacyRole': 'user' }
      ]
    })

    const teamLeads = await User.find({
      'role.name': { $regex: /team_lead/i }
    })

    let createdCount = 0
    let taskIndex = 0

    // Assign tasks to projects
    for (const project of projects) {
      // Determine how many tasks this project should have (2-5 tasks per project)
      const tasksForProject = Math.min(5, Math.max(2, Math.floor(Math.random() * 4) + 2))
      const projectTasks = taskSeeds.slice(taskIndex, taskIndex + tasksForProject)

      for (const taskData of projectTasks) {
        const assignee = executives[Math.floor(Math.random() * executives.length)]
        const assigner = teamLeads[Math.floor(Math.random() * teamLeads.length)] || assignee

        const task = new Task({
          ...taskData,
          projectId: project._id,
          departmentId: project.departmentIds[0] || project.departmentIds[Math.floor(Math.random() * project.departmentIds.length)],
          assigneeId: assignee?._id,
          createdBy: assigner?._id || assignee?._id,
          assignedBy: assigner?._id
        })

        await task.save()
        createdCount++
      }

      taskIndex += tasksForProject
      if (taskIndex >= taskSeeds.length) break
    }

    console.log(`✅ Created ${createdCount} tasks`)

    // Summary
    const statusCounts = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])

    console.log('\n📊 Task Seeding Summary:')
    statusCounts.forEach((status: any) => {
      console.log(`   ${status._id}: ${status.count} tasks`)
    })

    console.log('\n🎯 Priority Distribution:')
    const priorityCounts = await Task.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ])
    priorityCounts.forEach((priority: any) => {
      console.log(`   ${priority._id}: ${priority.count} tasks`)
    })

    console.log('\n📋 Task Types:')
    const typeCounts = await Task.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ])
    typeCounts.forEach((type: any) => {
      console.log(`   ${type._id}: ${type.count} tasks`)
    })

    // Hours statistics
    const hoursStats = await Task.aggregate([
      {
        $group: {
          _id: null,
          totalEstimated: { $sum: '$estimatedHours' },
          totalActual: { $sum: '$actualHours' },
          avgEstimated: { $avg: '$estimatedHours' },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ])

    if (hoursStats.length > 0) {
      const stats = hoursStats[0]
      console.log('\n⏱️  Hours Statistics:')
      console.log(`   Total Estimated: ${stats.totalEstimated || 0} hours`)
      console.log(`   Total Actual: ${stats.totalActual || 0} hours`)
      console.log(`   Average per Task: ${Math.round(stats.avgEstimated || 0)} hours`)
      console.log(`   Completed Tasks: ${stats.completedTasks} tasks`)
    }

    // Project distribution
    const projectTaskCounts = await Task.aggregate([
      {
        $group: {
          _id: '$projectId',
          taskCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project'
        }
      },
      {
        $unwind: '$project'
      },
      {
        $project: {
          projectName: '$project.name',
          taskCount: 1
        }
      }
    ])

    console.log('\n📊 Tasks per Project:')
    projectTaskCounts.forEach((item: any) => {
      console.log(`   ${item.projectName}: ${item.taskCount} tasks`)
    })

    await disconnectFromDatabase()

  } catch (error) {
    console.error('❌ Task seeding failed:', error)
    await disconnectFromDatabase()
    throw error
  }
}