import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

// Create a connection pool
const pool = globalForPrisma.pool ?? new Pool({ 
  connectionString: process.env.DATABASE_URL,
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.pool = pool

// Create Prisma adapter
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma