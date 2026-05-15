import crypto from 'node:crypto';

import { env } from '@config/env.js';
import type { UserRole } from '@constants/roles.js';
import { isValidRole } from '@constants/roles.js';
import { ApiError } from '@shared/errors/api-error.js';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

export type AuthTokenPayload = {
  sub: string;
  role: UserRole;
  sid?: string;
};

const expirationPattern = /^(\d+)(ms|s|m|h|d)$/;

const parseExpirationMs = (expiresIn: string) => {
  const match = expirationPattern.exec(expiresIn);

  if (!match) {
    throw new ApiError(500, 'Invalid JWT expiration configuration');
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
};

const assertAuthPayload = (payload: string | jwt.JwtPayload, tokenType: 'access' | 'refresh') => {
  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    !isValidRole(payload.role)
  ) {
    throw new ApiError(401, `Invalid ${tokenType} token`);
  }

    return {
      sub: payload.sub,
      role: payload.role,
      sid: typeof payload.sid === 'string' ? payload.sid : undefined
    };
  };

export const tokenService = {
  signAccessToken(userId: string, role: UserRole, sessionId?: string) {
    return jwt.sign({ role, sid: sessionId }, env.JWT_ACCESS_SECRET, {
      subject: userId,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn']
    });
  },

  signRefreshToken(userId: string, role: UserRole, sessionId?: string) {
    return jwt.sign({ role, sid: sessionId }, env.JWT_REFRESH_SECRET, {
      subject: userId,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']
    });
  },

  verifyAccessToken(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      return assertAuthPayload(payload, 'access');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(401, 'Invalid or expired access token');
    }
  },

  verifyRefreshToken(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
      return assertAuthPayload(payload, 'refresh');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(401, 'Invalid or expired refresh token');
    }
  },

  hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  createOpaqueToken(byteLength = 32) {
    return crypto.randomBytes(byteLength).toString('base64url');
  },

  getEmailVerificationExpiresAt() {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  },

  getPasswordResetExpiresAt() {
    return new Date(Date.now() + 30 * 60 * 1000);
  },

  getRefreshTokenExpiresAt() {
    return new Date(Date.now() + refreshTokenCookieMaxAgeMs);
  }
};

export const refreshTokenCookieMaxAgeMs = parseExpirationMs(env.JWT_REFRESH_EXPIRES_IN);
