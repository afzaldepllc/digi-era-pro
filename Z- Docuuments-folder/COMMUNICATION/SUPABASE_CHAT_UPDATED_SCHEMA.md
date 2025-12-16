
-- ============================================
-- CORE TABLES WITH CLEAR NAMING
-- ============================================

-- channels
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  type TEXT NOT NULL, -- 'dm', 'group', 'department', 'project'
  name TEXT,
  avatar_url TEXT,
  
  -- MongoDB references (explicit naming)
  mongo_department_id TEXT,
  mongo_project_id TEXT,
  mongo_creator_id TEXT NOT NULL, -- Who created this channel
  
  -- Simple metadata
  is_private BOOLEAN DEFAULT false,
  member_count INT DEFAULT 0,
  last_message_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_channels_type ON channels(type);
CREATE INDEX idx_channels_dept ON channels(mongo_department_id);
CREATE INDEX idx_channels_project ON channels(mongo_project_id);
CREATE INDEX idx_channels_creator ON channels(mongo_creator_id);

-- messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  mongo_sender_id TEXT NOT NULL, -- Who sent this message
  
  -- Content
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text', -- 'text', 'file', 'system'
  
  -- Threading (optional)
  thread_id UUID,
  reply_count INT DEFAULT 0,
  
  -- Mentions
  mongo_mentioned_user_ids TEXT[], -- Array of MongoDB user IDs mentioned
  
  -- Simple status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_sender ON messages(mongo_sender_id);
CREATE INDEX idx_messages_mentions ON messages USING gin(mongo_mentioned_user_ids);

-- channel_members
CREATE TABLE channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  mongo_member_id TEXT NOT NULL, -- MongoDB user ID of the member
  
  -- Role in channel
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  
  -- Read tracking
  last_read_at TIMESTAMP DEFAULT NOW(),
  
  -- Simple preferences
  is_muted BOOLEAN DEFAULT false,
  notification_level TEXT DEFAULT 'all', -- 'all', 'mentions', 'none'
  
  -- Membership metadata
  joined_at TIMESTAMP DEFAULT NOW(),
  mongo_invited_by_id TEXT, -- Who invited this member
  
  PRIMARY KEY(channel_id, mongo_member_id)
);

CREATE INDEX idx_members_user ON channel_members(mongo_member_id);
CREATE INDEX idx_members_channel ON channel_members(channel_id);
CREATE INDEX idx_members_unread ON channel_members(mongo_member_id, last_read_at);

-- reactions
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mongo_reactor_id TEXT NOT NULL, -- Who reacted
  emoji TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(message_id, mongo_reactor_id, emoji)
);

CREATE INDEX idx_reactions_message ON reactions(message_id);
CREATE INDEX idx_reactions_user ON reactions(mongo_reactor_id);

-- attachments (S3 references only)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  
  -- File info
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  
  -- S3 storage
  s3_key TEXT NOT NULL, -- S3 object key
  s3_bucket TEXT NOT NULL,
  
  -- Optional metadata for media
  width INT,
  height INT,
  duration_seconds INT, -- For audio/video
  
  mongo_uploader_id TEXT NOT NULL, -- Who uploaded this
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_attachments_uploader ON attachments(mongo_uploader_id);

-- ============================================
-- OPTIONAL: READ RECEIPTS TABLE
-- ============================================

CREATE TABLE read_receipts (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mongo_reader_id TEXT NOT NULL, -- Who read this message
  read_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY(message_id, mongo_reader_id)
);

CREATE INDEX idx_read_receipts_message ON read_receipts(message_id);
CREATE INDEX idx_read_receipts_reader ON read_receipts(mongo_reader_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Increment reply count for threaded messages
CREATE OR REPLACE FUNCTION increment_reply_count(message_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages 
  SET reply_count = reply_count + 1 
  WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;

-- Get unread message count for a user in a channel
CREATE OR REPLACE FUNCTION get_unread_count(
  p_mongo_member_id TEXT,
  p_channel_id UUID
)
RETURNS INT AS $$
DECLARE
  v_last_read_at TIMESTAMP;
  v_unread_count INT;
BEGIN
  -- Get user's last read timestamp
  SELECT last_read_at INTO v_last_read_at
  FROM channel_members
  WHERE channel_id = p_channel_id 
    AND mongo_member_id = p_mongo_member_id;
  
  -- Count unread messages
  SELECT COUNT(*)::INT INTO v_unread_count
  FROM messages
  WHERE channel_id = p_channel_id
    AND created_at > v_last_read_at
    AND mongo_sender_id != p_mongo_member_id;
  
  RETURN COALESCE(v_unread_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Get user's channels with metadata
CREATE OR REPLACE FUNCTION get_user_channels(p_mongo_member_id TEXT)
RETURNS TABLE (
  channel_id UUID,
  channel_name TEXT,
  channel_type TEXT,
  channel_avatar_url TEXT,
  is_private BOOLEAN,
  member_count INT,
  last_message_at TIMESTAMP,
  unread_count INT,
  is_muted BOOLEAN,
  last_read_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.type,
    c.avatar_url,
    c.is_private,
    c.member_count,
    c.last_message_at,
    get_unread_count(p_mongo_member_id, c.id) as unread_count,
    cm.is_muted,
    cm.last_read_at
  FROM channels c
  INNER JOIN channel_members cm ON c.id = cm.channel_id
  WHERE cm.mongo_member_id = p_mongo_member_id
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;