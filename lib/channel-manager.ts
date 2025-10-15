import Channel from '@/models/Channel'
import User from '@/models/User'
import Department from '@/models/Department'
import Project from '@/models/Project'
import connectDB from '@/lib/mongodb'

export class ChannelManager {
  /**
   * Create or get DM channel between two users
   */
  static async createOrGetDMChannel(userId1: string, userId2: string): Promise<any> {
    await connectDB()

    const channel = await (Channel as any).findOrCreateDM(userId1, userId2)

    // Populate participants
    await channel.populate('participants', 'name email avatar role')

    return channel
  }

  /**
   * Create department channel for all users in a department
   */
  static async createDepartmentChannel(departmentId: string): Promise<any> {
    await connectDB()

    // Get department details
    const department = await Department.findById(departmentId)
    if (!department) {
      throw new Error('Department not found')
    }

    // Get all users in this department
    const deptUsers = await User.find({
      department: departmentId,
      status: 'active'
    }).select('_id')

    const participantIds = deptUsers.map((u: any) => u._id.toString())

    if (participantIds.length === 0) {
      throw new Error('No active users found in department')
    }

    const channel = await (Channel as any).createDepartmentChannel(
      departmentId,
      department.name,
      participantIds
    )

    // Populate participants
    await channel.populate('participants', 'name email avatar role')
    await channel.populate('departmentId', 'name')

    return channel
  }

  /**
   * Create project channel for project stakeholders
   */
  static async createProjectChannel(projectId: string, createdBy: string): Promise<any> {
    await connectDB()

    // Get project details
    const project = await Project.findById(projectId)
    if (!project) {
      throw new Error('Project not found')
    }

    // Get project participants (client, assigned users, project manager)
    const participants = new Set<string>()

    // Add client if exists
    if (project.clientId) {
      participants.add(project.clientId.toString())
    }

    // Add created by user
    participants.add(createdBy)

    // Add any assigned users (if your project model has assignments)
    // This would depend on your project schema

    const participantIds = Array.from(participants)

    const channel = await (Channel as any).createProjectChannel(
      projectId,
      project.name,
      participantIds,
      createdBy
    )

    // Populate participants
    await channel.populate('participants', 'name email avatar role')
    await channel.populate('projectId', 'name status')

    return channel
  }

  /**
   * Get or create general company channel
   */
  static async getOrCreateGeneralChannel(): Promise<any> {
    await connectDB()

    // Get all active internal users
    const internalUsers = await User.find({
      status: 'active',
      role: { $ne: 'client' } // Exclude clients from general channel
    }).select('_id')

    const participantIds = internalUsers.map((u: any) => u._id.toString())

    const channel = await (Channel as any).getOrCreateGeneralChannel()

    // Update participants if needed
    const currentParticipants = channel.participants.map((p: any) => p.toString())
    const needsUpdate = participantIds.some((id: string) => !currentParticipants.includes(id)) ||
                       currentParticipants.some((id: string) => !participantIds.includes(id))

    if (needsUpdate) {
      channel.participants = participantIds
      await channel.save()
    }

    // Populate participants
    await channel.populate('participants', 'name email avatar role')

    return channel
  }

  /**
   * Get all channels for a user
   */
  static async getUserChannels(userId: string, isInternal?: boolean): Promise<any[]> {
    await connectDB()

    const filter: any = {
      participants: userId,
      isActive: true
    }

    if (isInternal !== undefined) {
      filter.isInternal = isInternal
    }

    const channels = await Channel.find(filter)
      .populate('participants', 'name email avatar role isOnline')
      .populate('projectId', 'name status')
      .populate('departmentId', 'name')
      .populate('lastMessage', 'message senderId createdAt communicationType')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 })
      .lean()

    return channels
  }

  /**
   * Ensure user has access to required channels
   */
  static async ensureUserChannels(userId: string): Promise<void> {
    await connectDB()

    const user = await User.findById(userId).populate('department')
    if (!user) return

    const channelsToCreate = []

    // Ensure department channel exists
    if (user.department) {
      const deptChannelExists = await Channel.findOne({
        departmentId: user.department._id,
        type: 'department',
        isActive: true
      })

      if (!deptChannelExists) {
        channelsToCreate.push(this.createDepartmentChannel(user.department._id.toString()))
      }
    }

    // Ensure general channel exists
    const generalChannelExists = await Channel.findOne({
      type: 'general',
      isActive: true
    })

    if (!generalChannelExists) {
      channelsToCreate.push(this.getOrCreateGeneralChannel())
    }

    // Create channels in parallel
    await Promise.all(channelsToCreate)
  }

  /**
   * Update channel participants when user joins/leaves department
   */
  static async updateDepartmentChannelParticipants(departmentId: string): Promise<void> {
    await connectDB()

    // Get current active users in department
    const deptUsers = await User.find({
      department: departmentId,
      status: 'active'
    }).select('_id')

    const participantIds = deptUsers.map((u: any) => u._id.toString())

    // Update department channel
    await Channel.findOneAndUpdate(
      { departmentId, type: 'department', isActive: true },
      { participants: participantIds, updatedAt: new Date() }
    )
  }

  /**
   * Archive channel (soft delete)
   */
  static async archiveChannel(channelId: string, userId: string): Promise<void> {
    await connectDB()

    const channel = await Channel.findOne({ channelId, isActive: true })
    if (!channel) {
      throw new Error('Channel not found')
    }

    // Check permissions
    if (channel.createdBy.toString() !== userId) {
      throw new Error('Only channel creator can archive')
    }

    channel.isActive = false
    await channel.save()
  }
}