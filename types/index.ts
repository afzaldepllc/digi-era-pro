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
  department: string | Department // Reference to Department ID or populated Department object
  position?: string
  status: "active" | "inactive" | "suspended"
  permissions: string[]
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
  status: 'active' | 'inactive'
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface DepartmentFilters {
  search?: string
  status?: 'active' | 'inactive' | ''
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
  status?: 'active' | 'inactive'
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
