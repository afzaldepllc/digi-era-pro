// Load environment variables
import { config } from 'dotenv'
import path from 'path'

// Load .env.local file
config({ path: path.resolve(process.cwd(), '.env.local') })

import connectDB from "../lib/mongodb"
import SystemPermission from "../../models/SystemPermission"

// Define all system permissions with their available actions and conditions
const systemPermissions = [
  // User Management Permissions
  {
    resource: "users",
    displayName: "User Management",
    description: "Manage user accounts and profiles",
    category: "user_management",
    availableActions: [
      { action: "create", description: "Create new users", conditions: ["department", "subordinates"] },
      { action: "read", description: "View user information", conditions: ["own", "department", "subordinates", "all"] },
      { action: "update", description: "Update user information", conditions: ["own", "department", "subordinates", "all"] },
      { action: "delete", description: "Delete/deactivate users", conditions: ["department", "subordinates"] },
      { action: "assign", description: "Assign users to roles or departments", conditions: ["department", "subordinates"] },
    ],
    isCore: true
  },

  // Department Management Permissions
  {
    resource: "departments",
    displayName: "Department Management",
    description: "Manage organizational departments",
    category: "department_management",
    availableActions: [
      { action: "create", description: "Create new departments" },
      { action: "read", description: "View department information", conditions: ["own", "all"] },
      { action: "update", description: "Update department information", conditions: ["own", "all"] },
      { action: "delete", description: "Delete/deactivate departments" },
      { action: "assign", description: "Assign users to departments" },
    ],
    isCore: true
  },

  // Role Management Permissions
  {
    resource: "roles",
    displayName: "Role Management",
    description: "Manage user roles and permissions",
    category: "role_management",
    availableActions: [
      { action: "create", description: "Create new roles", conditions: ["department"] },
      { action: "read", description: "View role information", conditions: ["department", "all"] },
      { action: "update", description: "Update role permissions", conditions: ["department", "all"] },
      { action: "delete", description: "Delete roles", conditions: ["department"] },
      { action: "assign", description: "Assign roles to users", conditions: ["department", "subordinates"] },
    ],
    isCore: true
  },

  // System Administration Permissions
  {
    resource: "system",
    displayName: "System Administration",
    description: "System-wide configuration and maintenance",
    category: "system_administration",
    availableActions: [
      { action: "read", description: "View system information" },
      { action: "update", description: "Update system configuration" },
      { action: "archive", description: "Archive system data" },
      { action: "export", description: "Export system data" },
      { action: "import", description: "Import system data" },
    ],
    isCore: true
  },

  // Audit and Security Permissions
  {
    resource: "audit_logs",
    displayName: "Audit Logs",
    description: "View and manage audit logs",
    category: "security",
    availableActions: [
      { action: "read", description: "View audit logs", conditions: ["department", "all"] },
      { action: "export", description: "Export audit logs" },
      { action: "archive", description: "Archive old audit logs" },
    ],
    isCore: true
  },

  // Reporting Permissions
  {
    resource: "reports",
    displayName: "Reports and Analytics",
    description: "Generate and view system reports",
    category: "reporting",
    availableActions: [
      { action: "create", description: "Generate reports", conditions: ["department", "all"] },
      { action: "read", description: "View reports", conditions: ["own", "department", "all"] },
      { action: "update", description: "Modify existing reports", conditions: ["own", "department"] },
      { action: "delete", description: "Delete reports", conditions: ["own", "department"] },
      { action: "export", description: "Export report data" },
    ],
    isCore: true
  },

  // Profile Management Permissions
  {
    resource: "profile",
    displayName: "Profile Management",
    description: "Manage personal profile and settings",
    category: "user_management",
    availableActions: [
      { action: "read", description: "View own profile", conditions: ["own"] },
      { action: "update", description: "Update own profile", conditions: ["own"] },
    ],
    isCore: true
  },

  // Dashboard and Analytics
  {
    resource: "dashboard",
    displayName: "Dashboard Access",
    description: "Access to various dashboard views",
    category: "reporting",
    availableActions: [
      { action: "read", description: "View dashboard", conditions: ["own", "department", "all"] },
    ],
    isCore: true
  },

  // Settings and Preferences
  {
    resource: "settings",
    displayName: "System Settings",
    description: "Manage application settings",
    category: "system_administration",
    availableActions: [
      { action: "read", description: "View settings", conditions: ["own", "department", "all"] },
      { action: "update", description: "Update settings", conditions: ["own", "department", "all"] },
    ],
    isCore: true
  },

  // Backup and Recovery
  {
    resource: "backup",
    displayName: "Backup and Recovery",
    description: "System backup and data recovery operations",
    category: "system_administration",
    availableActions: [
      { action: "create", description: "Create system backups" },
      { action: "read", description: "View backup status" },
      { action: "export", description: "Export backup files" },
      { action: "import", description: "Import/restore from backups" },
    ],
    isCore: true
  },

  // Debug and Testing (for development/testing purposes)
  {
    resource: "debug",
    displayName: "Debug and Testing",
    description: "Debug endpoints for testing permissions and authentication",
    category: "system_administration",
    availableActions: [
      { action: "read", description: "Access debug information and test endpoints" },
    ],
    isCore: false
  }
]

export async function seedSystemPermissions() {
  try {
    console.log('🌱 Starting system permissions seeding...')
    
    await connectDB()

    // Get existing permissions
    const existingPermissions = await SystemPermission.find({}).lean()
    const existingResources = new Set(existingPermissions.map(p => p.resource))

    let created = 0
    let updated = 0
    let skipped = 0

    for (const permissionData of systemPermissions) {
      if (existingResources.has(permissionData.resource)) {
        // Update existing permission
        const existing = existingPermissions.find(p => p.resource === permissionData.resource)
        if (existing) {
          // Only update if there are meaningful changes
          const hasChanges = 
            existing.displayName !== permissionData.displayName ||
            existing.description !== permissionData.description ||
            JSON.stringify(existing.availableActions) !== JSON.stringify(permissionData.availableActions)

          if (hasChanges) {
            await SystemPermission.findByIdAndUpdate(existing._id, {
              ...permissionData,
              'metadata.updatedBy': 'system_seeder',
              'metadata.version': '2.0.0'
            })
            updated++
            console.log(`📝 Updated permission: ${permissionData.resource}`)
          } else {
            skipped++
            console.log(`⏭️  Skipped permission (no changes): ${permissionData.resource}`)
          }
        }
      } else {
        // Create new permission
        const permission = new SystemPermission({
          ...permissionData,
          metadata: {
            createdBy: 'system_seeder',
            version: '1.0.0'
          }
        })
        await permission.save()
        created++
        console.log(`✅ Created permission: ${permissionData.resource}`)
      }
    }

    // Summary
    console.log('\n📊 System Permissions Seeding Summary:')
    console.log(`✅ Created: ${created}`)
    console.log(`📝 Updated: ${updated}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`📊 Total Permissions: ${created + updated + skipped}`)

    // Get category statistics
    const categoryStats = await SystemPermission.aggregate([
      { $match: { status: 'active' } },
      { $group: {
        _id: '$category',
        count: { $sum: 1 },
        coreCount: { $sum: { $cond: ['$isCore', 1, 0] } }
      }},
      { $sort: { _id: 1 } }
    ])

    console.log('\n📋 Permissions by Category:')
    categoryStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} (${stat.coreCount} core)`)
    })

    console.log('\n🎉 System permissions seeding completed successfully!')
    return {
      success: true,
      created,
      updated,
      skipped,
      total: created + updated + skipped,
      categoryStats
    }

  } catch (error: any) {
    console.error('❌ Error seeding system permissions:', error)
    throw error
  }
}

// Run directly if called as script
if (require.main === module) {
  seedSystemPermissions()
    .then(() => {
      console.log('Seeding completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}

export default seedSystemPermissions