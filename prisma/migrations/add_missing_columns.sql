-- Add categories column to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';

-- Add parent_message_id column to messages table  
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id uuid;

-- Add foreign key constraint for parent_message_id
ALTER TABLE messages 
  ADD CONSTRAINT messages_parent_message_id_fkey 
  FOREIGN KEY (parent_message_id) 
  REFERENCES messages(id) 
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Create index for better query performance on parent_message_id
CREATE INDEX IF NOT EXISTS messages_parent_message_id_idx ON messages(parent_message_id);

-- Create index for better query performance on categories
CREATE INDEX IF NOT EXISTS channels_categories_idx ON channels USING GIN(categories);
