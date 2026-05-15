import { logger } from '@/logging/logger.js';
import { env } from '@config/env.js';
import { z } from 'zod';
import { emailTemplates } from './email-templates.js';
import {
  EmailDeliveryError,
  EmailProvider,
  SendEmailOptions
} from './email.types.js';
import { gmailSmtpEmailProvider } from './providers/smtp.provider.js';

const emailAddressSchema = z.string().email();

const providers: Record<typeof env.EMAIL_PROVIDER, EmailProvider> = {
  gmail: gmailSmtpEmailProvider
};

const provider = providers[env.EMAIL_PROVIDER];

const assertValidRecipient = (to: string) => {
  const result = emailAddressSchema.safeParse(to);
  if (!result.success) {
    throw new EmailDeliveryError(
      'Invalid recipient email address',
      'INVALID_EMAIL_ADDRESS',
      env.EMAIL_PROVIDER
    );
  }
};

export const emailService = {
  async sendEmail(options: SendEmailOptions) {
    assertValidRecipient(options.to);

    try {
      const result = await provider.sendEmail(options);
      logger.info(
        {
          provider: result.provider,
          messageId: result.messageId,
          to: options.to,
          subject: options.subject
        },
        'Transactional email sent'
      );
      return result;
    } catch (error) {
      if (error instanceof EmailDeliveryError) {
        logger.error(
          {
            provider: error.provider ?? env.EMAIL_PROVIDER,
            code: error.code,
            statusCode: error.statusCode,
            to: options.to,
            subject: options.subject
          },
          'Transactional email failed'
        );
        throw error;
      }

      logger.error(
        { error, provider: env.EMAIL_PROVIDER, to: options.to },
        'Unexpected transactional email failure'
      );

      throw new EmailDeliveryError(
        'Unexpected email delivery failure',
        'EMAIL_DELIVERY_FAILED',
        env.EMAIL_PROVIDER
      );
    }
  },

  async sendVerificationEmail(to: string, verificationUrl: string, firstName?: string | null) {
    return this.sendEmail({
      to,
      ...emailTemplates.verification({ verificationUrl, firstName }),
      tags: [{ name: 'type', value: 'email_verification' }]
    });
  },

  async sendPasswordResetEmail(to: string, resetUrl: string, firstName?: string | null) {
    return this.sendEmail({
      to,
      ...emailTemplates.passwordReset({ resetUrl, firstName }),
      tags: [{ name: 'type', value: 'password_reset' }]
    });
  },

  async sendNotificationEmail(to: string, title: string, message: string) {
    return this.sendEmail({
      to,
      ...emailTemplates.notification({ title, message }),
      tags: [{ name: 'type', value: 'notification' }]
    });
  }
};
