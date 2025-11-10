import mongoose, { Schema, type Document } from "mongoose";

// Interface for a single phase document
export interface IPhase extends Document {
  _id: string;
  title: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  order: number;
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: 'pending' | 'planning' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  progress: number; // 0-100
  budgetAllocation?: number;
  actualCost?: number;
  objectives: string[];
  deliverables: string[];
  resources: string[];
  risks: string[];
  dependencies: mongoose.Types.ObjectId[]; // Other phase IDs
  approvalRequired: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
export interface PhaseModel extends mongoose.Model<IPhase> {
  findByProject(projectId: string): Promise<IPhase[]>;
  calculateProjectPhaseProgress(projectId: string): Promise<number>;
  findActivePhases(): Promise<IPhase[]>;
  reorderPhases(projectId: string, phaseOrders: Array<{ id: string, order: number }>): Promise<void>;
}

const PhaseSchema = new Schema<IPhase>({
  title: {
    type: String,
    required: [true, "Phase title is required"],
    trim: true,
    maxlength: [200, "Title cannot exceed 200 characters"],
    minlength: [2, "Title must be at least 2 characters"]
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, "Description cannot exceed 1000 characters"]
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, "Project reference is required"],
    // index: true, // Removed - covered by compound indexes
  },
  order: {
    type: Number,
    required: [true, "Phase order is required"],
    min: [1, "Order must be positive"],
  },
  startDate: {
    type: Date,
    required: [true, "Start date is required"],
    // index: true, // Removed - not frequently queried alone
  },
  endDate: {
    type: Date,
    required: [true, "End date is required"],
    // index: true, // Removed - covered by compound indexes
  },
  actualStartDate: {
    type: Date,
  },
  actualEndDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['pending', 'planning', 'in-progress', 'on-hold', 'completed', 'cancelled'],
    default: 'pending',
    // index: true, // Removed - covered by compound indexes
  },
  progress: {
    type: Number,
    min: [0, "Progress cannot be negative"],
    max: [100, "Progress cannot exceed 100%"],
    default: 0,
  },
  budgetAllocation: {
    type: Number,
    min: [0, "Budget allocation cannot be negative"],
  },
  actualCost: {
    type: Number,
    min: [0, "Actual cost cannot be negative"],
  },
  objectives: [{
    type: String,
    trim: true,
    maxlength: [500, "Objective description too long"]
  }],
  deliverables: [{
    type: String,
    trim: true,
    maxlength: [500, "Deliverable description too long"]
  }],
  resources: [{
    type: String,
    trim: true,
    maxlength: [200, "Resource description too long"]
  }],
  risks: [{
    type: String,
    trim: true,
    maxlength: [500, "Risk description too long"]
  }],
  dependencies: [{
    type: Schema.Types.ObjectId,
    ref: 'Phase',
  }],
  approvalRequired: {
    type: Boolean,
    default: false,
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    // index: true, // Removed - covered by compound indexes
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Creator is required"],
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound indexes for performance
PhaseSchema.index({ projectId: 1, order: 1 });
PhaseSchema.index({ projectId: 1, isDeleted: 1, status: 1 });
PhaseSchema.index({ status: 1, endDate: 1 });
PhaseSchema.index({ createdAt: -1 });

// Virtuals
PhaseSchema.virtual('duration').get(function () {
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Days
});

PhaseSchema.virtual('actualDuration').get(function () {
  if (!this.actualStartDate || !this.actualEndDate) return null;
  const start = new Date(this.actualStartDate);
  const end = new Date(this.actualEndDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Days
});

PhaseSchema.virtual('isOverdue').get(function () {
  return this.status !== 'completed' && this.endDate < new Date();
});

PhaseSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
PhaseSchema.pre('save', function (next) {
  // Validate date ranges
  if (this.startDate >= this.endDate) {
    return next(new Error('End date must be after start date'));
  }

  // Auto-update status based on dates and progress
  const now = new Date();

  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    if (!this.actualEndDate) {
      this.actualEndDate = now;
    }
  } else if (this.progress > 0 && this.status === 'pending') {
    this.status = 'in-progress';
    if (!this.actualStartDate) {
      this.actualStartDate = now;
    }
  }

  next();
});

// Pre-validation middleware
PhaseSchema.pre('validate', function (next) {
  if (this.actualStartDate && this.actualEndDate) {
    if (this.actualStartDate >= this.actualEndDate) {
      return next(new Error('Actual end date must be after actual start date'));
    }
  }
  next();
});

// Static methods
PhaseSchema.statics.findByProject = function (projectId: string) {
  return this.find({
    projectId,
    isDeleted: false
  })
    .sort({ order: 1 });
};

PhaseSchema.statics.calculateProjectPhaseProgress = async function (projectId: string) {
  const phases = await this.find({
    projectId,
    isDeleted: false
  });

  if (phases.length === 0) return 0;

  const totalProgress = phases.reduce((sum: number, phase: any) => sum + phase.progress, 0);
  return Math.round(totalProgress / phases.length);
};

PhaseSchema.statics.findActivePhases = function () {
  return this.find({
    isDeleted: false,
    status: { $in: ['in-progress', 'planning'] }
  })
    .populate('projectId', 'name')
    .sort({ endDate: 1 });
};

PhaseSchema.statics.reorderPhases = async function (projectId: string, phaseOrders: Array<{ id: string, order: number }>) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const { id, order } of phaseOrders) {
        await this.findByIdAndUpdate(
          id,
          { order },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

// Ensure virtual fields are serialized
PhaseSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    if (ret.__v !== undefined) {
      delete (ret as any).__v;
    }
    return ret;
  }
});

// Export the model with proper typing for static methods
export default (mongoose.models.Phase || mongoose.model<IPhase>("Phase", PhaseSchema)) as unknown as PhaseModel;