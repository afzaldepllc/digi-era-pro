import { connectToDatabase, disconnectFromDatabase } from '../migrations/migrationUtils'
import User from '../../models/User'
import Role from '../../models/Role'
import Department from '../../models/Department'

export interface IUserSeed {
  name: string
  email: string
  password: string
  legacyRole: 'admin' | 'manager' | 'user'
  departmentName: string
  roleName?: string
  phone?: string
  status: 'active' | 'inactive' | 'archived'
}

export const userSeeds: IUserSeed[] = [
  // Super Admin
  {
    name: 'Super Administrator',
    email: 'superadmin@gmail.com',
    password: 'SuperAdmin@123',
    legacyRole: 'admin',
    departmentName: 'System',
    roleName: 'super_admin',
    phone: '+1000000000',
    status: 'active'
  },


  // HR Manager
  {
    name: 'Lisa Johnson',
    email: 'lisa.johnson@company.com',
    password: 'HRManager@123',
    legacyRole: 'admin',
    departmentName: 'HR',
    roleName: 'hr_manager',
    phone: '+1234567803',
    status: 'active'
  },

  // Department Heads
  {
    name: 'Mike Developer',
    email: 'mike.developer@company.com',
    password: 'DeptHead@123',
    legacyRole: 'manager',
    departmentName: 'Web Development',
    roleName: 'department_head',
    phone: '+1234567804',
    status: 'active'
  },
  {
    name: 'Anna Designer',
    email: 'anna.designer@company.com',
    password: 'DeptHead@123',
    legacyRole: 'manager',
    departmentName: 'Graphics',
    roleName: 'department_head',
    phone: '+1234567805',
    status: 'active'
  },
  {
    name: 'David SEO',
    email: 'david.seo@company.com',
    password: 'DeptHead@123',
    legacyRole: 'manager',
    departmentName: 'SEO',
    roleName: 'department_head',
    phone: '+1234567806',
    status: 'active'
  },
  {
    name: 'Robert Sales',
    email: 'robert.sales@company.com',
    password: 'DeptHead@123',
    legacyRole: 'manager',
    departmentName: 'Sales',
    roleName: 'department_head',
    phone: '+1234567807',
    status: 'active'
  },
  {
    name: 'Emma Support',
    email: 'emma.support@company.com',
    password: 'DeptHead@123',
    legacyRole: 'manager',
    departmentName: 'Support',
    roleName: 'department_head',
    phone: '+1234567808',
    status: 'active'
  },

  // Team Leads
  {
    name: 'Tom WebLead',
    email: 'tom.weblead@company.com',
    password: 'TeamLead@123',
    legacyRole: 'manager',
    departmentName: 'Web Development',
    roleName: 'team_lead',
    phone: '+1234567809',
    status: 'active'
  },
  {
    name: 'Jane GraphicsLead',
    email: 'jane.graphicslead@company.com',
    password: 'TeamLead@123',
    legacyRole: 'manager',
    departmentName: 'Graphics',
    roleName: 'team_lead',
    phone: '+1234567810',
    status: 'active'
  },
  {
    name: 'Mark SocialLead',
    email: 'mark.sociallead@company.com',
    password: 'TeamLead@123',
    legacyRole: 'manager',
    departmentName: 'Social Media',
    roleName: 'team_lead',
    phone: '+1234567811',
    status: 'active'
  },

  // Clients
  {
    name: 'ABC Company',
    email: 'client@gmail.com',
    password: 'Client@123',
    legacyRole: 'user',
    departmentName: 'Sales',
    roleName: 'client',
    phone: '+1234567829',
    status: 'active'
  },
  {
    name: 'XYZ Corporation',
    email: 'info@xyzcorp.com',
    password: 'Client@123',
    legacyRole: 'user',
    departmentName: 'Sales',
    roleName: 'client',
    phone: '+1234567830',
    status: 'active'
  }
]

async function seedUsers() {
  try {
    await connectToDatabase()
    console.log('🌱 Starting user seeding...')

    // Clear existing users
    const existingCount = await User.countDocuments()
    if (existingCount > 0) {
      await User.deleteMany({})
      console.log(`✅ Cleared ${existingCount} existing users`)
    } else {
      console.log('✅ No existing users to clear')
    }

    // Get all roles (both system and department roles)
    const allRoles = await Role.find({ status: 'active' })
    const systemRoles = allRoles.filter(role => role.isSystemRole)
    const departmentRoles = allRoles.filter(role => !role.isSystemRole)

    // Create role maps
    const systemRoleMap = new Map(systemRoles.map(role => [role.name, role]))

    // Get all departments
    const allDepartments = await Department.find({ status: 'active' })
    const departmentMap = new Map(allDepartments.map(dept => [dept.name, dept]))

    if (allRoles.length === 0 || allDepartments.length === 0) {
      throw new Error('Roles and departments must be seeded first. Run role and department seeders.')
    }

    console.log(`📋 Found ${systemRoles.length} system roles and ${departmentRoles.length} department roles`)

    // Helper function to find the correct role for a user
    const findRoleForUser = (userData: IUserSeed) => {
      const targetRoleName = userData.roleName || 'client'
      const departmentDoc = departmentMap.get(userData.departmentName)

      if (!departmentDoc) {
        throw new Error(`Department '${userData.departmentName}' not found for user ${userData.email}`)
      }

      // Check if it's a system role first
      if (systemRoleMap.has(targetRoleName)) {
        return {
          role: systemRoleMap.get(targetRoleName)!,
          department: targetRoleName === 'hr_manager' ? departmentMap.get('HR') : departmentDoc
        }
      }

      // For department roles, construct the role name
      const departmentSlug = userData.departmentName.toLowerCase().replace(/\s+/g, '_')
      const departmentRoleName = `${targetRoleName}_${departmentSlug}`

      const departmentRole = departmentRoles.find(role => role.name === departmentRoleName)

      if (departmentRole) {
        return {
          role: departmentRole,
          department: departmentDoc
        }
      }

      // Fallback: try to find a client role for this department
      const clientRoleName = `client_${departmentSlug}`
      const clientRole = departmentRoles.find(role => role.name === clientRoleName)

      if (clientRole) {
        console.warn(`⚠️  Role '${targetRoleName}' not found for user ${userData.email}, using '${clientRole.name}' role`)
        return {
          role: clientRole,
          department: departmentDoc
        }
      }

      // Final fallback: use any client role
      const anyClientRole = departmentRoles.find(role => role.name.startsWith('client_'))
      if (anyClientRole) {
        console.warn(`⚠️  No specific role found for user ${userData.email}, using '${anyClientRole.name}' role`)
        return {
          role: anyClientRole,
          department: departmentDoc
        }
      }

      throw new Error(`No suitable role found for user ${userData.email} with role '${targetRoleName}' in department '${userData.departmentName}'`)
    }

    // Create users with proper role and department mapping
    const usersToCreate = userSeeds.map(userData => {
      const { role: finalRole, department: finalDepartment } = findRoleForUser(userData)

      return {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: finalRole._id,
        legacyRole: userData.legacyRole,
        department: finalDepartment._id,
        phone: userData.phone || '',
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
        twoFactorEnabled: false,
        permissions: [],
        preferences: {
          theme: 'system',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            push: true,
            sms: false
          }
        },
        metadata: {
          tags: ['seeded'],
          createdBy: 'system_seeder',
          isSuperAdmin: userData.email === 'superadmin@gmail.com',
          roleHierarchy: finalRole.hierarchyLevel
        }
      }
    })

    // Create users in batches for better performance
    const batchSize = 10
    const createdUsers = []

    for (let i = 0; i < usersToCreate.length; i += batchSize) {
      const batch = usersToCreate.slice(i, i + batchSize)
      const batchResult = await User.create(batch)
      createdUsers.push(...batchResult)
      console.log(`✅ Created batch ${Math.ceil((i + 1) / batchSize)} - ${batchResult.length} users`)
    }

    console.log(`\n� User Seeding Summary:`)
    console.log(`✅ Total Users Created: ${createdUsers.length}`)

    // Group users by role and department for summary
    const roleStats = new Map()
    const departmentStats = new Map()

    for (const user of createdUsers) {
      const userRole = allRoles.find(r => r._id.toString() === user.role.toString())
      const userDept = user.department ? allDepartments.find(d => d._id.toString() === user.department?.toString()) : null

      if (userRole) {
        roleStats.set(userRole.displayName, (roleStats.get(userRole.displayName) || 0) + 1)
      }
      if (userDept && userDept.name) {
        departmentStats.set(userDept.name, (departmentStats.get(userDept.name) || 0) + 1)
      }
    }

    console.log('\n👥 Users by Role:')
    for (const [roleName, count] of roleStats) {
      console.log(`   ${roleName}: ${count} users`)
    }

    console.log('\n🏢 Users by Department:')
    for (const [deptName, count] of departmentStats) {
      console.log(`   ${deptName}: ${count} users`)
    }

    console.log('\n✨ User seeding completed successfully')
    console.log('\n🔐 Sample Login Credentials:')
    console.log('   Super Admin: superadmin@gmail.com / SuperAdmin@123')
    console.log('   Project Manager: john.smith@company.com / ProjectManager@123')
    console.log('   HR Manager: lisa.johnson@company.com / HRManager@123')
    console.log('   Department Head: mike.developer@company.com / DeptHead@123')
    console.log('   Team Lead: tom.weblead@company.com / TeamLead@123')
    console.log('   Senior Executive: alex.seniordev@company.com / SeniorExec@123')
    console.log('   Executive: paul.webexec@company.com / Executive@123')
    console.log('   Junior Executive: steve.juniordev@company.com / JuniorExec@123')
    console.log('   Intern: james.webintern@company.com / Intern@123')
    console.log('   Client: contact@abccompany.com / Client@123')

    // Verify users were actually saved to database
    const verifyCount = await User.countDocuments()
    console.log(`\n🔍 Verification: ${verifyCount} users in database`)
    
    if (verifyCount !== createdUsers.length) {
      console.warn(`⚠️  Warning: Expected ${createdUsers.length} users but found ${verifyCount} in database`)
    }

    return {
      success: true,
      created: createdUsers.length,
      roleStats: Object.fromEntries(roleStats),
      departmentStats: Object.fromEntries(departmentStats)
    }

  } catch (error) {
    console.error('❌ Error seeding users:', error)
    throw error
  }
}

export default seedUsers