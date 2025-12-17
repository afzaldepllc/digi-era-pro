// Helper function to enrich channels with MongoDB user data
export function enrichChannelWithUserData(channel: any, users: any[]) {
  try {
    // Get all unique member IDs
    const memberIds = channel.channel_members?.map((m: any) => m.mongo_member_id) || []

    // Filter users
    const channelUsers = users.filter(user => memberIds.includes(user._id.toString()))

    // Map users to participants format
    const participants = channelUsers.map((user: any) => ({
      mongo_member_id: user._id.toString(),
      name: user.name || user.email,
      email: user.email,
      avatar: user.avatar,
      isOnline: false, // Will be updated from channel_members
      userType: user.isClient ? 'Client' : 'User',
      role: typeof user.role === 'string' ? user.role : user.role?.name || 'User'
    }))

    // Update online status from channel_members
    channel.channel_members?.forEach((member: any) => {
      const participant = participants.find((p: any) => p.mongo_member_id === member.mongo_member_id)
      if (participant) {
        participant.isOnline = member.is_online || false
      }
    })

    return {
      ...channel,
      participants
    }
  } catch (error) {
    console.error('Error enriching channel with user data:', error)
    return {
      ...channel,
      participants: []
    }
  }
}