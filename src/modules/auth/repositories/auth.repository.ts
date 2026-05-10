import { prisma } from '@config/prisma.js';

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },
  findActiveUserById(id: string) {
    return prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
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
  },
  findActiveUserAuthById(id: string) {
    return prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: { id: true, role: true }
    });
  },
  createUser(data: { 
    firstName: string; 
    lastName: string; 
    username: string; 
    email: string; 
    passwordHash: string 
  }) {
    return prisma.user.create({ data });
  },
  createRefreshToken(data: { userId: string; token: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },
  findValidRefreshToken(token: string) {
    return prisma.refreshToken.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });
  },
  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() }
    });
  },
  revokeUserRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
};
