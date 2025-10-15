import mongoose, { Document, Schema } from 'mongoose'

export interface IChannel extends Document {
  channelId: string // Unique identifier for socket rooms
  name: string
  type: 'dm' | 'project' | 'client-support' | 'group' | 'department' | 'general'
  participants: mongoose.Types.ObjectId[] // Array of user/client IDs
  projectId?: mongoose.Types.ObjectId // For project channels
  departmentId?: mongoose.Types.ObjectId // For department channels
  isInternal: boolean // True for internal users only
  isActive: boolean // Soft delete
  lastMessage?: mongoose.Types.ObjectId
  unreadCounts: Map<string, number> // userId -> unread count
  createdBy: mongoose.Types.ObjectId // User who created the channel
  createdAt: Date
  updatedAt: Date
}

export interface IChannelModel extends mongoose.Model<IChannel> {
  findOrCreateDM(userId1: string, userId2: string): Promise<IChannel>
  createDepartmentChannel(departmentId: string, departmentName: string, participants: string[]): Promise<IChannel>
  createProjectChannel(projectId: string, projectName: string, participants: string[], createdBy: string): Promise<IChannel>
  getOrCreateGeneralChannel(): Promise<IChannel>
}

const ChannelSchema = new Schema<IChannel>({
  channelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  type: {
    type: String,
    enum: ['dm', 'project', 'client-support', 'group', 'department', 'general'],
    required: true
  },
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  departmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    required: false
  },
  isInternal: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Communication',
    required: false
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})

// Indexes for performance
ChannelSchema.index({ type: 1, isActive: 1 })
ChannelSchema.index({ participants: 1 })
ChannelSchema.index({ projectId: 1, isActive: 1 })
ChannelSchema.index({ departmentId: 1, isActive: 1 })
ChannelSchema.index({ isInternal: 1, isActive: 1 })
ChannelSchema.index({
  name: 'text'
}, {
  name: 'channel_search_index'
})

// Virtual for last message details
ChannelSchema.virtual('lastMessageDetails', {
  ref: 'Communication',
  localField: 'lastMessage',
  foreignField: '_id',
  justOne: true
})

// Virtual for participant details
ChannelSchema.virtual('participantDetails', {
  ref: 'User',
  localField: 'participants',
  foreignField: '_id'
})

// Pre-save validation
ChannelSchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    this.name = this.name.trim()
  }

  // Validate channel constraints
  if (this.type === 'dm' && this.participants.length !== 2) {
    return next(new Error('DM channels must have exactly 2 participants'))
  }

  if (this.type === 'project' && !this.projectId) {
    return next(new Error('Project channels must have a projectId'))
  }

  if (this.type === 'department' && !this.departmentId) {
    return next(new Error('Department channels must have a departmentId'))
  }

  if (this.type === 'general' && this.participants.length === 0) {
    return next(new Error('General channels must have participants'))
  }

  next()
})

// Static method to find or create DM channel
ChannelSchema.statics.findOrCreateDM = async function(userId1: string, userId2: string) {
  const participants = [userId1, userId2].sort() // Sort for consistent channelId
  const channelId = `dm-${participants.join('-')}`

  let channel = await this.findOne({ channelId, type: 'dm', isActive: true })

  if (!channel) {
    channel = new this({
      channelId,
      name: `DM: ${participants.join(' ↔ ')}`, // Will be updated with actual names
      type: 'dm',
      participants,
      isInternal: true,
      createdBy: userId1
    })
    await channel.save()
  }

  return channel
}

// Static method to create department channel
ChannelSchema.statics.createDepartmentChannel = async function(departmentId: string, departmentName: string, participants: string[]) {
  const channelId = `dept-${departmentId}`

  const channel = new this({
    channelId,
    name: `${departmentName} Team`,
    type: 'department',
    participants,
    departmentId,
    isInternal: true,
    createdBy: participants[0] // First participant as creator
  })

  return await channel.save()
}

// Static method to create project channel
ChannelSchema.statics.createProjectChannel = async function(projectId: string, projectName: string, participants: string[], createdBy: string) {
  const channelId = `project-${projectId}`

  const channel = new this({
    channelId,
    name: `Project: ${projectName}`,
    type: 'project',
    participants,
    projectId,
    isInternal: true,
    createdBy
  })

  return await channel.save()
}

// Static method to get or create general channel
ChannelSchema.statics.getOrCreateGeneralChannel = async function() {
  const channelId = 'general-company'

  let channel = await this.findOne({ channelId, type: 'general', isActive: true })

  if (!channel) {
    channel = new this({
      channelId,
      name: 'General',
      type: 'general',
      participants: [], // Will be populated dynamically
      isInternal: true,
      createdBy: null // System created
    })
    await channel.save()
  }

  return channel
}

export default mongoose.models.Channel || mongoose.model<IChannel, IChannelModel>("Channel", ChannelSchema)