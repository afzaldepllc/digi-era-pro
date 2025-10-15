import { ChannelManager } from '@/lib/channel-manager'
import connectDB from '@/lib/mongodb'

/**
 * Hook to be called when a new project is created
 * This will automatically create a project channel
 */
export async function onProjectCreated(projectId: string, createdBy: string): Promise<void> {
  try {
    console.log(`Creating project channel for project ${projectId}`)

    await connectDB()
    const channel = await ChannelManager.createProjectChannel(projectId, createdBy)

    console.log(`Project channel created: ${channel.channelId} - ${channel.name}`)
  } catch (error) {
    console.error('Failed to create project channel:', error)
    // Don't throw - project creation should succeed even if channel creation fails
  }
}

/**
 * Hook to be called when a user joins a department
 * This will ensure the user is added to department channels
 */
export async function onUserJoinedDepartment(userId: string, departmentId: string): Promise<void> {
  try {
    console.log(`Ensuring channels for user ${userId} in department ${departmentId}`)

    await connectDB()
    await ChannelManager.updateDepartmentChannelParticipants(departmentId)

    console.log(`Department channels updated for user ${userId}`)
  } catch (error) {
    console.error('Failed to update department channels:', error)
    // Don't throw - user creation should succeed
  }
}

/**
 * Hook to be called when departments are created
 * This will create department channels
 */
export async function onDepartmentCreated(departmentId: string): Promise<void> {
  try {
    console.log(`Creating department channel for department ${departmentId}`)

    await connectDB()
    const channel = await ChannelManager.createDepartmentChannel(departmentId)

    console.log(`Department channel created: ${channel.channelId} - ${channel.name}`)
  } catch (error) {
    console.error('Failed to create department channel:', error)
    // Don't throw - department creation should succeed
  }
}

/**
 * Initialize default channels for the system
 * Call this during system setup or migration
 */
export async function initializeSystemChannels(): Promise<void> {
  try {
    console.log('Initializing system channels...')

    await connectDB()

    // Create general channel
    const generalChannel = await ChannelManager.getOrCreateGeneralChannel()
    console.log(`General channel ready: ${generalChannel.channelId}`)

    // Get all departments and create department channels
    const Department = (await import('@/models/Department')).default
    const departments = await Department.find({ status: 'active' })

    for (const dept of departments) {
      try {
        const deptChannel = await ChannelManager.createDepartmentChannel(dept._id.toString())
        console.log(`Department channel created: ${deptChannel.channelId} - ${deptChannel.name}`)
      } catch (error) {
        console.error(`Failed to create channel for department ${dept.name}:`, error)
      }
    }

    console.log('System channels initialization completed')
  } catch (error) {
    console.error('Failed to initialize system channels:', error)
    throw error
  }
}