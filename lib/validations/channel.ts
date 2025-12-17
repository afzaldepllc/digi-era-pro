import { z } from 'zod'

// Base constants for validation
export const CHANNEL_CONSTANTS = {
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  TYPE: {
    VALUES: ['dm', 'group', 'project', 'department', 'client-support'] as const,
    DEFAULT: 'group' as const,
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    MIN_PAGE: 1,
  },
  SORT: {
    ALLOWED_FIELDS: ['name', 'type', 'created_at', 'updated_at'] as const,
    DEFAULT_FIELD: 'updated_at' as const,
    DEFAULT_ORDER: 'desc' as const,
  },
} as const

// Custom validation helpers
const createStringValidator = (config: { min?: number; max?: number; required?: boolean }) => {
  let validator = z.string()

  if (config.min) {
    validator = validator.min(config.min, `Must be at least ${config.min} characters`)
  }

  if (config.max) {
    validator = validator.max(config.max, `Cannot exceed ${config.max} characters`)
  }

  // Trim all strings
  const baseValidator = baseValidator.transform((val) => val.trim())

  if (config.required === false) {
    return baseValidator.optional()
  }

  return baseValidator
}

// Base channel schema
export const baseChannelSchema = z.object({
  type: z.enum(CHANNEL_CONSTANTS.TYPE.VALUES, {
    errorMap: () => ({ message: `Type must be one of: ${CHANNEL_CONSTANTS.TYPE.VALUES.join(', ')}` })
  }),
  name: createStringValidator({
    min: CHANNEL_CONSTANTS.NAME.MIN_LENGTH,
    max: CHANNEL_CONSTANTS.NAME.MAX_LENGTH,
    required: false
  }),
  mongo_department_id: z.string().optional(),
  mongo_project_id: z.string().optional(),
  is_private: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  client_id: z.string().optional(),
})

// Create channel schema
export const createChannelSchema = baseChannelSchema.extend({
  participants: z.array(z.string()).optional(),
  category: z.string().optional(),
})

// Update channel schema
export const updateChannelSchema = z.object({
  name: createStringValidator({
    min: CHANNEL_CONSTANTS.NAME.MIN_LENGTH,
    max: CHANNEL_CONSTANTS.NAME.MAX_LENGTH,
    required: false
  }),
  is_private: z.boolean().optional(),
}).partial()

// Channel query schema for GET requests
export const channelQuerySchema = z.object({
  type: z.string().optional(),
  department_id: z.string().optional(),
  project_id: z.string().optional(),
})

// Channel ID parameter schema
export const channelIdSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID format'),
})

// Message schemas
export const baseMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(5000, 'Message too long'),
  content_type: z.enum(['text', 'image', 'file', 'system']).default('text'),
  thread_id: z.string().uuid().optional(),
  parent_message_id: z.string().uuid().optional(),
  mongo_mentioned_user_ids: z.array(z.string()).default([]),
})

export const createMessageSchema = baseMessageSchema

export const updateMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(5000, 'Message too long'),
})

// Message query schema
export const messageQuerySchema = z.object({
  channel_id: z.string().uuid('Invalid channel ID'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

// Message ID parameter schema
export const messageIdSchema = z.object({
  messageId: z.string().uuid('Invalid message ID format'),
})

// Member schemas
export const addMemberSchema = z.object({
  channel_id: z.string().uuid(),
  mongo_member_id: z.string(),
  role: z.enum(['admin', 'member']).default('member'),
})

export const updateMemberStatusSchema = z.object({
  channel_id: z.string().uuid(),
  mongo_member_id: z.string(),
  is_online: z.boolean(),
})

// Reaction schema
export const createReactionSchema = z.object({
  message_id: z.string().uuid(),
  emoji: z.string().min(1).max(10),
})

// Read receipt schema
export const markAsReadSchema = z.object({
  message_id: z.string().uuid(),
})

// Type exports for TypeScript
export type CreateChannelData = z.infer<typeof createChannelSchema>
export type UpdateChannelData = z.infer<typeof updateChannelSchema>
export type ChannelQueryParams = z.infer<typeof channelQuerySchema>
export type CreateMessageData = z.infer<typeof createMessageSchema>
export type UpdateMessageData = z.infer<typeof updateMessageSchema>
export type MessageQueryParams = z.infer<typeof messageQuerySchema>
export type AddMemberData = z.infer<typeof addMemberSchema>
export type UpdateMemberStatusData = z.infer<typeof updateMemberStatusSchema>
export type CreateReactionData = z.infer<typeof createReactionSchema>
export type MarkAsReadData = z.infer<typeof markAsReadSchema>