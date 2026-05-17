import { prisma } from '@config/prisma.js';

const authUserSelect = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  emailVerifiedAt: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  headline: true,
  location: true,
  isDemo: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true
};

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: authUserSelect
    });
  },
  findUserByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });
  },
  findActiveUserById(id: string) {
    return prisma.user.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        headline: true,
        location: true,
        isDemo: true,
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
    return prisma.user.create({
      data,
      select: authUserSelect
    });
  },
  async findDemoUserByRole(role: 'USER' | 'ADMIN' | 'MENTOR') {
    const baseWhere = {
      isDemo: true,
      isActive: true,
      deletedAt: null
    };

    const user = await prisma.user.findFirst({
      where: {
        role,
        ...baseWhere
      },
      select: authUserSelect,
      orderBy: { createdAt: 'asc' }
    });

    if (user) {
      return user;
    }

    return prisma.user.findFirst({
      where: { role: 'USER' },
      orderBy: { createdAt: 'asc' }
    });
  },
  markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() }
    });
  },
  updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  },
  createSession(data: {
    userId: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return prisma.accountSession.create({ data });
  },
  touchSession(id: string) {
    return prisma.accountSession.update({
      where: { id },
      data: { lastSeenAt: new Date() }
    });
  },
  getActiveSessions(userId: string) {
    return prisma.accountSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastSeenAt: true,
        expiresAt: true,
        createdAt: true
      }
    });
  },
  findSession(id: string, userId: string) {
    return prisma.accountSession.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } }
    });
  },
  revokeSession(id: string, userId: string) {
    const revokedAt = new Date();
    return prisma.$transaction([
      prisma.accountSession.updateMany({
        where: { id, userId, revokedAt: null },
        data: { revokedAt }
      }),
      prisma.refreshToken.updateMany({
        where: { sessionId: id, userId, revokedAt: null },
        data: { revokedAt }
      })
    ]);
  },
  revokeOtherSessions(userId: string, currentSessionId?: string) {
    const revokedAt = new Date();
    return prisma.$transaction([
      prisma.accountSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {})
        },
        data: { revokedAt }
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { sessionId: { not: currentSessionId } } : {})
        },
        data: { revokedAt }
      })
    ]);
  },
  createRefreshToken(data: { userId: string; sessionId?: string; token: string; expiresAt: Date }) {
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
        user: {
          select: authUserSelect
        },
        session: true
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
  },
  deleteOpenEmailVerificationTokens(userId: string) {
    return prisma.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null }
    });
  },
  createEmailVerificationToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.emailVerificationToken.create({ data });
  },
  findValidEmailVerificationToken(tokenHash: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });
  },
  markEmailVerificationTokenUsed(id: string) {
    return prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() }
    });
  },
  deleteOpenPasswordResetTokens(userId: string) {
    return prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null }
    });
  },
  createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.passwordResetToken.create({ data });
  },
  findValidPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });
  },
  markPasswordResetTokenUsed(id: string) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() }
    });
  }
};
