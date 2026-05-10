import { prisma } from '@config/prisma.js';

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        headline: true,
        location: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
};
