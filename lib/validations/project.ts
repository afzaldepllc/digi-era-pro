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
  BUDGET_BREAKDOWN: {
    DEVELOPMENT: { MIN: 0 },
    DESIGN: { MIN: 0 },
    TESTING: { MIN: 0 },
    DEPLOYMENT: { MIN: 0 },
    MAINTENANCE: { MIN: 0 },
    CONTINGENCY: { MIN: 0 },
  },
  STAKEHOLDERS: {
    ROLE: { MAX_LENGTH: 100 },
    RESPONSIBILITY: { MAX_LENGTH: 200 },
  },
  MILESTONES: {
    TITLE: { MAX_LENGTH: 200 },
    DESCRIPTION: { MAX_LENGTH: 500 },
    DELIVERABLE: { MAX_LENGTH: 200 },
  },
  PHASES: {
    NAME: { MAX_LENGTH: 100 },
    DESCRIPTION: { MAX_LENGTH: 500 },
    STATUS: { VALUES: ['pending', 'in_progress', 'completed'] as const },
    DELIVERABLE: { MAX_LENGTH: 200 },
  },
  DELIVERABLES: {
    NAME: { MAX_LENGTH: 200 },
    DESCRIPTION: { MAX_LENGTH: 500 },
    ACCEPTANCE_CRITERIA: { MAX_LENGTH: 300 },
    STATUS: { VALUES: ['pending', 'in_progress', 'completed', 'delivered'] as const },
  },
  RISKS: {
    DESCRIPTION: { MAX_LENGTH: 500 },
    MITIGATION: { MAX_LENGTH: 500 },
    IMPACT: { VALUES: ['low', 'medium', 'high', 'critical'] as const },
    PROBABILITY: { VALUES: ['low', 'medium', 'high'] as const },
    STATUS: { VALUES: ['identified', 'mitigated', 'occurred'] as const },
  },
  PROGRESS: {
    OVERALL: { MIN: 0, MAX: 100 },
    PHASE_PROGRESS: { MIN: 0, MAX: 100 },
    NOTES: { MAX_LENGTH: 1000 },
  },
  RESOURCES: {
    ESTIMATED_HOURS: { MIN: 0 },
    ACTUAL_HOURS: { MIN: 0 },
    TEAM_SIZE: { MIN: 1 },
    TOOL: { MAX_LENGTH: 100 },
    EXTERNAL_RESOURCE: { MAX_LENGTH: 200 },
  },
  QUALITY_METRICS: {
    REQUIREMENTS_COVERAGE: { MIN: 0, MAX: 100 },
    DEFECT_DENSITY: { MIN: 0 },
    CUSTOMER_SATISFACTION: { MIN: 0, MAX: 5 },
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

  // Enhanced professional CRM fields
  budgetBreakdown: z.object({
    development: z.number().min(PROJECT_CONSTANTS.BUDGET_BREAKDOWN.DEVELOPMENT.MIN).optional(),
    design: z.number().min(PROJECT_CONSTANTS.BUDGET_BREAKDOWN.DESIGN.MIN).optional(),
    testing: z.number().min(PROJECT_CONSTANTS.BUDGET_BREAKDOWN.TESTING.MIN).optional(),
    deployment: z.number().min(PROJECT_CONSTANTS.BUDGET_BREAKDOWN.DEPLOYMENT.MIN).optional(),
    maintenance: z.number().min(PROJECT_CONSTANTS.BUDGET_BREAKDOWN.MAINTENANCE.MIN).optional(),
    contingency: z.number().min(PROJECT_CONSTANTS.BUDGET_BREAKDOWN.CONTINGENCY.MIN).optional(),
  }).optional(),

  stakeholders: z.object({
    projectManager: objectIdSchema.optional(),
    teamMembers: z.array(objectIdSchema).optional().default([]),
    clientContacts: z.array(objectIdSchema).optional().default([]),
    roles: z.array(z.object({
      userId: objectIdSchema,
      role: z.string().max(PROJECT_CONSTANTS.STAKEHOLDERS.ROLE.MAX_LENGTH).transform(val => val.trim()),
      responsibilities: z.array(z.string().max(PROJECT_CONSTANTS.STAKEHOLDERS.RESPONSIBILITY.MAX_LENGTH).transform(val => val.trim())).optional().default([]),
    })).optional().default([]),
  }).optional(),

  milestones: z.array(z.object({
    title: z.string().min(1).max(PROJECT_CONSTANTS.MILESTONES.TITLE.MAX_LENGTH).transform(val => val.trim()),
    description: z.string().max(PROJECT_CONSTANTS.MILESTONES.DESCRIPTION.MAX_LENGTH).transform(val => val.trim()).optional(),
    dueDate: z.date().optional(),
    completed: z.boolean().default(false),
    completedAt: z.date().optional(),
    deliverables: z.array(z.string().max(PROJECT_CONSTANTS.MILESTONES.DELIVERABLE.MAX_LENGTH).transform(val => val.trim())).optional().default([]),
  })).optional().default([]),

  phases: z.array(z.object({
    name: z.string().min(1).max(PROJECT_CONSTANTS.PHASES.NAME.MAX_LENGTH).transform(val => val.trim()),
    description: z.string().max(PROJECT_CONSTANTS.PHASES.DESCRIPTION.MAX_LENGTH).transform(val => val.trim()).optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    status: z.enum(PROJECT_CONSTANTS.PHASES.STATUS.VALUES).default('pending'),
    deliverables: z.array(z.string().max(PROJECT_CONSTANTS.PHASES.DELIVERABLE.MAX_LENGTH).transform(val => val.trim())).optional().default([]),
  })).optional().default([]),

  deliverables: z.array(z.object({
    name: z.string().min(1).max(PROJECT_CONSTANTS.DELIVERABLES.NAME.MAX_LENGTH).transform(val => val.trim()),
    description: z.string().max(PROJECT_CONSTANTS.DELIVERABLES.DESCRIPTION.MAX_LENGTH).transform(val => val.trim()).optional(),
    dueDate: z.date().optional(),
    status: z.enum(PROJECT_CONSTANTS.DELIVERABLES.STATUS.VALUES).default('pending'),
    assignedTo: objectIdSchema.optional(),
    acceptanceCriteria: z.array(z.string().max(PROJECT_CONSTANTS.DELIVERABLES.ACCEPTANCE_CRITERIA.MAX_LENGTH).transform(val => val.trim())).optional().default([]),
  })).optional().default([]),

  risks: z.array(z.object({
    description: z.string().min(1).max(PROJECT_CONSTANTS.RISKS.DESCRIPTION.MAX_LENGTH).transform(val => val.trim()),
    impact: z.enum(PROJECT_CONSTANTS.RISKS.IMPACT.VALUES).default('medium'),
    probability: z.enum(PROJECT_CONSTANTS.RISKS.PROBABILITY.VALUES).default('medium'),
    mitigation: z.string().max(PROJECT_CONSTANTS.RISKS.MITIGATION.MAX_LENGTH).transform(val => val.trim()).optional(),
    status: z.enum(PROJECT_CONSTANTS.RISKS.STATUS.VALUES).default('identified'),
  })).optional().default([]),

  progress: z.object({
    overall: z.number().min(PROJECT_CONSTANTS.PROGRESS.OVERALL.MIN).max(PROJECT_CONSTANTS.PROGRESS.OVERALL.MAX),
    phases: z.array(z.object({
      phaseId: z.string().min(1),
      progress: z.number().min(PROJECT_CONSTANTS.PROGRESS.PHASE_PROGRESS.MIN).max(PROJECT_CONSTANTS.PROGRESS.PHASE_PROGRESS.MAX),
    })).optional().default([]),
    lastUpdated: z.date().optional(),
    notes: z.string().max(PROJECT_CONSTANTS.PROGRESS.NOTES.MAX_LENGTH).transform(val => val.trim()).optional(),
  }).optional(),

  resources: z.object({
    estimatedHours: z.number().min(PROJECT_CONSTANTS.RESOURCES.ESTIMATED_HOURS.MIN).optional(),
    actualHours: z.number().min(PROJECT_CONSTANTS.RESOURCES.ACTUAL_HOURS.MIN).optional(),
    teamSize: z.number().min(PROJECT_CONSTANTS.RESOURCES.TEAM_SIZE.MIN).optional(),
    tools: z.array(z.string().max(PROJECT_CONSTANTS.RESOURCES.TOOL.MAX_LENGTH).transform(val => val.trim())).optional().default([]),
    externalResources: z.array(z.string().max(PROJECT_CONSTANTS.RESOURCES.EXTERNAL_RESOURCE.MAX_LENGTH).transform(val => val.trim())).optional().default([]),
  }).optional(),

  qualityMetrics: z.object({
    requirementsCoverage: z.number().min(PROJECT_CONSTANTS.QUALITY_METRICS.REQUIREMENTS_COVERAGE.MIN).max(PROJECT_CONSTANTS.QUALITY_METRICS.REQUIREMENTS_COVERAGE.MAX).optional(),
    defectDensity: z.number().min(PROJECT_CONSTANTS.QUALITY_METRICS.DEFECT_DENSITY.MIN).optional(),
    customerSatisfaction: z.number().min(PROJECT_CONSTANTS.QUALITY_METRICS.CUSTOMER_SATISFACTION.MIN).max(PROJECT_CONSTANTS.QUALITY_METRICS.CUSTOMER_SATISFACTION.MAX).optional(),
    onTimeDelivery: z.boolean().default(false),
    withinBudget: z.boolean().default(false),
  }).optional(),

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

  // Enhanced professional CRM fields (form versions with string inputs)
  budgetBreakdown: z.object({
    development: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    design: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    testing: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    deployment: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    maintenance: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    contingency: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
  }).optional(),

  stakeholders: z.object({
    projectManager: objectIdSchema.optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    teamMembers: z.array(objectIdSchema).optional().default([]),
    clientContacts: z.array(objectIdSchema).optional().default([]),
    roles: z.array(z.object({
      userId: objectIdSchema,
      role: z.string().min(1).max(PROJECT_CONSTANTS.STAKEHOLDERS.ROLE.MAX_LENGTH),
      responsibilities: z.array(z.string().max(PROJECT_CONSTANTS.STAKEHOLDERS.RESPONSIBILITY.MAX_LENGTH)).optional().default([]),
    })).optional().default([]),
  }).optional(),

  milestones: z.array(z.object({
    title: z.string().min(1).max(PROJECT_CONSTANTS.MILESTONES.TITLE.MAX_LENGTH),
    description: z.string().max(PROJECT_CONSTANTS.MILESTONES.DESCRIPTION.MAX_LENGTH).optional(),
    dueDate: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    status: z.enum(['pending', 'in-progress', 'completed', 'delayed'] as const).default('pending'),
  })).optional().default([]),

  phases: z.array(z.object({
    name: z.string().min(1).max(PROJECT_CONSTANTS.PHASES.NAME.MAX_LENGTH),
    description: z.string().max(PROJECT_CONSTANTS.PHASES.DESCRIPTION.MAX_LENGTH).optional(),
    startDate: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    endDate: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    status: z.enum(['not-started', 'in-progress', 'completed', 'on-hold'] as const).default('not-started'),
  })).optional().default([]),

  deliverables: z.string()
    .optional()
    .transform(val => !val || val.trim() === '' ? undefined : val.trim()),

  risks: z.array(z.object({
    description: z.string().min(1).max(PROJECT_CONSTANTS.RISKS.DESCRIPTION.MAX_LENGTH),
    impact: z.enum(PROJECT_CONSTANTS.RISKS.IMPACT.VALUES).default('medium'),
    probability: z.enum(PROJECT_CONSTANTS.RISKS.PROBABILITY.VALUES).default('medium'),
    mitigation: z.string().max(PROJECT_CONSTANTS.RISKS.MITIGATION.MAX_LENGTH).optional(),
  })).optional().default([]),

  progress: z.object({
    overallProgress: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    completedTasks: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    totalTasks: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    lastUpdated: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    nextMilestone: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    blockers: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
  }).optional(),

  resources: z.object({
    estimatedHours: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    actualHours: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    teamSize: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    tools: z.array(z.string().max(PROJECT_CONSTANTS.RESOURCES.TOOL.MAX_LENGTH)).optional().default([]),
    externalResources: z.array(z.string().max(PROJECT_CONSTANTS.RESOURCES.EXTERNAL_RESOURCE.MAX_LENGTH)).optional().default([]),
  }).optional(),

  qualityMetrics: z.object({
    requirementsCoverage: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    defectDensity: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    customerSatisfaction: z.string().optional().transform(val => !val || val.trim() === '' ? undefined : val.trim()),
    onTimeDelivery: z.boolean().default(false),
    withinBudget: z.boolean().default(false),
  }).optional(),
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
  .omit({ milestones: true, phases: true, risks: true, deliverables: true }) // Remove milestones, phases, risks, and deliverables - handled in dedicated tabs
  .partial()
  .strict()
  .refine(data => {
    // Simplified check - if any top-level field has a truthy value
    const hasUpdate = Object.entries(data).some(([key, value]) => {
      // Skip completely empty values
      if (value === undefined || value === null || value === '') return false;
      
      // For objects, check if they have any meaningful content
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return Object.values(value).some(v => v !== undefined && v !== null && v !== '');
      }
      
      // For arrays, check if not empty
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      
      return true;
    });
    
    console.log('🔍 Validation refine check:', { hasUpdate, data: Object.keys(data) });
    return hasUpdate;
  }, { 
    message: 'At least one field must be provided for update',
    path: ['_form']
  })

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