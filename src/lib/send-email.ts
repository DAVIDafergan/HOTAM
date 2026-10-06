import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}
const resend = new Resend(apiKey);
const FROM = 'Hotam Shop <updates@hotam.shop>';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}

export interface BatchEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

/** Up to 100 separate emails in one Resend call (each recipient gets their own message). Throws on failure. */
export async function sendEmailBatch(emails: BatchEmail[]): Promise<void> {
  if (emails.length === 0) return;
  const { error } = await resend.batch.send(emails.map((email) => ({ from: FROM, ...email })));
  if (error) throw new Error(error.message);
}
