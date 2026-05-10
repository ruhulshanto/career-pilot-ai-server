
import {
  refreshTokenCookieName,
  refreshTokenCookieOptions
} from '@modules/auth/config/auth-cookie.config.js';
import { authService } from '@modules/auth/services/auth.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie(refreshTokenCookieName, refreshToken, refreshTokenCookieOptions);
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(refreshTokenCookieName, refreshTokenCookieOptions);
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.register(req.body);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res
    .status(StatusCodes.CREATED)
    .json(apiResponse('User registered successfully', { 
      accessToken: tokens.accessToken,
      user: tokens.user 
    }));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.login(req.body);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(StatusCodes.OK).json(apiResponse('Login successful', { 
    accessToken: tokens.accessToken,
    user: tokens.user 
  }));
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.refresh(req.cookies?.[refreshTokenCookieName]);

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(StatusCodes.OK).json(apiResponse('Token refreshed successfully', { 
    accessToken: tokens.accessToken,
    user: tokens.user
  }));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.cookies?.[refreshTokenCookieName]);

  clearRefreshTokenCookie(res);
  res.status(StatusCodes.OK).json(apiResponse('Logout successful'));
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);

  res.status(StatusCodes.OK).json(apiResponse('Current user fetched successfully', user));
});
