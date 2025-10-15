import mongoose, { Document, Schema } from 'mongoose'

export interface IProject extends Document {
  name: string
  description?: string
  clientId: mongoose.Types.ObjectId
  departmentIds: mongoose.Types.ObjectId[]
  status: 'pending' | 'active' | 'completed' | 'approved' | 'inactive'
  budget?: number
  startDate?: Date
  endDate?: Date
  priority: 'low' | 'medium' | 'high' | 'urgent'
  
  // Fields from lead project info
  projectType?: string
  requirements?: string
  timeline?: string
  
  // Meta fields
  createdBy: mongoose.Types.ObjectId
  approvedBy?: mongoose.Types.ObjectId
  approvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const ProjectSchema = new Schema<IProject>({
  name: {
    type: String,
    required: [true, "Project name is required"],
    trim: true,
    maxlength: [200, "Name cannot exceed 200 characters"],
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, "Description cannot exceed 1000 characters"],
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Client is required"],
    index: true,
  },
  departmentIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Department',
    index: true,
  }],
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'approved', 'inactive'],
    default: 'pending',
    index: true,
  },
  budget: {
    type: Number,
    min: [0, "Budget must be positive"],
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true,
  },
  
  // Fields from lead project info
  projectType: {
    type: String,
    trim: true,
    maxlength: [100, "Project type cannot exceed 100 characters"],
  },
  requirements: {
    type: String,
    trim: true,
    maxlength: [2000, "Requirements cannot exceed 2000 characters"],
  },
  timeline: {
    type: String,
    trim: true,
    maxlength: [500, "Timeline cannot exceed 500 characters"],
  },
  
  // Meta fields
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Creator is required"],
    index: true,
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

// Performance indexes
ProjectSchema.index({ clientId: 1, status: 1 })
ProjectSchema.index({ status: 1, createdAt: -1 })
ProjectSchema.index({ departmentIds: 1, status: 1 })
ProjectSchema.index({ createdBy: 1, status: 1 })
ProjectSchema.index({ priority: 1, status: 1 })

// Text search index
ProjectSchema.index({ 
  name: 'text', 
  description: 'text',
  requirements: 'text'
}, {
  weights: { name: 10, description: 5, requirements: 3 },
  name: 'project_search_index'
})

// Virtuals for populated fields
ProjectSchema.virtual('client', {
  ref: 'User',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true,
})

ProjectSchema.virtual('departments', {
  ref: 'Department',
  localField: 'departmentIds',
  foreignField: '_id',
})

ProjectSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
})

ProjectSchema.virtual('approver', {
  ref: 'User',
  localField: 'approvedBy',
  foreignField: '_id',
  justOne: true,
})

// Virtual for task count
ProjectSchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'projectId',
  count: true,
})

// Pre-save validation
ProjectSchema.pre('save', async function(next) {
  // Validate dates
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    const error = new Error('Start date cannot be after end date')
    return next(error)
  }
  
  // Validate client is qualified
  if (this.isModified('clientId')) {
    const User = mongoose.model('User')
    const client = await User.findById(this.clientId)
    
    // if (!client || client.role !== 'client' || client.status !== 'qualified') {
    //   const error = new Error('Client must be qualified to create project')
    //   return next(error)
    // }
  }
  
  // Auto approve for certain statuses
  if (this.isModified('status') && this.status === 'approved' && !this.approvedAt) {
    this.approvedAt = new Date()
  }
  
  next()
})

// Static methods
ProjectSchema.statics.findByClient = function(clientId: string, options = {}) {
  return this.find({ clientId, ...options })
    .populate('client', 'name email')
    .populate('departments', 'name status')
    .sort({ createdAt: -1 })
}

ProjectSchema.statics.findByDepartment = function(departmentId: string, options = {}) {
  return this.find({ departmentIds: departmentId, ...options })
    .populate('client', 'name email')
    .populate('creator', 'name email')
    .sort({ createdAt: -1 })
}

export default mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema)