import mongoose from 'mongoose'

// Import all models to ensure they're registered
import '@/models/User'
import '@/models/Role'
import '@/models/Department'
import '@/models/SystemPermission'

// Simple connection state management
let isConnected = false
let isConnecting = false
let connectionPromise: Promise<typeof mongoose> | null = null

// Simple cache for query results (optional enhancement)
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

/**
 * Main MongoDB connection function with singleton pattern
 */
async function connectDB(): Promise<{ db: mongoose.Connection['db'] }> {
  // Return existing connection if already connected
  if (isConnected && mongoose.connection.readyState === 1) {
    return { db: mongoose.connection.db }
  }

  // If already connecting, wait for the existing promise
  if (isConnecting && connectionPromise) {
    await connectionPromise
    return { db: mongoose.connection.db }
  }

  // Validate MongoDB URI
  if (!process.env.MONGODB_URI) {
    throw new Error('❌ MONGODB_URI environment variable is not defined')
  }

  // Start connection process
  isConnecting = true
  console.log('🚀 Connecting to MongoDB...')

  try {
    // Optimized connection options
    const connectionOptions = {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    }

    // Create connection promise
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, connectionOptions)
    await connectionPromise

    // Set connection status
    isConnected = true
    isConnecting = false

    console.log('✅ MongoDB connected successfully')
    console.log(`📊 Database: ${mongoose.connection.db?.databaseName}`)

    return { db: mongoose.connection.db }

  } catch (error: any) {
    isConnected = false
    isConnecting = false
    connectionPromise = null
    console.error('❌ MongoDB connection failed:', error.message)
    throw error
  }
}

/**
 * Enhanced query function with optional caching
 */
async function query<T>(
  queryFn: () => Promise<T>, 
  cacheKey?: string, 
  cacheTtl: number = 30000 // 30 seconds default
): Promise<T> {
  // Check cache first if key provided
  if (cacheKey && queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey)!
    if (Date.now() - cached.timestamp < cached.ttl) {
      console.log(`🎯 Cache hit: ${cacheKey}`)
      return cached.data
    }
    queryCache.delete(cacheKey)
  }

  // Ensure connection
  await connectDB()

  // Execute query
  const result = await queryFn()

  // Cache result if key provided
  if (cacheKey) {
    queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl: cacheTtl
    })
    console.log(`💾 Cached: ${cacheKey} (TTL: ${cacheTtl}ms)`)
  }

  return result
}

/**
 * Clear cache (useful for data mutations)
 */
function clearCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear()
    console.log('🧹 All cache cleared')
    return
  }

  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key)
    }
  }
  console.log(`🗑️ Cleared cache matching: ${pattern}`)
}

// Connection event handlers
mongoose.connection.on('connected', () => {
  isConnected = true
  isConnecting = false
  console.log('🟢 MongoDB connection established')
})

mongoose.connection.on('error', (error) => {
  isConnected = false
  isConnecting = false
  connectionPromise = null
  console.error('🔴 MongoDB connection error:', error.message)
})

mongoose.connection.on('disconnected', () => {
  isConnected = false
  isConnecting = false
  connectionPromise = null
  console.log('🟡 MongoDB disconnected')
})

// Graceful shutdown
process.on('SIGINT', async () => {
  if (isConnected) {
    await mongoose.connection.close()
    console.log('🔌 MongoDB connection closed')
    process.exit(0)
  }
})

export default connectDB
export { query, clearCache }