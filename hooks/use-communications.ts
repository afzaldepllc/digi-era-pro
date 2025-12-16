import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppSelector, useAppDispatch } from './redux'
import type { User } from '@/types'
import {
  setActiveChannel,
  clearActiveChannel,
  setChannels,
  setMessages,
  addMessage,
  updateMessage,
  setTyping,
  removeTyping,
  updateOnlineUsers,
  toggleChannelList,
  toggleContextPanel,
  setChannelListExpanded,
  setContextPanelVisible,
  setFilters,
  setSort,
  setPagination,
  setLoading,
  setActionLoading,
  setMessagesLoading,
  clearError,
  setError,
  addNotification,
  clearNotifications,
  resetState
} from '@/store/slices/communicationSlice'
import type {
  FetchMessagesParams,
  CreateMessageData,
  CreateChannelData,
  CommunicationFilters,
  CommunicationSort,
  ITypingIndicator,
  IParticipant,
  ICommunication,
  IChannel
} from '@/types/communication'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/utils/api-client'
import { getRealtimeManager } from '@/lib/realtime-manager'
const mockChannels: IChannel[] = [
  // 1. General Channel - Company-wide
  {
    id: '1',
    type: 'group', // Changed from 'general'
    name: 'General',
    avatar_url: undefined,
    mongo_department_id: undefined,
    mongo_project_id: undefined,
    mongo_creator_id: 'user1',
    is_private: false,
    member_count: 3,
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    participants: [
      {
        channel_id: '1',
        mongo_member_id: 'user1',
        role: 'admin',
        last_read_at: new Date(Date.now() - 86400000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 86400000).toISOString(),
        mongo_invited_by_id: undefined,
        userType: 'User',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: undefined,
        isOnline: true
      },
      {
        channel_id: '1',
        mongo_member_id: 'user2',
        role: 'member',
        last_read_at: new Date(Date.now() - 84000000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 86400000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'User',
        name: 'Jane Smith',
        email: 'jane@example.com',
        avatar: undefined,
        isOnline: false
      },
      {
        channel_id: '1',
        mongo_member_id: 'user3',
        role: 'member',
        last_read_at: new Date(Date.now() - 3600000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'User',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        avatar: undefined,
        isOnline: true
      }
    ],
    last_message: {
      id: 'msg1-3',
      mongo_sender_id: 'user3',
      channel_id: '1',
      content: 'Great work on the Q4 initiatives everyone! 🚀',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 3600000).toISOString()
    } as ICommunication,
    created_at: new Date(Date.now() - 2592000000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },

  // 2. Department Channel - IT Department
  {
    id: '2',
    type: 'department',
    name: 'IT Department',
    avatar_url: undefined,
    mongo_department_id: 'dept1',
    mongo_project_id: undefined,
    mongo_creator_id: 'user1',
    is_private: false,
    member_count: 2,
    last_message_at: new Date(Date.now() - 1800000).toISOString(),
    participants: [
      {
        channel_id: '2',
        mongo_member_id: 'user1',
        role: 'admin',
        last_read_at: new Date(Date.now() - 14400000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: undefined,
        userType: 'User',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: undefined,
        isOnline: true
      },
      {
        channel_id: '2',
        mongo_member_id: 'user3',
        role: 'member',
        last_read_at: new Date(Date.now() - 1800000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'User',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        avatar: undefined,
        isOnline: true
      }
    ],
    last_message: {
      id: 'msg2-3',
      mongo_sender_id: 'user3',
      channel_id: '2',
      content: 'Server maintenance scheduled for tonight at 10 PM',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 1800000).toISOString()
    } as ICommunication,
    created_at: new Date(Date.now() - 2592000000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString()
  },

  // 3. Department Channel - Sales Department
  {
    id: '3',
    type: 'department',
    name: 'Sales Department',
    avatar_url: undefined,
    mongo_department_id: 'dept2',
    mongo_project_id: undefined,
    mongo_creator_id: 'user2',
    is_private: false,
    member_count: 2,
    last_message_at: new Date(Date.now() - 7200000).toISOString(),
    unreadCount: 0,
    participants: [
      {
        channel_id: '3',
        mongo_member_id: 'user2',
        role: 'admin',
        last_read_at: new Date(Date.now() - 7200000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: undefined,
        userType: 'User',
        name: 'Jane Smith',
        email: 'jane@example.com',
        avatar: undefined,
        isOnline: false
      },
      {
        channel_id: '3',
        mongo_member_id: 'user4',
        role: 'member',
        last_read_at: new Date(Date.now() - 7200000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 259200000).toISOString(),
        mongo_invited_by_id: 'user2',
        userType: 'User',
        name: 'Alice Brown',
        email: 'alice@example.com',
        avatar: undefined,
        isOnline: true
      }
    ],
    last_message: {
      id: 'msg3-1',
      mongo_sender_id: 'user2',
      channel_id: '3',
      content: 'New sales targets for Q1 have been set!',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      readAt: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
    } as ICommunication,
    created_at: new Date(Date.now() - 2592000000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString()
  },

  // 4. Project Channel - Project Alpha
  {
    id: '4',
    type: 'project',
    name: 'Project Alpha',
    avatar_url: undefined,
    mongo_department_id: undefined,
    mongo_project_id: 'proj1',
    mongo_creator_id: 'user1',
    is_private: false,
    member_count: 3,
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 1,
    participants: [
      {
        channel_id: '4',
        mongo_member_id: 'user1',
        role: 'admin',
        last_read_at: new Date(Date.now() - 3600000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 1209600000).toISOString(),
        mongo_invited_by_id: undefined,
        userType: 'User',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: undefined,
        isOnline: true
      },
      {
        channel_id: '4',
        mongo_member_id: 'user3',
        role: 'member',
        last_read_at: new Date(Date.now() - 3600000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 1209600000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'User',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        avatar: undefined,
        isOnline: true
      },
      {
        channel_id: '4',
        mongo_member_id: 'user5',
        role: 'member',
        last_read_at: new Date(Date.now() - 3600000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'Client',
        name: 'Client One',
        email: 'client1@example.com',
        avatar: undefined,
        isOnline: false
      }
    ],
    last_message: {
      id: 'msg4-1',
      mongo_sender_id: 'user1',
      channel_id: '4',
      content: 'Project Alpha kickoff meeting is scheduled for tomorrow',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      read_receipts: [],
      created_at: new Date(Date.now() - 3600000).toISOString(),
    } as ICommunication,
    created_at: new Date(Date.now() - 1209600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString()
  },

  // 5. DM Channel - User to User
  {
    id: '5',
    type: 'dm',
    name: undefined, // DMs don't have names
    avatar_url: undefined,
    mongo_department_id: undefined,
    mongo_project_id: undefined,
    mongo_creator_id: 'user1',
    is_private: true,
    member_count: 2,
    last_message_at: new Date(Date.now() - 10800000).toISOString(),
    unreadCount: 0,
    participants: [
      {
        channel_id: '5',
        mongo_member_id: 'user1',
        role: 'admin',
        last_read_at: new Date(Date.now() - 10800000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 2592000000).toISOString(),
        mongo_invited_by_id: undefined,
        userType: 'User',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: undefined,
        isOnline: true
      },
      {
        channel_id: '5',
        mongo_member_id: 'user2',
        role: 'member',
        last_read_at: new Date(Date.now() - 10800000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 2592000000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'User',
        name: 'Jane Smith',
        email: 'jane@example.com',
        avatar: undefined,
        isOnline: false
      }
    ],
    last_message: {
      id: 'msg5-1',
      mongo_sender_id: 'user2',
      channel_id: '5',
      content: 'Hey John, can we discuss the project timeline?',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      readAt: new Date(Date.now() - 10800000).toISOString(),
      created_at: new Date(Date.now() - 10800000).toISOString(),
    } as ICommunication,
    created_at: new Date(Date.now() - 2592000000).toISOString(),
    updated_at: new Date(Date.now() - 10800000).toISOString()
  },

  // 6. Client Support Channel - Support Agent to Client
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    type: 'dm',
    name: undefined, // DMs don't have names
    avatar_url: undefined,
    mongo_department_id: undefined,
    mongo_project_id: 'proj1',
    mongo_creator_id: 'user1',
    is_private: true,
    member_count: 2,
    last_message_at: new Date(Date.now() - 1800000).toISOString(),
    unreadCount: 1,
    participants: [
      {
        channel_id: '550e8400-e29b-41d4-a716-446655440005',
        mongo_member_id: 'user1',
        role: 'admin',
        last_read_at: new Date(Date.now() - 86400000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: undefined,
        userType: 'User',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: undefined,
        isOnline: true
      },
      {
        channel_id: '550e8400-e29b-41d4-a716-446655440005',
        mongo_member_id: 'user5',
        role: 'member',
        last_read_at: new Date(Date.now() - 1800000).toISOString(),
        is_muted: false,
        notification_level: 'all',
        joined_at: new Date(Date.now() - 604800000).toISOString(),
        mongo_invited_by_id: 'user1',
        userType: 'Client',
        name: 'Client One',
        email: 'client1@example.com',
        avatar: undefined,
        isOnline: false
      }
    ],
    last_message: {
      id: 'msg6-5',
      mongo_sender_id: 'user5',
      channel_id: '550e8400-e29b-41d4-a716-446655440005',
      content: 'When can I expect the next update?',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      read_receipts: [],
      created_at: new Date(Date.now() - 1800000).toISOString(),
    } as ICommunication,
    created_at: new Date(Date.now() - 604800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString()
  }
]

const mockMessages: Record<string, ICommunication[]> = {
  // General Channel Messages
  '1': [
    {
      id: 'msg1-1',
      mongo_sender_id: 'user1',
      channel_id: '1',
      content: 'Welcome to the general channel! 👋',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg1-2',
      mongo_sender_id: 'user2',
      channel_id: '1',
      content: 'Hello everyone! Looking forward to collaborating 😊',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 84000000).toISOString(),
    },
    {
      id: 'msg1-3',
      mongo_sender_id: 'user3',
      channel_id: '1',
      content: 'Great work on the Q4 initiatives everyone! 🚀',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    }
  ],

  // Department IT Channel Messages
  '2': [
    {
      id: 'msg2-1',
      mongo_sender_id: 'user1',
      channel_id: '2',
      content: 'System upgrade completed successfully',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'msg2-2',
      mongo_sender_id: 'user3',
      channel_id: '2',
      content: 'All tests passed. Ready for production deployment.',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'msg2-3',
      mongo_sender_id: 'user3',
      channel_id: '2',
      content: 'Server maintenance scheduled for tonight at 10 PM',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 1800000).toISOString(),
    }
  ],

  // Department Sales Channel Messages
  '3': [
    {
      id: 'msg3-1',
      mongo_sender_id: 'user2',
      channel_id: '3',
      content: 'Q4 targets have been set. Focus on enterprise deals.',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 18000000).toISOString(),
    },
    {
      id: 'msg3-2',
      mongo_sender_id: 'user4',
      channel_id: '3',
      content: 'Already have 3 hot leads for this quarter',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'msg3-3',
      mongo_sender_id: 'user4',
      channel_id: '3',
      content: 'Updated Q4 sales targets - please review',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 7200000).toISOString(),
    }
  ],

  // Project Alpha Channel Messages
  '4': [
    {
      id: 'msg4-1',
      mongo_sender_id: 'user1',
      channel_id: '4',
      content: 'Project kickoff - Welcome to Project Alpha team!',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 1209600000).toISOString(),
    },
    {
      id: 'msg4-2',
      mongo_sender_id: 'user3',
      channel_id: '4',
      content: 'Backend APIs ready for integration testing',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 604800000).toISOString(),
    },
    {
      id: 'msg4-3',
      mongo_sender_id: 'user1',
      channel_id: '4',
      content: 'Great progress! Let\'s sync up tomorrow at 2 PM',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 432000000).toISOString(),
    },
    {
      id: 'msg4-4',
      mongo_sender_id: 'user5',
      channel_id: '4',
      content: 'Can you provide the latest version of the design specs?',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: 'msg4-5',
      mongo_sender_id: 'user3',
      channel_id: '4',
      content: 'Feature development 85% complete',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ],

  // DM User1-User2 Channel Messages
  '5': [
    {
      id: 'msg5-1',
      mongo_sender_id: 'user1',
      channel_id: '5',
      content: 'Hey Jane, do you have time for a quick sync?',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 18000000).toISOString(),
    },
    {
      id: 'msg5-2',
      mongo_sender_id: 'user2',
      channel_id: '5',
      content: 'Sure! I\'ll be free in 10 minutes',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'msg5-3',
      mongo_sender_id: 'user1',
      channel_id: '5',
      content: 'Perfect! Let me know if you need any other resources',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'msg5-4',
      mongo_sender_id: 'user1',
      channel_id: '5',
      content: 'Let me know if you need any updates',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 10800000).toISOString(),
    }
  ],

  // Client Support Channel Messages
  '550e8400-e29b-41d4-a716-446655440005': [
    {
      id: 'msg6-1',
      mongo_sender_id: 'user1',
      channel_id: '550e8400-e29b-41d4-a716-446655440005',
      content: 'Welcome! Thanks for choosing us. How can I help you today?',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 604800000).toISOString(),
    },
    {
      id: 'msg6-2',
      mongo_sender_id: 'user5',
      channel_id: '550e8400-e29b-41d4-a716-446655440005',
      content: 'Hi! I need help with setting up the integration',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 604800000).toISOString(),
    },
    {
      id: 'msg6-3',
      mongo_sender_id: 'user1',
      channel_id: '550e8400-e29b-41d4-a716-446655440005',
      content: 'No problem! Let me guide you through the setup process.',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 432000000).toISOString(),
    },
    {
      id: 'msg6-4',
      mongo_sender_id: 'user1',
      channel_id: '550e8400-e29b-41d4-a716-446655440005',
      content: 'I\'ve sent you the documentation. Check your email!',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,

      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg6-5',
      mongo_sender_id: 'user5',
      channel_id: '550e8400-e29b-41d4-a716-446655440005',
      content: 'When can I expect the next update?',
      content_type: 'text',
      thread_id: undefined,
      reply_count: 0,
      mongo_mentioned_user_ids: [],
      is_edited: false,
      edited_at: undefined,
      created_at: new Date(Date.now() - 1800000).toISOString(),
    }
  ]
}

// Mock users data for the user directory
const mockUsers: User[] = [
  {
    _id: 'user1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Admin',
    avatar: undefined,
    phone: undefined,
    department: {
      _id: 'dept1',
      name: 'System',
      category: 'it' as const,
      status: 'active' as const
    },
    position: 'Administrator',
    status: 'active' as const,
    permissions: ['read', 'write', 'delete'],
    isClient: false,
    emailVerified: true,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'user2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'Manager',
    avatar: undefined,
    phone: undefined,
    department: {
      _id: 'dept2',
      name: 'Sales',
      category: 'sales' as const,
      status: 'active' as const
    },
    position: 'Sales Manager',
    status: 'active' as const,
    permissions: ['read', 'write'],
    isClient: false,
    emailVerified: true,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'user3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'Developer',
    avatar: undefined,
    phone: undefined,
    department: {
      _id: 'dept1',
      name: 'IT',
      category: 'it' as const,
      status: 'active' as const
    },
    position: 'Senior Developer',
    status: 'active' as const,
    permissions: ['read', 'write'],
    isClient: false,
    emailVerified: true,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'user4',
    name: 'Alice Brown',
    email: 'alice@example.com',
    role: 'Employee',
    avatar: undefined,
    phone: undefined,
    department: {
      _id: 'dept3',
      name: 'Support',
      category: 'support' as const,
      status: 'active' as const
    },
    position: 'Support Agent',
    status: 'active' as const,
    permissions: ['read'],
    isClient: false,
    emailVerified: true,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // Client User
  {
    _id: 'user5',
    name: 'Client One',
    email: 'client1@example.com',
    role: 'Client',
    avatar: undefined,
    phone: undefined,
    department: {
      _id: 'dept0',
      name: 'Clients',
      category: 'clients' as const,
      status: 'active' as const
    },
    position: 'Client',
    status: 'active' as const,
    permissions: ['read'],
    isClient: true,
    emailVerified: true,
    phoneVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

// Mock current user
const mockCurrentUser: User = {
  _id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'Admin',
  avatar: undefined,
  phone: undefined,
  department: {
    _id: 'dept1',
    name: 'IT',
    category: 'it' as const,
    status: 'active' as const
  },
  position: 'System Administrator',
  status: 'active' as const,
  permissions: ['read', 'write', 'admin'],
  isClient: false,
  emailVerified: true,
  phoneVerified: false,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date()
}

export function useCommunications() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const realtimeManager = getRealtimeManager()

  const {
    channels,
    activeChannelId,
    selectedChannel,
    messages,
    onlineUsers,
    typingUsers,
    isChannelListExpanded,
    isContextPanelVisible,
    loading,
    actionLoading,
    messagesLoading,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications
  } = useAppSelector((state) => state.communications)

  // Initialize realtime manager with event handlers
  useEffect(() => {
    realtimeManager.updateHandlers({
      onNewMessage: (message) => {
        dispatch(addMessage({ channelId: message.channel_id, message }))
      },
      onMessageUpdate: (message) => {
        dispatch(updateMessage({
          channelId: message.channel_id,
          messageId: message.id,
          updates: message
        }))
      },
      onMessageDelete: (messageId) => {
        // Handle message deletion
        console.log('Message deleted:', messageId)
      },
      onUserJoined: (member) => {
        // Handle user joined
        console.log('User joined:', member)
      },
      onUserLeft: (memberId) => {
        // Handle user left
        console.log('User left:', memberId)
      },
      onUserOnline: (userId) => {
        dispatch(updateOnlineUsers({ userId, isOnline: true }))
      },
      onUserOffline: (userId) => {
        dispatch(updateOnlineUsers({ userId, isOnline: false }))
      },
      onTypingStart: (userId) => {
        dispatch(setTyping({
          channelId: activeChannelId || '',
          userId,
          userName: 'Unknown User', // Will be resolved later
          timestamp: new Date().toISOString()
        }))
      },
      onTypingStop: (userId) => {
        dispatch(removeTyping(activeChannelId || '', userId))
      }
    })
  }, [dispatch, realtimeManager, activeChannelId])

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels()
  }, [])

  // Subscribe to active channel
  useEffect(() => {
    if (activeChannelId) {
      realtimeManager.subscribeToChannel(activeChannelId)
      fetchMessages({ channel_id: activeChannelId })
    }

    return () => {
      if (activeChannelId) {
        realtimeManager.unsubscribeFromChannel(activeChannelId)
      }
    }
  }, [activeChannelId, realtimeManager])

  // Channel operations
  const fetchChannels = useCallback(async (params: { type?: string; department_id?: string; project_id?: string } = {}) => {
    try {
      dispatch(setLoading(true))
      const response = await apiRequest('/api/communication/channels', {
        method: 'GET',
        params
      })
      dispatch(setChannels(response.channels))
      return response.channels
    } catch (error) {
      dispatch(setError('Failed to fetch channels'))
      toast({
        title: "Error",
        description: "Failed to load channels",
        variant: "destructive"
      })
      return []
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, toast])

  const selectChannel = useCallback((channel_id: string) => {
    dispatch(setActiveChannel(channel_id))
  }, [dispatch])

  const clearActiveChannel = useCallback(() => {
    dispatch(clearActiveChannel())
  }, [dispatch])

  // Message operations
  const fetchMessages = useCallback(async (params: FetchMessagesParams) => {
    try {
      dispatch(setMessagesLoading(true))
      const response = await apiRequest('/api/communication/messages', {
        method: 'GET',
        params: { channel_id: params.channel_id, limit: params.limit, offset: params.offset }
      })
      dispatch(setMessages({ channelId: params.channel_id, messages: response.messages }))
      return response.messages
    } catch (error) {
      dispatch(setError('Failed to fetch messages'))
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      })
      return []
    } finally {
      dispatch(setMessagesLoading(false))
    }
  }, [dispatch, toast])

  const sendMessage = useCallback(async (messageData: CreateMessageData) => {
    try {
      dispatch(setActionLoading(true))
      const response = await apiRequest('/api/communication/messages', {
        method: 'POST',
        body: messageData
      })

      // The message will be added via realtime subscription
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      })

      return response.message
    } catch (error) {
      dispatch(setError('Failed to send message'))
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, toast])

  const createChannel = useCallback(async (channelData: CreateChannelData) => {
    try {
      dispatch(setActionLoading(true))
      const response = await apiRequest('/api/communication/channels', {
        method: 'POST',
        body: channelData
      })

      // Refresh channels list
      await fetchChannels()

      toast({
        title: "Channel created",
        description: "New conversation started successfully",
      })

      return response.channel
    } catch (error) {
      dispatch(setError('Failed to create channel'))
      toast({
        title: "Error",
        description: "Failed to create channel",
        variant: "destructive"
      })
      throw error
    } finally {
      dispatch(setActionLoading(false))
    }
  }, [dispatch, toast, fetchChannels])

  const markAsRead = useCallback(async (messageId: string, channel_id: string) => {
    try {
      await apiRequest('/api/communication/read-receipts', {
        method: 'POST',
        body: { message_id: messageId, channel_id }
      })
    } catch (error) {
      console.error('Failed to mark message as read:', error)
    }
  }, [])

  // Real-time operations
  const setTyping = useCallback((typingIndicator: ITypingIndicator) => {
    if (activeChannelId) {
      realtimeManager.sendTypingStart(activeChannelId, typingIndicator.userId)
      dispatch(setTyping(typingIndicator))

      // Auto-remove typing indicator after 3 seconds
      setTimeout(() => {
        removeTyping(activeChannelId, typingIndicator.userId)
      }, 3000)
    }
  }, [dispatch, activeChannelId, realtimeManager])

  const removeTyping = useCallback((channelId: string, userId: string) => {
    realtimeManager.sendTypingStop(channelId, userId)
    dispatch(removeTyping({ channelId, userId }))
  }, [dispatch, realtimeManager])

  // UI state operations
  const toggleChannelList = useCallback(() => {
    dispatch(toggleChannelList())
  }, [dispatch])

  const toggleContextPanel = useCallback(() => {
    dispatch(toggleContextPanel())
  }, [dispatch])

  const setChannelListExpanded = useCallback((expanded: boolean) => {
    dispatch(setChannelListExpanded(expanded))
  }, [dispatch])

  const setContextPanelVisible = useCallback((visible: boolean) => {
    dispatch(setContextPanelVisible(visible))
  }, [dispatch])

  // Filter and search operations
  const setFilters = useCallback((newFilters: CommunicationFilters) => {
    dispatch(setFilters(newFilters))
  }, [dispatch])

  const setSort = useCallback((newSort: CommunicationSort) => {
    dispatch(setSort(newSort))
  }, [dispatch])

  const setPagination = useCallback((newPagination: any) => {
    dispatch(setPagination(newPagination))
  }, [dispatch])

  // Error handling
  const clearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const setError = useCallback((errorMessage: string) => {
    dispatch(setError(errorMessage))
  }, [dispatch])

  // Notifications
  const addNotification = useCallback((notification: any) => {
    dispatch(addNotification(notification))
  }, [dispatch])

  const clearNotifications = useCallback(() => {
    dispatch(clearNotifications())
  }, [dispatch])

  // Utility operations
  const resetState = useCallback(() => {
    dispatch(resetState())
  }, [dispatch])

  const refreshChannels = useCallback(() => {
    return fetchChannels()
  }, [fetchChannels])

  const refreshMessages = useCallback(() => {
    if (activeChannelId) {
      return fetchMessages({ channel_id: activeChannelId })
    }
  }, [fetchMessages, activeChannelId])

  // Mock data for backward compatibility (remove when fully migrated)
  const mockUsers = [] as User[]
  const mockCurrentUser = null as User | null
  const hasChannels = channels.length > 0

  return {
    // State
    channels,
    activeChannelId,
    selectedChannel,
    messages,
    onlineUsers,
    typingUsers,
    isChannelListExpanded,
    isContextPanelVisible,
    loading,
    actionLoading,
    messagesLoading,
    error,
    filters,
    sort,
    pagination,
    currentUser,
    unreadCount,
    notifications,

    // Mock data (for backward compatibility)
    mockUsers,
    mockCurrentUser,
    hasChannels,

    // Channel operations
    fetchChannels,
    selectChannel,
    clearActiveChannel,

    // Message operations
    fetchMessages,
    sendMessage,
    createChannel,
    markAsRead,

    // Real-time operations
    setTyping,
    removeTyping,

    // UI state operations
    toggleChannelList,
    toggleContextPanel,
    setChannelListExpanded,
    setContextPanelVisible,

    // Filter and search operations
    setFilters,
    setSort,
    setPagination,

    // Error handling
    clearError,
    setError,

    // Notifications
    addNotification,
    clearNotifications,

    // Utility operations
    resetState,
    refreshChannels,
    refreshMessages
  }
  }
