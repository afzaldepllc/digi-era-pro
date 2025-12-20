import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_DATABASE_URL!,
  },
})


