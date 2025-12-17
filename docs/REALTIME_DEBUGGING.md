# Realtime Debugging Guide

## Current Issue
Messages are not appearing in real-time. Users need to refresh to see new messages, even the sender needs to refresh.

## ⚠️ CRITICAL: Most Likely Issue - Supabase Authentication

**The most common reason Realtime doesn't work is missing Supabase authentication!**

Supabase Realtime with Row Level Security (RLS) requires an authenticated Supabase session. We use Next-Auth for authentication, but this doesn't automatically authenticate with Supabase.

**Quick Fix:** Run the SQL script at `scripts/setup-supabase-realtime.sql` in your Supabase SQL Editor to enable Realtime and set up proper policies.

## Recent Changes
1. ✅ Added duplicate message prevention in Redux `addMessage` action
2. ✅ Added optimistic update in `sendMessage` - sender should see message immediately
3. ✅ Enhanced debug logging throughout the realtime system
4. ✅ Fixed handler references to use dynamic lookup
5. ✅ Added Supabase auth sync hook (`use-supabase-auth.ts`)

## Debug Logs to Check

When you send a message, you should see these console logs in sequence:

### 1. Subscription Setup (on channel change)
```
🔧 Updating realtime handlers
✅ Realtime handlers updated
Subscribing to channel: [channelId]
🔌 Channel subscription status for [channelId]: CONNECTING
🔌 Channel subscription status for [channelId]: SUBSCRIBED
✅ Successfully subscribed to channel [channelId]
📡 Active handlers: [list of handler names]
```

### 2. When Message is Sent
```
[Your message send logic]
📩 onNewMessage handler called with: [message data]
```

### 3. When Postgres Change is Detected
```
🔔 Realtime: New message detected [payload]
✅ Calling onNewMessage handler
```

## What to Check

### 1. Supabase Realtime Settings
Go to your Supabase Dashboard:
- Navigate to: https://app.supabase.com/project/mifxampcsrojspuhtlpy
- Go to: Database → Replication
- **Ensure these tables have Realtime enabled:**
  - ✅ messages
  - ✅ channel_members
  - ✅ reactions

**How to enable:**
1. Click on the table
2. Find "Realtime" toggle
3. Turn it ON
4. Click "Save"

### 2. Postgres Changes Requirements
For Postgres Changes to work, you need:
- Realtime enabled for the table (see above)
- Row Level Security (RLS) policies that allow SELECT on the table
- The user must have proper authentication

### 3. Check RLS Policies
Go to: Database → Policies

For the `messages` table, you should have a policy like:
```sql
-- Allow all users to SELECT messages they have access to
CREATE POLICY "Allow SELECT on messages for channel members"
ON messages FOR SELECT
USING (
  channel_id IN (
    SELECT channel_id 
    FROM channel_members 
    WHERE mongo_member_id = current_setting('request.jwt.claim.sub', true)
  )
);
```

**Important:** Postgres Changes respect RLS policies. If users can't SELECT the row, they won't receive real-time updates for it.

### 4. Check Supabase Client Auth
Verify your Supabase client is authenticated:

Add this to your code temporarily:
```typescript
// In use-communications.ts, add to useEffect
useEffect(() => {
  const checkAuth = async () => {
    const { data, error } = await supabase.auth.getSession()
    console.log('🔐 Supabase auth session:', data)
    console.log('🔐 Supabase auth error:', error)
  }
  checkAuth()
}, [])
```

### 5. Test Direct Database Insert
Open Supabase SQL Editor and run:
```sql
-- This should trigger a real-time event if everything is working
INSERT INTO messages (channel_id, mongo_sender_id, content, created_at, updated_at)
VALUES (
  'your-channel-id',
  'your-user-id',
  'Test message from SQL',
  now(),
  now()
);
```

Watch your browser console - you should see the realtime event logs.

## Common Issues

### Issue 1: "No Postgres Changes events at all"
**Symptoms:** No "🔔 Realtime: New message detected" logs
**Cause:** Realtime not enabled on table
**Fix:** Enable Realtime in Supabase Dashboard (see #1 above)

### Issue 2: "Handlers not registered"
**Symptoms:** "❌ No onNewMessage handler registered"
**Cause:** Handlers updated after subscription
**Fix:** Already fixed - handlers now use dynamic lookup

### Issue 3: "Subscription TIMED_OUT"
**Symptoms:** "⏱️ Channel subscription timed out"
**Cause:** Network issues or Supabase service down
**Fix:** Check Supabase status, check network connectivity

### Issue 4: "RLS Policy blocking updates"
**Symptoms:** Can INSERT but no real-time updates
**Cause:** RLS policy blocks SELECT
**Fix:** Add proper SELECT policy (see #3 above)

### Issue 5: "Optimistic update works, but no realtime for others"
**Symptoms:** Sender sees message, others don't
**Cause:** Probably Realtime not enabled
**Fix:** Enable Realtime in dashboard

## Next Steps

1. **First:** Check the console logs when sending a message
2. **Second:** Verify Realtime is enabled in Supabase Dashboard
3. **Third:** Check RLS policies allow SELECT
4. **Fourth:** Test direct SQL INSERT
5. **Fifth:** Report back which logs you see/don't see

## Manual Test Checklist

- [ ] See "🔧 Updating realtime handlers" in console?
- [ ] See "✅ Successfully subscribed to channel" in console?
- [ ] See "📡 Active handlers:" with onNewMessage listed?
- [ ] When sending message, see "🔔 Realtime: New message detected"?
- [ ] See "✅ Calling onNewMessage handler"?
- [ ] See "📩 onNewMessage handler called with: [data]"?
- [ ] See "Message already exists, skipping duplicate" for sender's optimistic update?
- [ ] Realtime enabled in Supabase Dashboard for messages table?
- [ ] RLS policy allows SELECT on messages?

## Contact Support

If all the above checks pass but it still doesn't work, provide:
1. Screenshot of console logs
2. Screenshot of Supabase Realtime settings
3. Your RLS policies for messages table
4. Network tab showing WebSocket connection
