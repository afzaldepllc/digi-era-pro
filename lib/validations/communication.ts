import { z } from 'zod'

// Constants for validation
export const COMMUNICATION_CONSTANTS = {
  MESSAGE: { MIN_LENGTH: 1, MAX_LENGTH: 5000 },
  CHANNEL_ID: { MAX_LENGTH: 100 },
  CHANNEL_NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  ATTACHMENT_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_ATTACHMENTS: 5,
  TYPES: ['chat', 'email', 'note'] as const,
  PRIORITIES: ['low', 'medium', 'high'] as const,
  CHANNEL_TYPES: ['dm', 'project', 'client-support', 'group', 'department', 'general'] as const,
  PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 50, MAX_LIMIT: 100, MIN_PAGE: 1 },
} as const

// MongoDB ObjectId validation
export const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  'Invalid ID format'
)

// Base message schema
export const baseMessageSchema = z.object({
  message: z.string()
    .min(COMMUNICATION_CONSTANTS.MESSAGE.MIN_LENGTH, 'Message cannot be empty')
    .max(COMMUNICATION_CONSTANTS.MESSAGE.MAX_LENGTH, 'Message too long')
    .transform(val => val.trim()),

  attachments: z.array(z.string().url())
    .max(COMMUNICATION_CONSTANTS.MAX_ATTACHMENTS, 'Too many attachments')
    .optional(),

  parentMessageId: objectIdSchema.optional(),

  communicationType: z.enum(COMMUNICATION_CONSTANTS.TYPES)
    .default('chat'),

  priority: z.enum(COMMUNICATION_CONSTANTS.PRIORITIES)
    .default('medium'),
})

// Create message schema
export const createMessageSchema = baseMessageSchema.extend({
  channelId: z.string()
    .min(1, 'Channel ID is required')
    .max(COMMUNICATION_CONSTANTS.CHANNEL_ID.MAX_LENGTH, 'Channel ID too long'),
}).strict()

// Update message schema
export const updateMessageSchema = z.object({
  message: z.string()
    .min(COMMUNICATION_CONSTANTS.MESSAGE.MIN_LENGTH, 'Message cannot be empty')
    .max(COMMUNICATION_CONSTANTS.MESSAGE.MAX_LENGTH, 'Message too long')
    .transform(val => val.trim())
    .optional(),

  isRead: z.boolean().optional(),
  readAt: z.date().optional(),
}).strict()
  .refine(data => Object.values(data).some(value => 
    value !== undefined && value !== null
  ), { message: 'At least one field must be provided for update' })

// Channel creation schema
export const createChannelSchema = z.object({
  name: z.string()
    .min(COMMUNICATION_CONSTANTS.CHANNEL_NAME.MIN_LENGTH, 'Channel name too short')
    .max(COMMUNICATION_CONSTANTS.CHANNEL_NAME.MAX_LENGTH, 'Channel name too long')
    .transform(val => val.trim())
    .optional(),

  type: z.enum(['dm', 'project', 'client-support', 'group', 'department', 'general']),

  participants: z.array(objectIdSchema)
    .min(1, 'At least one participant is required'),

  projectId: objectIdSchema.optional(),

  departmentId: objectIdSchema.optional(),

  isInternal: z.boolean().optional(),

  description: z.string()
    .max(500, 'Description too long')
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),
}).strict()

// Update channel schema
export const updateChannelSchema = z.object({
  name: z.string()
    .min(COMMUNICATION_CONSTANTS.CHANNEL_NAME.MIN_LENGTH, 'Channel name too short')
    .max(COMMUNICATION_CONSTANTS.CHANNEL_NAME.MAX_LENGTH, 'Channel name too long')
    .transform(val => val.trim())
    .optional(),

  participants: z.array(objectIdSchema)
    .min(1, 'At least one participant is required')
    .optional(),

  isInternal: z.boolean().optional(),

  description: z.string()
    .max(500, 'Description too long')
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),
}).strict()
  .refine(data => Object.values(data).some(value => 
    value !== undefined && value !== null
  ), { message: 'At least one field must be provided for update' })

// Channel ID schema
export const channelIdSchema = objectIdSchema

// Query parameter schemas
export const messageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  channelId: z.string().min(1, 'Channel ID is required'),
  search: z.string().optional().transform(val => val?.trim() || ''),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  isRead: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const channelQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().transform(val => val?.trim() || ''),
  type: z.enum(['dm', 'project', 'client-support', 'group', 'department', 'general', '']).optional(),
  isInternal: z.boolean().optional(),
  projectId: objectIdSchema.optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Typing indicator schema
export const typingIndicatorSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  userId: objectIdSchema,
  userName: z.string().min(1, 'User name is required'),
  timestamp: z.string().default(() => new Date().toISOString()),
})

// Socket event schemas
export const socketMessageSchema = createMessageSchema

export const socketJoinChannelSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
})

export const socketReadMessageSchema = z.object({
  messageId: objectIdSchema,
  channelId: z.string().min(1, 'Channel ID is required'),
})

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= COMMUNICATION_CONSTANTS.ATTACHMENT_MAX_SIZE, 
      `File size must be less than ${COMMUNICATION_CONSTANTS.ATTACHMENT_MAX_SIZE / (1024 * 1024)}MB`)
    .refine(file => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/zip'
      ]
      return allowedTypes.includes(file.type)
    }, 'File type not supported'),

  channelId: z.string().min(1, 'Channel ID is required'),
})

// Batch operations schemas
export const batchMarkReadSchema = z.object({
  messageIds: z.array(objectIdSchema).min(1, 'At least one message ID required'),
  channelId: z.string().min(1, 'Channel ID is required'),
})

export const batchDeleteMessagesSchema = z.object({
  messageIds: z.array(objectIdSchema).min(1, 'At least one message ID required'),
  channelId: z.string().min(1, 'Channel ID is required'),
})

// Response validation schemas
export const communicationResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

// Type exports
export type CreateMessageData = z.infer<typeof createMessageSchema>
export type UpdateMessageData = z.infer<typeof updateMessageSchema>
export type CreateChannelData = z.infer<typeof createChannelSchema>
export type UpdateChannelData = z.infer<typeof updateChannelSchema>
export type MessageQueryParams = z.infer<typeof messageQuerySchema>
export type ChannelQueryParams = z.infer<typeof channelQuerySchema>
export type ChannelId = z.infer<typeof channelIdSchema>
export type TypingIndicatorData = z.infer<typeof typingIndicatorSchema>
export type SocketMessageData = z.infer<typeof socketMessageSchema>
export type SocketJoinChannelData = z.infer<typeof socketJoinChannelSchema>
export type SocketReadMessageData = z.infer<typeof socketReadMessageSchema>
export type FileUploadData = z.infer<typeof fileUploadSchema>
export type BatchMarkReadData = z.infer<typeof batchMarkReadSchema>
export type BatchDeleteMessagesData = z.infer<typeof batchDeleteMessagesSchema>
export type CommunicationResponse = z.infer<typeof communicationResponseSchema>