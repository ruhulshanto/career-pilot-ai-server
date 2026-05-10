import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const seed = async () => {
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  await prisma.user.upsert({
    where: { email: 'admin@career-platform.local' },
    update: {},
    create: {
      email: 'admin@career-platform.local',
      username: 'admin',
      firstName: 'Platform',
      lastName: 'Admin',
      passwordHash,
      role: UserRole.ADMIN
    }
  });
};

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
