import mongoose, { Schema, type Document } from "mongoose"

export interface ILead extends Document {
  // Client Basic Info Section
  name: string
  email: string
  phone?: string
  company?: string
  position?: string // Job title/position
  website?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }

  // Company Details
  industry?: string
  companySize?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  annualRevenue?: number
  employeeCount?: number

  // Project Basic Info Section
  projectName: string
  projectDescription?: string
  projectBudget?: number
  projectTimeline?: string
  projectRequirements?: string[]
  technologies?: string[] // Required technologies/frameworks
  projectType?: 'web' | 'mobile' | 'desktop' | 'api' | 'consulting' | 'other'
  complexity?: 'simple' | 'medium' | 'complex'

  // Project Scope & Details
  deliverables?: string[]
  milestones?: Array<{
    title: string
    description?: string
    dueDate?: Date
    completed?: boolean
  }>
  estimatedHours?: number

  // Lead Management
  status: 'active' | 'inactive' | 'qualified' | 'unqualified'
  createdBy: mongoose.Types.ObjectId // Reference to User (sales agent)
  assignedTo?: mongoose.Types.ObjectId // Current assignee
  clientId?: mongoose.Types.ObjectId // Reference to User (populated after qualification)

  // Lead Source & Tracking
  source?: 'website' | 'referral' | 'cold_call' | 'email' | 'social_media' | 'event' | 'partner' | 'advertising' | 'other'
  sourceDetails?: string // Additional source information
  campaign?: string // Marketing campaign name
  priority: 'low' | 'medium' | 'high' | 'urgent'

  // Communication & Notes
  notes?: string
  lastContactDate?: Date
  nextFollowUpDate?: Date
  contactHistory?: Array<{
    date: Date
    type: 'call' | 'email' | 'meeting' | 'note'
    description: string
    outcome?: string
    contactPerson?: string
  }>

  // Qualification Details
  qualifiedAt?: Date
  qualifiedBy?: mongoose.Types.ObjectId // Reference to User
  unqualifiedReason?: string
  unqualifiedAt?: Date

  // Scoring & Analytics
  score?: number // Lead scoring (0-100)
  hotLead?: boolean
  conversionProbability?: number // Percentage

  // Preferences & Communication
  preferredContactMethod?: 'email' | 'phone' | 'meeting' | 'chat'
  timezone?: string
  language?: string

  // Metadata
  tags?: string[]
  customFields?: Record<string, any>

  // Timestamps
  createdAt: Date
  updatedAt: Date

  // Internal tracking for status changes
  _original?: any

  // Business logic methods
  canTransitionTo(newStatus: string): { allowed: boolean; reason?: string }
  qualify(qualifiedBy: mongoose.Types.ObjectId): Promise<void>
  unqualify(reason: string): Promise<void>
}

const LeadSchema = new Schema<ILead>(
  {
    // Client Basic Info Section
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      unique: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v);
        },
        message: "Please enter a valid phone number"
      }
    },
    company: {
      type: String,
      trim: true,
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },
    position: {
      type: String,
      trim: true,
      maxlength: [100, "Position cannot exceed 100 characters"],
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.*/, "Website must be a valid URL"],
    },
    address: {
      street: { type: String, trim: true, maxlength: [200, "Street cannot exceed 200 characters"] },
      city: { type: String, trim: true, maxlength: [100, "City cannot exceed 100 characters"] },
      state: { type: String, trim: true, maxlength: [100, "State cannot exceed 100 characters"] },
      zipCode: { type: String, trim: true, maxlength: [20, "Zip code cannot exceed 20 characters"] },
      country: { type: String, trim: true, maxlength: [100, "Country cannot exceed 100 characters"] },
    },

    // Company Details
    industry: {
      type: String,
      trim: true,
      maxlength: [100, "Industry cannot exceed 100 characters"],
    },
    companySize: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
    },
    annualRevenue: {
      type: Number,
      min: [0, "Annual revenue cannot be negative"],
    },
    employeeCount: {
      type: Number,
      min: [1, "Employee count must be at least 1"],
    },

    // Project Basic Info Section
    projectName: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: [200, "Project name cannot exceed 200 characters"],
      index: true,
    },
    projectDescription: {
      type: String,
      trim: true,
      maxlength: [2000, "Project description cannot exceed 2000 characters"],
    },
    projectBudget: {
      type: Number,
      min: [0, "Budget cannot be negative"],
      max: [999999999, "Budget too large"],
    },
    projectTimeline: {
      type: String,
      trim: true,
      maxlength: [100, "Timeline cannot exceed 100 characters"],
    },
    projectRequirements: [{
      type: String,
      trim: true,
      maxlength: [500, "Each requirement cannot exceed 500 characters"],
    }],
    technologies: [{
      type: String,
      trim: true,
      maxlength: [100, "Each technology cannot exceed 100 characters"],
    }],
    projectType: {
      type: String,
      enum: ['web', 'mobile', 'desktop', 'api', 'consulting', 'other'],
    },
    complexity: {
      type: String,
      enum: ['simple', 'medium', 'complex'],
    },

    // Project Scope & Details
    deliverables: [{
      type: String,
      trim: true,
      maxlength: [500, "Each deliverable cannot exceed 500 characters"],
    }],
    milestones: [{
      title: { type: String, required: true, trim: true, maxlength: [200, "Milestone title cannot exceed 200 characters"] },
      description: { type: String, trim: true, maxlength: [500, "Milestone description cannot exceed 500 characters"] },
      dueDate: { type: Date },
      completed: { type: Boolean, default: false },
    }],
    estimatedHours: {
      type: Number,
      min: [0, "Estimated hours cannot be negative"],
    },

    // Lead Management
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'qualified', 'unqualified'],
        message: 'Status must be one of: active, inactive, qualified, unqualified'
      },
      default: 'active',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "Created by is required"],
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },

    // Lead Source & Tracking
    source: {
      type: String,
      enum: ['website', 'referral', 'cold_call', 'email', 'social_media', 'event', 'partner', 'advertising', 'other'],
      default: 'website',
      index: true,
    },
    sourceDetails: {
      type: String,
      trim: true,
      maxlength: [500, "Source details cannot exceed 500 characters"],
    },
    campaign: {
      type: String,
      trim: true,
      maxlength: [200, "Campaign name cannot exceed 200 characters"],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },

    // Communication & Notes
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    lastContactDate: {
      type: Date,
      index: true,
    },
    nextFollowUpDate: {
      type: Date,
      index: true,
    },
    contactHistory: [{
      date: { type: Date, required: true },
      type: { type: String, enum: ['call', 'email', 'meeting', 'note'], required: true },
      description: { type: String, required: true, trim: true, maxlength: [1000, "Description cannot exceed 1000 characters"] },
      outcome: { type: String, trim: true, maxlength: [500, "Outcome cannot exceed 500 characters"] },
      contactPerson: { type: String, trim: true, maxlength: [100, "Contact person cannot exceed 100 characters"] },
    }],

    // Qualification Details
    qualifiedAt: {
      type: Date,
      index: true,
    },
    qualifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    unqualifiedReason: {
      type: String,
      trim: true,
      maxlength: [500, "Unqualified reason cannot exceed 500 characters"],
    },
    unqualifiedAt: {
      type: Date,
    },

    // Scoring & Analytics
    score: {
      type: Number,
      min: [0, "Score cannot be less than 0"],
      max: [100, "Score cannot exceed 100"],
    },
    hotLead: {
      type: Boolean,
      default: false,
    },
    conversionProbability: {
      type: Number,
      min: [0, "Conversion probability cannot be less than 0"],
      max: [100, "Conversion probability cannot exceed 100"],
    },

    // Preferences & Communication
    preferredContactMethod: {
      type: String,
      enum: ['email', 'phone', 'meeting', 'chat'],
    },
    timezone: {
      type: String,
      trim: true,
      maxlength: [50, "Timezone cannot exceed 50 characters"],
    },
    language: {
      type: String,
      trim: true,
      maxlength: [50, "Language cannot exceed 50 characters"],
    },

    // Metadata
    tags: [{
      type: String,
      trim: true,
      maxlength: [50, "Tag cannot exceed 50 characters"],
    }],
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Compound indexes for performance optimization
LeadSchema.index({ status: 1, createdAt: -1 }) // Status with date sorting
LeadSchema.index({ status: 1, priority: 1 }) // Status with priority filtering
LeadSchema.index({ createdBy: 1, status: 1 }) // Sales agent leads with status
LeadSchema.index({ status: 1, nextFollowUpDate: 1 }) // Follow-up scheduling
LeadSchema.index({ email: 1 }, { unique: true }) // Unique email constraint

// Text search index for name, email, company, and project name
LeadSchema.index({ 
  name: 'text', 
  email: 'text',
  company: 'text',
  projectName: 'text'
}, {
  weights: {
    name: 10,
    email: 8,
    projectName: 6,
    company: 4
  },
  name: 'lead_search_index'
})

// Sparse indexes for optional fields
LeadSchema.index({ clientId: 1 }, { sparse: true })
LeadSchema.index({ qualifiedAt: 1 }, { sparse: true })
LeadSchema.index({ tags: 1 }, { sparse: true })

// Virtual to populate created by user details
LeadSchema.virtual('createdByDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
})

// Virtual to populate client details
LeadSchema.virtual('clientDetails', {
  ref: 'User',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true,
})

// Virtual to populate qualified by user details
LeadSchema.virtual('qualifiedByDetails', {
  ref: 'User',
  localField: 'qualifiedBy',
  foreignField: '_id',
  justOne: true,
})

// Pre-save validation and business logic
LeadSchema.pre('save', async function(next) {
  try {
    // Note: User validation and department permissions are handled by API middleware
    // No need to validate user existence here as it can cause issues with authentication systems

    // Business logic for status transitions
    if (this.isModified('status')) {
      const originalStatus = this._original?.status

      // Set qualification timestamp
      if (this.status === 'qualified' && originalStatus !== 'qualified') {
        this.qualifiedAt = new Date()
      }

      // Set unqualification timestamp
      if (this.status === 'unqualified' && originalStatus !== 'unqualified') {
        this.unqualifiedAt = new Date()
      }

      // Validate status transitions
      if (originalStatus) {
        // Once qualified, can only be unqualified
        if (originalStatus === 'qualified' && this.status !== 'unqualified' && this.status !== 'qualified') {
          const error = new Error('Qualified lead can only be changed to unqualified status')
          return next(error)
        }

        // Once unqualified, cannot be changed
        if (originalStatus === 'unqualified' && this.status !== 'unqualified') {
          const error = new Error('Unqualified lead status cannot be changed')
          return next(error)
        }
      }
    }

    next()
  } catch (error: any) {
    next(error)
  }
})

// Post middleware to store original document for comparison
LeadSchema.pre('save', function(next) {
  if (!this.isNew) {
    this._original = this.toObject()
  }
  next()
})

// Instance methods
LeadSchema.methods.canTransitionTo = function(newStatus: string): { allowed: boolean; reason?: string } {
  const currentStatus = this.status

  // Define allowed transitions
  const transitions: Record<string, string[]> = {
    'active': ['inactive', 'qualified', 'unqualified'],
    'inactive': ['active', 'qualified', 'unqualified'],
    'qualified': ['unqualified'],
    'unqualified': [] // Terminal status
  }

  const allowedStatuses = transitions[currentStatus] || []
  
  if (!allowedStatuses.includes(newStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${currentStatus} to ${newStatus}`
    }
  }

  return { allowed: true }
}

LeadSchema.methods.qualify = async function(qualifiedBy: string) {
  const transition = this.canTransitionTo('qualified')
  if (!transition.allowed) {
    throw new Error(transition.reason)
  }

  this.status = 'qualified'
  this.qualifiedBy = qualifiedBy
  this.qualifiedAt = new Date()
  
  return await this.save()
}

LeadSchema.methods.unqualify = async function(reason: string, unqualifiedBy?: string) {
  this.status = 'unqualified'
  this.unqualifiedReason = reason
  this.unqualifiedAt = new Date()
  
  return await this.save()
}

// Static methods for analytics and reporting
LeadSchema.statics.getLeadStats = async function(filter = {}) {
  const stats = await this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgBudget: { $avg: '$projectBudget' },
        totalBudget: { $sum: '$projectBudget' }
      }
    }
  ])

  const result = {
    totalLeads: 0,
    activeLeads: 0,
    qualifiedLeads: 0,
    unqualifiedLeads: 0,
    inactiveLeads: 0,
    totalBudget: 0,
    averageBudget: 0
  }

  stats.forEach((stat: any) => {
    result.totalLeads += stat.count
    result.totalBudget += stat.totalBudget || 0
    
    switch (stat._id) {
      case 'active':
        result.activeLeads = stat.count
        break
      case 'qualified':
        result.qualifiedLeads = stat.count
        break
      case 'unqualified':
        result.unqualifiedLeads = stat.count
        break
      case 'inactive':
        result.inactiveLeads = stat.count
        break
    }
  })

  result.averageBudget = result.totalLeads > 0 ? result.totalBudget / result.totalLeads : 0

  return result
}

LeadSchema.statics.getConversionRate = async function(dateRange?: { start: Date; end: Date }) {
  const matchStage: any = {}
  
  if (dateRange) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    }
  }

  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        qualifiedLeads: {
          $sum: { $cond: [{ $eq: ['$status', 'qualified'] }, 1, 0] }
        }
      }
    }
  ])

  const data = result[0] || { totalLeads: 0, qualifiedLeads: 0 }
  const conversionRate = data.totalLeads > 0 ? (data.qualifiedLeads / data.totalLeads) * 100 : 0

  return {
    totalLeads: data.totalLeads,
    qualifiedLeads: data.qualifiedLeads,
    conversionRate: Math.round(conversionRate * 100) / 100
  }
}

// Remove sensitive fields from JSON output
LeadSchema.methods.toJSON = function () {
  const leadObject = this.toObject()
  delete leadObject.__v
  delete leadObject._original
  return leadObject
}

// Interface for static methods
interface ILeadModel extends mongoose.Model<ILead> {
  getLeadStats(filter?: any): Promise<any>;
  getConversionRate(dateRange?: { start: Date; end: Date }): Promise<any>;
}

const Lead = mongoose.models.Lead as ILeadModel || mongoose.model<ILead, ILeadModel>("Lead", LeadSchema)

// Register the model with the generic registry
import { registerModel } from '../lib/modelRegistry'
registerModel('Lead', Lead, LeadSchema, '1.0.0')

export default Lead