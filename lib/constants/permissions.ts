/**
 * ========================================
 * CENTRALIZED PERMISSION SYSTEM
 * ========================================
 * Single source of truth for ALL permissions in the application
 * This replaces multiple permission files with one unified system
 */

// ===== CORE PERMISSION BUILDING BLOCKS =====
export const RESOURCES = {
  USERS: 'users',
  ROLES: 'roles',
  DEPARTMENTS: 'departments',
  PERMISSIONS: 'permissions',
  SYSTEM: 'system',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  LEADS: 'leads',
  PROPOSALS: 'proposals',
  REPORTS: 'reports',
  DASHBOARD: 'dashboard',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  BACKUP: 'backup',
} as const

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  ASSIGN: 'assign',
  APPROVE: 'approve',
  REJECT: 'reject',
  EXPORT: 'export',
  IMPORT: 'import',
  ARCHIVE: 'archive',
  MANAGE: 'manage',
  CONFIGURE: 'configure',
  AUDIT: 'audit',
} as const

export const CONDITIONS = {
  OWN: 'own',
  DEPARTMENT: 'department',
  ASSIGNED: 'assigned',
  SUBORDINATES: 'subordinates',
  UNRESTRICTED: 'unrestricted',
} as const

// ===== PERMISSION INTERFACES =====
export interface PermissionCheck {
  resource: string
  action: string
  condition?: 'own' | 'department' | 'assigned' | 'subordinates' | 'unrestricted'
}

// ===== MAIN PERMISSION DEFINITIONS =====
/**
 * All application permissions defined in one place
 * Simple, direct object definitions - no unnecessary function calls
 */
export const PERMISSIONS = {
  // ===== DEPARTMENT PERMISSIONS =====
  DEPARTMENTS_READ: { resource: 'departments', action: 'read' },
  DEPARTMENTS_CREATE: { resource: 'departments', action: 'create' },
  DEPARTMENTS_UPDATE: { resource: 'departments', action: 'update' },
  DEPARTMENTS_DELETE: { resource: 'departments', action: 'delete'  },

  // ===== PROFILE PERMISSIONS =====
  PROFILE_READ: { resource: 'profile', action: 'read' },
  PROFILE_UPDATE: { resource: 'profile', action: 'update' },

  
  // ===== ROLE PERMISSIONS =====
  ROLES_READ: { resource: 'roles', action: 'read' },
  ROLES_CREATE: { resource: 'roles', action: 'create' },
  ROLES_UPDATE: { resource: 'roles', action: 'update' },
  ROLES_DELETE: { resource: 'roles', action: 'delete' },
  ROLES_ASSIGN: { resource: 'roles', action: 'assign' },
  
  // ===== USER PERMISSIONS =====
  USERS_READ: { resource: 'users', action: 'read' },
  USERS_CREATE: { resource: 'users', action: 'create' },
  USERS_UPDATE: { resource: 'users', action: 'update' },
  USERS_DELETE: { resource: 'users', action: 'delete' },
  USERS_ASSIGN: { resource: 'users', action: 'assign' },
  
  // ===== PROJECT PERMISSIONS =====
  PROJECTS_READ: { resource: 'projects', action: 'read' },
  PROJECTS_CREATE: { resource: 'projects', action: 'create' },
  PROJECTS_UPDATE: { resource: 'projects', action: 'update' },
  PROJECTS_DELETE: { resource: 'projects', action: 'delete' },
  PROJECTS_ASSIGN: { resource: 'projects', action: 'assign' },
  
  // ===== TASK PERMISSIONS =====
  TASKS_READ: { resource: 'tasks', action: 'read' },
  TASKS_CREATE: { resource: 'tasks', action: 'create' },
  TASKS_UPDATE: { resource: 'tasks', action: 'update' },
  TASKS_DELETE: { resource: 'tasks', action: 'delete' },
  TASKS_ASSIGN: { resource: 'tasks', action: 'assign' },
  
  // ===== LEAD PERMISSIONS =====
  LEADS_READ: { resource: 'leads', action: 'read' },
  LEADS_CREATE: { resource: 'leads', action: 'create' },
  LEADS_UPDATE: { resource: 'leads', action: 'update' },
  LEADS_DELETE: { resource: 'leads', action: 'delete' },
  LEADS_ASSIGN: { resource: 'leads', action: 'assign' },
  
  // ===== PROPOSAL PERMISSIONS =====
  PROPOSALS_READ: { resource: 'proposals', action: 'read' },
  PROPOSALS_CREATE: { resource: 'proposals', action: 'create' },
  PROPOSALS_UPDATE: { resource: 'proposals', action: 'update' },
  PROPOSALS_DELETE: { resource: 'proposals', action: 'delete' },
  PROPOSALS_ASSIGN: { resource: 'proposals', action: 'assign' },
  
  // ===== SYSTEM PERMISSIONS =====
  SYSTEM_READ: { resource: 'system', action: 'read' },
  SYSTEM_MANAGE: { resource: 'system', action: 'manage' },
  SYSTEM_CONFIGURE: { resource: 'system', action: 'configure' },
  SYSTEM_AUDIT: { resource: 'system', action: 'audit' },
  
  // ===== PERMISSION MANAGEMENT =====
  PERMISSIONS_READ: { resource: 'permissions', action: 'read' },
  PERMISSIONS_MANAGE: { resource: 'permissions', action: 'manage' },
  
  // ===== DASHBOARD & REPORTS =====
  DASHBOARD_READ: { resource: 'dashboard', action: 'read' },
  DASHBOARD_EXPORT: { resource: 'dashboard', action: 'export' },
  
  REPORTS_READ: { resource: 'reports', action: 'read' },
  REPORTS_CREATE: { resource: 'reports', action: 'create' },
  REPORTS_UPDATE: { resource: 'reports', action: 'update' },
  REPORTS_DELETE: { resource: 'reports', action: 'delete' },
  REPORTS_EXPORT: { resource: 'reports', action: 'export' },
  
  // ===== AUDIT & SETTINGS =====
  AUDIT_LOGS_READ: { resource: 'audit_logs', action: 'read' },
  AUDIT_LOGS_EXPORT: { resource: 'audit_logs', action: 'export' },
  AUDIT_LOGS_ARCHIVE: { resource: 'audit_logs', action: 'archive' },
  
  SETTINGS_READ: { resource: 'settings', action: 'read' },
  SETTINGS_UPDATE: { resource: 'settings', action: 'update' },
  
  BACKUP_CREATE: { resource: 'backup', action: 'create' },
  BACKUP_READ: { resource: 'backup', action: 'read' },
  BACKUP_EXPORT: { resource: 'backup', action: 'export' },
  BACKUP_IMPORT: { resource: 'backup', action: 'import' },
} as const

/**
 * Alias for the main permissions - keeps existing code working
 * Now both PERMISSIONS and COMMON_PERMISSIONS point to the same clean structure
 */
export const COMMON_PERMISSIONS = PERMISSIONS