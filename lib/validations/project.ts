import { z } from 'zod'

// Constants for validation
export const PROJECT_CONSTANTS = {
  NAME: { MIN_LENGTH: 2, MAX_LENGTH: 200 },
  DESCRIPTION: { MAX_LENGTH: 1000 },
  REQUIREMENTS: { MAX_LENGTH: 2000 },
  TIMELINE: { MAX_LENGTH: 500 },
  PROJECT_TYPE: { MAX_LENGTH: 100 },
  STATUS: { 
    VALUES: ['pending', 'active', 'completed', 'approved', 'inactive'] as const, 
    DEFAULT: 'pending' as const 
  },
  PRIORITY: { 
    VALUES: ['low', 'medium', 'high', 'urgent'] as const, 
    DEFAULT: 'medium' as const 
  },
  PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 10, MAX_LIMIT: 100, MIN_PAGE: 1 },
  SORT: { ALLOWED_FIELDS: ['name', 'status', 'priority', 'createdAt', 'updatedAt', 'startDate', 'endDate'] as const }
} as const

// MongoDB ObjectId validation
export const objectIdSchema = z.string().regex(
  /^[0-9a-fA-F]{24}$/,
  'Invalid ID format'
)

// Base project schema
export const baseProjectSchema = z.object({
  name: z.string()
    .min(PROJECT_CONSTANTS.NAME.MIN_LENGTH, 'Name too short')
    .max(PROJECT_CONSTANTS.NAME.MAX_LENGTH, 'Name too long')
    .transform(val => val.trim())
    .refine(name => name.length > 0, 'Project name is required'),

  description: z.string()
    .max(PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH, 'Description too long')
    .nullable()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  clientId: objectIdSchema,

  departmentIds: z.array(objectIdSchema)
    .optional()
    .default([]),

  status: z.enum(PROJECT_CONSTANTS.STATUS.VALUES)
    .default(PROJECT_CONSTANTS.STATUS.DEFAULT),

  priority: z.enum(PROJECT_CONSTANTS.PRIORITY.VALUES)
    .default(PROJECT_CONSTANTS.PRIORITY.DEFAULT),

  budget: z.number()
    .min(0, 'Budget must be positive')
    .nullable()
    .optional()
    .transform(val => val === null ? undefined : val),

  startDate: z.date()
    .nullable()
    .optional()
    .transform(val => val === null ? undefined : val),

  endDate: z.date()
    .nullable()
    .optional()
    .transform(val => val === null ? undefined : val),

  // Fields from lead project info
  projectType: z.string()
    .max(PROJECT_CONSTANTS.PROJECT_TYPE.MAX_LENGTH, 'Project type too long')
    .nullable()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  requirements: z.string()
    .max(PROJECT_CONSTANTS.REQUIREMENTS.MAX_LENGTH, 'Requirements too long')
    .nullable()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  timeline: z.string()
    .max(PROJECT_CONSTANTS.TIMELINE.MAX_LENGTH, 'Timeline too long')
    .nullable()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  // Approval fields
  approvedBy: objectIdSchema.nullable().optional(),
  approvedAt: z.date().nullable().optional(),

  createdBy: objectIdSchema,
})

// Form schemas (with string dates for form handling)
export const baseProjectFormSchema = z.object({
  name: z.string()
    .min(PROJECT_CONSTANTS.NAME.MIN_LENGTH, 'Name too short')
    .max(PROJECT_CONSTANTS.NAME.MAX_LENGTH, 'Name too long')
    .transform(val => val.trim()),

  description: z.string()
    .max(PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH, 'Description too long')
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  clientId: z.string()
    .transform(val => val?.trim() || '')
    .refine(val => val.length > 0, 'Client is required'),

  departmentIds: z.array(z.string())
    .optional()
    .default([]),

  status: z.enum(PROJECT_CONSTANTS.STATUS.VALUES)
    .default(PROJECT_CONSTANTS.STATUS.DEFAULT),

  priority: z.enum(PROJECT_CONSTANTS.PRIORITY.VALUES)
    .default(PROJECT_CONSTANTS.PRIORITY.DEFAULT),

  budget: z.string()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  startDate: z.string()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  endDate: z.string()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  // Fields from lead project info
  projectType: z.string()
    .max(PROJECT_CONSTANTS.PROJECT_TYPE.MAX_LENGTH, 'Project type too long')
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  requirements: z.string()
    .max(PROJECT_CONSTANTS.REQUIREMENTS.MAX_LENGTH, 'Requirements too long')
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  timeline: z.string()
    .max(PROJECT_CONSTANTS.TIMELINE.MAX_LENGTH, 'Timeline too long')
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),
})

// Operation-specific schemas
export const createProjectSchema = baseProjectSchema
  .omit({ createdBy: true })
  .strict()
  .refine(data => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return false
    }
    return true
  }, { message: 'Start date cannot be after end date' })

export const updateProjectSchema = baseProjectSchema
  .omit({ createdBy: true })
  .partial()
  .strict()
  .refine(data => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  ), { message: 'At least one field must be provided for update' })
  .refine(data => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return false
    }
    return true
  }, { message: 'Start date cannot be after end date' })

// Form operation schemas
export const createProjectFormSchema = baseProjectFormSchema.strict()

export const updateProjectFormSchema = baseProjectFormSchema
  .partial()
  .strict()
  .refine(data => Object.values(data).some(value => 
    value !== undefined && value !== null && value !== ''
  ), { message: 'At least one field must be provided for update' })

// Department categorization schema
export const categorizeDepartmentsSchema = z.object({
  departmentIds: z.array(objectIdSchema)
    .min(1, 'At least one department must be selected')
    .max(10, 'Maximum 10 departments allowed'),
})

// ID parameter schema
export const projectIdSchema = z.object({
  id: objectIdSchema
})

// Query parameter schemas
export const projectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional().transform(val => val?.trim() || ''),
  status: z.enum(['pending', 'active', 'completed', 'approved', 'inactive', '']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent', '']).optional(),
  clientId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  sortBy: z.enum(['name', 'status', 'priority', 'createdAt', 'updatedAt', 'startDate', 'endDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Project prefill schema (from lead data)
export const projectPrefillSchema = z.object({
  clientId: objectIdSchema,
  leadId: objectIdSchema.optional(),
  // Auto-filled from lead project info
  name: z.string().optional(),
  projectType: z.string().optional(),
  requirements: z.string().optional(),
  timeline: z.string().optional(),
  budget: z.number().optional(),
})

// Project stats schema
export const projectStatsSchema = z.object({
  totalProjects: z.number(),
  pendingProjects: z.number(),
  activeProjects: z.number(),
  completedProjects: z.number(),
  approvedProjects: z.number(),
  inactiveProjects: z.number(),
  
  // Priority breakdown
  lowPriorityProjects: z.number(),
  mediumPriorityProjects: z.number(),
  highPriorityProjects: z.number(),
  urgentPriorityProjects: z.number(),
  
  // Budget stats
  totalBudget: z.number().optional(),
  averageBudget: z.number().optional(),
})

// Type exports for frontend
export type Project = {
  _id: string
  name: string
  description?: string
  clientId: string
  departmentIds: string[]
  status: 'pending' | 'active' | 'completed' | 'approved' | 'inactive'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  budget?: number
  startDate?: string
  endDate?: string
  projectType?: string
  requirements?: string
  timeline?: string
  createdBy: string
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
  
  // Virtual fields
  client?: {
    _id: string
    name: string
    email: string
  }
  departments?: Array<{
    _id: string
    name: string
    status: string
  }>
  creator?: {
    _id: string
    name: string
    email: string
  }
  taskCount?: number
}

export type CreateProjectData = z.infer<typeof createProjectSchema>
export type UpdateProjectData = z.infer<typeof updateProjectSchema>
export type CreateProjectFormData = z.infer<typeof createProjectFormSchema>
export type UpdateProjectFormData = z.infer<typeof updateProjectFormSchema>
export type ProjectQueryParams = z.infer<typeof projectQuerySchema>
export type ProjectPrefillData = z.infer<typeof projectPrefillSchema>
export type ProjectStats = z.infer<typeof projectStatsSchema>
export type CategorizeDepartmentsData = z.infer<typeof categorizeDepartmentsSchema>

// Fetch params interface
export interface FetchProjectsParams extends Partial<ProjectQueryParams> {}

// Project filter interface
export interface ProjectFilters {
  search?: string
  status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive' | ''
  priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
  clientId?: string
  departmentId?: string
}

// Project sort interface
export interface ProjectSort {
  field: 'name' | 'status' | 'priority' | 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'
  direction: 'asc' | 'desc'
}