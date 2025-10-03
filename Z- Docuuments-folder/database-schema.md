# Complete CRM System MongoDB Schema Design

## Database Configuration

### MongoDB Settings
\`\`\`javascript
// Database Configuration
{
  "name": "crm_system",
  "version": "1.0.0",
  "sharding": {
    "enabled": true,
    "shardKey": { "_id": "hashed" }
  },
  "replication": {
    "replicaSet": "crm-replica-set",
    "members": 3
  }
}
\`\`\`

## Enums and Constants

### System Enums
\`\`\`typescript
// User Roles Enum
enum UserRole {
  ADMIN = 'ADMIN',
  SALES = 'SALES',
  SUPPORT = 'SUPPORT',
  IT_MANAGER = 'IT_MANAGER',
  IT_EMPLOYEE = 'IT_EMPLOYEE'
}

// User Status Enum
enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

// Client Status Enum
enum ClientStatus {
  LEAD = 'LEAD',
  PROSPECT = 'PROSPECT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CHURNED = 'CHURNED'
}

// Project Type Enum
enum ProjectType {
  WEB_DEVELOPMENT = 'WEB_DEVELOPMENT',
  GMB = 'GMB',
  SEO = 'SEO',
  GRAPHICS = 'GRAPHICS',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  MOBILE_APP = 'MOBILE_APP',
  ECOMMERCE = 'ECOMMERCE'
}

// Project Status Enum
enum ProjectStatus {
  NEW = 'NEW',
  REQUIREMENTS_GATHERING = 'REQUIREMENTS_GATHERING',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Task Status Enum
enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED'
}

// Priority Enum
enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Notification Type Enum
enum NotificationType {
  CLIENT_ADDED = 'CLIENT_ADDED',
  PROJECT_ASSIGNED = 'PROJECT_ASSIGNED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  STATUS_UPDATED = 'STATUS_UPDATED',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  COMMENT_ADDED = 'COMMENT_ADDED'
}
\`\`\`

## Core Collections

### 1. Users Collection
\`\`\`typescript
interface User {
  _id: ObjectId;
  email: string; // Unique, indexed
  password: string; // Hashed with bcrypt
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  role: UserRole;
  department: ObjectId; // Reference to Department
  designation: string;
  status: UserStatus;
  employeeId: string; // Unique employee identifier
  
  // Authentication & Security
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  
  // Settings
  settings: {
    notifications: {
      email: boolean;
      inApp: boolean;
      sms: boolean;
      desktop: boolean;
    };
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
  };
  
  // Security Meta
  meta: {
    passwordChangedAt?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    totpSecret?: string;
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
    backupCodes?: string[];
  };
  
  // Audit Fields
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
}

// Indexes for Users Collection
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "employeeId": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "department": 1 });
db.users.createIndex({ "status": 1 });
db.users.createIndex({ "meta.passwordResetToken": 1 });
db.users.createIndex({ "createdAt": -1 });
db.users.createIndex({ "firstName": "text", "lastName": "text", "email": "text" });
\`\`\`

### 2. Departments Collection
\`\`\`typescript
interface Department {
  _id: ObjectId;
  name: string;
  code: string; // Unique department code
  description: string;
  head: ObjectId; // Reference to User
  parentDepartment?: ObjectId; // For hierarchical structure
  status: 'ACTIVE' | 'INACTIVE';
  budget?: {
    allocated: number;
    spent: number;
    currency: string;
  };
  
  // Audit Fields
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for Departments Collection
db.departments.createIndex({ "code": 1 }, { unique: true });
db.departments.createIndex({ "name": 1 });
db.departments.createIndex({ "head": 1 });
db.departments.createIndex({ "parentDepartment": 1 });
db.departments.createIndex({ "status": 1 });
\`\`\`

### 3. Roles Collection
\`\`\`typescript
interface Role {
  _id: ObjectId;
  name: UserRole;
  displayName: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean; // Cannot be deleted
  
  // Audit Fields
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface Permission {
  resource: string; // clients, projects, tasks, users, etc.
  actions: ('create' | 'read' | 'update' | 'delete' | 'assign')[];
  conditions?: {
    own?: boolean; // Can only access own records
    department?: boolean; // Can access department records
    assigned?: boolean; // Can access assigned records
  };
}

// Indexes for Roles Collection
db.roles.createIndex({ "name": 1 }, { unique: true });
\`\`\`

### 4. Clients Collection
\`\`\`typescript
interface Client {
  _id: ObjectId;
  companyName: string;
  industry: string;
  website?: string;
  logo?: string;
  
  // Address Information
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  
  // Contact Information
  contacts: [{
    _id: ObjectId; // Unique contact ID
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
    isPrimary: boolean;
  }];
  
  // Business Information
  businessInfo: {
    size: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
    revenue?: number;
    employees?: number;
    foundedYear?: number;
  };
  
  // CRM Specific
  assignedTo: ObjectId; // Reference to User (Sales Rep)
  status: ClientStatus;
  source: 'WEBSITE' | 'REFERRAL' | 'COLD_CALL' | 'SOCIAL_MEDIA' | 'ADVERTISEMENT' | 'OTHER';
  leadScore?: number; // 0-100
  tags: string[];
  
  // Financial Information
  billing: {
    currency: string;
    paymentTerms?: string;
    creditLimit?: number;
    totalRevenue: number;
  };
  
  // Custom Fields for flexibility
  customFields: Record<string, any>;
  
  // Audit Fields
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
}

// Indexes for Clients Collection
db.clients.createIndex({ "companyName": "text" });
db.clients.createIndex({ "contacts.email": 1 });
db.clients.createIndex({ "assignedTo": 1 });
db.clients.createIndex({ "status": 1 });
db.clients.createIndex({ "source": 1 });
db.clients.createIndex({ "industry": 1 });
db.clients.createIndex({ "createdAt": -1 });
db.clients.createIndex({ "leadScore": -1 });
db.clients.createIndex({ "tags": 1 });
\`\`\`

### 5. Projects Collection
\`\`\`typescript
interface Project {
  _id: ObjectId;
  clientId: ObjectId; // Reference to Client
  name: string;
  description: string;
  type: ProjectType;
  category: string;
  priority: Priority;
  status: ProjectStatus;
  
  // Financial Information
  budget: {
    estimated: number;
    approved: number;
    spent: number;
    currency: string;
  };
  
  // Timeline Information
  timeline: {
    startDate: Date;
    endDate: Date;
    actualStartDate?: Date;
    actualEndDate?: Date;
    completedDate?: Date;
  };
  
  // Team Assignment
  assignedTeam: {
    salesRep: ObjectId; // Reference to User
    supportRep: ObjectId; // Reference to User
    itManager: ObjectId; // Reference to User
    itEmployees: ObjectId[]; // References to Users
  };
  
  // Requirements and Documentation
  requirements: {
    description: string;
    technicalSpecs?: string;
    documents: [{
      _id: ObjectId;
      name: string;
      url: string;
      type: string;
      size: number;
      uploadedBy: ObjectId;
      uploadedAt: Date;
    }];
  };
  
  // Communication History
  communications: [{
    _id: ObjectId;
    type: 'EMAIL' | 'INTERNAL_NOTE' | 'CLIENT_MESSAGE' | 'PHONE_CALL' | 'MEETING';
    sender: ObjectId;
    recipients?: ObjectId[];
    subject?: string;
    message: string;
    attachments?: [{
      name: string;
      url: string;
      size: number;
    }];
    isInternal: boolean;
    timestamp: Date;
  }];
  
  // Project Milestones
  milestones: [{
    _id: ObjectId;
    name: string;
    description: string;
    dueDate: Date;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
    completedAt?: Date;
    completedBy?: ObjectId;
    progress: number; // 0-100
  }];
  
  // Progress Tracking
  progress: {
    overall: number; // 0-100
    phases: [{
      name: string;
      progress: number;
      status: string;
    }];
  };
  
  // Metadata
  metadata: {
    createdBy: ObjectId;
    lastModifiedBy: ObjectId;
    source: string;
    tags: string[];
    isArchived: boolean;
  };
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
}

// Indexes for Projects Collection
db.projects.createIndex({ "clientId": 1 });
db.projects.createIndex({ "status": 1 });
db.projects.createIndex({ "type": 1 });
db.projects.createIndex({ "priority": 1 });
db.projects.createIndex({ "assignedTeam.salesRep": 1 });
db.projects.createIndex({ "assignedTeam.supportRep": 1 });
db.projects.createIndex({ "assignedTeam.itManager": 1 });
db.projects.createIndex({ "assignedTeam.itEmployees": 1 });
db.projects.createIndex({ "timeline.startDate": 1 });
db.projects.createIndex({ "timeline.endDate": 1 });
db.projects.createIndex({ "createdAt": -1 });
db.projects.createIndex({ "name": "text", "description": "text" });
\`\`\`

### 6. Tasks Collection
\`\`\`typescript
interface Task {
  _id: ObjectId;
  projectId: ObjectId; // Reference to Project
  parentTaskId?: ObjectId; // For subtasks
  title: string;
  description: string;
  type: 'DEVELOPMENT' | 'DESIGN' | 'TESTING' | 'DEPLOYMENT' | 'RESEARCH' | 'DOCUMENTATION';
  status: TaskStatus;
  priority: Priority;
  
  // Assignment Information
  assignedTo: ObjectId; // Reference to User
  assignedBy: ObjectId; // Reference to User
  assignedAt: Date;
  
  // Time Tracking
  timeTracking: {
    estimatedHours: number;
    actualHours: number;
    startTime?: Date;
    endTime?: Date;
  };
  
  // Timeline
  timeline: {
    dueDate: Date;
    startDate?: Date;
    completedDate?: Date;
  };
  
  // Progress and Dependencies
  progress: number; // 0-100
  dependencies: ObjectId[]; // References to other Tasks
  blockers: [{
    description: string;
    createdAt: Date;
    resolvedAt?: Date;
  }];
  
  // Comments and Updates
  comments: [{
    _id: ObjectId;
    userId: ObjectId;
    message: string;
    attachments?: [{
      name: string;
      url: string;
    }];
    isInternal: boolean;
    createdAt: Date;
  }];
  
  // Labels and Tags
  labels: string[];
  tags: string[];
  
  // Visibility Control
  visibility: {
    visibleToRoles: UserRole[];
    visibleToUsers?: ObjectId[];
    isPublic: boolean;
  };
  
  // Audit Fields
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
}

// Indexes for Tasks Collection
db.tasks.createIndex({ "projectId": 1 });
db.tasks.createIndex({ "assignedTo": 1 });
db.tasks.createIndex({ "assignedBy": 1 });
db.tasks.createIndex({ "status": 1 });
db.tasks.createIndex({ "priority": 1 });
db.tasks.createIndex({ "timeline.dueDate": 1 });
db.tasks.createIndex({ "parentTaskId": 1 });
db.tasks.createIndex({ "dependencies": 1 });
db.tasks.createIndex({ "createdAt": -1 });
db.tasks.createIndex({ "title": "text", "description": "text" });
\`\`\`

### 7. Notifications Collection
\`\`\`typescript
interface Notification {
  _id: ObjectId;
  recipientId: ObjectId; // Reference to User
  senderId?: ObjectId; // Reference to User who triggered
  type: NotificationType;
  title: string;
  message: string;
  
  // Related Entity Information
  entityType: 'CLIENT' | 'PROJECT' | 'TASK' | 'USER';
  entityId: ObjectId;
  
  // Notification Channels
  channels: {
    inApp: {
      sent: boolean;
      readAt?: Date;
    };
    email: {
      sent: boolean;
      sentAt?: Date;
      emailId?: string;
    };
    sms: {
      sent: boolean;
      sentAt?: Date;
      smsId?: string;
    };
  };
  
  // Priority and Scheduling
  priority: Priority;
  scheduledFor?: Date;
  expiresAt?: Date;
  
  // Action Information
  actionUrl?: string;
  actionText?: string;
  
  // Status
  isRead: boolean;
  isArchived: boolean;
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for Notifications Collection
db.notifications.createIndex({ "recipientId": 1 });
db.notifications.createIndex({ "type": 1 });
db.notifications.createIndex({ "isRead": 1 });
db.notifications.createIndex({ "createdAt": -1 });
db.notifications.createIndex({ "entityType": 1, "entityId": 1 });
db.notifications.createIndex({ "scheduledFor": 1 });
db.notifications.createIndex({ "expiresAt": 1 });
\`\`\`

### 8. Client Portal Collection
\`\`\`typescript
interface ClientPortal {
  _id: ObjectId;
  clientId: ObjectId; // Reference to Client
  
  // Portal Users (Client-side users)
  portalUsers: [{
    _id: ObjectId;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'REGULAR' | 'VIEWER';
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_INVITATION';
    lastLogin?: Date;
    invitedAt: Date;
    invitedBy: ObjectId;
  }];
  
  // Portal Settings
  settings: {
    enableNotifications: boolean;
    allowProjectCreation: boolean;
    allowFileUpload: boolean;
    allowComments: boolean;
    maxFileSize: number; // in MB
    allowedFileTypes: string[];
  };
  
  // Branding
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };
  
  // Access Control
  accessToken?: string;
  
  // Audit Fields
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for Client Portal Collection
db.clientPortals.createIndex({ "clientId": 1 }, { unique: true });
db.clientPortals.createIndex({ "portalUsers.email": 1 });
\`\`\`

### 9. Activity Logs Collection
\`\`\`typescript
interface ActivityLog {
  _id: ObjectId;
  userId: ObjectId; // Reference to User who performed the action
  
  // Entity Information
  entityType: 'USER' | 'CLIENT' | 'PROJECT' | 'TASK' | 'NOTIFICATION' | 'ROLE' | 'DEPARTMENT';
  entityId: ObjectId; // Reference to the affected entity
  
  // Action Information
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'UNASSIGNED' | 'VIEWED' | 'DOWNLOADED';
  
  // Change Details
  changes: {
    field?: string;
    previousValue?: any;
    newValue?: any;
    description: string;
  }[];
  
  // Request Information
  requestInfo: {
    ipAddress: string;
    userAgent: string;
    method: string;
    endpoint: string;
  };
  
  // Additional Context
  metadata: {
    source: 'WEB' | 'MOBILE' | 'API' | 'SYSTEM';
    sessionId?: string;
    correlationId?: string;
  };
  
  // Timestamp
  timestamp: Date;
}

// Indexes for Activity Logs Collection
db.activityLogs.createIndex({ "userId": 1 });
db.activityLogs.createIndex({ "entityType": 1 });
db.activityLogs.createIndex({ "entityId": 1 });
db.activityLogs.createIndex({ "action": 1 });
db.activityLogs.createIndex({ "timestamp": -1 });
db.activityLogs.createIndex({ "entityType": 1, "entityId": 1, "timestamp": -1 });
\`\`\`

### 10. Comments Collection
\`\`\`typescript
interface Comment {
  _id: ObjectId;
  
  // Entity Reference
  entityType: 'PROJECT' | 'TASK' | 'CLIENT';
  entityId: ObjectId;
  
  // Comment Information
  content: string;
  authorId: ObjectId; // Reference to User
  parentCommentId?: ObjectId; // For threaded comments
  
  // Attachments
  attachments: [{
    _id: ObjectId;
    name: string;
    url: string;
    type: string;
    size: number;
  }];
  
  // Mentions
  mentions: ObjectId[]; // References to Users mentioned
  
  // Status
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  
  // Visibility
  isInternal: boolean; // Internal comments not visible to clients
  visibleToClient: boolean;
  
  // Reactions
  reactions: [{
    userId: ObjectId;
    type: 'LIKE' | 'LOVE' | 'THUMBS_UP' | 'THUMBS_DOWN';
    createdAt: Date;
  }];
  
  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for Comments Collection
db.comments.createIndex({ "entityType": 1, "entityId": 1 });
db.comments.createIndex({ "authorId": 1 });
db.comments.createIndex({ "parentCommentId": 1 });
db.comments.createIndex({ "createdAt": -1 });
db.comments.createIndex({ "mentions": 1 });
\`\`\`

### 11. File Storage Collection
\`\`\`typescript
interface FileStorage {
  _id: ObjectId;
  
  // File Information
  originalName: string;
  fileName: string; // Stored file name
  mimeType: string;
  size: number; // in bytes
  
  // Storage Information
  storageProvider: 'FIREBASE' | 'AWS_S3' | 'LOCAL';
  storagePath: string;
  publicUrl?: string;
  
  // Entity Reference
  entityType: 'PROJECT' | 'TASK' | 'CLIENT' | 'USER' | 'COMMENT';
  entityId: ObjectId;
  
  // Upload Information
  uploadedBy: ObjectId; // Reference to User
  uploadedAt: Date;
  
  // File Metadata
  metadata: {
    width?: number; // For images
    height?: number; // For images
    duration?: number; // For videos/audio
    pages?: number; // For documents
  };
  
  // Access Control
  isPublic: boolean;
  allowedRoles: UserRole[];
  allowedUsers?: ObjectId[];
  
  // Status
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  
  // Virus Scan Results
  scanResults?: {
    isClean: boolean;
    scannedAt: Date;
    scanProvider: string;
  };
}

// Indexes for File Storage Collection
db.fileStorage.createIndex({ "entityType": 1, "entityId": 1 });
db.fileStorage.createIndex({ "uploadedBy": 1 });
db.fileStorage.createIndex({ "fileName": 1 });
db.fileStorage.createIndex({ "mimeType": 1 });
db.fileStorage.createIndex({ "uploadedAt": -1 });
\`\`\`

### 12. Settings Collection
\`\`\`typescript
interface SystemSettings {
  _id: ObjectId;
  category: 'GENERAL' | 'EMAIL' | 'SMS' | 'SECURITY' | 'INTEGRATION' | 'NOTIFICATION';
  key: string;
  value: any;
  dataType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY';
  description: string;
  isEncrypted: boolean;
  
  // Access Control
  editableByRoles: UserRole[];
  visibleToRoles: UserRole[];
  
  // Validation
  validation?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  
  // Audit Fields
  createdBy: ObjectId;
  updatedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes for Settings Collection
db.settings.createIndex({ "category": 1, "key": 1 }, { unique: true });
db.settings.createIndex({ "category": 1 });
\`\`\`

## Advanced Indexes and Optimization

### Compound Indexes for Complex Queries
\`\`\`javascript
// User dashboard queries
db.projects.createIndex({ 
  "assignedTeam.itEmployees": 1, 
  "status": 1, 
  "priority": 1 
});

// Task assignment queries
db.tasks.createIndex({ 
  "assignedTo": 1, 
  "status": 1, 
  "timeline.dueDate": 1 
});

// Client search and filtering
db.clients.createIndex({ 
  "assignedTo": 1, 
  "status": 1, 
  "createdAt": -1 
});

// Activity log queries
db.activityLogs.createIndex({ 
  "userId": 1, 
  "timestamp": -1, 
  "entityType": 1 
});

// Notification queries
db.notifications.createIndex({ 
  "recipientId": 1, 
  "isRead": 1, 
  "createdAt": -1 
});

// Project timeline queries
db.projects.createIndex({ 
  "timeline.endDate": 1, 
  "status": 1, 
  "priority": 1 
});
\`\`\`

### Text Search Indexes
\`\`\`javascript
// Global search functionality
db.clients.createIndex({ 
  "companyName": "text", 
  "contacts.firstName": "text", 
  "contacts.lastName": "text", 
  "contacts.email": "text" 
});

db.projects.createIndex({ 
  "name": "text", 
  "description": "text", 
  "requirements.description": "text" 
});

db.tasks.createIndex({ 
  "title": "text", 
  "description": "text" 
});

db.users.createIndex({ 
  "firstName": "text", 
  "lastName": "text", 
  "email": "text", 
  "employeeId": "text" 
});
\`\`\`

## Sharding Strategy

### Shard Key Selection
\`\`\`javascript
// Users Collection - Hash sharding on _id
sh.shardCollection("crm_system.users", { "_id": "hashed" });

// Clients Collection - Range sharding on assignedTo for better query performance
sh.shardCollection("crm_system.clients", { "assignedTo": 1, "_id": 1 });

// Projects Collection - Range sharding on clientId
sh.shardCollection("crm_system.projects", { "clientId": 1, "_id": 1 });

// Tasks Collection - Range sharding on projectId
sh.shardCollection("crm_system.tasks", { "projectId": 1, "_id": 1 });

// Activity Logs - Range sharding on timestamp for time-based queries
sh.shardCollection("crm_system.activityLogs", { "timestamp": 1, "_id": 1 });

// Notifications - Range sharding on recipientId
sh.shardCollection("crm_system.notifications", { "recipientId": 1, "_id": 1 });
\`\`\`

## Data Validation Rules

### MongoDB Schema Validation
\`\`\`javascript
// Users Collection Validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "firstName", "lastName", "role", "status"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        role: {
          enum: ["ADMIN", "SALES", "SUPPORT", "IT_MANAGER", "IT_EMPLOYEE"]
        },
        status: {
          enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]
        }
      }
    }
  }
});

// Projects Collection Validation
db.createCollection("projects", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["clientId", "name", "type", "status", "priority"],
      properties: {
        type: {
          enum: ["WEB_DEVELOPMENT", "GMB", "SEO", "GRAPHICS", "SOCIAL_MEDIA", "MOBILE_APP", "ECOMMERCE"]
        },
        status: {
          enum: ["NEW", "REQUIREMENTS_GATHERING", "IN_PROGRESS", "REVIEW", "ON_HOLD", "COMPLETED", "CANCELLED"]
        },
        priority: {
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"]
        }
      }
    }
  }
});
\`\`\`

## Performance Optimization Guidelines

### 1. Query Optimization
- Use projection to limit returned fields
- Implement pagination for large result sets
- Use aggregation pipeline for complex queries
- Cache frequently accessed data

### 2. Index Optimization
- Monitor index usage with `db.collection.getIndexes()`
- Remove unused indexes to improve write performance
- Use partial indexes for conditional queries
- Implement TTL indexes for temporary data

### 3. Connection Optimization
- Use connection pooling
- Implement read preferences for replica sets
- Use write concerns appropriately
- Monitor connection metrics

### 4. Data Archiving Strategy
\`\`\`javascript
// Archive old activity logs (older than 2 years)
db.activityLogs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 63072000 });

// Archive completed projects (older than 1 year)
db.projects.createIndex({ 
  "updatedAt": 1 
}, { 
  expireAfterSeconds: 31536000,
  partialFilterExpression: { "status": "COMPLETED" }
});
\`\`\`

## Security Considerations

### 1. Field-Level Encryption
\`\`\`javascript
// Encrypt sensitive fields
const encryptedFields = {
  "users.password": true,
  "users.meta.totpSecret": true,
  "users.meta.backupCodes": true,
  "clients.customFields.ssn": true,
  "clients.customFields.taxId": true
};
\`\`\`

### 2. Role-Based Access Control
\`\`\`javascript
// Database roles for different user types
db.createRole({
  role: "salesRole",
  privileges: [
    { resource: { db: "crm_system", collection: "clients" }, actions: ["find", "insert", "update"] },
    { resource: { db: "crm_system", collection: "projects" }, actions: ["find"] }
  ],
  roles: []
});

db.createRole({
  role: "supportRole",
  privileges: [
    { resource: { db: "crm_system", collection: "clients" }, actions: ["find", "update"] },
    { resource: { db: "crm_system", collection: "projects" }, actions: ["find", "insert", "update"] },
    { resource: { db: "crm_system", collection: "tasks" }, actions: ["find"] }
  ],
  roles: []
});
\`\`\`

## Backup and Recovery Strategy

### 1. Backup Configuration
\`\`\`javascript
// Automated backup script
{
  "backupSchedule": "0 2 * * *", // Daily at 2 AM
  "retentionPolicy": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12
  },
  "compressionEnabled": true,
  "encryptionEnabled": true
}
\`\`\`

### 2. Point-in-Time Recovery
- Enable oplog for point-in-time recovery
- Regular backup testing and validation
- Disaster recovery procedures documentation

This comprehensive MongoDB schema design provides a robust foundation for your CRM system with proper normalization, indexing strategies, security considerations, and scalability features. The schema supports all the modules mentioned in your requirements while maintaining optimal performance for CRUD operations.
\`\`\`

I've created a comprehensive MongoDB schema for your CRM system that includes all the modules from your requirements. The schema features proper enums for type safety, strategic indexing for optimal query performance, normalization where appropriate, and advanced MongoDB features like sharding and validation rules. This design supports role-based access control, audit logging, real-time notifications, and scalable architecture suitable for enterprise-level CRM operations.