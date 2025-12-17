-- ============================================
-- Supabase Realtime Setup for Messages Table
-- ============================================

-- This script ensures that Realtime works properly with your messages table
-- Run this in your Supabase SQL Editor

-- 1. Enable Realtime for the messages table (if not already enabled)
-- Note: You can also do this from the Supabase Dashboard:
-- Go to Database → Replication → messages → Toggle "Realtime"

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 2. Check current RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'messages';

-- 3. If RLS is enabled, we need policies that allow SELECT for Realtime

-- Option A: Allow all authenticated users to SELECT messages (simplest)
-- Uncomment if you want to use this approach:
/*
CREATE POLICY "Allow authenticated users to SELECT messages" 
ON messages 
FOR SELECT 
TO authenticated
USING (true);
*/

-- Option B: Allow based on channel membership (more secure)
-- Uncomment if you want channel-based access:
/*
CREATE POLICY "Allow SELECT messages for channel members" 
ON messages 
FOR SELECT 
TO authenticated
USING (
  channel_id IN (
    SELECT channel_id 
    FROM channel_members 
    WHERE mongo_member_id = auth.uid()::text
  )
);
*/

-- Option C: Disable RLS temporarily for testing (NOT RECOMMENDED for production)
-- Uncomment ONLY for testing:
/*
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
*/

-- 4. For anonymous access (if using anonymous auth), add this policy:
-- Uncomment if using anonymous Supabase auth:
/*
CREATE POLICY "Allow anonymous SELECT on messages" 
ON messages 
FOR SELECT 
TO anon
USING (true);
*/

-- 5. Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'messages';

-- ============================================
-- Additional tables for Realtime
-- ============================================

-- Enable Realtime for channel_members
ALTER PUBLICATION supabase_realtime ADD TABLE channel_members;

-- Enable Realtime for reactions (if needed)
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- ============================================
-- Verification Queries
-- ============================================

-- Check which tables have Realtime enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check Realtime configuration
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- ============================================
-- Test Query
-- ============================================

-- Test if you can SELECT from messages (run this after applying policies)
-- This should return your messages if policies are correct
SELECT * FROM messages LIMIT 5;
