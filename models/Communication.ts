import mongoose, { Document, Schema } from 'mongoose'

export interface ICommunication extends Document {
  projectId?: mongoose.Types.ObjectId // FK to Projects
  senderId: mongoose.Types.ObjectId // FK to Users or Clients
  receiverId?: mongoose.Types.ObjectId // FK to Users/Clients (null for group channels)
  senderModel: 'User' | 'Client'
  receiverModel?: 'User' | 'Client'
  channelId: string // Unique channel identifier
  subject?: string
  message: string
  communicationType: 'chat' | 'email' | 'note'
  priority: 'low' | 'medium' | 'high'
  isRead: boolean
  isInternal: boolean // True for internal users only
  attachments?: string[] // Array of file URLs
  parentMessageId?: mongoose.Types.ObjectId // For threading/replies
  readAt?: Date
  typingUsers?: mongoose.Types.ObjectId[] // Array of user IDs typing
  createdAt: Date
  updatedAt: Date
}

const CommunicationSchema = new Schema<ICommunication>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  senderId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'senderModel'
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    required: false,
    refPath: 'receiverModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['User', 'Client']
  },
  receiverModel: {
    type: String,
    required: false,
    enum: ['User', 'Client']
  },
  channelId: {
    type: String,
    required: true,
    // index: true // Removed - covered by compound indexes
  },
  subject: {
    type: String,
    required: false,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 5000
  },
  communicationType: {
    type: String,
    enum: ['chat', 'email', 'note'],
    default: 'chat'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isInternal: {
    type: Boolean,
    default: true
  },
  attachments: [{
    type: String,
    validate: {
      validator: function (v: string) {
        return /^https?:\/\/.+/.test(v)
      },
      message: 'Attachment must be a valid URL'
    }
  }],
  parentMessageId: {
    type: Schema.Types.ObjectId,
    ref: 'Communication',
    required: false
  },
  readAt: {
    type: Date,
    required: false
  },
  typingUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})

// Indexes for performance
CommunicationSchema.index({ channelId: 1, createdAt: -1 })
CommunicationSchema.index({ senderId: 1, createdAt: -1 })
CommunicationSchema.index({ receiverId: 1, createdAt: -1 })
CommunicationSchema.index({ projectId: 1, createdAt: -1 })
CommunicationSchema.index({ isRead: 1, channelId: 1 })
CommunicationSchema.index({
  message: 'text',
  subject: 'text'
}, {
  weights: { message: 10, subject: 5 },
  name: 'communication_search_index'
})

// Virtual for replies
CommunicationSchema.virtual('replies', {
  ref: 'Communication',
  localField: '_id',
  foreignField: 'parentMessageId'
})

// Pre-save validation
CommunicationSchema.pre('save', async function (next) {
  if (this.isModified('message')) {
    // Trim whitespace
    this.message = this.message.trim()
  }
  next()
})

export default mongoose.models.Communication || mongoose.model<ICommunication>("Communication", CommunicationSchema)