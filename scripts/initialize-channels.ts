import { initializeSystemChannels } from '@/lib/channel-hooks'
import connectDB from '@/lib/mongodb'

async function main() {
  try {
    console.log('Starting system channels initialization...')

    await connectDB()
    await initializeSystemChannels()

    console.log('System channels initialization completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('System channels initialization failed:', error)
    process.exit(1)
  }
}

main()