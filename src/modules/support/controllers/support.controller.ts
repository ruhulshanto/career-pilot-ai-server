import { emailTemplates } from '@/shared/email/email-templates.js';
import { emailService } from '@/shared/email/email.service.js';
import { apiResponse, apiErrorResponse } from '@/shared/responses/api-response.js';
import type { Request, Response } from 'express';

export const supportController = {
  async sendContactMessage(req: Request, res: Response) {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json(apiErrorResponse('All fields are required'));
    }

    try {
      // 1. Send email to admin/support
      await emailService.sendEmail({
        to: process.env.EMAIL_REPLY_TO || 'support@careerpilot.ai',
        ...emailTemplates.notification({
          title: `New Support Inquiry: ${subject}`,
          message: `From: ${name} (${email})\n\nMessage:\n${message}`
        })
      });

      // 2. Optional: Send confirmation to user
      await emailService.sendEmail({
        to: email,
        ...emailTemplates.notification({
          title: 'We received your message - Career Pilot AI',
          message: `Hi ${name},\n\nThank you for reaching out. Our team has received your message regarding "${subject}" and will get back to you shortly.\n\nBest regards,\nCareer Pilot AI Support`
        })
      });

      return res.status(200).json(apiResponse('Message sent successfully'));
    } catch (error) {
      console.error('Contact form error:', error);
      return res.status(500).json(apiErrorResponse('Failed to send message. Please try again later.'));
    }
  }
};
