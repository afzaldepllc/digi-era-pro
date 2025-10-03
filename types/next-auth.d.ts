declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      roleDisplayName: string
      department: string
      avatar?: string
      permissions: any[]
      sessionStartTime: number
      iat?: number
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: string
    roleDisplayName: string
    department: string
    avatar?: string
    permissions: any[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    roleDisplayName: string
    department: string
    avatar?: string
    permissions: any[]
    sessionStartTime: number
  }
}
