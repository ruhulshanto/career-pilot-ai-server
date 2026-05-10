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

  req.user = {
    id: user.id,
    role: user.role
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
