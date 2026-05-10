import type { UserRole } from '@constants/roles.js';
import { authRepository } from '@modules/auth/repositories/auth.repository.js';
import { tokenService } from '@modules/auth/services/token.service.js';
import { hashPassword, verifyPassword } from '@modules/auth/utils/password.util.js';
import { ApiError } from '@shared/errors/api-error.js';

export const authService = {
  async register(payload: { 
    firstName: string; 
    lastName: string; 
    username: string; 
    email: string; 
    password: string 
  }) {
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

    const tokens = await this.issueTokens({ userId: user.id, role: user.role as UserRole });
    return { ...tokens, user };
  },

  async login(payload: { email: string; password: string }) {
    const user = await authRepository.findUserByEmail(payload.email);

    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }

    if (!user.isActive || user.deletedAt) {
      throw new ApiError(403, 'Account is inactive');
    }

    const isMatch = await verifyPassword(payload.password, user.passwordHash);

    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const tokens = await this.issueTokens({ userId: user.id, role: user.role as UserRole });
    return { ...tokens, user };
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

    if (!storedToken.user.isActive || storedToken.user.deletedAt) {
      throw new ApiError(403, 'Account is inactive');
    }

    await authRepository.revokeRefreshToken(storedToken.id);

    const tokens = await this.issueTokens({
      userId: storedToken.user.id,
      role: storedToken.user.role as UserRole
    });
    return { ...tokens, user: storedToken.user };
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

  async issueTokens({ userId, role }: { userId: string; role: UserRole }) {
    const accessToken = tokenService.signAccessToken(userId, role);
    const refreshToken = tokenService.signRefreshToken(userId, role);

    await authRepository.createRefreshToken({
      userId,
      token: tokenService.hashToken(refreshToken),
      expiresAt: tokenService.getRefreshTokenExpiresAt()
    });

    return { accessToken, refreshToken };
  }
};
