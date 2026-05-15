import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const smtpMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn()
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: smtpMocks.createTransport
  },
  createTransport: smtpMocks.createTransport
}));

import { env } from '@config/env.js';
import { emailService } from '@shared/email/email.service.js';

const originalEmailEnv = {
  EMAIL_FROM: env.EMAIL_FROM,
  EMAIL_REPLY_TO: env.EMAIL_REPLY_TO,
  SMTP_HOST: env.SMTP_HOST,
  SMTP_PORT: env.SMTP_PORT,
  SMTP_SECURE: env.SMTP_SECURE,
  SMTP_USER: env.SMTP_USER,
  SMTP_PASS: env.SMTP_PASS
};

describe('EmailService', () => {
  beforeEach(() => {
    env.EMAIL_FROM = 'Career Pilot AI <onboarding@example.com>';
    env.EMAIL_REPLY_TO = 'support@example.com';
    env.SMTP_HOST = 'smtp.gmail.com';
    env.SMTP_PORT = 465;
    env.SMTP_SECURE = true;
    env.SMTP_USER = 'careerpilot@example.com';
    env.SMTP_PASS = 'smtp_app_password_for_tests';
    smtpMocks.createTransport.mockReturnValue({ sendMail: smtpMocks.sendMail });
  });

  afterEach(() => {
    env.EMAIL_FROM = originalEmailEnv.EMAIL_FROM;
    env.EMAIL_REPLY_TO = originalEmailEnv.EMAIL_REPLY_TO;
    env.SMTP_HOST = originalEmailEnv.SMTP_HOST;
    env.SMTP_PORT = originalEmailEnv.SMTP_PORT;
    env.SMTP_SECURE = originalEmailEnv.SMTP_SECURE;
    env.SMTP_USER = originalEmailEnv.SMTP_USER;
    env.SMTP_PASS = originalEmailEnv.SMTP_PASS;
  });

  it('rejects invalid recipient emails before calling SMTP', async () => {
    await expect(
      emailService.sendVerificationEmail('not-an-email', 'https://app.example.com/verify-email?token=abc')
    ).rejects.toMatchObject({
      code: 'INVALID_EMAIL_ADDRESS'
    });

    expect(smtpMocks.createTransport).not.toHaveBeenCalled();
    expect(smtpMocks.sendMail).not.toHaveBeenCalled();
  });

  it('sends branded verification email through Gmail SMTP', async () => {
    smtpMocks.sendMail.mockResolvedValue({
      messageId: 'smtp-message-123',
      accepted: ['user@example.com'],
      rejected: []
    });

    await expect(
      emailService.sendVerificationEmail(
        'user@example.com',
        'https://app.example.com/verify-email?token=abc',
        'Ada'
      )
    ).resolves.toEqual({
      provider: 'gmail',
      messageId: 'smtp-message-123'
    });

    expect(smtpMocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: 'careerpilot@example.com',
          pass: 'smtp_app_password_for_tests'
        }
      })
    );
    expect(smtpMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Career Pilot AI <onboarding@example.com>',
        to: 'user@example.com',
        replyTo: 'support@example.com',
        subject: expect.stringContaining('Verify'),
        html: expect.stringContaining('Career Pilot AI'),
        text: expect.stringContaining('https://app.example.com/verify-email?token=abc')
      })
    );
  });

  it('returns a typed error when SMTP rate limits sending', async () => {
    smtpMocks.sendMail.mockRejectedValue({
      responseCode: 454,
      message: 'Temporary authentication or rate-limit failure'
    });

    await expect(
      emailService.sendPasswordResetEmail(
        'user@example.com',
        'https://app.example.com/reset-password?token=abc'
      )
    ).rejects.toMatchObject({
      code: 'EMAIL_RATE_LIMITED',
      provider: 'gmail',
      statusCode: 454
    });
  });

  it('returns a typed error when SMTP authentication fails', async () => {
    smtpMocks.sendMail.mockRejectedValue({
      responseCode: 535,
      message: 'Invalid login'
    });

    await expect(
      emailService.sendPasswordResetEmail(
        'user@example.com',
        'https://app.example.com/reset-password?token=abc'
      )
    ).rejects.toMatchObject({
      code: 'EMAIL_AUTH_FAILED',
      provider: 'gmail',
      statusCode: 535
    });
  });
});
