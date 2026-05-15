import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '@/app/app.js';
import { env } from '@config/env.js';
import { tokenService } from '@modules/auth/services/token.service.js';
import { hashPassword } from '@modules/auth/utils/password.util.js';
import { prismaMock } from '../mocks/prisma.mock.js';

const userId = 'auth-user-id';
const sessionId = 'auth-session-id';
const password = 'password123';

const authUser = {
  id: userId,
  email: 'auth@example.com',
  passwordHash: '',
  role: 'USER',
  emailVerifiedAt: null,
  username: 'authuser',
  firstName: 'Auth',
  lastName: 'User',
  avatarUrl: null,
  headline: null,
  location: null,
  isDemo: false,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-05-15T00:00:00.000Z'),
  updatedAt: new Date('2026-05-15T00:00:00.000Z')
};

const session = {
  id: sessionId,
  userId,
  userAgent: 'test-agent',
  ipAddress: '127.0.0.1',
  lastSeenAt: new Date('2026-05-15T00:00:00.000Z'),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date('2026-05-15T00:00:00.000Z')
};

const mockTokenPersistence = () => {
  prismaMock.accountSession.create.mockResolvedValue(session as any);
  prismaMock.accountSession.findFirst.mockResolvedValue(session as any);
  prismaMock.accountSession.update.mockResolvedValue(session as any);
  prismaMock.refreshToken.create.mockResolvedValue({ id: 'refresh-token-id' } as any);
  prismaMock.refreshToken.update.mockResolvedValue({ id: 'refresh-token-id' } as any);
};

const cookieHeader = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join('; ') : value ?? '';

const mockCurrentUser = () => {
  prismaMock.user.findFirst.mockResolvedValue(authUser as any);
};

const mockLoginUser = async () => {
  const passwordHash = await hashPassword(password);
  prismaMock.user.findUnique.mockResolvedValue({
    ...authUser,
    passwordHash
  } as any);
};

const login = async (agent = request.agent(app)) => {
  await mockLoginUser();
  mockTokenPersistence();

  return agent.post(`${env.API_PREFIX}/auth/login`).send({
    email: authUser.email,
    password
  });
};

describe('Auth token security', () => {
  beforeEach(() => {
    mockCurrentUser();
    mockTokenPersistence();
  });

  it('logs in with an in-body short-lived access token and an httpOnly refresh cookie', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.passwordHash).toBeUndefined();

    const setCookie = cookieHeader(response.headers['set-cookie']);
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Max-Age=');
  });

  it('allows protected route access with a bearer access token', async () => {
    const response = await login();
    const accessToken = response.body.data.accessToken;

    const protectedResponse = await request(app)
      .get(`${env.API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body.data.id).toBe(userId);
    expect(prismaMock.accountSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: sessionId, userId })
      })
    );
  });

  it('refreshes after page reload using only the httpOnly refresh cookie', async () => {
    const agent = request.agent(app);
    const loginResponse = await login(agent);

    expect(loginResponse.status).toBe(200);

    prismaMock.refreshToken.findFirst.mockResolvedValue({
      id: 'stored-refresh-token-id',
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      user: authUser,
      session
    } as any);

    const refreshResponse = await agent.post(`${env.API_PREFIX}/auth/refresh`);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.data.user.id).toBe(userId);
    expect(prismaMock.refreshToken.update).toHaveBeenCalled();
  });

  it('logs out by revoking the refresh token and clearing the refresh cookie', async () => {
    const agent = request.agent(app);
    const loginResponse = await login(agent);

    expect(loginResponse.status).toBe(200);
    prismaMock.refreshToken.findFirst.mockResolvedValue({
      id: 'stored-refresh-token-id',
      userId,
      user: authUser,
      session
    } as any);

    const logoutResponse = await agent.post(`${env.API_PREFIX}/auth/logout`);

    expect(logoutResponse.status).toBe(200);
    expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stored-refresh-token-id' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) })
      })
    );

    const setCookie = cookieHeader(logoutResponse.headers['set-cookie']);
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('rejects access tokens passed through query strings', async () => {
    const token = tokenService.signAccessToken(userId, 'USER', sessionId);

    const response = await request(app).get(
      `${env.API_PREFIX}/auth/me?accessToken=${encodeURIComponent(token)}`
    );

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('Demo login security and availability', () => {
  const originalDemoLoginEnabled = env.DEMO_LOGIN_ENABLED;

  afterEach(() => {
    env.DEMO_LOGIN_ENABLED = originalDemoLoginEnabled;
  });

  it('rejects demo login when the environment flag is disabled', async () => {
    env.DEMO_LOGIN_ENABLED = false;

    const response = await request(app)
      .post(`${env.API_PREFIX}/auth/demo-login`)
      .send({ role: 'USER' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Demo login is disabled for this environment');
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('logs in a seeded demo account when demo login is enabled', async () => {
    env.DEMO_LOGIN_ENABLED = true;
    mockTokenPersistence();
    prismaMock.user.findFirst.mockResolvedValue({
      ...authUser,
      id: 'demo-admin-id',
      email: 'demo.admin@careerai.local',
      role: 'ADMIN',
      isDemo: true
    } as any);

    const response = await request(app)
      .post(`${env.API_PREFIX}/auth/demo-login`)
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.user.role).toBe('ADMIN');
    expect(response.body.data.user.isDemo).toBe(true);
    expect(response.body.data.user.passwordHash).toBeUndefined();

    const setCookie = cookieHeader(response.headers['set-cookie']);
    expect(setCookie).toContain('refreshToken=');
    expect(setCookie).toContain('HttpOnly');
  });
});

describe('Client auth storage policy', () => {
  it('does not persist auth access tokens to browser storage', async () => {
    const clientRoot = path.resolve(process.cwd(), '..', 'AI-career-pilot-client');
    const authStore = await readFile(
      path.join(clientRoot, 'shared', 'store', 'auth-store.ts'),
      'utf8'
    );
    const apiClient = await readFile(
      path.join(clientRoot, 'services', 'api', 'client.ts'),
      'utf8'
    );

    expect(authStore).not.toContain('localStorage');
    expect(authStore).not.toContain('sessionStorage');
    expect(authStore).not.toContain('persist(');
    expect(authStore).not.toContain('createJSONStorage');
    expect(authStore).not.toContain('career-ai-auth');
    expect(apiClient).not.toContain('localStorage');
    expect(apiClient).not.toContain('sessionStorage');
    expect(apiClient).toContain("'/auth/demo-login'");
  });
});
