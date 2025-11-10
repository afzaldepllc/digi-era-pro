/**
 * Database Cleanup Script - Fix Corrupted Department IDs in Tasks
 * This script identifies and fixes tasks that have invalid departmentId values
 */

import mongoose from 'mongoose'
import { connectDatabase } from '../lib/mongodb'
import Task from '../models/Task'
import Department from '../models/Department'

interface CorruptedTask {
  _id: string
  title: string
  departmentId: any
  projectId: string
}

async function identifyCorruptedTasks(): Promise<CorruptedTask[]> {
  console.log('🔍 Scanning for corrupted departmentId values in tasks...')
  
  // Find all tasks and check for invalid departmentId values
  const allTasks = await Task.aggregate([
    {
      $project: {
        _id: 1,
        title: 1,
        departmentId: 1,
        projectId: 1,
        departmentIdType: { $type: "$departmentId" },
        departmentIdString: { $toString: "$departmentId" }
      }
    }
  ])

  const corrupted: CorruptedTask[] = []
  
  for (const task of allTasks) {
    const deptId = task.departmentId
    
    // Check if departmentId is not a valid ObjectId
    if (typeof deptId === 'string' && !mongoose.Types.ObjectId.isValid(deptId)) {
      corrupted.push({
        _id: task._id,
        title: task.title,
        departmentId: deptId,
        projectId: task.projectId
      })
    }
    
    // Check if departmentId is not 24 characters (invalid ObjectId format)
    if (typeof deptId === 'string' && deptId.length !== 24) {
      corrupted.push({
        _id: task._id,
        title: task.title,
        departmentId: deptId,
        projectId: task.projectId
      })
    }
  }

  return corrupted
}

async function getValidDepartments() {
  console.log('📋 Fetching valid departments...')
  const departments = await Department.find({ status: 'active' }).select('_id name')
  console.log(`Found ${departments.length} valid departments:`)
  departments.forEach(dept => {
    console.log(`  - ${dept.name} (${dept._id})`)
  })
  return departments
}

async function suggestFixes(corruptedTasks: CorruptedTask[], validDepartments: any[]) {
  console.log('\n💡 Suggested fixes for corrupted tasks:')
  
  const systemDept = validDepartments.find(d => d.name.toLowerCase().includes('system'))
  const defaultDept = validDepartments.find(d => d.name.toLowerCase().includes('general') || d.name.toLowerCase().includes('default'))
  const firstDept = validDepartments[0]
  
  const fallbackDept = systemDept || defaultDept || firstDept

  for (const task of corruptedTasks) {
    console.log(`\nTask: "${task.title}" (${task._id})`)
    console.log(`  Current departmentId: "${task.departmentId}" (Invalid)`)
    
    // Try to match department name if it's a string
    if (typeof task.departmentId === 'string') {
      const matchedDept = validDepartments.find(d => 
        d.name.toLowerCase().includes(task.departmentId.toLowerCase()) ||
        task.departmentId.toLowerCase().includes(d.name.toLowerCase())
      )
      
      if (matchedDept) {
        console.log(`  📍 Suggested fix: ${matchedDept.name} (${matchedDept._id})`)
      } else {
        console.log(`  📍 Suggested fix: ${fallbackDept?.name} (${fallbackDept?._id}) - Fallback`)
      }
    } else {
      console.log(`  📍 Suggested fix: ${fallbackDept?.name} (${fallbackDept?._id}) - Fallback`)
    }
  }

  return fallbackDept
}

async function fixCorruptedTasks(corruptedTasks: CorruptedTask[], validDepartments: any[], dryRun: boolean = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY RUN - ' : ''}Fixing corrupted tasks...`)
  
  const systemDept = validDepartments.find(d => d.name.toLowerCase().includes('system'))
  const defaultDept = validDepartments.find(d => d.name.toLowerCase().includes('general') || d.name.toLowerCase().includes('default'))
  const firstDept = validDepartments[0]
  
  const fallbackDept = systemDept || defaultDept || firstDept
  
  if (!fallbackDept) {
    throw new Error('No valid departments found to use as fallback')
  }

  let fixedCount = 0
  
  for (const task of corruptedTasks) {
    let targetDeptId: string
    
    // Try to match department name if it's a string
    if (typeof task.departmentId === 'string') {
      const matchedDept = validDepartments.find(d => 
        d.name.toLowerCase().includes(task.departmentId.toLowerCase()) ||
        task.departmentId.toLowerCase().includes(d.name.toLowerCase())
      )
      
      targetDeptId = matchedDept?._id || fallbackDept._id
    } else {
      targetDeptId = fallbackDept._id
    }

    console.log(`${dryRun ? '[DRY RUN] ' : ''}Fixing task "${task.title}" -> ${targetDeptId}`)
    
    if (!dryRun) {
      try {
        await Task.updateOne(
          { _id: task._id },
          { 
            $set: { 
              departmentId: new mongoose.Types.ObjectId(targetDeptId),
              // Add a flag to indicate this was auto-fixed
              __autoFixed: true,
              __autoFixedAt: new Date()
            }
          }
        )
        fixedCount++
        console.log(`  ✅ Fixed successfully`)
      } catch (error) {
        console.log(`  ❌ Failed to fix: ${error.message}`)
      }
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Summary:`)
  console.log(`  Total corrupted tasks: ${corruptedTasks.length}`)
  if (!dryRun) {
    console.log(`  Successfully fixed: ${fixedCount}`)
    console.log(`  Failed to fix: ${corruptedTasks.length - fixedCount}`)
  }
}

async function main() {
  console.log('🚀 Starting database cleanup for corrupted departmentId values...\n')
  
  try {
    await connectDatabase()
    console.log('✅ Connected to database\n')

    // Step 1: Identify corrupted tasks
    const corruptedTasks = await identifyCorruptedTasks()
    
    if (corruptedTasks.length === 0) {
      console.log('🎉 No corrupted departmentId values found! Database is clean.')
      return
    }
    
    console.log(`\n⚠️  Found ${corruptedTasks.length} tasks with corrupted departmentId values:`)
    corruptedTasks.forEach((task, index) => {
      console.log(`${index + 1}. "${task.title}" - departmentId: "${task.departmentId}"`)
    })

    // Step 2: Get valid departments
    const validDepartments = await getValidDepartments()
    
    if (validDepartments.length === 0) {
      throw new Error('No valid departments found in the database')
    }

    // Step 3: Suggest fixes
    const fallbackDept = await suggestFixes(corruptedTasks, validDepartments)

    // Step 4: Run dry run first
    console.log('\n' + '='.repeat(60))
    await fixCorruptedTasks(corruptedTasks, validDepartments, true)
    
    console.log('\n' + '='.repeat(60))
    console.log('⚡ To actually apply these fixes, run:')
    console.log('   node scripts/fix-corrupted-departments.js --apply')
    console.log('\n⚠️  IMPORTANT: Make sure to backup your database first!')

    // Check if --apply flag is passed
    const applyFix = process.argv.includes('--apply')
    if (applyFix) {
      console.log('\n🔥 APPLYING FIXES (This will modify the database)...')
      console.log('Are you sure? This operation cannot be undone without a backup.')
      
      // In a real scenario, you might want to add a confirmation prompt
      // For now, we'll just apply the fixes
      await fixCorruptedTasks(corruptedTasks, validDepartments, false)
      console.log('\n✅ Database cleanup completed!')
    }

  } catch (error) {
    console.error('❌ Error during database cleanup:', error)
    throw error
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close()
      console.log('📡 Database connection closed')
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
}

export { identifyCorruptedTasks, fixCorruptedTasks }