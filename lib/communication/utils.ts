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