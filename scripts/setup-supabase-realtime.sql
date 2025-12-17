-- ============================================
-- Supabase Realtime Setup - API-Level Security
-- ============================================

-- This configuration disables RLS and relies on API-level authentication
-- All security is handled through MongoDB auth and API endpoints
-- Supabase is only accessible via API keys (secure server-side)

-- Run this in your Supabase SQL Editor

-- 1. Create or use existing supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Enable Realtime for all communication tables (skip if already added)
DO $$
BEGIN
  -- Add messages table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- Add channels table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE channels;
  END IF;

  -- Add channel_members table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'channel_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE channel_members;
  END IF;

  -- Add reactions table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
END $$;

-- 3. DISABLE Row Level Security (RLS) on ALL tables in public schema
-- Security is handled at the API level with MongoDB authentication
-- Only servers with Supabase keys can access this data
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'  -- Exclude system tables
    AND tablename NOT LIKE '_prisma_%'  -- Exclude Prisma internal tables
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', table_name);
    RAISE NOTICE 'Disabled RLS for table: %', table_name;
  END LOOP;
END $$;

-- 4. Drop any existing RLS policies from ALL tables (if any)
DO $$
DECLARE
  pol record;
BEGIN
  -- Drop all policies from all public schema tables
  FOR pol IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped policy: % on table: %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- 5. Verify RLS is disabled on ALL tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

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
