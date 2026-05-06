import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';

export async function POST(req: Request) {
  try {
    const { to, subject, text } = await req.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, text' }, { status: 400 });
    }

    await sendEmail({ to, subject, text });
    return NextResponse.json({ message: 'Email sent' });
  } catch (error: any) {
    console.error('send-email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
