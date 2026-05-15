import { describe, expect, it, vi } from 'vitest';

const emailMocks = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendNotificationEmail: vi.fn(),
  sendEmail: vi.fn()
}));

vi.mock('@shared/email/email.service.js', () => ({
  emailService: emailMocks
}));

vi.mock('@shared/utils/email.service.js', () => ({
  emailService: emailMocks
}));

import { authService } from '@modules/auth/services/auth.service.js';
import { tokenService } from '@modules/auth/services/token.service.js';
import { EmailDeliveryError } from '@shared/email/email.types.js';
import { prismaMock } from '../mocks/prisma.mock.js';

const activeUser = {
  id: 'user_123',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  passwordHash: 'hashed_password',
  role: 'USER',
  emailVerifiedAt: null,
  avatarUrl: null,
  headline: null,
  location: null,
  isDemo: false,
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

const getTokenFromUrl = (url: string) => {
  const token = new URL(url).searchParams.get('token');
  expect(token).toBeTruthy();
  return token!;
};

describe('Auth email flows', () => {
  it('creates a one-time hashed verification token and sends a real email template request', async () => {
    prismaMock.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.emailVerificationToken.create.mockResolvedValue({} as any);

    await authService.sendVerificationEmail(activeUser.id, activeUser.email, activeUser.firstName);

    expect(prismaMock.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: activeUser.id, usedAt: null }
    });

    const createArgs = prismaMock.emailVerificationToken.create.mock.calls[0][0] as any;
    const sentUrl = emailMocks.sendVerificationEmail.mock.calls[0][1] as string;
    const rawToken = getTokenFromUrl(sentUrl);

    expect(createArgs.data.userId).toBe(activeUser.id);
    expect(createArgs.data.tokenHash).toBe(tokenService.hashToken(rawToken));
    expect(createArgs.data.tokenHash).not.toBe(rawToken);
    expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(emailMocks.sendVerificationEmail).toHaveBeenCalledWith(
      activeUser.email,
      expect.stringContaining('/verify-email?token='),
      activeUser.firstName
    );
  });

  it('verifies email only when the verification token is unused and unexpired', async () => {
    const rawToken = 'verification-token';
    const tokenHash = tokenService.hashToken(rawToken);

    prismaMock.emailVerificationToken.findFirst.mockResolvedValue({
      id: 'verification_token_123',
      userId: activeUser.id,
      user: activeUser
    } as any);
    prismaMock.emailVerificationToken.update.mockResolvedValue({} as any);
    prismaMock.user.update.mockResolvedValue({} as any);

    await expect(authService.verifyEmail(rawToken)).resolves.toEqual({ verified: true });

    expect(prismaMock.emailVerificationToken.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      include: { user: true }
    });
    expect(prismaMock.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'verification_token_123' },
      data: { usedAt: expect.any(Date) }
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { emailVerifiedAt: expect.any(Date) }
    });
  });

  it('rejects expired verification tokens', async () => {
    prismaMock.emailVerificationToken.findFirst.mockResolvedValue(null);

    await expect(authService.verifyEmail('expired-verification-token')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired verification link'
    });
    expect(prismaMock.emailVerificationToken.update).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects reused verification tokens through the usedAt lookup guard', async () => {
    prismaMock.emailVerificationToken.findFirst.mockResolvedValue(null);

    await expect(authService.verifyEmail('reused-verification-token')).rejects.toMatchObject({
      statusCode: 400
    });
    expect(prismaMock.emailVerificationToken.findFirst.mock.calls[0][0]).toMatchObject({
      where: { usedAt: null }
    });
  });

  it('creates a one-time hashed password reset token and sends a real email template request', async () => {
    prismaMock.user.findUnique.mockResolvedValue(activeUser as any);
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.create.mockResolvedValue({} as any);

    await authService.requestPasswordReset(activeUser.email);

    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: activeUser.id, usedAt: null }
    });

    const createArgs = prismaMock.passwordResetToken.create.mock.calls[0][0] as any;
    const sentUrl = emailMocks.sendPasswordResetEmail.mock.calls[0][1] as string;
    const rawToken = getTokenFromUrl(sentUrl);

    expect(createArgs.data.userId).toBe(activeUser.id);
    expect(createArgs.data.tokenHash).toBe(tokenService.hashToken(rawToken));
    expect(createArgs.data.tokenHash).not.toBe(rawToken);
    expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(emailMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      activeUser.email,
      expect.stringContaining('/reset-password?token='),
      activeUser.firstName
    );
  });

  it('resets password only when the reset token is unused and unexpired', async () => {
    const rawToken = 'password-reset-token';
    const tokenHash = tokenService.hashToken(rawToken);

    prismaMock.passwordResetToken.findFirst.mockResolvedValue({
      id: 'password_reset_token_123',
      userId: activeUser.id,
      user: activeUser
    } as any);
    prismaMock.passwordResetToken.update.mockResolvedValue({} as any);
    prismaMock.user.update.mockResolvedValue({} as any);
    prismaMock.accountSession.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.$transaction.mockResolvedValue([] as any);

    await authService.resetPassword(rawToken, 'newPassword123');

    expect(prismaMock.passwordResetToken.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      include: { user: true }
    });
    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'password_reset_token_123' },
      data: { usedAt: expect.any(Date) }
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { passwordHash: expect.any(String) }
    });
    expect(prismaMock.user.update.mock.calls[0][0].data.passwordHash).not.toBe('newPassword123');
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('rejects expired password reset tokens', async () => {
    prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(authService.resetPassword('expired-reset-token', 'newPassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired reset link'
    });
    expect(prismaMock.passwordResetToken.update).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects reused password reset tokens through the usedAt lookup guard', async () => {
    prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(authService.resetPassword('reused-reset-token', 'newPassword123')).rejects.toMatchObject({
      statusCode: 400
    });
    expect(prismaMock.passwordResetToken.findFirst.mock.calls[0][0]).toMatchObject({
      where: { usedAt: null }
    });
  });

  it('returns a safe API error when the email provider fails', async () => {
    prismaMock.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.emailVerificationToken.create.mockResolvedValue({} as any);
    emailMocks.sendVerificationEmail.mockRejectedValue(
      new EmailDeliveryError(
        'Provider rejected the message',
        'EMAIL_DELIVERY_FAILED',
        'gmail',
        502
      )
    );

    await expect(
      authService.sendVerificationEmail(activeUser.id, activeUser.email, activeUser.firstName)
    ).rejects.toMatchObject({
      statusCode: 503,
      message: 'Email delivery is temporarily unavailable. Please try again later.',
      code: 'EMAIL_DELIVERY_FAILED'
    });
  });
});
