import type { UserRole } from '@constants/roles.js';
import { authRepository } from '@modules/auth/repositories/auth.repository.js';
import { tokenService } from '@modules/auth/services/token.service.js';
import { ApiError } from '@shared/errors/api-error.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import type { NextFunction, Request, Response } from 'express';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined;

  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  const payload = tokenService.verifyAccessToken(token);
  const user = await authRepository.findActiveUserAuthById(payload.sub);

  if (!user) {
    throw new ApiError(401, 'Invalid or inactive account');
  }

  if (payload.sid) {
    const session = await authRepository.findSession(payload.sid, payload.sub);
    if (!session) {
      throw new ApiError(401, 'Session expired or revoked');
    }
    await authRepository.touchSession(payload.sid);
  }

  req.user = {
    id: user.id,
    role: user.role,
    sessionId: payload.sid
  };

  next();
});

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    next();
  };

export const authorizeRoles = authorize;
