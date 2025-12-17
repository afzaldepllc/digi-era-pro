// Communication Types - Updated for Supabase integration

// Messages table interface
export interface ICommunication {
  id: string // Supabase UUID
  channel_id: string // Supabase channel UUID reference
  mongo_sender_id: string // MongoDB user ID of sender
  content: string // Message content
  content_type: 'text' | 'file' | 'system' // Content type
  thread_id?: string // For threading (optional)
  reply_count: number // Number of replies
  mongo_mentioned_user_ids?: string[] // Array of mentioned user IDs
  is_edited: boolean // Edit status
  edited_at?: string // Edit timestamp
  created_at: string // Creation timestamp
  attachments?: IAttachment[]
  read_receipts?: IReadReceipt[]
}

// Channels table interface
export interface IChannel {
  id: string // Supabase UUID
  type: 'dm' | 'group' | 'department' | 'project' | 'client-support' // Channel type
  name?: string // Channel name (optional for DMs)
  avatar_url?: string // Channel avatar URL
  mongo_department_id?: string // MongoDB department reference
  mongo_project_id?: string // MongoDB project reference
  mongo_creator_id: string // MongoDB user ID of creator
  is_private: boolean // Privacy setting
  member_count: number // Number of members
  last_message_at?: string // Last message timestamp
  created_at: string // Creation timestamp
  updated_at: string // Update timestamp
  // UI helper fields (not in schema)
  last_message?: ICommunication
  unreadCount?: number
  participants: IChannelMember[] // Required for UI
}

// Channel members table interface
export interface IChannelMember extends IParticipant {
  channel_id: string // Supabase channel UUID
  mongo_member_id: string // MongoDB user ID
  role: 'admin' | 'member' // Channel role
  last_read_at: string // Last read timestamp
  is_muted: boolean // Mute status
  notification_level: 'all' | 'mentions' | 'none' // Notification preference
  joined_at: string // Join timestamp
  mongo_invited_by_id?: string // Who invited this member
  // UI helper fields (not in schema) - inherited from IParticipant
}

export interface IParticipant {
  mongo_member_id: string // Changed from 'mongoUserId'
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
  timestamp: Date
}

// Filter and Query Types
export interface CommunicationFilters {
  channelId?: string
  is_private?: boolean // Changed from 'isInternal'
  mongoDepartmentId?: string
  mongo_project_id?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface CommunicationSort {
  field: keyof ICommunication
  direction: 'asc' | 'desc'
}

export interface FetchMessagesParams {
  channel_id: string
  page?: number
  limit?: number
  filters?: CommunicationFilters
  sort?: CommunicationSort
}

// Form Data Types
export interface CreateMessageData {
  channel_id: string
  content: string // Changed from 'message'
  content_type?: 'text' | 'file' | 'system' // Changed from 'messageType'
  attachments?: string[] // array of attachment URLs or attachment ids (depends on upload flow)
  thread_id?: string // Changed from 'parentMessageId'
}

export interface CreateChannelData {
  name?: string
  type: 'dm' | 'group' | 'department' | 'project' | 'client-support' // Updated to match schema
  participants: string[] // MongoDB User IDs
  mongo_project_id?: string
  mongo_department_id?: string
  is_private?: boolean // Changed from 'isInternal'
}

export interface UpdateMessageData {
  content?: string // Changed from 'message'
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

// New interfaces for additional features
export interface IReaction {
  id: string
  message_id: string
  mongo_user_id: string
  reaction_type: string
  created_at: string
}

export interface IAttachment {
  id: string
  message_id: string
  file_name: string
  file_url?: string
  s3_key?: string
  s3_bucket?: string
  file_size?: number
  file_type?: string
  uploaded_by?: string
  created_at: string
  width?: number
  height?: number
  durationSeconds?: number
}

export interface IReadReceipt {
  message_id: string
  mongo_user_id: string
  read_at: string
}