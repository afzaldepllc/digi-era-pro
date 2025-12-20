# Real-time Communication - Required Updates

## Problem Summary

Your current implementation has these issues causing the sender to make unnecessary GET requests after POST:

1. **Sender receives own broadcasts** - Missing `self: false` config in Supabase channel
2. **Potential race conditions** - No subscription promise tracking
3. **No typing debounce** - Typing indicators spam the network
4. **Anti-pattern global flag** - Using `globalChannelsFetched` can cause issues

---

## File 1: `lib/realtime-manager.ts`

### Current Issues

**Issue 1: Missing `self: false` Configuration**
```typescript
// CURRENT (WRONG) - Sender receives own broadcasts
const rtChannel = supabase.channel(`rt_${channelId}`, {
  config: {
    presence: {
      key: channelId,
    },
  },
})
```

**Issue 2: No Subscription Promise Tracking**
```typescript
// CURRENT (WRONG) - Can create duplicate subscriptions
subscribeToChannel(channelId: string): Promise<void> {
  if (this.rtChannels.has(channelId)) {
    return Promise.resolve()
  }
  // Race condition: Multiple calls can enter here before subscription completes
}
```

---

### Required Updates

#### Update 1: Add `broadcast: { self: false }` Config

```typescript
// In subscribeToChannel method, update channel creation:
const rtChannel = supabase.channel(`rt_${channelId}`, {
  config: {
    broadcast: {
      self: false, // Prevent sender from receiving own broadcasts
    },
    presence: {
      key: channelId,
    },
  },
})
```

**Why**: This prevents the sender from receiving their own broadcast messages, eliminating duplicate messages.

---

#### Update 2: Add Subscription Promise Tracking

```typescript
// Add new property to class
private subscriptionPromises: Map<string, Promise<void>> = new Map()

// Update subscribeToChannel method:
subscribeToChannel(channelId: string): Promise<void> {
  const existingPromise = this.subscriptionPromises.get(channelId)
  if (existingPromise) {
    console.log("🔄 Returning existing subscription promise for:", channelId)
    return existingPromise
  }

  if (this.rtChannels.has(channelId)) {
    console.log("🔄 RT Channel already exists for:", channelId)
    return Promise.resolve()
  }

  console.log("🆕 Creating RT channel for:", channelId)

  const subscriptionPromise = new Promise<void>((resolve, reject) => {
    const rtChannel = supabase.channel(`rt_${channelId}`, {
      config: {
        broadcast: {
          self: false, // Prevent self-broadcast
        },
        presence: {
          key: channelId,
        },
      },
    })

    // ... existing broadcast event handlers ...

    rtChannel.subscribe((status, err) => {
      console.log(`🔌 RT Channel subscription status for ${channelId}:`, status)
      if (err) {
        console.error("❌ RT Subscription error:", err)
        this.subscriptionPromises.delete(channelId) // Clean up on error
        reject(err)
      }
      if (status === "SUBSCRIBED") {
        console.log(`✅ Successfully subscribed to RT channel ${channelId}`)
        this.rtChannels.set(channelId, rtChannel)
        this.subscriptionPromises.delete(channelId) // Clean up after success
        resolve()
      } else if (status === "CHANNEL_ERROR") {
        console.error(`❌ RT Channel error for ${channelId}`)
        this.subscriptionPromises.delete(channelId) // Clean up on error
        reject(new Error(`RT Channel error for ${channelId}`))
      } else if (status === "TIMED_OUT") {
        console.error(`⏱️ RT Channel subscription timed out for ${channelId}`)
        this.subscriptionPromises.delete(channelId) // Clean up on timeout
        reject(new Error(`RT Channel subscription timed out for ${channelId}`))
      }
    })
  })

  this.subscriptionPromises.set(channelId, subscriptionPromise)
  return subscriptionPromise
}
```

**Why**: Prevents race conditions when multiple calls try to subscribe to the same channel simultaneously.

---

#### Update 3: Clean Up Subscription Promises on Unsubscribe

```typescript
unsubscribeFromChannel(channelId: string) {
  const rtChannel = this.rtChannels.get(channelId)
  if (rtChannel) {
    supabase.removeChannel(rtChannel)
    this.rtChannels.delete(channelId)
  }
  this.subscriptionPromises.delete(channelId)
}
```

---

#### Update 4: Clean Up in cleanup() Method

```typescript
cleanup() {
  for (const [channelId, rtChannel] of this.rtChannels) {
    supabase.removeChannel(rtChannel)
  }
  this.rtChannels.clear()
  this.subscriptionPromises.clear()
}
```

---

## File 2: `hooks/use-communications.ts`

### Current Issues

**Issue 1: No Debouncing on Typing Indicators**
```typescript
// CURRENT (WRONG) - Sends typing event on every keystroke
const setUserTyping = useCallback(
  async (typingIndicator: ITypingIndicator) => {
    if (activeChannelId) {
      await realtimeManager.sendTypingStart(activeChannelId, typingIndicator.userId)
      // ... rest of code
    }
  },
  [dispatch, activeChannelId, realtimeManager],
)
```

**Issue 2: Global Anti-Pattern Flag**
```typescript
// CURRENT (WRONG) - Global state can cause issues across different app instances
let globalChannelsFetched = false
```

**Issue 3: No Error Recovery for Failed Messages**
The optimistic update marks failed messages but doesn't provide retry mechanism.

---

### Required Updates

#### Update 1: Add Typing Debounce

```typescript
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

const setUserTyping = useCallback(
  async (typingIndicator: ITypingIndicator) => {
    if (activeChannelId) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Send typing start
      await realtimeManager.sendTypingStart(activeChannelId, typingIndicator.userId)
      dispatch(setTyping(typingIndicator))

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        removeUserTyping(activeChannelId, typingIndicator.userId)
      }, 3000)
    }
  },
  [dispatch, activeChannelId, realtimeManager],
)

useEffect(() => {
  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }
}, [])
```

**Why**: Prevents spamming typing events on every keystroke, only sends when user stops typing.

---

#### Update 2: Remove Global Flag Anti-Pattern

```typescript
// let globalChannelsFetched = false  // DELETE THIS LINE

const channelsFetchedRef = useRef(false)

// Update the useEffect:
useEffect(() => {
  console.log(
    "🔄 Channels fetch useEffect running, channelsFetched:",
    channelsFetchedRef.current, // Use ref
    "sessionUserId:",
    sessionUserId,
    "loading:",
    loading,
  )
  if (!channelsFetchedRef.current && sessionUserId && !loading) {
    channelsFetchedRef.current = true // Use ref
    console.log("🚀 Fetching channels")
    fetchChannels()
  }
}, [sessionUserId])
```

**Why**: Using a ref keeps state local to the component instance, preventing issues with multiple instances or hot reloading.

---

#### Update 3: Fix Optimistic Update to Use Only Broadcast (No GET)

The current `sendMessage` already does this correctly - it:
1. Adds optimistic message to local state immediately
2. POSTs to API
3. Broadcasts to Supabase
4. Does NOT call fetchMessages()

**Verify this is working** - The issue might be that `self: false` is missing in realtime-manager, causing sender to receive their own broadcast.

---

## Summary of Changes

### `lib/realtime-manager.ts` (3 updates)
1. Add `broadcast: { self: false }` to channel config
2. Add subscription promise tracking with Map
3. Clean up subscription promises in unsubscribe and cleanup methods

### `hooks/use-communications.ts` (2 updates)
1. Add typing debounce with useRef and cleanup
2. Replace global flag with useRef for channels fetched state

---

## Testing Checklist

After implementing these changes, test the following:

- [ ] **Sender**: Send a message, verify no GET request happens after POST
- [ ] **Sender**: Message appears instantly in your own UI
- [ ] **Receiver**: Opens same channel, sees new message appear in real-time
- [ ] **Receiver**: Verify no duplicate messages
- [ ] **Both**: Type in message box, verify typing indicator appears for other user
- [ ] **Both**: Stop typing, verify typing indicator disappears after 3s
- [ ] **Both**: Rapidly switch channels, verify no duplicate subscriptions
- [ ] **Both**: Close app and reopen, verify channels load correctly without duplicates

---

## Expected Flow After Fixes

### Sender Sends Message
1. Types message and hits send
2. Message appears instantly in UI (optimistic update)
3. POST request saves to MongoDB in background
4. Broadcast sent to Supabase channel with `self: false`
5. **No GET request needed**
6. Message confirmed and updated with real ID

### Receiver Receives Message
1. Subscribed to channel via Supabase broadcast
2. Receives `new_message` event from Supabase
3. `onNewMessage` handler enriches message with user data
4. Message added to local state and appears in UI
5. **No API call needed**

This ensures true real-time communication with zero unnecessary API requests.
