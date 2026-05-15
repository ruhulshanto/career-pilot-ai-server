import { logger } from '@/logging/logger.js';
import { env } from '@config/env.js';
import nodemailer from 'nodemailer';
import {
  EmailDeliveryError,
  EmailProvider,
  SendEmailOptions
} from '../email.types.js';

const getMissingSmtpConfig = () =>
  [
    ['EMAIL_FROM', env.EMAIL_FROM],
    ['SMTP_HOST', env.SMTP_HOST],
    ['SMTP_USER', env.SMTP_USER],
    ['SMTP_PASS', env.SMTP_PASS]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

const getResponseCode = (error: unknown) => {
  const responseCode = (error as { responseCode?: unknown })?.responseCode;
  return typeof responseCode === 'number' ? responseCode : undefined;
};

const getSmtpErrorCode = (error: unknown) => {
  const responseCode = getResponseCode(error);

  if (responseCode === 534 || responseCode === 535) {
    return 'EMAIL_AUTH_FAILED';
  }

  if (
    responseCode &&
    [421, 450, 451, 452, 454].includes(responseCode)
  ) {
    return 'EMAIL_RATE_LIMITED';
  }

  return 'EMAIL_DELIVERY_FAILED';
};

const buildHeaders = (tags: SendEmailOptions['tags']) =>
  tags?.reduce<Record<string, string>>((headers, tag) => {
    headers[`X-Career-Pilot-${tag.name}`] = tag.value;
    return headers;
  }, {});

export const gmailSmtpEmailProvider: EmailProvider = {
  name: 'gmail',

  async sendEmail(options: SendEmailOptions) {
    const missingConfig = getMissingSmtpConfig();
    if (missingConfig.length) {
      throw new EmailDeliveryError(
        `SMTP provider is not configured: ${missingConfig.join(', ')}`,
        'EMAIL_PROVIDER_NOT_CONFIGURED',
        'gmail'
      );
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    });

    try {
      const result = await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: options.to,
        replyTo: options.replyTo ?? env.EMAIL_REPLY_TO,
        subject: options.subject,
        text: options.text,
        html: options.html,
        headers: buildHeaders(options.tags)
      });

      logger.info(
        {
          provider: 'gmail',
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected,
          to: options.to,
          subject: options.subject
        },
        'SMTP email delivered'
      );

      return {
        provider: 'gmail',
        messageId: result.messageId
      };
    } catch (error) {
      const statusCode = getResponseCode(error);
      const code = getSmtpErrorCode(error);

      logger.error(
        {
          provider: 'gmail',
          code,
          statusCode,
          to: options.to,
          subject: options.subject
        },
        'SMTP email delivery failed'
      );

      throw new EmailDeliveryError(
        code === 'EMAIL_AUTH_FAILED'
          ? 'SMTP authentication failed'
          : code === 'EMAIL_RATE_LIMITED'
            ? 'SMTP provider rate limit reached'
            : 'SMTP provider failed to deliver message',
        code,
        'gmail',
        statusCode
      );
    }
  }
};
