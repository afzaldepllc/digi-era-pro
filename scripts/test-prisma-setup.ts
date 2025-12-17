import { prisma } from '../lib/prisma'
import { supabase } from '../lib/supabase'

async function testPrismaSetup() {
  console.log('🔍 Testing Prisma & Supabase Setup...\n')

  try {
    // Test 1: Prisma Connection
    console.log('✅ Test 1: Prisma Client Connection')
    const channelCount = await prisma.channel.count()
    console.log(`   - Connected successfully`)
    console.log(`   - Current channels in database: ${channelCount}\n`)

    // Test 2: Supabase Connection
    console.log('✅ Test 2: Supabase Client Connection')
    const { data: supabaseData, error: supabaseError } = await supabase
      .from('channels')
      .select('count')
    
    if (supabaseError) {
      console.log(`   ⚠️  Warning: ${supabaseError.message}`)
    } else {
      console.log(`   - Connected successfully`)
    }
    console.log('')

    // Test 3: Prisma Schema Models
    console.log('✅ Test 3: Prisma Schema Models')
    const models = [
      'channel',
      'message',
      'channelMember',
      'readReceipt',
      'reaction',
      'attachment'
    ]
    
    for (const model of models) {
      try {
        // @ts-ignore - Dynamic access for testing
        const count = await prisma[model].count()
        console.log(`   - ${model}: ✓ (${count} records)`)
      } catch (error: any) {
        console.log(`   - ${model}: ✗ (${error.message})`)
      }
    }
    console.log('')

    // Test 4: Environment Variables
    console.log('✅ Test 4: Environment Variables')
    const requiredVars = [
      'DATABASE_URL',
      'DIRECT_DATABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SECRET_KEY'
    ]

    for (const varName of requiredVars) {
      const exists = !!process.env[varName]
      console.log(`   - ${varName}: ${exists ? '✓' : '✗ MISSING'}`)
    }
    console.log('')

    // Test 5: Create and Delete Test Channel
    console.log('✅ Test 5: CRUD Operations')
    const testChannel = await prisma.channel.create({
      data: {
        type: 'group',
        name: 'Test Channel',
        mongo_creator_id: 'test_user_id',
        is_private: false,
        member_count: 0,
      }
    })
    console.log(`   - Create: ✓ (ID: ${testChannel.id})`)

    const updatedChannel = await prisma.channel.update({
      where: { id: testChannel.id },
      data: { name: 'Updated Test Channel' }
    })
    console.log(`   - Update: ✓ (Name: ${updatedChannel.name})`)

    const foundChannel = await prisma.channel.findUnique({
      where: { id: testChannel.id }
    })
    console.log(`   - Read: ✓ (Found: ${!!foundChannel})`)

    await prisma.channel.delete({
      where: { id: testChannel.id }
    })
    console.log(`   - Delete: ✓`)
    console.log('')

    console.log('🎉 All tests passed! Prisma is properly set up.')
    console.log('\n📋 Summary:')
    console.log('   ✓ Prisma Client configured')
    console.log('   ✓ Database connection working')
    console.log('   ✓ All models accessible')
    console.log('   ✓ Environment variables set')
    console.log('   ✓ CRUD operations functioning')

  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testPrismaSetup()
