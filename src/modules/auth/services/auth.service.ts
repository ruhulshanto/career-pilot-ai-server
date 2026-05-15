import type { UserRole } from '@constants/roles.js';
import { authRepository } from '@modules/auth/repositories/auth.repository.js';
import { tokenService } from '@modules/auth/services/token.service.js';
import { hashPassword, verifyPassword } from '@modules/auth/utils/password.util.js';
import { ApiError } from '@shared/errors/api-error.js';
import { emailService } from '@shared/email/email.service.js';
import { EmailDeliveryError } from '@shared/email/email.types.js';
import { env } from '@config/env.js';
import { logger } from '@/logging/logger.js';

type AuthRequestContext = {
  userAgent?: string;
  ipAddress?: string;
};

const buildClientUrl = (path: string) =>
  `${env.CLIENT_ORIGIN.split(',')[0].trim().replace(/\/$/, '')}${path}`;

const toEmailApiError = (error: unknown): never => {
  if (!(error instanceof EmailDeliveryError)) {
    throw error;
  }

  if (error.code === 'INVALID_EMAIL_ADDRESS') {
    throw new ApiError(400, 'Invalid email address', { code: error.code });
  }

  if (error.code === 'EMAIL_RATE_LIMITED') {
    throw new ApiError(429, 'Too many email requests. Please try again later.', {
      code: error.code
    });
  }

  throw new ApiError(503, 'Email delivery is temporarily unavailable. Please try again later.', {
    code: error.code
  });
};

const sanitizeUser = <T extends { passwordHash?: string }>(user: T) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

export const authService = {
  async register(payload: { 
    firstName: string; 
    lastName: string; 
    username: string; 
    email: string; 
    password: string 
  }, context: AuthRequestContext = {}) {
    const existingEmail = await authRepository.findUserByEmail(payload.email);
    if (existingEmail) {
      throw new ApiError(409, 'Email already in use');
    }

    const existingUsername = await authRepository.findUserByUsername(payload.username);
    if (existingUsername) {
      throw new ApiError(409, 'Username already taken');
    }

    const passwordHash = await hashPassword(payload.password);
    const user = await authRepository.createUser({
      firstName: payload.firstName,
      lastName: payload.lastName,
      username: payload.username,
      email: payload.email,
      passwordHash
    });

    await this.sendVerificationEmail(user.id, user.email, user.firstName);

    const tokens = await this.issueTokens({
      userId: user.id,
      role: user.role as UserRole,
      context
    });
    return { ...tokens, user: sanitizeUser(user) };
  },

  async login(payload: { email: string; password: string }, context: AuthRequestContext = {}) {
    const user = await authRepository.findUserByEmail(payload.email);

    if (!user) {
      logger.warn(
        { email: payload.email, ipAddress: context.ipAddress },
        'Auth login failed: user not found'
      );
      throw new ApiError(401, 'Invalid credentials');
    }

    if (!user.isActive || user.deletedAt) {
      logger.warn(
        { userId: user.id, email: user.email, ipAddress: context.ipAddress },
        'Auth login failed: inactive account'
      );
      throw new ApiError(403, 'Account is inactive');
    }

    const isMatch = await verifyPassword(payload.password, user.passwordHash);

    if (!isMatch) {
      logger.warn(
        { userId: user.id, email: user.email, ipAddress: context.ipAddress },
        'Auth login failed: invalid password'
      );
      throw new ApiError(401, 'Invalid credentials');
    }

    const tokens = await this.issueTokens({
      userId: user.id,
      role: user.role as UserRole,
      context
    });
    return { ...tokens, user: sanitizeUser(user) };
  },

  async demoLogin(role: 'USER' | 'ADMIN' | 'COACH' | 'MENTOR', context: AuthRequestContext = {}) {
    if (!env.DEMO_LOGIN_ENABLED) {
      throw new ApiError(403, 'Demo login is disabled for this environment', {
        code: 'DEMO_LOGIN_DISABLED'
      });
    }

    const user = await authRepository.findDemoUserByRole(role);

    if (!user) {
      throw new ApiError(
        404,
        `Demo ${role.toLowerCase()} account is not seeded. Run pnpm prisma:seed on the backend.`
      );
    }

    const tokens = await this.issueTokens({
      userId: user.id,
      role: user.role as UserRole,
      context
    });

    return { ...tokens, user: sanitizeUser(user) };
  },

  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new ApiError(401, 'Refresh token required');
    }

    const payload = tokenService.verifyRefreshToken(refreshToken);
    const tokenHash = tokenService.hashToken(refreshToken);
    const storedToken = await authRepository.findValidRefreshToken(tokenHash);

    if (!storedToken || storedToken.userId !== payload.sub) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (!storedToken.session || storedToken.session.revokedAt || storedToken.session.expiresAt <= new Date()) {
      throw new ApiError(401, 'Session expired or revoked');
    }

    if (!storedToken.user.isActive || storedToken.user.deletedAt) {
      throw new ApiError(403, 'Account is inactive');
    }

    await authRepository.revokeRefreshToken(storedToken.id);

    const tokens = await this.issueTokens({
      userId: storedToken.user.id,
      role: storedToken.user.role as UserRole,
      sessionId: storedToken.session.id
    });
    await authRepository.touchSession(storedToken.session.id);
    return { ...tokens, user: sanitizeUser(storedToken.user) };
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    const tokenHash = tokenService.hashToken(refreshToken);
    const storedToken = await authRepository.findValidRefreshToken(tokenHash);

    if (storedToken) {
      await authRepository.revokeRefreshToken(storedToken.id);
    }
  },

  async getCurrentUser(userId: string) {
    const user = await authRepository.findActiveUserById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  },

  async issueTokens({
    userId,
    role,
    sessionId,
    context
  }: {
    userId: string;
    role: UserRole;
    sessionId?: string;
    context?: AuthRequestContext;
  }) {
    const expiresAt = tokenService.getRefreshTokenExpiresAt();
    const session =
      sessionId
        ? await authRepository.findSession(sessionId, userId)
        : await authRepository.createSession({
            userId,
            expiresAt,
            userAgent: context?.userAgent,
            ipAddress: context?.ipAddress
          });

    if (!session) {
      throw new ApiError(401, 'Session expired or revoked');
    }

    const accessToken = tokenService.signAccessToken(userId, role, session.id);
    const refreshToken = tokenService.signRefreshToken(userId, role, session.id);

    await authRepository.createRefreshToken({
      userId,
      sessionId: session.id,
      token: tokenService.hashToken(refreshToken),
      expiresAt
    });

    return { accessToken, refreshToken, sessionId: session.id };
  },

  async sendVerificationEmail(userId: string, email: string, firstName?: string | null) {
    await authRepository.deleteOpenEmailVerificationTokens(userId);
    const token = tokenService.createOpaqueToken();
    await authRepository.createEmailVerificationToken({
      userId,
      tokenHash: tokenService.hashToken(token),
      expiresAt: tokenService.getEmailVerificationExpiresAt()
    });

    const verificationUrl = buildClientUrl(`/verify-email?token=${encodeURIComponent(token)}`);
    try {
      await emailService.sendVerificationEmail(email, verificationUrl, firstName);
    } catch (error) {
      toEmailApiError(error);
    }
  },

  async resendVerification(userId: string) {
    const currentUser = await authRepository.findActiveUserById(userId);
    if (!currentUser) {
      throw new ApiError(404, 'User not found');
    }
    if (currentUser.emailVerifiedAt) {
      return { verified: true };
    }
    await this.sendVerificationEmail(currentUser.id, currentUser.email, currentUser.firstName);
    return { verified: false };
  },

  async verifyEmail(token: string) {
    const tokenHash = tokenService.hashToken(token);
    const storedToken = await authRepository.findValidEmailVerificationToken(tokenHash);
    if (!storedToken) {
      throw new ApiError(400, 'Invalid or expired verification link');
    }

    await authRepository.markEmailVerificationTokenUsed(storedToken.id);
    await authRepository.markEmailVerified(storedToken.userId);
    return { verified: true };
  },

  async requestPasswordReset(email: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || !user.isActive || user.deletedAt) {
      return;
    }

    await authRepository.deleteOpenPasswordResetTokens(user.id);
    const token = tokenService.createOpaqueToken();
    await authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: tokenService.hashToken(token),
      expiresAt: tokenService.getPasswordResetExpiresAt()
    });

    const resetUrl = buildClientUrl(`/reset-password?token=${encodeURIComponent(token)}`);
    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl, user.firstName);
    } catch (error) {
      toEmailApiError(error);
    }
  },

  async resetPassword(token: string, password: string) {
    const tokenHash = tokenService.hashToken(token);
    const storedToken = await authRepository.findValidPasswordResetToken(tokenHash);
    if (!storedToken) {
      throw new ApiError(400, 'Invalid or expired reset link');
    }

    const passwordHash = await hashPassword(password);
    await authRepository.markPasswordResetTokenUsed(storedToken.id);
    await authRepository.updatePassword(storedToken.userId, passwordHash);
    await authRepository.revokeOtherSessions(storedToken.userId);
  },

  async getSessions(userId: string, currentSessionId?: string) {
    const sessions = await authRepository.getActiveSessions(userId);
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId
    }));
  },

  async revokeSession(userId: string, sessionId: string, currentSessionId?: string) {
    if (sessionId === currentSessionId) {
      throw new ApiError(400, 'Use logout to end your current session');
    }
    await authRepository.revokeSession(sessionId, userId);
  },

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    await authRepository.revokeOtherSessions(userId, currentSessionId);
  }
};
