// Communication Types - Following CRM patterns
export interface ICommunication {
  _id: string
  projectId?: string // FK to Projects
  senderId: string // FK to Users or Clients
  receiverId?: string // FK to Users/Clients (null for group channels)
  senderModel: 'User' | 'Client'
  receiverModel?: 'User' | 'Client'
  channelId: string // Unique channel identifier
  subject?: string
  message: string
  communicationType: 'chat' | 'email' | 'note'
  priority: 'low' | 'medium' | 'high'
  isRead: boolean
  isInternal: boolean // True for internal users only
  attachments?: string[] // Array of file URLs
  parentMessageId?: string // For threading/replies
  readAt?: string // ISO string to avoid Redux serialization issues
  typingUsers?: string[] // Array of user IDs typing
  createdAt: string // ISO string to avoid Redux serialization issues
  updatedAt: string // ISO string to avoid Redux serialization issues
}

export interface IChannel {
  _id: string
  channelId: string
  name: string
  type: 'dm' | 'project' | 'client-support' | 'group'
  participants: IParticipant[]
  projectId?: string
  isInternal: boolean
  lastMessage?: ICommunication
  unreadCount: number
  createdAt: string // ISO string to avoid Redux serialization issues
  updatedAt: string // ISO string to avoid Redux serialization issues
}

export interface IParticipant {
  _id: string
  name: string
  email: string
  avatar?: string
  isOnline: boolean
  userType: 'User' | 'Client'
  role?: string
}

export interface ITypingIndicator {
  channelId: string
  userId: string
  userName: string
  timestamp: string // ISO string to avoid Redux serialization issues
}

// Filter and Query Types
export interface CommunicationFilters {
  channelId?: string
  isInternal?: boolean
  communicationType?: 'chat' | 'email' | 'note'
  priority?: 'low' | 'medium' | 'high'
  search?: string
  dateFrom?: string // ISO string to avoid Redux serialization issues
  dateTo?: string // ISO string to avoid Redux serialization issues
}

export interface CommunicationSort {
  field: keyof ICommunication
  direction: 'asc' | 'desc'
}

export interface FetchMessagesParams {
  channelId: string
  page?: number
  limit?: number
  filters?: CommunicationFilters
  sort?: CommunicationSort
}

// Form Data Types
export interface CreateMessageData {
  channelId: string
  message: string
  attachments?: string[]
  parentMessageId?: string
  communicationType?: 'chat' | 'email' | 'note'
  priority?: 'low' | 'medium' | 'high'
}

export interface CreateChannelData {
  name?: string
  type: 'dm' | 'project' | 'client-support' | 'group' | 'department' | 'general'
  participants: string[]
  projectId?: string
  departmentId?: string
  isInternal?: boolean
}

export interface UpdateMessageData {
  message?: string
  isRead?: boolean
  readAt?: string // ISO string to avoid Redux serialization issues
}

// Socket Event Types
export interface SocketEvents {
  // Connection events
  'user:connect': { userId: string; channelIds: string[] }
  'user:disconnect': { userId: string }
  
  // Channel events
  'channel:join': { channelId: string }
  'channel:leave': { channelId: string }
  
  // Message events
  'message:send': CreateMessageData
  'message:receive': ICommunication
  'message:read': { messageId: string; channelId: string }
  'message:typing': { channelId: string; userId: string; userName: string }
  'message:stop_typing': { channelId: string; userId: string }
  
  // Notification events
  'notification:new_message': { channelId: string; message: ICommunication }
}

// Component Props Types
export interface ChatWindowProps {
  channelId: string
  className?: string
  onToggleSidebar?: () => void
  isSidebarExpanded?: boolean
}

export interface MessageListProps {
  messages: ICommunication[]
  typingUsers: ITypingIndicator[]
  currentUserId: string
  onMessageRead?: (messageId: string) => void
}

export interface MessageInputProps {
  channelId: string
  onSend: (data: CreateMessageData) => void
  disabled?: boolean
  placeholder?: string
  allowAttachments?: boolean
}

export interface ChannelListProps {
  channels: IChannel[]
  activeChannelId?: string
  onChannelSelect: (channelId: string) => void
  currentUserId: string
  showSearch?: boolean
}

export interface OnlineIndicatorProps {
  users: IParticipant[]
  maxVisible?: number
}

export interface ContextPanelProps {
  channel?: IChannel
  isVisible: boolean
  onToggle: () => void
}

// API Response Types
export interface CommunicationApiResponse {
  success: boolean
  data?: ICommunication | ICommunication[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
  error?: string
  message?: string
}

export interface ChannelApiResponse {
  success: boolean
  data?: IChannel | IChannel[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
  error?: string
  message?: string
}