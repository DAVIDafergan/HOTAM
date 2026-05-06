import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';

export async function POST(req: Request) {
  try {
    const { to, subject, text, senderName, message, link } = await req.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, text' }, { status: 400 });
    }

    let html: string | undefined;
    if (senderName && message) {
      const chatLink = link || 'https://hotam.shop';
      html = `
  <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <div style="background-color: #000000; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px; font-weight: 800;">HOTAM SHOP</h1>
    </div>
    
    <div style="padding: 32px; color: #1f2937;">
      <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #111827;">היי, קיבלת הודעה חדשה</h2>
      
      <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
        <strong style="color: #000;">${senderName}</strong> שלח/ה לך הודעה חדשה:
      </p>
      
      <div style="background-color: #f9fafb; border-right: 4px solid #000; padding: 20px; margin-bottom: 32px; border-radius: 4px; font-style: italic; color: #374151;">
        "${message}"
      </div>
      
      <div style="text-align: center;">
        <a href="${chatLink}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          מעבר לשיחה והשבת תגובה
        </a>
      </div>
    </div>
    
    <div style="background-color: #f3f4f6; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">
        נשלח באופן אוטומטי מ-Hotam Shop &copy; 2026
      </p>
    </div>
  </div>
`;
    }

    await sendEmail({ to, subject, text, html });
    return NextResponse.json({ message: 'Email sent' });
  } catch (error: any) {
    console.error('send-email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
