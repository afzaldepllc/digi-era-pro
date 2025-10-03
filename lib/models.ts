// Model registration file to ensure all models are loaded
import User from '@/models/User'
import Role from '@/models/Role'
import Department from '@/models/Department'
import SystemPermission from '@/models/SystemPermission'

// This file ensures all models are registered with mongoose
// Import this in mongodb.ts to prevent "Schema hasn't been registered" errors

export const registerModels = () => {
  // Models are registered by importing them
  // No additional code needed - the import statements handle registration
}

export {
  User,
  Role,
  Department,
  SystemPermission
}