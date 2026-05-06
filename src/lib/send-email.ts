import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}
const resend = new Resend(apiKey);

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
  await resend.emails.send({
    from: 'Hotam Shop <updates@hotam.shop>',
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}
