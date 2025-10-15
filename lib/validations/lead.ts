import { z } from 'zod'

// =============================================================================
// CONSTANTS FOR VALIDATION
// =============================================================================

export const LEAD_CONSTANTS = {
  NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  EMAIL: { MAX_LENGTH: 254 },
  PHONE: { PATTERN: /^[\+]?[0-9]{7,15}$/ },
  COMPANY: { MAX_LENGTH: 200 },
  PROJECT: {
    NAME: { MIN_LENGTH: 2, MAX_LENGTH: 200 },
    DESCRIPTION: { MAX_LENGTH: 2000 },
    TIMELINE: { MAX_LENGTH: 100 },
    BUDGET: { MIN: 0, MAX: 999999999 },
    REQUIREMENTS: { MAX_LENGTH: 500 }
  },
  NOTES: { MAX_LENGTH: 2000 },
  TAGS: { MAX_LENGTH: 50, MAX_COUNT: 10 },
  STATUS: {
    VALUES: ['active', 'inactive', 'qualified', 'unqualified'] as const,
    DEFAULT: 'active' as const,
    CREATE_ALLOWED: ['active', 'inactive'] as const,
    TRANSITIONS: {
      'active': ['inactive', 'qualified', 'unqualified'],
      'inactive': ['active', 'qualified', 'unqualified'], 
      'qualified': ['unqualified'],
      'unqualified': [] // Terminal status
    }
  },
  SOURCE: {
    VALUES: ['website', 'referral', 'cold_call', 'email', 'social_media', 'event', 'other'] as const,
    DEFAULT: 'website' as const
  },
  PRIORITY: {
    VALUES: ['low', 'medium', 'high', 'urgent'] as const,
    DEFAULT: 'medium' as const
  },
  PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 100, MIN_PAGE: 1 },
  SORT: { ALLOWED_FIELDS: ['name', 'email', 'projectName', 'status', 'priority', 'createdAt', 'updatedAt'] as const },
  UNQUALIFIED_REASON: { MAX_LENGTH: 500 }
} as const

// =============================================================================
// BASE VALIDATION SCHEMAS
// =============================================================================

// MongoDB ObjectId validation
export const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  'Invalid ID format'
)

// Name validation with proper character support
const nameSchema = z
  .string()
  .min(LEAD_CONSTANTS.NAME.MIN_LENGTH, `Name must be at least ${LEAD_CONSTANTS.NAME.MIN_LENGTH} characters`)
  .max(LEAD_CONSTANTS.NAME.MAX_LENGTH, `Name must not exceed ${LEAD_CONSTANTS.NAME.MAX_LENGTH} characters`)
  .regex(
    /^[a-zA-Z\u00C0-\u017F\s\-\'\.]+$/,
    "Name can only contain letters, spaces, hyphens, apostrophes, and periods"
  )
  .transform((name) => name.trim().replace(/\s+/g, ' '))

// Email validation
const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(LEAD_CONSTANTS.EMAIL.MAX_LENGTH, `Email must not exceed ${LEAD_CONSTANTS.EMAIL.MAX_LENGTH} characters`)
  .transform((email) => email.toLowerCase().trim())

// Phone validation
const phoneSchema = z
  .string()
  .regex(
    LEAD_CONSTANTS.PHONE.PATTERN,
    "Phone number must be 7-15 digits, optionally starting with +"
  )
  .transform((phone) => {
    // Clean phone number: remove spaces, hyphens, parentheses
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '')
    if (cleaned.includes('+') && !cleaned.startsWith('+')) {
      cleaned = cleaned.replace(/\+/g, '')
    }
    return cleaned
  })
  .optional()

// Company name validation
const companySchema = z
  .string()
  .max(LEAD_CONSTANTS.COMPANY.MAX_LENGTH, `Company name must not exceed ${LEAD_CONSTANTS.COMPANY.MAX_LENGTH} characters`)
  .transform((company) => company.trim())
  .optional()

// Project name validation
const projectNameSchema = z
  .string()
  .min(LEAD_CONSTANTS.PROJECT.NAME.MIN_LENGTH, `Project name must be at least ${LEAD_CONSTANTS.PROJECT.NAME.MIN_LENGTH} characters`)
  .max(LEAD_CONSTANTS.PROJECT.NAME.MAX_LENGTH, `Project name must not exceed ${LEAD_CONSTANTS.PROJECT.NAME.MAX_LENGTH} characters`)
  .transform((name) => name.trim())

// Project description validation
const projectDescriptionSchema = z
  .string()
  .max(LEAD_CONSTANTS.PROJECT.DESCRIPTION.MAX_LENGTH, `Project description must not exceed ${LEAD_CONSTANTS.PROJECT.DESCRIPTION.MAX_LENGTH} characters`)
  .transform((desc) => desc.trim())
  .optional()

// Project budget validation
const projectBudgetSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    // Handle empty/null/undefined cases
    if (val === undefined || val === null || val === '') return undefined;
    
    // Handle string inputs
    if (typeof val === 'string') {
      // Remove any non-numeric characters except decimal point
      const cleaned = val.replace(/[^\d.-]/g, '');
      if (cleaned === '' || cleaned === '.') return undefined;
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }
    
    // Handle number inputs
    return typeof val === 'number' ? val : undefined;
  })
  .refine(
    (val) => {
      // Allow undefined values (optional field)
      if (val === undefined) return true;
      
      // Validate number range
      return typeof val === 'number' && 
             val >= LEAD_CONSTANTS.PROJECT.BUDGET.MIN && 
             val <= LEAD_CONSTANTS.PROJECT.BUDGET.MAX;
    },
    { 
      message: `Budget must be between ${LEAD_CONSTANTS.PROJECT.BUDGET.MIN} and ${LEAD_CONSTANTS.PROJECT.BUDGET.MAX}`,
    }
  )

// Project timeline validation
const projectTimelineSchema = z
  .string()
  .max(LEAD_CONSTANTS.PROJECT.TIMELINE.MAX_LENGTH, `Project timeline must not exceed ${LEAD_CONSTANTS.PROJECT.TIMELINE.MAX_LENGTH} characters`)
  .transform((timeline) => timeline.trim())
  .optional()

// Project requirements validation
const projectRequirementsSchema = z
  .array(
    z.string()
      .max(LEAD_CONSTANTS.PROJECT.REQUIREMENTS.MAX_LENGTH, `Each requirement must not exceed ${LEAD_CONSTANTS.PROJECT.REQUIREMENTS.MAX_LENGTH} characters`)
      .transform((req) => req.trim())
  )
  .max(10, "Cannot have more than 10 requirements")
  .optional()

// Notes validation
const notesSchema = z
  .string()
  .max(LEAD_CONSTANTS.NOTES.MAX_LENGTH, `Notes must not exceed ${LEAD_CONSTANTS.NOTES.MAX_LENGTH} characters`)
  .transform((notes) => notes.trim())
  .optional()

// Tags validation
const tagsSchema = z
  .array(
    z.string()
      .max(LEAD_CONSTANTS.TAGS.MAX_LENGTH, `Each tag must not exceed ${LEAD_CONSTANTS.TAGS.MAX_LENGTH} characters`)
      .transform((tag) => tag.trim().toLowerCase())
  )
  .max(LEAD_CONSTANTS.TAGS.MAX_COUNT, `Cannot have more than ${LEAD_CONSTANTS.TAGS.MAX_COUNT} tags`)
  .optional()

// Status validation
const statusSchema = z.enum(LEAD_CONSTANTS.STATUS.VALUES)

// Source validation
const sourceSchema = z.enum(LEAD_CONSTANTS.SOURCE.VALUES).default(LEAD_CONSTANTS.SOURCE.DEFAULT)

// Priority validation
const prioritySchema = z.enum(LEAD_CONSTANTS.PRIORITY.VALUES).default(LEAD_CONSTANTS.PRIORITY.DEFAULT)

// Date validation
const dateSchema = z
  .union([z.string(), z.date()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string') {
      const date = new Date(val);
      return isNaN(date.getTime()) ? undefined : date;
    }
    return val;
  })

// =============================================================================
// CORE LEAD SCHEMAS
// =============================================================================

// Base lead schema with all fields
export const baseLeadSchema = z.object({
  // Client Basic Info Section
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: companySchema,
  
  // Project Basic Info Section  
  projectName: projectNameSchema,
  projectDescription: projectDescriptionSchema,
  projectBudget: projectBudgetSchema,
  projectTimeline: projectTimelineSchema,
  projectRequirements: projectRequirementsSchema,
  
  // Lead Management
  status: statusSchema.default(LEAD_CONSTANTS.STATUS.DEFAULT),
  createdBy: objectIdSchema,
  
  // Lead Source & Tracking
  source: sourceSchema,
  priority: prioritySchema,
  
  // Communication & Notes
  notes: notesSchema,
  lastContactDate: dateSchema,
  nextFollowUpDate: dateSchema,
  
  // Metadata
  tags: tagsSchema,
  customFields: z.record(z.any()).optional(),
})

// =============================================================================
// OPERATION SPECIFIC SCHEMAS
// =============================================================================

// Form-specific schemas with raw string inputs (for UI compatibility)
export const createLeadFormSchema = z.object({
  // Client Basic Info Section
  name: z.string().min(LEAD_CONSTANTS.NAME.MIN_LENGTH).max(LEAD_CONSTANTS.NAME.MAX_LENGTH),
  email: z.string().email().max(LEAD_CONSTANTS.EMAIL.MAX_LENGTH),
  phone: z.string().optional(),
  company: z.string().optional(),
  
  // Project Basic Info Section  
  projectName: z.string().min(LEAD_CONSTANTS.PROJECT.NAME.MIN_LENGTH).max(LEAD_CONSTANTS.PROJECT.NAME.MAX_LENGTH),
  projectDescription: z.string().optional(),
  projectBudget: z.string().optional(), // Keep as string for form inputs
  projectTimeline: z.string().optional(),
  projectRequirements: z.array(z.string()).optional(),
  
  // Lead Management
  status: z.enum(LEAD_CONSTANTS.STATUS.CREATE_ALLOWED).default(LEAD_CONSTANTS.STATUS.DEFAULT),
  
  // Lead Source & Tracking
  source: z.enum(LEAD_CONSTANTS.SOURCE.VALUES).default(LEAD_CONSTANTS.SOURCE.DEFAULT),
  priority: z.enum(LEAD_CONSTANTS.PRIORITY.VALUES).default(LEAD_CONSTANTS.PRIORITY.DEFAULT),
  
  // Communication & Notes
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(), // Keep as string for date inputs
  
  // Metadata
  tags: z.array(z.string()).optional(),
}).strict()

// Create lead schema (only allow active/inactive status)
export const createLeadSchema = z.object({
  // Client Basic Info Section
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: companySchema,
  
  // Project Basic Info Section  
  projectName: projectNameSchema,
  projectDescription: projectDescriptionSchema,
  projectBudget: projectBudgetSchema,
  projectTimeline: projectTimelineSchema,
  projectRequirements: projectRequirementsSchema,
  
  // Lead Management - createdBy is INTENTIONALLY OMITTED (set by API)
  status: z.enum(LEAD_CONSTANTS.STATUS.CREATE_ALLOWED).default(LEAD_CONSTANTS.STATUS.DEFAULT),
  
  // Lead Source & Tracking
  source: sourceSchema,
  priority: prioritySchema,
  
  // Communication & Notes
  notes: notesSchema,
  lastContactDate: dateSchema,
  nextFollowUpDate: dateSchema,
  
  // Metadata
  tags: tagsSchema,
  customFields: z.record(z.any()).optional(),
}).strict()

// Update form schema (partial fields with string inputs)
export const updateLeadFormSchema = z.object({
  // Client Basic Info Section
  name: z.string().min(LEAD_CONSTANTS.NAME.MIN_LENGTH).max(LEAD_CONSTANTS.NAME.MAX_LENGTH).optional(),
  email: z.string().email().max(LEAD_CONSTANTS.EMAIL.MAX_LENGTH).optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  
  // Project Basic Info Section  
  projectName: z.string().min(LEAD_CONSTANTS.PROJECT.NAME.MIN_LENGTH).max(LEAD_CONSTANTS.PROJECT.NAME.MAX_LENGTH).optional(),
  projectDescription: z.string().optional(),
  projectBudget: z.string().optional(), // Keep as string for form inputs
  projectTimeline: z.string().optional(),
  projectRequirements: z.array(z.string()).optional(),
  
  // Lead Management
  status: z.enum(LEAD_CONSTANTS.STATUS.VALUES).optional(),
  
  // Lead Source & Tracking
  source: z.enum(LEAD_CONSTANTS.SOURCE.VALUES).optional(),
  priority: z.enum(LEAD_CONSTANTS.PRIORITY.VALUES).optional(),
  
  // Communication & Notes
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(), // Keep as string for date inputs
  
  // Metadata
  tags: z.array(z.string()).optional(),
}).strict()

// Update lead schema (partial fields allowed)
export const updateLeadSchema = baseLeadSchema.partial().strict()
  .refine(data => {
    // At least one field must be provided for update
    const values = Object.values(data).filter(value => 
      value !== undefined && value !== null && value !== ''
    )
    return values.length > 0
  }, { message: 'At least one field must be provided for update' })

// Status update schema with validation
export const leadStatusUpdateSchema = z.object({
  status: statusSchema,
  reason: z.string()
    .max(LEAD_CONSTANTS.UNQUALIFIED_REASON.MAX_LENGTH, `Reason must not exceed ${LEAD_CONSTANTS.UNQUALIFIED_REASON.MAX_LENGTH} characters`)
    .optional()
}).refine(data => {
  // Reason required when changing to unqualified
  if (data.status === 'unqualified' && !data.reason) {
    return false
  }
  return true
}, {
  message: 'Reason is required when changing status to unqualified',
  path: ['reason']
})

// Lead qualification schema
export const leadQualificationSchema = z.object({
  leadId: objectIdSchema,
  qualifiedBy: objectIdSchema.optional(), // Will be set from authenticated user if not provided
}).strict()

// =============================================================================
// QUERY PARAMETER SCHEMAS
// =============================================================================

// Lead query parameters for listing/filtering
export const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(LEAD_CONSTANTS.PAGINATION.MIN_PAGE).default(LEAD_CONSTANTS.PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(LEAD_CONSTANTS.PAGINATION.MAX_LIMIT).default(LEAD_CONSTANTS.PAGINATION.DEFAULT_LIMIT),
  search: z.string().optional().transform(val => val?.trim() || ''),
  status: z.enum([...LEAD_CONSTANTS.STATUS.VALUES, '']).optional(),
  source: z.enum([...LEAD_CONSTANTS.SOURCE.VALUES, '']).optional(),
  priority: z.enum([...LEAD_CONSTANTS.PRIORITY.VALUES, '']).optional(),
  createdBy: z.union([objectIdSchema, z.literal(''), z.undefined()]).optional().transform(val => val === '' ? undefined : val),
  sortBy: z.enum(LEAD_CONSTANTS.SORT.ALLOWED_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Date filters
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  
  // Budget filters
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  
  // Follow-up filters
  hasFollowUp: z.coerce.boolean().optional(),
  followUpOverdue: z.coerce.boolean().optional(),
})

// Lead ID parameter validation
export const leadIdSchema = z.object({
  id: objectIdSchema
})

// Bulk operations schema
export const bulkLeadOperationSchema = z.object({
  leadIds: z.array(objectIdSchema).min(1, 'At least one lead ID is required').max(100, 'Cannot process more than 100 leads at once'),
  operation: z.enum(['delete', 'updateStatus', 'bulkAssign']),
  data: z.object({
    status: statusSchema.optional(),
    assignTo: objectIdSchema.optional(),
    tags: tagsSchema.optional(),
  }).optional(),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Lead with ID (for responses)
export const leadWithIdSchema = baseLeadSchema.extend({
  _id: objectIdSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  qualifiedAt: z.date().optional(),
  qualifiedBy: objectIdSchema.optional(),
  unqualifiedAt: z.date().optional(),
  unqualifiedReason: z.string().optional(),
  clientId: objectIdSchema.optional(),
})

// TypeScript type definitions
export type Lead = z.infer<typeof leadWithIdSchema>
export type CreateLeadData = z.infer<typeof createLeadSchema>
export type UpdateLeadData = z.infer<typeof updateLeadSchema>
export type CreateLeadFormData = z.infer<typeof createLeadFormSchema>
export type UpdateLeadFormData = z.infer<typeof updateLeadFormSchema>
export type LeadStatusUpdate = z.infer<typeof leadStatusUpdateSchema>
export type LeadQualification = z.infer<typeof leadQualificationSchema>
export type LeadQueryParams = z.infer<typeof leadQuerySchema>
export type LeadIdParams = z.infer<typeof leadIdSchema>
export type BulkLeadOperation = z.infer<typeof bulkLeadOperationSchema>

// Additional helper types
export type LeadStatus = (typeof LEAD_CONSTANTS.STATUS.VALUES)[number]
export type LeadSource = (typeof LEAD_CONSTANTS.SOURCE.VALUES)[number]
export type LeadPriority = (typeof LEAD_CONSTANTS.PRIORITY.VALUES)[number]
export type LeadSortField = (typeof LEAD_CONSTANTS.SORT.ALLOWED_FIELDS)[number]

// Lead filters type for frontend
export type LeadFilters = Partial<{
  search: string
  status: LeadStatus | ''
  source: LeadSource | ''
  priority: LeadPriority | ''
  createdBy: string
  createdAfter: Date
  createdBefore: Date
  minBudget: number
  maxBudget: number
  hasFollowUp: boolean
  followUpOverdue: boolean
}>

// Lead sort configuration
export type LeadSort = {
  field: LeadSortField
  direction: 'asc' | 'desc'
}

// Lead pagination configuration
export type LeadPagination = {
  page: number
  limit: number
  total: number
  pages: number
}

// Lead stats type
export type LeadStats = {
  totalLeads: number
  activeLeads: number
  qualifiedLeads: number
  unqualifiedLeads: number
  inactiveLeads: number
  totalBudget: number
  averageBudget: number
  conversionRate: number
}

// Lead API response types
export type LeadListResponse = {
  success: boolean
  data: {
    leads: Lead[]
    pagination: LeadPagination
    stats: LeadStats
  }
  message: string
}

export type LeadResponse = {
  success: boolean
  data: Lead
  message: string
}

export type LeadMutationResponse = {
  success: boolean
  data: Lead
  message: string
}