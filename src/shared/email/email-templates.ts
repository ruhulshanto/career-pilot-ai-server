type VerificationTemplateInput = {
  verificationUrl: string;
  firstName?: string | null;
};

type PasswordResetTemplateInput = {
  resetUrl: string;
  firstName?: string | null;
};

type NotificationTemplateInput = {
  title: string;
  message: string;
};

const brandName = 'Career Pilot AI';
const supportText = 'If you did not request this, you can safely ignore this email.';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const plainGreeting = (firstName?: string | null) =>
  firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi,';

const htmlGreeting = (firstName?: string | null) =>
  firstName?.trim() ? `Hi ${escapeHtml(firstName.trim())},` : 'Hi,';

const baseHtml = ({
  title,
  preview,
  body,
  actionLabel,
  actionUrl,
  footerNote
}: {
  title: string;
  preview: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
}) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preview)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#07111f;padding:28px 32px;">
                <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${brandName}</div>
                <div style="margin-top:6px;font-size:13px;color:#94a3b8;">AI career planning, resume intelligence, and interview readiness.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0f172a;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:1.7;color:#334155;">${body}</div>
                ${
                  actionLabel && actionUrl
                    ? `<div style="margin:28px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 22px;">${escapeHtml(actionLabel)}</a></div>`
                    : ''
                }
                ${
                  actionUrl
                    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Button not working? Copy and paste this link into your browser:<br /><a href="${escapeHtml(actionUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(actionUrl)}</a></p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;padding:20px 32px;font-size:12px;line-height:1.6;color:#64748b;">
                ${escapeHtml(footerNote ?? supportText)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const emailTemplates = {
  verification({ verificationUrl, firstName }: VerificationTemplateInput) {
    const greeting = htmlGreeting(firstName);
    const body = `
      <p style="margin:0 0 14px;">${greeting}</p>
      <p style="margin:0 0 14px;">Please verify your email address so your ${brandName} account stays secure and ready for career planning.</p>
      <p style="margin:0;">This verification link expires in 24 hours and can only be used once.</p>
    `;

    return {
      subject: `Verify your ${brandName} email`,
      text: `${plainGreeting(firstName)}

Please verify your email address for ${brandName}: ${verificationUrl}

This verification link expires in 24 hours and can only be used once.

${supportText}`,
      html: baseHtml({
        title: 'Verify your email',
        preview: `Verify your ${brandName} account email.`,
        body,
        actionLabel: 'Verify email',
        actionUrl: verificationUrl
      })
    };
  },

  passwordReset({ resetUrl, firstName }: PasswordResetTemplateInput) {
    const greeting = htmlGreeting(firstName);
    const body = `
      <p style="margin:0 0 14px;">${greeting}</p>
      <p style="margin:0 0 14px;">We received a request to reset your ${brandName} password.</p>
      <p style="margin:0;">This reset link expires in 30 minutes and can only be used once.</p>
    `;

    return {
      subject: `Reset your ${brandName} password`,
      text: `${plainGreeting(firstName)}

Reset your ${brandName} password: ${resetUrl}

This reset link expires in 30 minutes and can only be used once.

${supportText}`,
      html: baseHtml({
        title: 'Reset your password',
        preview: `Reset your ${brandName} password.`,
        body,
        actionLabel: 'Reset password',
        actionUrl: resetUrl
      })
    };
  },

  notification({ title, message }: NotificationTemplateInput) {
    return {
      subject: `Notification: ${title}`,
      text: message,
      html: baseHtml({
        title,
        preview: message,
        body: `<p style="margin:0;">${escapeHtml(message)}</p>`,
        footerNote:
          'You received this because email notifications are enabled for your Career Pilot AI account.'
      })
    };
  }
};
