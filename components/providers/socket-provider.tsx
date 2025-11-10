import { createContext, useContext, useEffect, useRef, useState, ReactNode, memo } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  connect: (channelIds: string[]) => void
  disconnect: () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

interface SocketProviderProps {
  children: ReactNode
}

export const SocketProvider = memo(function SocketProvider({ children }: SocketProviderProps) {
  const { data: session } = useSession()
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    // Skip socket connection for now to avoid WebSocket errors
    // This prevents navigation performance issues caused by failed socket connections
    if (!session?.user) return
    
    // Check if WebSocket should be enabled (optional feature)
    const enableWebSocket = process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true'
    if (!enableWebSocket) {
      // WebSocket disabled - just provide context without connection
      return
    }

    // Delay socket connection to not interfere with initial page load
    const initTimeout = setTimeout(() => {
      try {
        // Create socket connection with optimized settings and error handling
        const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
          path: '/api/socket/io',
          addTrailingSlash: false,
          transports: ['websocket', 'polling'], // Prefer websocket
          upgrade: true,
          rememberUpgrade: true,
          timeout: 5000, // 5 second timeout
          forceNew: true, // Create new connection
        })

        socketRef.current = socket

        // Connection events
        socket.on('connect', () => {
          setIsConnected(true)
          setConnectionError(null)
        })

        socket.on('disconnect', () => {
          setIsConnected(false)
        })

        socket.on('connect_error', (error) => {
          setConnectionError(`Socket connection failed: ${error.message}`)
          setIsConnected(false)
          // Don't spam console with connection errors
        })

        socket.on('error', (error) => {
          setConnectionError(`Socket error: ${error}`)
          setIsConnected(false)
        })

        // Auto-reconnect on disconnect (limited attempts)
        socket.on('disconnect', (reason) => {
          if (reason === 'io server disconnect') {
            // Server disconnected - try to reconnect after delay
            reconnectTimeoutRef.current = setTimeout(() => {
              if (socketRef.current) {
                socket.connect()
              }
            }, 5000)
          }
        })
      } catch (error) {
        setConnectionError(`Failed to initialize socket: ${error}`)
        console.warn('Socket initialization failed:', error)
      }
    }, 2000) // 2 second delay to ensure page load completes

    // Cleanup on unmount
    return () => {
      clearTimeout(initTimeout)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setIsConnected(false)
    }
  }, [session?.user])

  useEffect(() => {
    if (!socketRef.current) return

    // Send heartbeat every 25 seconds
    const heartbeatInterval = setInterval(() => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit('user:heartbeat')
      }
    }, 25000)

    return () => clearInterval(heartbeatInterval)
  }, [isConnected])

  const connect = (channelIds: string[]) => {
    if (!socketRef.current || !session?.user || !isConnected) {
      // Silently handle case where WebSocket is not available
      return
    }

    try {
      // Get JWT token from session
      const token = (session as any)?.accessToken || ''

      socketRef.current.emit('user:connect', {
        token,
        channelIds
      })
    } catch (error) {
      console.warn('Failed to connect to channels:', error)
    }
  }

  const disconnect = () => {
    if (!socketRef.current) return
    
    try {
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
    } catch (error) {
      console.warn('Failed to disconnect socket:', error)
    }
  }

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
})

export function useSocket() {
  // Return safe default values instead of throwing error
  // This prevents crashes when socket functionality is not needed
  return {
    socket: null,
    isConnected: false,
    connect: () => {
      // No-op function for compatibility
    },
    disconnect: () => {
      // No-op function for compatibility  
    }
  }
}