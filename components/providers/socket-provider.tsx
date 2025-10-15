import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
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

export function SocketProvider({ children }: SocketProviderProps) {
  const { data: session } = useSession()
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Only initialize socket if user is authenticated
    if (!session?.user) return

    // Create socket connection
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/api/socket/io',
      addTrailingSlash: false,
    })

    socketRef.current = socket

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected')
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
      socketRef.current = null
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
    if (!socketRef.current || !session?.user) return

    // Get JWT token from session
    const token = (session as any)?.accessToken || ''

    socketRef.current.emit('user:connect', {
      token,
      channelIds
    })
  }

  const disconnect = () => {
    if (!socketRef.current) return
    socketRef.current.disconnect()
    socketRef.current = null
    setIsConnected(false)
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
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}