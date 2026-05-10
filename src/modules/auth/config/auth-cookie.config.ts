import { env } from '@config/env.js';
import { refreshTokenCookieMaxAgeMs } from '@modules/auth/services/token.service.js';
import type { CookieOptions } from 'express';

export const refreshTokenCookieName = 'refreshToken';

export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
  path: `${env.API_PREFIX}/auth`,
  maxAge: refreshTokenCookieMaxAgeMs
};
