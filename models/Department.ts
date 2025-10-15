import mongoose, { Document, Schema } from 'mongoose'

export interface IDepartment extends Document {
  name: string
  description?: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

const DepartmentSchema = new Schema<IDepartment>({
  name: {
    type: String,
    required: [true, "Department name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
    unique: true, // This already creates an index, so remove index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"],
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})

// Compound indexes for better query performance
DepartmentSchema.index({ status: 1, createdAt: -1 })

// Text search index
DepartmentSchema.index({ 
  name: 'text', 
  description: 'text'
}, {
  weights: { name: 10, description: 5 },
  name: 'department_search_index'
})

// Pre-save middleware to ensure unique name (case insensitive)
DepartmentSchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const existingDept = await mongoose.model('Department').findOne({
      name: { $regex: new RegExp(`^${this.name}$`, 'i') },
      _id: { $ne: this._id }
    })
    
    if (existingDept) {
      const error = new Error('Department name already exists')
      return next(error)
    }
  }
  next()
})

export default mongoose.models.Department || mongoose.model<IDepartment>("Department", DepartmentSchema)