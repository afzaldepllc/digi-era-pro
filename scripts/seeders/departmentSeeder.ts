import { connectToDatabase, disconnectFromDatabase } from '../migrations/migrationUtils'
import Department from '../../models/Department'

export interface IDepartmentSeed {
  name: string
  description: string
  status: 'active' | 'inactive' | 'archived'
  metadata: {
    createdBy: string
    isSystemDepartment?: boolean
  }
}

export const departmentSeeds: IDepartmentSeed[] = [
  {
    name: 'System',
    description: 'System administration and core management',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder',
      isSystemDepartment: true
    }
  },
  {
    name: 'Web Development',
    description: 'WordPress development and web solutions',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'Graphics',
    description: 'Graphic design and visual content creation',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'SEO',
    description: 'Search Engine Optimization - On-Page and Off-Page',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'Sales',
    description: 'Sales and business development',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'Support',
    description: 'Customer support and technical assistance',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'GMB',
    description: 'Google My Business management and local SEO',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'Social Media',
    description: 'Social media management and marketing',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'HR',
    description: 'Human Resources and personnel management',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  },
  {
    name: 'Accounting',
    description: 'Financial management and accounting services',
    status: 'active',
    metadata: {
      createdBy: 'system_seeder'
    }
  }
]

async function seedDepartments() {
  try {
    await connectToDatabase()
    console.log('🏢 Starting department seeding...')

    // Clear existing departments except system ones that might be referenced
    const existingDepartments = await Department.find({})
    const existingNames = new Set(existingDepartments.map(d => d.name))

    let created = 0
    let updated = 0
    let skipped = 0

    for (const deptData of departmentSeeds) {
      if (existingNames.has(deptData.name)) {
        // Update existing department
        const existing = existingDepartments.find(d => d.name === deptData.name)
        if (existing) {
          const hasChanges = 
            existing.description !== deptData.description ||
            existing.status !== deptData.status

          if (hasChanges) {
            await Department.findByIdAndUpdate(existing._id, {
              description: deptData.description,
              status: deptData.status,
              'metadata.updatedBy': 'system_seeder'
            })
            updated++
            console.log(`📝 Updated department: ${deptData.name}`)
          } else {
            skipped++
            console.log(`⏭️  Skipped department (no changes): ${deptData.name}`)
          }
        }
      } else {
        // Create new department
        await Department.create(deptData)
        created++
        console.log(`✅ Created department: ${deptData.name}`)
      }
    }

    console.log(`\n📊 Department Seeding Summary:`)
    console.log(`✅ Created: ${created}`)
    console.log(`📝 Updated: ${updated}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`📊 Total Departments: ${created + updated + skipped}`)

    // List all departments
    const allDepartments = await Department.find({ status: 'active' })
      .select('name description')
      .sort({ name: 1 })
      .lean()

    console.log('\n🏢 Available Departments:')
    allDepartments.forEach(dept => {
      console.log(`   ${dept.name} - ${dept.description}`)
    })

    console.log('\n✨ Department seeding completed successfully')

    return {
      success: true,
      created,
      updated,
      skipped,
      total: created + updated + skipped,
      departments: allDepartments
    }

  } catch (error) {
    console.error('❌ Error seeding departments:', error)
    throw error
  }
}

export default seedDepartments