# Complete AWS SES & S3 Integration Guide for DepLLC CRM
## Step-by-Step Implementation Following Your Current Architecture

This guide integrates AWS SES (email) and S3 (file storage) into your existing DepLLC CRM following the exact same patterns as your Department module.

## 📋 **Implementation Checklist Overview**

```
Phase 1: Environment & AWS Setup (30 mins)
├── AWS Account & IAM Setup
├── Environment Variables Configuration
└── Package Installation

Phase 2: Database Models (45 mins)
├── Email Log Model
├── File Model
└── Database Migrations

Phase 3: Validation Layer (30 mins)
├── Email Validation Schemas
├── File Validation Schemas
└── Type Definitions

Phase 4: Service Layer (60 mins)
├── AWS SES Service
├── AWS S3 Service
└── Integration with Existing Middleware

Phase 5: API Layer (90 mins)
├── Email API Routes
├── File API Routes
└── Error Handling

Phase 6: State Management (60 mins)
├── Email Redux Slice
├── File Redux Slice
└── Custom Hooks

Phase 7: Frontend Integration (120 mins)
├── Email Components
├── File Upload Components
└── Integration with Existing Pages

Phase 8: Testing & Deployment (45 mins)
├── Testing Email Sending
├── Testing File Upload
└── Production Deployment
```

---

## 🚀 **PHASE 1: Environment & AWS Setup**

### Step 1.1: AWS Account Setup

```bash
# 1. Create AWS Account (if you don't have one)
# Go to: https://aws.amazon.com/

# 2. Install AWS CLI
npm install -g aws-cli
# or
curl "https://awscli.amazonaws.com/awscli-exe-windows-x86_64.msi" -o "AWSCLIV2.msi"

# 3. Configure AWS CLI
aws configure
# Enter your access key, secret key, region (us-east-1), output format (json)
```

### Step 1.2: Create IAM User for CRM

```bash
# Create IAM policy file
```

Create `aws-iam-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SESPermissions",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendBulkTemplatedEmail",
        "ses:GetSendQuota",
        "ses:GetSendStatistics",
        "ses:GetIdentityVerificationAttributes",
        "ses:VerifyEmailIdentity",
        "ses:VerifyDomainIdentity"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3Permissions",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObjectVersion"
      ],
      "Resource": [
        "arn:aws:s3:::depllc-crm-files",
        "arn:aws:s3:::depllc-crm-files/*"
      ]
    }
  ]
}
```

```bash
# Create IAM policy
aws iam create-policy \
  --policy-name DepLLC-CRM-Policy \
  --policy-document file://aws-iam-policy.json

# Create IAM user
aws iam create-user --user-name depllc-crm-user

# Attach policy to user
aws iam attach-user-policy \
  --user-name depllc-crm-user \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/DepLLC-CRM-Policy

# Create access keys
aws iam create-access-key --user-name depllc-crm-user
```

### Step 1.3: SES Setup

```bash
# Verify your email domain
aws sesv2 verify-domain-identity --domain yourcompany.com

# Verify specific email addresses (for testing)
aws sesv2 verify-email-identity --email noreply@yourcompany.com
aws sesv2 verify-email-identity --email support@yourcompany.com

# Create configuration set
aws sesv2 create-configuration-set --configuration-set-name depllc-crm-emails

# Move out of sandbox (production)
# Note: This requires AWS support request for production use
```

### Step 1.4: S3 Setup

```bash
# Create S3 bucket
aws s3 mb s3://depllc-crm-files --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket depllc-crm-files \
  --versioning-configuration Status=Enabled

# Set bucket policy (create bucket-policy.json first)
```

Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureConnections",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::depllc-crm-files",
        "arn:aws:s3:::depllc-crm-files/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

```bash
# Apply bucket policy
aws s3api put-bucket-policy --bucket depllc-crm-files --policy file://bucket-policy.json
```

### Step 1.5: Package Installation

```bash
# Navigate to your CRM project
cd E:\DepLLC_Projects\depllc-crm

# Install AWS SDK packages
npm install @aws-sdk/client-ses @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Install additional utilities
npm install nodemailer @types/nodemailer sharp multer @types/multer
```

### Step 1.6: Environment Variables

Add to your `.env.local`:
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here

# SES Configuration
AWS_SES_FROM_EMAIL=noreply@yourcompany.com
AWS_SES_REPLY_TO=support@yourcompany.com
SES_CONFIGURATION_SET=depllc-crm-emails

# S3 Configuration
AWS_S3_BUCKET=depllc-crm-files
AWS_S3_REGION=us-east-1

# Security
WEBHOOK_SECRET=your-webhook-secret-256-bit-key
FILE_ENCRYPTION_KEY=your-file-encryption-key-32-chars
```

---

## 🗄️ **PHASE 2: Database Models**

### Step 2.1: Email Model

Create `models/EmailLog.ts`:
```typescript
import mongoose, { Document, Schema } from 'mongoose'

export interface IEmailLog extends Document {
  messageId: string
  to: string[]
  from: string
  subject: string
  content: {
    html?: string
    text?: string
  }
  category: 'auth' | 'notification' | 'marketing' | 'system' | 'client-portal'
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complaint' | 'failed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  events: Array<{
    type: 'send' | 'delivery' | 'bounce' | 'complaint' | 'open' | 'click'
    timestamp: Date
    metadata?: Record<string, any>
  }>
  userId?: string
  clientId?: string
  templateId?: string
  templateData?: Record<string, any>
  cost: number
  size: number
  tags?: Record<string, string>
  customData?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const EmailLogSchema = new Schema<IEmailLog>({
  messageId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  to: [{ 
    type: String, 
    required: true 
  }],
  from: { 
    type: String, 
    required: true 
  },
  subject: { 
    type: String, 
    required: true 
  },
  content: {
    html: String,
    text: String,
  },
  category: {
    type: String,
    enum: ['auth', 'notification', 'marketing', 'system', 'client-portal'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'bounced', 'complaint', 'failed'],
    default: 'queued',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  events: [{
    type: {
      type: String,
      enum: ['send', 'delivery', 'bounce', 'complaint', 'open', 'click'],
      required: true
    },
    timestamp: { type: Date, default: Date.now },
    metadata: Schema.Types.Mixed
  }],
  userId: { type: String, index: true },
  clientId: { type: String, index: true },
  templateId: String,
  templateData: Schema.Types.Mixed,
  cost: { type: Number, default: 0 },
  size: { type: Number, required: true },
  tags: Schema.Types.Mixed,
  customData: Schema.Types.Mixed,
}, {
  timestamps: true,
  toJSON: { virtuals: true }
})

// Performance indexes
EmailLogSchema.index({ category: 1, status: 1, createdAt: -1 })
EmailLogSchema.index({ userId: 1, createdAt: -1 })
EmailLogSchema.index({ 'events.type': 1, 'events.timestamp': -1 })

export default mongoose.models.EmailLog || mongoose.model<IEmailLog>("EmailLog", EmailLogSchema)
```

### Step 2.2: File Model

Create `models/File.ts`:
```typescript
import mongoose, { Document, Schema } from 'mongoose'

export interface IFile extends Document {
  key: string
  fileName: string
  originalName: string
  contentType: string
  size: number
  category: 'email' | 'document' | 'avatar' | 'contract' | 'invoice' | 'backup' | 'general'
  status: 'uploading' | 'completed' | 'failed' | 'deleted'
  isPublic: boolean
  userId: string
  clientId?: string
  departmentId?: string
  metadata: {
    uploadedBy: string
    ipAddress?: string
    userAgent?: string
    checksum?: string
    tags?: string[]
  }
  s3Info: {
    bucket: string
    region: string
    etag?: string
    versionId?: string
  }
  access: {
    downloadCount: number
    lastAccessed?: Date
    expiresAt?: Date
  }
  createdAt: Date
  updatedAt: Date
}

const FileSchema = new Schema<IFile>({
  key: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  fileName: { 
    type: String, 
    required: true 
  },
  originalName: { 
    type: String, 
    required: true 
  },
  contentType: { 
    type: String, 
    required: true 
  },
  size: { 
    type: Number, 
    required: true 
  },
  category: {
    type: String,
    enum: ['email', 'document', 'avatar', 'contract', 'invoice', 'backup', 'general'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['uploading', 'completed', 'failed', 'deleted'],
    default: 'uploading',
    index: true
  },
  isPublic: { 
    type: Boolean, 
    default: false 
  },
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  clientId: { 
    type: String, 
    index: true 
  },
  departmentId: { 
    type: String, 
    index: true 
  },
  metadata: {
    uploadedBy: { type: String, required: true },
    ipAddress: String,
    userAgent: String,
    checksum: String,
    tags: [String]
  },
  s3Info: {
    bucket: { type: String, required: true },
    region: { type: String, required: true },
    etag: String,
    versionId: String
  },
  access: {
    downloadCount: { type: Number, default: 0 },
    lastAccessed: Date,
    expiresAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
})

// Performance indexes
FileSchema.index({ userId: 1, category: 1, status: 1 })
FileSchema.index({ status: 1, createdAt: -1 })
FileSchema.index({ 'metadata.tags': 1 })
FileSchema.index({ departmentId: 1, createdAt: -1 })

export default mongoose.models.File || mongoose.model<IFile>("File", FileSchema)
```

---

## ✅ **PHASE 3: Validation Layer**

### Step 3.1: Email Validation Schemas

Create `lib/validations/email.ts`:
```typescript
import { z } from 'zod'

// Constants
export const EMAIL_CONSTANTS = {
  SUBJECT: { MIN_LENGTH: 1, MAX_LENGTH: 200 },
  CONTENT: { MAX_LENGTH: 50000 },
  RECIPIENTS: { MAX_COUNT: 100 },
  ATTACHMENT: { MAX_SIZE: 25 * 1024 * 1024, MAX_COUNT: 10 }, // 25MB, 10 files
  CATEGORIES: ['auth', 'notification', 'marketing', 'system', 'client-portal'] as const,
  PRIORITIES: ['low', 'normal', 'high', 'urgent'] as const,
  STATUSES: ['queued', 'sent', 'delivered', 'bounced', 'complaint', 'failed'] as const
} as const

// Base schemas
export const emailAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string(), // Base64 encoded
  contentType: z.string().min(1)
})

export const sendEmailSchema = z.object({
  to: z.union([
    z.string().email(),
    z.array(z.string().email()).max(EMAIL_CONSTANTS.RECIPIENTS.MAX_COUNT)
  ]),
  subject: z.string()
    .min(EMAIL_CONSTANTS.SUBJECT.MIN_LENGTH)
    .max(EMAIL_CONSTANTS.SUBJECT.MAX_LENGTH),
  htmlContent: z.string()
    .max(EMAIL_CONSTANTS.CONTENT.MAX_LENGTH)
    .optional(),
  textContent: z.string()
    .max(EMAIL_CONSTANTS.CONTENT.MAX_LENGTH)
    .optional(),
  templateId: z.string().optional(),
  templateData: z.record(z.any()).optional(),
  category: z.enum(EMAIL_CONSTANTS.CATEGORIES),
  priority: z.enum(EMAIL_CONSTANTS.PRIORITIES).default('normal'),
  attachments: z.array(emailAttachmentSchema)
    .max(EMAIL_CONSTANTS.ATTACHMENT.MAX_COUNT)
    .optional(),
  tags: z.record(z.string()).optional(),
  clientId: z.string().optional(),
  replyTo: z.string().email().optional()
}).refine(data => data.htmlContent || data.textContent || data.templateId, {
  message: "At least one of htmlContent, textContent, or templateId must be provided"
})

// Query schemas
export const emailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.enum([...EMAIL_CONSTANTS.CATEGORIES, '']).optional(),
  status: z.enum([...EMAIL_CONSTANTS.STATUSES, '']).optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'subject', 'status', 'category']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Types
export type SendEmailData = z.infer<typeof sendEmailSchema>
export type EmailQueryParams = z.infer<typeof emailQuerySchema>
export type EmailAttachment = z.infer<typeof emailAttachmentSchema>
```

### Step 3.2: File Validation Schemas

Create `lib/validations/file.ts`:
```typescript
import { z } from 'zod'

// Constants
export const FILE_CONSTANTS = {
  FILENAME: { MAX_LENGTH: 255 },
  SIZE: { MAX_SIZE: 100 * 1024 * 1024 }, // 100MB
  CATEGORIES: ['email', 'document', 'avatar', 'contract', 'invoice', 'backup', 'general'] as const,
  STATUSES: ['uploading', 'completed', 'failed', 'deleted'] as const,
  ALLOWED_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ] as const
} as const

// Upload URL generation schema
export const generateUploadUrlSchema = z.object({
  fileName: z.string()
    .min(1)
    .max(FILE_CONSTANTS.FILENAME.MAX_LENGTH)
    .refine(name => !name.includes('..'), 'Invalid file name'),
  contentType: z.enum(FILE_CONSTANTS.ALLOWED_TYPES),
  category: z.enum(FILE_CONSTANTS.CATEGORIES),
  maxSizeBytes: z.number()
    .int()
    .min(1)
    .max(FILE_CONSTANTS.SIZE.MAX_SIZE)
    .default(10 * 1024 * 1024), // 10MB default
  isPublic: z.boolean().default(false),
  metadata: z.record(z.string()).optional(),
  clientId: z.string().optional(),
  departmentId: z.string().optional()
})

// Upload completion schema
export const uploadCompleteSchema = z.object({
  fileId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid file ID'),
  actualSize: z.number().int().min(1)
})

// File query schema
export const fileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.enum([...FILE_CONSTANTS.CATEGORIES, '']).optional(),
  status: z.enum([...FILE_CONSTANTS.STATUSES, '']).optional(),
  userId: z.string().optional(),
  departmentId: z.string().optional(),
  sortBy: z.enum(['fileName', 'size', 'createdAt', 'category']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Types
export type GenerateUploadUrlData = z.infer<typeof generateUploadUrlSchema>
export type UploadCompleteData = z.infer<typeof uploadCompleteSchema>
export type FileQueryParams = z.infer<typeof fileQuerySchema>
```

---

## 🔧 **PHASE 4: Service Layer**

### Step 4.1: AWS SES Service

Create `lib/services/email-service.ts`:
```typescript
import { SESClient, SendEmailCommand, GetSendQuotaCommand, GetSendStatisticsCommand } from '@aws-sdk/client-ses'
import connectDB from '@/lib/mongodb'
import EmailLog from '@/models/EmailLog'
import { SendEmailData } from '@/lib/validations/email'
import crypto from 'crypto'

export class EmailService {
  private static sesClient = new SESClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  static async sendEmail(params: SendEmailData & { userId: string }) {
    try {
      await connectDB()

      // Generate unique message ID
      const messageId = crypto.randomUUID()
      const recipients = Array.isArray(params.to) ? params.to : [params.to]

      // Calculate email size (rough estimate)
      const emailSize = JSON.stringify({
        to: recipients,
        subject: params.subject,
        content: {
          html: params.htmlContent,
          text: params.textContent
        }
      }).length

      // Create email log entry
      const emailLog = new EmailLog({
        messageId,
        to: recipients,
        from: process.env.AWS_SES_FROM_EMAIL!,
        subject: params.subject,
        content: {
          html: params.htmlContent,
          text: params.textContent
        },
        category: params.category,
        priority: params.priority,
        userId: params.userId,
        clientId: params.clientId,
        templateId: params.templateId,
        templateData: params.templateData,
        size: emailSize,
        cost: 0, // Will be updated after sending
        tags: params.tags,
        status: 'queued'
      })

      await emailLog.save()

      // Prepare SES command
      const command = new SendEmailCommand({
        Source: process.env.AWS_SES_FROM_EMAIL!,
        Destination: {
          ToAddresses: recipients
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: params.htmlContent ? {
              Data: params.htmlContent,
              Charset: 'UTF-8'
            } : undefined,
            Text: params.textContent ? {
              Data: params.textContent,
              Charset: 'UTF-8'
            } : undefined
          }
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : [process.env.AWS_SES_REPLY_TO!],
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET
      })

      // Send email via SES
      const response = await this.sesClient.send(command)

      // Update email log with success
      await EmailLog.findByIdAndUpdate(emailLog._id, {
        messageId: response.MessageId,
        status: 'sent',
        cost: recipients.length * 0.0001, // AWS SES pricing
        events: [{
          type: 'send',
          timestamp: new Date(),
          metadata: { sesMessageId: response.MessageId }
        }]
      })

      return {
        success: true,
        messageId: response.MessageId,
        emailLogId: emailLog._id.toString()
      }

    } catch (error: any) {
      console.error('Email send error:', error)
      
      // Update email log with error
      if (params.userId) {
        try {
          await EmailLog.updateOne(
            { userId: params.userId, status: 'queued' },
            { 
              status: 'failed',
              events: [{
                type: 'send',
                timestamp: new Date(),
                metadata: { error: error.message }
              }]
            },
            { sort: { createdAt: -1 } }
          )
        } catch (logError) {
          console.error('Failed to update email log:', logError)
        }
      }

      return {
        success: false,
        error: error.message || 'Failed to send email'
      }
    }
  }

  static async getEmailAnalytics(params: {
    userId?: string
    category?: string
    status?: string[]
    startDate?: Date
    endDate?: Date
  }) {
    try {
      await connectDB()

      const query: any = {}
      
      if (params.userId) query.userId = params.userId
      if (params.category) query.category = params.category
      if (params.status) query.status = { $in: params.status }
      if (params.startDate || params.endDate) {
        query.createdAt = {}
        if (params.startDate) query.createdAt.$gte = params.startDate
        if (params.endDate) query.createdAt.$lte = params.endDate
      }

      const [stats, recentEmails] = await Promise.all([
        EmailLog.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              totalEmails: { $sum: 1 },
              totalCost: { $sum: '$cost' },
              avgSize: { $avg: '$size' },
              byStatus: {
                $push: {
                  status: '$status',
                  count: 1
                }
              },
              byCategory: {
                $push: {
                  category: '$category',
                  count: 1
                }
              }
            }
          }
        ]),
        EmailLog.find(query)
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      ])

      return {
        success: true,
        data: {
          stats: stats[0] || {
            totalEmails: 0,
            totalCost: 0,
            avgSize: 0,
            byStatus: [],
            byCategory: []
          },
          recentEmails
        }
      }

    } catch (error: any) {
      console.error('Email analytics error:', error)
      return {
        success: false,
        error: error.message || 'Failed to get email analytics'
      }
    }
  }

  static async getSendQuota() {
    try {
      const command = new GetSendQuotaCommand({})
      const response = await this.sesClient.send(command)
      
      return {
        success: true,
        data: {
          maxSend24Hour: response.Max24HourSend,
          maxSendRate: response.MaxSendRate,
          sentLast24Hours: response.SentLast24Hours
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}
```

### Step 4.2: AWS S3 Service

Create `lib/services/file-service.ts`:
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import connectDB from '@/lib/mongodb'
import File from '@/models/File'
import { GenerateUploadUrlData, UploadCompleteData, FileQueryParams } from '@/lib/validations/file'
import crypto from 'crypto'

export class FileService {
  private static s3Client = new S3Client({
    region: process.env.AWS_S3_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  static async generateUploadUrl(params: GenerateUploadUrlData & { userId: string }) {
    try {
      await connectDB()

      // Generate unique file key
      const fileExtension = params.fileName.split('.').pop()
      const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const timestamp = Date.now()
      const randomId = crypto.randomBytes(8).toString('hex')
      const fileKey = `${params.category}/${params.userId}/${timestamp}-${randomId}-${sanitizedFileName}`

      // Create file metadata in database
      const file = new File({
        key: fileKey,
        fileName: sanitizedFileName,
        originalName: params.fileName,
        contentType: params.contentType,
        size: 0, // Will be updated after upload
        category: params.category,
        status: 'uploading',
        isPublic: params.isPublic,
        userId: params.userId,
        clientId: params.clientId,
        departmentId: params.departmentId,
        metadata: {
          uploadedBy: params.userId,
          tags: params.metadata?.tags ? params.metadata.tags.split(',') : [],
          ...params.metadata
        },
        s3Info: {
          bucket: process.env.AWS_S3_BUCKET!,
          region: process.env.AWS_S3_REGION!
        }
      })

      await file.save()

      // Generate presigned URL for upload
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: fileKey,
        ContentType: params.contentType,
        ContentLengthRange: [1, params.maxSizeBytes],
        Metadata: {
          userId: params.userId,
          category: params.category,
          originalName: params.fileName
        }
      })

      const uploadUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 900 // 15 minutes
      })

      return {
        success: true,
        uploadUrl,
        fileKey,
        fileId: file._id.toString(),
        expiresIn: 900
      }

    } catch (error: any) {
      console.error('Generate upload URL error:', error)
      return {
        success: false,
        error: error.message || 'Failed to generate upload URL'
      }
    }
  }

  static async completeUpload(params: UploadCompleteData) {
    try {
      await connectDB()

      const file = await File.findById(params.fileId)
      if (!file) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Update file with actual size and mark as completed
      const updatedFile = await File.findByIdAndUpdate(
        params.fileId,
        {
          size: params.actualSize,
          status: 'completed'
        },
        { new: true }
      )

      return {
        success: true,
        data: { file: updatedFile }
      }

    } catch (error: any) {
      console.error('Upload completion error:', error)
      return {
        success: false,
        error: error.message || 'Failed to complete upload'
      }
    }
  }

  static async getDownloadUrl(fileId: string, userId: string) {
    try {
      await connectDB()

      const file = await File.findOne({
        _id: fileId,
        status: 'completed',
        $or: [
          { userId },
          { isPublic: true }
        ]
      })

      if (!file) {
        return {
          success: false,
          error: 'File not found or access denied'
        }
      }

      // Generate presigned URL for download
      const command = new GetObjectCommand({
        Bucket: file.s3Info.bucket,
        Key: file.key
      })

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600 // 1 hour
      })

      // Update access statistics
      await File.findByIdAndUpdate(fileId, {
        $inc: { 'access.downloadCount': 1 },
        'access.lastAccessed': new Date()
      })

      return {
        success: true,
        downloadUrl,
        file: {
          id: file._id,
          fileName: file.fileName,
          originalName: file.originalName,
          contentType: file.contentType,
          size: file.size
        }
      }

    } catch (error: any) {
      console.error('Download URL generation error:', error)
      return {
        success: false,
        error: error.message || 'Failed to generate download URL'
      }
    }
  }

  static async listFiles(params: FileQueryParams & { userId: string }) {
    try {
      await connectDB()

      const query: any = {
        userId: params.userId,
        status: { $ne: 'deleted' }
      }

      if (params.search) {
        query.$or = [
          { fileName: { $regex: params.search, $options: 'i' } },
          { originalName: { $regex: params.search, $options: 'i' } }
        ]
      }

      if (params.category) query.category = params.category
      if (params.status) query.status = params.status
      if (params.departmentId) query.departmentId = params.departmentId

      const sort: any = {}
      sort[params.sortBy] = params.sortOrder === 'asc' ? 1 : -1

      const [files, total] = await Promise.all([
        File.find(query)
          .sort(sort)
          .skip((params.page - 1) * params.limit)
          .limit(params.limit)
          .lean(),
        File.countDocuments(query)
      ])

      return {
        success: true,
        data: {
          files,
          pagination: {
            page: params.page,
            limit: params.limit,
            total,
            pages: Math.ceil(total / params.limit)
          }
        }
      }

    } catch (error: any) {
      console.error('List files error:', error)
      return {
        success: false,
        error: error.message || 'Failed to list files'
      }
    }
  }

  static async deleteFile(fileId: string, userId: string) {
    try {
      await connectDB()

      const file = await File.findOne({
        _id: fileId,
        userId,
        status: { $ne: 'deleted' }
      })

      if (!file) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Soft delete - mark as deleted instead of actually deleting
      await File.findByIdAndUpdate(fileId, {
        status: 'deleted'
      })

      // Optionally, delete from S3 (commented out for safety)
      /*
      const command = new DeleteObjectCommand({
        Bucket: file.s3Info.bucket,
        Key: file.key
      })
      await this.s3Client.send(command)
      */

      return {
        success: true,
        message: 'File deleted successfully'
      }

    } catch (error: any) {
      console.error('Delete file error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete file'
      }
    }
  }
}
```

---

Continue reading for the remaining phases (API Layer, State Management, Frontend Integration, and Testing)...