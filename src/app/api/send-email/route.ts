import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { createClient } = await import('@supabase/supabase-js');
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user: authUser }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, text, senderName, message, link, html: providedHtml } = await req.json();

    if (!to || !subject || !text) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, text' }, { status: 400 });
    }

    let html: string | undefined = typeof providedHtml === 'string' ? providedHtml : undefined;
    if (senderName && message) {
      const chatLink = link || 'https://hotam.shop';
      html = `
  <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08);">
    <!-- Header with Logo -->
    <div style="background-color: #0a0a0a; padding: 28px 32px; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 10px; text-decoration: none;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19 7-7 3 3-7 7-3-3z" />
          <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="m2 2 5 5" />
          <path d="m11 11 1 1" />
        </svg>
        <span style="color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;">HOTAM</span>
      </div>
      <p style="color: #D4AF37; margin: 8px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;">זירת כלי הקודש</p>
    </div>

    <!-- Accent bar -->
    <div style="height: 3px; background: linear-gradient(to left, #D4AF37, #f5d060, #D4AF37);"></div>

    <!-- Body -->
    <div style="padding: 40px 36px; color: #1f2937; text-align: right;">
      <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px; color: #0a0a0a;">💬 הודעה חדשה ממתינה לך</h2>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 28px; font-weight: 500;">קיבלת הודעה חדשה בפלטפורמת חותם</p>

      <!-- Sender info -->
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; background-color: #0a0a0a; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: #D4AF37; font-size: 18px; font-weight: 900;">${senderName.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p style="margin: 0; font-size: 16px; font-weight: 800; color: #0a0a0a;">${senderName}</p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af; font-weight: 500;">שלח/ה לך הודעה</p>
        </div>
      </div>

      <!-- Message bubble -->
      <div style="background-color: #f0f9ff; border-right: 4px solid #D4AF37; border-radius: 4px 12px 12px 4px; padding: 20px 24px; margin-bottom: 32px; position: relative;">
        <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #374151; font-style: italic;">"${message}"</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; padding: 8px 0;">
        <a href="${chatLink}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          השב להודעה עכשיו &#x2190;
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #f0f0f0;">
      <p style="font-size: 11px; color: #9ca3af; margin: 0; font-weight: 500;">
        הודעה זו נשלחה אוטומטית מ-<strong style="color: #6b7280;">Hotam Shop</strong> &copy; 2026<br/>
        <span style="font-size: 10px; opacity: 0.7;">לא להשיב ישירות למייל זה &bull; כנסו לאתר להשבת תגובה</span>
      </p>
    </div>
  </div>
`;
    }

    const isWelcomeEmail = typeof subject === 'string' && subject.includes('אושר בהצלחה');
    if (isWelcomeEmail) {
      for (const tableName of ['customers', 'sellers'] as const) {
        const { data: row } = await serviceClient
          .from(tableName)
          .select('welcome_email_sent')
          .eq('id', authUser.id)
          .maybeSingle();

        if (row) {
          if (row.welcome_email_sent) {
            return NextResponse.json({ message: 'Already sent' });
          }

          await sendEmail({ to, subject, text, html });
          await serviceClient
            .from(tableName)
            .update({ welcome_email_sent: true })
            .eq('id', authUser.id);

          return NextResponse.json({ message: 'Email sent' });
        }
      }
    }

    await sendEmail({ to, subject, text, html });
    return NextResponse.json({ message: 'Email sent' });
  } catch (error: any) {
    console.error('send-email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
