// Communication types - re-export from communication module
export * from './communication'

// Client types - defined locally to avoid circular imports
export interface Client {
  _id?: string
  name: string
  email: string
  phone?: string
  role: string
  department: string
  position?: string
  status: 'active' | 'inactive' | 'qualified' | 'unqualified'
  permissions: string[]
  isClient: true
  leadId?: string
  clientStatus: 'qualified' | 'unqualified'
  company: string
  projectInterests?: string[]
  industry?: string
  companySize?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  annualRevenue?: string
  employeeCount?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  socialLinks?: {
    linkedin?: string
    twitter?: string
    github?: string
  }
  preferences?: {
    theme: 'light' | 'dark' | 'system'
    language: string
    timezone: string
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
  }
  notes?: string
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
  emailVerified: boolean
  phoneVerified: boolean
  twoFactorEnabled: boolean
}

export interface CreateClientData {
  name: string
  email: string
  phone?: string
  leadId?: string
  company: string
  projectInterests?: string[]
  password?: string
  role?: string
  department?: string
  position?: string
  avatar?: string
  address?: User['address']
  socialLinks?: User['socialLinks']
  preferences?: User['preferences']
  metadata?: User['metadata']
  clientStatus?: 'qualified' | 'unqualified'
  status?: 'active' | 'inactive' | 'qualified' | 'unqualified'
}

export interface UpdateClientData extends Partial<CreateClientData> {
  password?: string
}

export type ClientStatus = 'qualified' | 'unqualified'

export type ClientSortField = 'name' | 'email' | 'company' | 'clientStatus' | 'status' | 'createdAt' | 'updatedAt'

export interface ClientFilters {
  search?: string
  status?: 'active' | 'inactive' | 'qualified' | 'unqualified' | ''
  clientStatus?: 'qualified' | 'unqualified' | ''
  company?: string
  hasLead?: boolean
  qualifiedAfter?: Date
  qualifiedBefore?: Date
}

export interface ClientSort {
  field: ClientSortField
  direction: 'asc' | 'desc'
}

export interface ClientPagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ClientStats {
  totalClients: number
  qualifiedClients: number
  unqualifiedClients: number
  activeClients: number
  newClientsThisMonth: number
  clientsWithProjects: number
}

export interface CreateClientFormData {
  name: string
  email: string
  phone?: string
  position?: string
  company: string
  industry?: string
  companySize?: '' | 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  annualRevenue?: string
  employeeCount?: string
  clientStatus: 'qualified' | 'unqualified'
  status: 'active' | 'inactive' | 'qualified' | 'unqualified'
  projectInterests?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  socialLinks?: {
    linkedin?: string
    twitter?: string
    github?: string
  }
  preferences?: {
    theme: 'light' | 'dark' | 'system'
    language: string
    timezone: string
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
  }
  notes?: string
}

export interface UpdateClientFormData {
  name: string
  email: string
  phone?: string
  position?: string
  company: string
  industry?: string
  companySize?: '' | 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  annualRevenue?: string
  employeeCount?: string
  clientStatus: 'qualified' | 'unqualified'
  status: 'active' | 'inactive' | 'qualified' | 'unqualified'
  projectInterests?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  socialLinks?: {
    linkedin?: string
    twitter?: string
    github?: string
  }
  preferences?: {
    theme: 'light' | 'dark' | 'system'
    language: string
    timezone: string
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
  }
  notes?: string
}

export interface ClientStatusUpdate {
  clientStatus: 'qualified' | 'unqualified'
  status: 'active' | 'inactive' | 'qualified' | 'unqualified'
  reason?: string
}

export interface CreateClientFromLead {
  leadId: string
  createdBy?: string
  password?: string
  projectInterests?: string[]
  notes?: string
}

export interface ClientQueryParams {
  page: number
  limit: number
  search?: string
  clientStatus?: 'qualified' | 'unqualified' | ''
  status?: 'active' | 'inactive' | 'qualified' | 'unqualified' | ''
  hasLead?: boolean
  company?: string
  sortBy: ClientSortField
  sortOrder: 'asc' | 'desc'
  qualifiedAfter?: Date
  qualifiedBefore?: Date
  isClient: true
}

export interface ClientIdParams {
  id: string
}

export interface BulkClientOperation {
  clientIds: string[]
  operation: 'updateStatus' | 'assignProject' | 'bulkNote'
  data?: {
    clientStatus?: 'qualified' | 'unqualified'
    status?: 'active' | 'inactive' | 'qualified' | 'unqualified'
    projectId?: string
    notes?: string
  }
}

// Permission interface
export interface Permission {
  resource: string
  actions: string[]
  conditions?: {
    own?: boolean
    department?: boolean
    assigned?: boolean
    subordinates?: boolean
    unrestricted?: boolean // Add this for full access
  }
  unrestricted?: boolean // Alternative way to grant full access
}

// Role interface
export interface Role {
  _id?: string
  name: string
  displayName: string
  description?: string
  department?: string | Department // Reference to Department ID or populated object
  permissions: Permission[]
  hierarchyLevel: number
  isSystemRole: boolean
  status: "active" | "inactive" | "archived"
  maxUsers?: number
  validityPeriod?: {
    startDate?: Date
    endDate?: Date
  }
  metadata?: {
    createdBy?: string
    updatedBy?: string
    notes?: string
    tags?: string[]
  }
  createdAt?: Date
  updatedAt?: Date
  // Virtual fields
  departmentDetails?: Department
  userCount?: number
}

export interface User {
  _id?: string
  name: string
  email: string
  password?: string
  // role: string | Role // Reference to Role ID or populated Role object
  role: string | Role // Reference to Role ID or populated Role object
  legacyRole?: "admin" | "user" | "manager" | "hr" | "finance" | "sales" // For backward compatibility
  avatar?: string
  phone?: string
  department: Department // Reference to Department ID or populated Department object
  position?: string
  status: "active" | "inactive" | "suspended" | "qualified" | "unqualified" // Extended for clients
  permissions: string[]

  // Client-specific fields (optional for regular users)
  isClient?: boolean // Flag to identify client users
  leadId?: string | Lead // Reference to Lead model (for clients created from leads)
  clientStatus?: "qualified" | "unqualified" // Client-specific status
  company?: string // Client's company name
  projectInterests?: string[] // Areas of interest for projects
  lastLogin?: Date
  emailVerified: boolean
  phoneVerified: boolean
  twoFactorEnabled: boolean
  passwordChangedAt?: Date
  address?: {
    street?: string
    city?: string
    state?: string
    country?: string
    zipCode?: string
  }
  socialLinks?: {
    linkedin?: string
    twitter?: string
    github?: string
  }
  preferences?: {
    theme: "light" | "dark" | "system"
    language: string
    timezone: string
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
  }
  metadata?: {
    createdBy?: string
    updatedBy?: string
    notes?: string
    tags?: string[]
  }
  createdAt?: Date
  updatedAt?: Date
  // Virtual fields
  roleDetails?: Role
  departmentDetails?: Department
  leadDetails?: Lead // For client users
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Department interfaces
export interface Department {
  _id?: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'deleted'
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface DepartmentFilters {
  search?: string
  status?: 'active' | 'inactive' | 'deleted' | ''
}

export interface DepartmentSort {
  field: keyof Department
  direction: 'asc' | 'desc'
}

export interface RoleFilters {
  search?: string
  status?: 'active' | 'inactive' | 'archived' | ''
  department?: string
  hierarchyLevel?: number
  isSystemRole?: boolean
}

export interface RoleSort {
  field: keyof Role
  direction: 'asc' | 'desc'
}

export interface CreateRoleData {
  name: string
  displayName: string
  description?: string
  department: string
  permissions: Permission[]
  hierarchyLevel?: number
  maxUsers?: number
  status?: 'active' | 'inactive' | 'archived'
}

export interface CreateDepartmentData {
  name?: string
  description?: string
  status?: 'active' | 'inactive' | 'deleted'
}

export interface UpdateDepartmentData extends Partial<CreateDepartmentData> {
}

export interface FetchDepartmentsParams {
  page?: number
  limit?: number
  filters?: DepartmentFilters
  sort?: DepartmentSort
}

// Generic Filter types (used by multiple modules)
export interface FilterField {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'number'
  placeholder?: string
  options?: { value: string; label: string }[]
  cols?: number
  smCols?: number
  mdCols?: number
  lgCols?: number
  xlCols?: number
}

export interface FilterConfig {
  fields: FilterField[]
  defaultValues?: Record<string, any>
}

// =============================================================================
// LEAD TYPES
// =============================================================================

export interface Lead {
  _id?: string
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
  status: 'active' | 'inactive' | 'qualified' | 'unqualified' | 'deleted'
  createdBy: string | User // Reference to User (sales agent)
  assignedTo?: string | User // Current assignee
  clientId?: string | User // Reference to User (populated after qualification)

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
  qualifiedBy?: string | User // Reference to User
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
  createdAt?: Date
  updatedAt?: Date

  // Virtual fields (populated)
  createdByDetails?: User
  assignedToDetails?: User
  clientDetails?: User
  qualifiedByDetails?: User
}

export interface CreateLeadData {
  // Client Basic Info Section
  name: string
  email: string
  phone?: string
  company?: string

  // Project Basic Info Section  
  projectName: string
  projectDescription?: string
  projectBudget?: number
  projectTimeline?: string
  projectRequirements?: string[]

  // Lead Management
  status?: 'active' | 'inactive'

  // Lead Source & Tracking
  source?: 'website' | 'referral' | 'cold_call' | 'email' | 'social_media' | 'event' | 'other'
  priority?: 'low' | 'medium' | 'high' | 'urgent'

  // Communication & Notes
  notes?: string
  lastContactDate?: Date
  nextFollowUpDate?: Date

  // Metadata
  tags?: string[]
  customFields?: Record<string, any>
}

export interface UpdateLeadData extends Partial<CreateLeadData> {
  qualifiedBy?: string
  unqualifiedReason?: string
}

export interface LeadFilters {
  search?: string
  status?: 'active' | 'inactive' | 'qualified' | 'unqualified' | ''
  source?: 'website' | 'referral' | 'cold_call' | 'email' | 'social_media' | 'event' | 'other' | ''
  priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
  createdBy?: string
  createdAfter?: Date
  createdBefore?: Date
  minBudget?: number
  maxBudget?: number
  hasFollowUp?: boolean
  followUpOverdue?: boolean
}

export interface LeadSort {
  field: 'name' | 'email' | 'projectName' | 'status' | 'priority' | 'createdAt' | 'updatedAt'
  direction: 'asc' | 'desc'
}

export interface LeadStats {
  totalLeads: number
  activeLeads: number
  qualifiedLeads: number
  unqualifiedLeads: number
  inactiveLeads: number
  totalBudget: number
  averageBudget: number
  conversionRate: number
}

export interface LeadStatusUpdate {
  status: 'active' | 'inactive' | 'qualified' | 'unqualified'
  reason?: string
}

export interface FetchLeadsParams {
  page?: number
  limit?: number
  filters?: LeadFilters
  sort?: LeadSort
}

// =============================================================================
// CLIENT TYPES (Extended User)
// =============================================================================

// All client types are now imported from validations/client.ts
// No local definitions needed

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface LeadListResponse extends ApiResponse {
  data: {
    leads: Lead[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
    stats: LeadStats
    filters: LeadFilters
  }
}

export interface LeadResponse extends ApiResponse {
  data: Lead
}

export interface ClientListResponse extends ApiResponse {
  data: {
    clients: Client[]
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
    stats: ClientStats
    filters: ClientFilters
  }
}

export interface ClientResponse extends ApiResponse {
  data: Client
}

// =============================================================================
// PROJECT TYPES
// =============================================================================

export interface Project {
  _id?: string
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
  createdAt?: string
  updatedAt?: string

  // Professional CRM fields
  budgetBreakdown?: {
    labor?: number
    materials?: number
    equipment?: number
    contingency?: number
    profitMargin?: number
  }

  stakeholders?: {
    clientContact?: string
    projectManager?: string
    teamLead?: string
    keyStakeholders?: string
  }

  milestones?: {
    title: string
    description?: string
    dueDate?: Date
    status: 'pending' | 'in-progress' | 'completed' | 'delayed'
  }[]

  phases?: {
    name: string
    description?: string
    startDate?: Date
    endDate?: Date
    status: 'not-started' | 'in-progress' | 'completed' | 'on-hold'
  }[]

  deliverables?: string

  risks?: {
    description: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    probability: 'low' | 'medium' | 'high'
    mitigation?: string
  }[]

  progress?: {
    overallProgress?: number
    completedTasks?: number
    totalTasks?: number
    lastUpdated?: Date
    nextMilestone?: string
    blockers?: string
  }

  resources?: {
    estimatedHours?: number
    actualHours?: number
    teamSize?: number
    tools?: string[]
    externalResources?: string[]
  }

  qualityMetrics?: {
    requirementsCoverage?: number
    defectDensity?: number
    customerSatisfaction?: number
    onTimeDelivery: boolean
    withinBudget: boolean
  }

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
  departmentTasks?: Array<{
    departmentId: string
    departmentName: string
    taskCount: number
    tasks: Array<{
      _id: string
      title: string
      status: string
    }>
  }>
  creator?: {
    _id: string
    name: string
    email: string
  }
  taskCount?: number
}

export interface ProjectFilters {
  search?: string
  status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive' | ''
  priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
  clientId?: string
  departmentId?: string
}

export interface ProjectSort {
  field: 'name' | 'status' | 'priority' | 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'
  direction: 'asc' | 'desc'
}

export interface CreateProjectData {
  name: string
  description?: string
  clientId: string
  departmentIds?: string[]
  status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  budget?: number
  startDate?: Date
  endDate?: Date
  projectType?: string
  requirements?: string
  timeline?: string
}

export interface CreateProjectFormData {
  name: string
  description?: string
  clientId: string
  departmentIds?: string[]
  status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  budget?: string
  startDate?: string
  endDate?: string
  projectType?: string
  requirements?: string
  timeline?: string
}

export interface UpdateProjectData extends Partial<CreateProjectData> { }

export interface UpdateProjectFormData {
  name?: string
  description?: string
  clientId?: string
  departmentIds?: string[]
  status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  budget?: string
  startDate?: string
  endDate?: string
  projectType?: string
  requirements?: string
  timeline?: string

  // Professional CRM fields
  budgetBreakdown?: {
    labor?: string
    materials?: string
    equipment?: string
    contingency?: string
    profitMargin?: string
  }

  stakeholders?: {
    clientContact?: string
    projectManager?: string
    teamLead?: string
    keyStakeholders?: string
  }

  milestones?: {
    title: string
    description?: string
    dueDate?: string
    status: 'pending' | 'in-progress' | 'completed' | 'delayed'
  }[]

  phases?: {
    name: string
    description?: string
    startDate?: string
    endDate?: string
    status: 'not-started' | 'in-progress' | 'completed' | 'on-hold'
  }[]

  deliverables?: string

  risks?: {
    description: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    probability: 'low' | 'medium' | 'high'
    mitigation?: string
  }[]

  progress?: {
    overallProgress?: string
    completedTasks?: string
    totalTasks?: string
    lastUpdated?: string
    nextMilestone?: string
    blockers?: string
  }

  resources?: {
    estimatedHours?: string
    actualHours?: string
    teamSize?: string
    tools?: string[]
    externalResources?: string[]
  }

  qualityMetrics?: {
    requirementsCoverage?: string
    defectDensity?: string
    customerSatisfaction?: string
    onTimeDelivery: boolean
    withinBudget: boolean
  }
}

export interface DepartmentSort {
  field: keyof Department;
  direction: 'asc' | 'desc';
}

// export interface ProjectFilters {
//   search?: string;
//   status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive' | ''
//   departmentId?: string
//   priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
//   clientId?: string
// }


export interface FetchProjectsParams {
  page?: number
  limit?: number
  filters?: ProjectFilters
  // search?: string
  // status?: 'pending' | 'active' | 'completed' | 'approved' | 'inactive' | ''
  // priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
  // clientId?: string
  // departmentId?: string
  // sort?: 'name' | 'status' | 'priority' | 'createdAt' | 'updatedAt' | 'startDate' | 'endDate'
  sort?: DepartmentSort
}

export interface ProjectStats {
  totalProjects: number
  pendingProjects: number
  activeProjects: number
  completedProjects: number
  approvedProjects: number
  inactiveProjects: number
  lowPriorityProjects: number
  mediumPriorityProjects: number
  highPriorityProjects: number
  urgentPriorityProjects: number
  totalBudget?: number
  averageBudget?: number
}

export interface CategorizeDepartmentsData {
  departmentIds: string[]
}

export interface ProjectPrefillData {
  clientId: string
  leadId?: string
  name?: string
  projectType?: string
  requirements?: string
  timeline?: string
  budget?: number
}

// =============================================================================
// TASK TYPES
// =============================================================================

export interface Task {
  _id?: string
  title: string
  description?: string
  projectId: string
  departmentId: string
  parentTaskId?: string
  assigneeId?: string
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  type: 'task' | 'sub-task'
  estimatedHours?: number
  actualHours?: number
  startDate?: string
  dueDate?: string
  completedAt?: string
  createdBy: string
  assignedBy?: string
  createdAt?: string
  updatedAt?: string

  // Virtual fields
  project?: {
    _id: string
    name: string
    clientId: string
  }
  department?: {
    _id: string
    name: string
  }
  assignee?: {
    _id: string
    name: string
    email: string
  }
  creator?: {
    _id: string
    name: string
    email: string
  }
  assigner?: {
    _id: string
    name: string
    email: string
  }
  parentTask?: {
    _id: string
    title: string
  }
  subTasks?: Task[]
  subTaskCount?: number
}

export interface TaskFilters {
  search?: string
  status?: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled' | ''
  priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
  type?: 'task' | 'sub-task' | ''
  projectId?: string
  departmentId?: string
  assigneeId?: string
  parentTaskId?: string
}

export interface TaskSort {
  field: 'title' | 'status' | 'priority' | 'type' | 'createdAt' | 'updatedAt' | 'dueDate'
  direction: 'asc' | 'desc'
}

export interface CreateTaskData {
  title: string
  description?: string
  projectId: string
  departmentId: string
  parentTaskId?: string
  assigneeId?: string
  status?: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  type?: 'task' | 'sub-task'
  estimatedHours?: number
  actualHours?: number
  startDate?: Date
  dueDate?: Date
}

export interface UpdateTaskData extends Partial<CreateTaskData> { }

export interface FetchTasksParams {
  page?: number
  limit?: number
  search?: string
  status?: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled' | ''
  priority?: 'low' | 'medium' | 'high' | 'urgent' | ''
  type?: 'task' | 'sub-task' | ''
  projectId?: string
  departmentId?: string
  assigneeId?: string
  parentTaskId?: string
  sortBy?: 'title' | 'status' | 'priority' | 'type' | 'createdAt' | 'updatedAt' | 'dueDate'
  sortOrder?: 'asc' | 'desc'
}

export interface TaskStats {
  totalTasks: number
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  onHoldTasks: number
  cancelledTasks: number
  mainTasks: number
  subTasks: number
  lowPriorityTasks: number
  mediumPriorityTasks: number
  highPriorityTasks: number
  urgentPriorityTasks: number
  totalEstimatedHours?: number
  totalActualHours?: number
}

export interface TaskHierarchy {
  _id: string
  title: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  departmentId: string
  assigneeId?: string
  estimatedHours?: number
  actualHours?: number
  dueDate?: string
  createdAt: string

  // Populated fields
  assignee?: {
    _id: string
    name: string
    email: string
  }
  department?: {
    _id: string
    name: string
  }

  // Sub-tasks
  subTasks: Array<{
    _id: string
    title: string
    status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    assigneeId?: string
    dueDate?: string
    createdAt: string
  }>
}
