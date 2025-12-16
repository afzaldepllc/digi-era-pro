import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create a general channel
  const generalChannel = await prisma.channel.create({
    data: {
      type: 'group',
      name: 'General',
      mongo_creator_id: 'admin_user_id', // Replace with actual admin user ID
      is_private: false,
      member_count: 0,
    }
  })

  // Create a department channel (example)
  const deptChannel = await prisma.channel.create({
    data: {
      type: 'department',
      name: 'Development Team',
      mongo_department_id: 'dept_id_1', // Replace with actual department ID
      mongo_creator_id: 'admin_user_id', // Replace with actual admin user ID
      is_private: false,
      member_count: 0,
    }
  })

  console.log('Seeding completed:', { generalChannel, deptChannel })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })