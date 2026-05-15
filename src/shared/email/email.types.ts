export type EmailProviderName = 'gmail';

export type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

export type EmailDeliveryResult = {
  provider: EmailProviderName;
  messageId?: string;
};

export interface EmailProvider {
  name: EmailProviderName;
  sendEmail(options: SendEmailOptions): Promise<EmailDeliveryResult>;
}

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: EmailProviderName,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}
