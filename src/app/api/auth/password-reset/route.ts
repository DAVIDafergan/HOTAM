import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getBaseOrigin(): string | null {
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envSiteUrl && /^https?:\/\//i.test(envSiteUrl)) {
    return envSiteUrl.replace(/\/+$/, '');
  }
  return null;
}

function getResetEmailTemplate(actionLink: string) {
  const subject = 'איפוס סיסמה - HOTAM';
  const text = `שלום,\n\nהתקבלה בקשה לאיפוס סיסמה בחשבון HOTAM שלך.\n\nלהגדרת סיסמה חדשה לחץ כאן:\n${actionLink}\n\nאם לא ביקשת לאפס סיסמה, ניתן להתעלם מהמייל הזה.\n\nHOTAM`;
  const html = `
    <div dir="rtl" style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.12);border:1px solid rgba(212,175,55,0.18);">
        <div style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);padding:36px 32px;text-align:center;">
          <img src="https://hotam.shop/icon.svg" alt="Hotam" width="72" height="72" style="display:block;margin:0 auto 16px;" />
          <div style="color:#d4af37;font-size:13px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">HOTAM</div>
          <h1 style="margin:14px 0 0;font-size:30px;line-height:1.3;color:#ffffff;font-weight:900;">איפוס סיסמה</h1>
          <p style="margin:12px 0 0;color:rgba(255,255,255,0.82);font-size:16px;line-height:1.8;">
            התקבלה בקשה לאיפוס סיסמה. לחיצה על הכפתור תאפשר לך להגדיר סיסמה חדשה.
          </p>
        </div>
        <div style="padding:36px 32px 20px;text-align:center;">
          <a href="${actionLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 10px 25px rgba(17,24,39,0.18);">
            להגדרת סיסמה חדשה
          </a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.8;color:#6b7280;text-align:right;">
            אם לא ביקשת לאפס סיסמה, ניתן להתעלם מהמייל הזה.
          </p>
        </div>
      </div>
    </div>
  `;
  return { subject, text, html };
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase env is not configured');
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const baseOrigin = getBaseOrigin();
    const redirectTo = baseOrigin ? `${baseOrigin}/reset-password` : undefined;

    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) {
      throw new Error(error.message);
    }

    const actionLink = data?.properties?.action_link;
    if (actionLink) {
      const { sendEmail } = await import('@/lib/send-email');
      const template = getResetEmailTemplate(actionLink);
      await sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[password-reset] failed:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
