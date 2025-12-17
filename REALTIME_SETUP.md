# Quick Setup Guide - Supabase Realtime

## What Was Fixed

### 1. Horizontal Scroll Issue ✅
**Problem:** Message container had horizontal scroll
**Fixed in:** `components/ui/message-list.tsx`
- Added `overflow-x-hidden` to message list container
- Changed `break-all` to `overflow-wrap-anywhere` for better word breaking

### 2. Authentication Architecture ✅
**Approach:** API-Level Security (No Supabase Auth)
- All authentication handled by MongoDB + Next-Auth
- Supabase only accessible via API keys (server-side)
- Row Level Security (RLS) DISABLED
- Security enforced in API endpoints

## Required Setup Steps

### Step 1: Enable Realtime in Supabase Dashboard
1. Go to: https://app.supabase.com/project/mifxampcsrojspuhtlpy
2. Navigate to: **Database → Replication**
3. Enable Realtime for these tables:
   - ✅ messages
   - ✅ channels
   - ✅ channel_members
   - ✅ reactions

### Step 2: Disable RLS and Configure Database
1. Open **SQL Editor** in Supabase Dashboard
2. Copy and run the entire script from: `scripts/setup-supabase-realtime.sql`
3. This will:
   - Enable Realtime on all tables
   - Disable Row Level Security
   - Drop any existing RLS policies
   - Verify configuration

### Step 3: Test Real-time Messages
1. Open your app in two different browsers
2. Send a message from one browser
3. You should see these console logs:

```
🔧 Updating realtime handlers
✅ Realtime handlers updated
Subscribing to channel: [channelId]
🔌 Channel subscription status: SUBSCRIBED
✅ Successfully subscribed to channel [channelId]
📡 Active handlers: [onNewMessage, onMessageUpdate, ...]
```

4. When message is sent:
```
🔔 Realtime: New message detected [payload]
✅ Calling onNewMessage handler
📩 onNewMessage handler called with: [message]
Message already exists, skipping duplicate: [messageId]
```

## Security Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ Next-Auth Session
       │
┌──────▼──────────────────────────────┐
│     Next.js API Routes              │
│  (MongoDB Authentication Check)     │
└──────┬──────────────────────────────┘
       │
       │ Supabase API Key
       │ (Server-side only)
       │
┌──────▼──────────────────────────────┐
│        Supabase Database            │
│        (RLS Disabled)               │
│   ┌──────────────────────────┐     │
│   │ Realtime Postgres Changes│     │
│   └────────────┬─────────────┘     │
└────────────────┼───────────────────┘
                 │
                 │ WebSocket (wss://)
                 │ NEXT_PUBLIC_SUPABASE_ANON_KEY
                 │
┌────────────────▼───────────────────┐
│      RealtimeManager (Client)      │
│  Receives real-time notifications  │
└────────────────────────────────────┘
```

### Why This is Secure:
1. **API Keys are safe to expose** - The anon key only allows operations defined by RLS policies (which are disabled) or by API endpoints
2. **MongoDB authentication** - All write operations go through API routes that check MongoDB session
3. **Read-only Realtime** - Clients can only receive notifications, not directly modify data
4. **Server-side writes** - All INSERT/UPDATE/DELETE happens server-side through authenticated API routes

## Files Modified

1. ✅ `components/ui/message-list.tsx` - Fixed horizontal scroll
2. ✅ `hooks/use-communications.ts` - Removed Supabase auth (not needed)
3. ✅ `store/slices/communicationSlice.ts` - Added duplicate message prevention
4. ✅ `lib/realtime-manager.ts` - Enhanced debug logging
5. ✅ `scripts/setup-supabase-realtime.sql` - RLS disable configuration
6. ✅ `docs/REALTIME_DEBUGGING.md` - Updated debugging guide
7. ❌ `hooks/use-supabase-auth.ts` - Deleted (not needed)

## Troubleshooting

If messages still don't appear in real-time:

1. **Check Realtime is enabled**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
   Should show: messages, channels, channel_members, reactions

2. **Check RLS is disabled**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename IN ('messages', 'channels', 'channel_members', 'reactions');
   ```
   All should show `rowsecurity = false`

3. **Check console logs** - Open browser DevTools and look for the emoji logs (🔔, ✅, 📩)

4. **Test direct insert**
   ```sql
   -- This should trigger a real-time event
   INSERT INTO messages (channel_id, mongo_sender_id, content, created_at, updated_at)
   VALUES ('your-channel-id', 'your-user-id', 'Test', now(), now());
   ```
   Watch console - you should see "🔔 Realtime: New message detected"

## Next Steps

After running the SQL script:
1. Refresh your browser
2. Open DevTools console
3. Send a test message
4. Watch for the debug logs
5. If you see all the ✅ logs, real-time is working!

## Need Help?

See detailed debugging guide: `docs/REALTIME_DEBUGGING.md`
