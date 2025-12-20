// Helper function to enrich channels with MongoDB user data
export function enrichChannelWithUserData(channel: any, users: any[]) {
  try {
    // Create a map of users by _id for quick lookup
    const userMap = new Map(users.map(user => [user._id.toString(), user]))

    // Enrich channel_members with user data
    const enrichedChannelMembers = channel.channel_members?.map((member: any) => {
      const user = userMap.get(member.mongo_member_id)
      return {
        ...member,
        channelRole: member.role, // Rename role to channelRole
        userRole: user ? (typeof user.role === 'string' ? user.role : user.role?.name || 'User') : 'User',
        name: user?.name || user?.email || 'Unknown User',
        email: user?.email || '',
        avatar: user?.avatar || '',
        userType: user?.isClient ? 'Client' : 'User',
        isOnline: member.is_online || false
      }
    }) || []

    return {
      ...channel,
      channel_members: enrichedChannelMembers
    }
  } catch (error) {
    console.error('Error enriching channel with user data:', error)
    return {
      ...channel,
      channel_members: []
    }
  }
}

// Helper function to enrich messages with MongoDB user data
export function enrichMessageWithUserData(message: any, users: any[]) {
  if (!message || typeof message !== 'object' || !message.mongo_sender_id) {
    console.error('Invalid message for enrichment:', message)
    return null
  }
  
  try {
    // Create a map of users by _id for quick lookup
    const userMap = new Map(users.map(user => [user._id.toString(), user]))

    // Find the sender user
    const sender = userMap.get(message.mongo_sender_id)

    // Enrich message with sender data
    const enrichedMessage = {
      ...message,
      sender: sender ? {
        mongo_member_id: sender._id,
        name: sender.name || sender.email || 'Unknown User',
        email: sender.email || '',
        avatar: sender.avatar || '',
        role: typeof sender.role === 'string' ? sender.role : sender.role?.name || 'User',
        userType: sender.isClient ? 'Client' : 'User',
        isOnline: false // TODO: Add real-time status if needed
      } : {
        mongo_member_id: message.mongo_sender_id,
        name: 'Unknown User',
        email: '',
        avatar: '',
        role: 'User',
        userType: 'User',
        isOnline: false
      }
    }

    return enrichedMessage
  } catch (error) {
    console.error('Error enriching message with user data:', error)
    return null
  }
}