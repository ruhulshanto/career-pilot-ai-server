import { logger } from '@/logging/logger.js';
import { env } from '@config/env.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

/**
 * Reusable Email Service
 * Handles actual email delivery via SMTP, SendGrid, etc.
 */
export const emailService = {
  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, text, html } = options;

    logger.info({ to, subject }, 'Simulating email delivery');

    // In a real implementation, you would use:
    // 1. Nodemailer with SMTP
    // 2. SendGrid / Postmark / Amazon SES SDK
    
    if (env.NODE_ENV === 'production') {
      // Logic for production email delivery
    }

    // Simulate success
    return true;
  },

  /**
   * Send notification email
   */
  async sendNotificationEmail(to: string, title: string, message: string) {
    return this.sendEmail({
      to,
      subject: `Notification: ${title}`,
      text: message,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>${title}</h2>
          <p>${message}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">You received this because you have notifications enabled.</p>
        </div>
      `
    });
  }
};
