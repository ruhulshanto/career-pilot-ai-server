
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
  const { maxAge: _maxAge, ...clearCookieOptions } = refreshTokenCookieOptions;
  res.clearCookie(refreshTokenCookieName, clearCookieOptions);
};

const getAuthRequestContext = (req: Request) => ({
  userAgent: req.get('user-agent'),
  ipAddress: req.ip
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.register(req.body, getAuthRequestContext(req));

  setRefreshTokenCookie(res, tokens.refreshToken);
  res
    .status(StatusCodes.CREATED)
    .json(apiResponse('User registered successfully', { 
      accessToken: tokens.accessToken,
      user: tokens.user 
    }));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.login(req.body, getAuthRequestContext(req));

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(StatusCodes.OK).json(apiResponse('Login successful', { 
    accessToken: tokens.accessToken,
    user: tokens.user 
  }));
});

export const demoLogin = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.demoLogin(req.body.role, getAuthRequestContext(req));

  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(StatusCodes.OK).json(apiResponse('Demo login successful', {
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

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyEmail(req.body.token);

  res.status(StatusCodes.OK).json(apiResponse('Email verified successfully', result));
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resendVerification(req.user!.id);

  res.status(StatusCodes.OK).json(apiResponse('Verification email sent', result));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestPasswordReset(req.body.email);

  res
    .status(StatusCodes.OK)
    .json(apiResponse('If that email exists, a reset link has been sent'));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);

  res.status(StatusCodes.OK).json(apiResponse('Password reset successfully'));
});

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await authService.getSessions(req.user!.id, req.user!.sessionId);

  res.status(StatusCodes.OK).json(apiResponse('Active sessions fetched successfully', sessions));
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };
  await authService.revokeSession(req.user!.id, sessionId, req.user!.sessionId);

  res.status(StatusCodes.OK).json(apiResponse('Session revoked successfully'));
});

export const revokeOtherSessions = asyncHandler(async (req: Request, res: Response) => {
  await authService.revokeOtherSessions(req.user!.id, req.user!.sessionId);

  res.status(StatusCodes.OK).json(apiResponse('Other sessions revoked successfully'));
});
