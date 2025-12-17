#!/usr/bin/env node
/**
 * Test script to verify Realtime connection and configuration
 * Run with: node --loader ts-node/esm scripts/test-realtime.ts
 * Or: npx tsx scripts/test-realtime.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mifxampcsrojspuhtlpy.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZnhhbXBjc3JvanNwdWh0bHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTIyNTYsImV4cCI6MjA4MTQ4ODI1Nn0.zYXnJ2hPcxPqN2kI90Mjuh2s9O47ln4QtssuJmIXgdE'

console.log('🔧 Testing Supabase Realtime Configuration...\n')
console.log('📍 URL:', supabaseUrl)
console.log('🔑 Key:', supabaseAnonKey.substring(0, 20) + '...\n')

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

async function testRealtimeConnection() {
  console.log('1️⃣ Testing database connection...')
  
  try {
    // Test basic query
    const { data: tables, error: tablesError } = await supabase
      .from('messages')
      .select('id')
      .limit(1)
    
    if (tablesError) {
      console.error('❌ Database query failed:', tablesError.message)
      return false
    }
    
    console.log('✅ Database connection successful\n')
    
    // Test Realtime subscription
    console.log('2️⃣ Testing Realtime subscription...')
    
    const testChannel = supabase.channel('test_channel_' + Date.now())
    
    testChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('🔔 Received realtime event:', payload.eventType)
          console.log('📦 Payload:', payload)
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Subscription status:', status)
        if (err) {
          console.error('❌ Subscription error:', err)
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to Realtime!\n')
          console.log('3️⃣ Waiting 5 seconds for any events...')
          
          setTimeout(async () => {
            console.log('\n4️⃣ Testing INSERT event (optional - you can skip)...')
            console.log('💡 To test: Go to Supabase SQL Editor and run:')
            console.log('   INSERT INTO messages (channel_id, mongo_sender_id, content, created_at)')
            console.log('   VALUES (\'00000000-0000-0000-0000-000000000000\', \'test\', \'Test message\', now());')
            console.log('\nIf you see a realtime event above, it\'s working! ✨\n')
            
            setTimeout(() => {
              console.log('✅ Test completed. Unsubscribing...')
              supabase.removeChannel(testChannel)
              process.exit(0)
            }, 3000)
          }, 5000)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error - Realtime might not be enabled')
          console.log('\n📋 Action Required:')
          console.log('1. Go to Supabase Dashboard → Database → Replication')
          console.log('2. Enable Realtime for the "messages" table')
          console.log('3. Run the SQL script: scripts/setup-supabase-realtime.sql\n')
          process.exit(1)
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Subscription timed out')
          process.exit(1)
        }
      })
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    return false
  }
}

// Run the test
testRealtimeConnection().catch(console.error)
