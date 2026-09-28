import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// A Judaica seller asks to be verified as a סופר סת"ם. They submit the same professional
// details + files as the full scribe onboarding; this marks the request 'pending' for an
// admin. seller_type itself is never changed here — only an admin approval does that — and
// the seller's existing Judaica listings keep selling while the request is pending.

// Only these profile fields may be written by this route.
const PROFESSIONAL_FIELDS = [
  'age', 'marital_status', 'has_scribe_certificate', 'certificate_url', 'torah_study_frequency',
  'mikveh_frequency', 'notes', 'experience_years', 'script_level', 'script_types', 'writing_samples',
] as const;

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Tells every admin (the admins table's emails) that an upgrade request is waiting. Best effort:
 * the request is already saved and shows in /admin, so a mail failure is only logged.
 */
async function notifyAdmins(serviceClient: any, seller: { first_name?: string | null; last_name?: string | null; email?: string | null }, experienceYears: number) {
  try {
    const { data: admins, error } = await serviceClient.from('admins').select('email');
    if (error) throw error;
    const recipients = Array.from(new Set((admins || []).map((a: any) => String(a.email || '').trim()).filter(Boolean))) as string[];
    if (recipients.length === 0) return;
    // Loaded here (not at the top) so a missing mail key can't take the whole route down.
    const { sendEmail } = await import('@/lib/send-email');
    const name = `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email || 'מוכר';
    const subject = `בקשת שדרוג לסופר סת"ם: ${name}`;
    const text = `${name} (${seller.email || ''}) ביקש/ה אימות כסופר סת"ם, עם ${experienceYears} שנות ניסיון. הבקשה ממתינה לאישורך בפאנל הניהול: https://hotam.shop/admin`;
    const html = `
      <div dir="rtl" style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(212,175,55,0.18);">
          <div style="background:#111827;padding:28px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:900;">בקשת שדרוג לסופר סת"ם</h1>
            <p style="margin:8px 0 0;color:#d4af37;font-size:14px;font-weight:700;">ממתינה לאישורך</p>
          </div>
          <div style="padding:28px;text-align:right;">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.8;"><strong>${escapeHtml(name)}</strong> (${escapeHtml(seller.email)}), מוכר/ת יודאיקה באתר, ביקש/ה אימות מלא כסופר סת"ם.</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;">שנות ניסיון: ${escapeHtml(experienceYears)}. פרטי ההסמכה ודוגמאות הכתיבה מחכים לבדיקה בפאנל הניהול, בטאב "ממתינים לאישור".</p>
            <div style="text-align:center;">
              <a href="https://hotam.shop/admin" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-size:15px;font-weight:800;">לבדיקת הבקשה</a>
            </div>
          </div>
        </div>
      </div>`;
    await Promise.all(recipients.map((to) => sendEmail({ to, subject, text, html })));
  } catch (error: any) {
    console.error('[request-stam-upgrade] admin notification email failed:', error?.message ?? error);
  }
}

function validate(fields: Record<string, any>): string | null {
  if (!String(fields.notes ?? '').trim()) return 'יש לפרט על ההסמכה וההנהגה האישית';
  const experience = fields.experience_years;
  if (experience === undefined || experience === null || String(experience).trim() === '' || Number.isNaN(Number(experience)) || Number(experience) < 0) {
    return 'יש להזין שנות ניסיון';
  }
  if (!Array.isArray(fields.script_types) || fields.script_types.length === 0) return 'יש לבחור לפחות סוג כתב אחד';
  if (!Array.isArray(fields.writing_samples) || fields.writing_samples.length < 2) return 'יש להעלות לפחות 2 דוגמאות כתיבה';
  const hasCertificate = fields.has_scribe_certificate === 'valid' || fields.has_scribe_certificate === 'expired';
  if (hasCertificate && !String(fields.certificate_url ?? '').trim()) return 'יש להעלות צילום של תעודת הסופר';
  return null;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'request-stam-upgrade', maxRequests: 5, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: seller, error: sellerError } = await serviceClient
      .from('sellers')
      .select('id, is_approved, seller_type, stam_upgrade_status, first_name, last_name, email')
      .eq('id', user.id)
      .maybeSingle();
    if (sellerError || !seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    if (seller.seller_type === 'stam_scribe') {
      return NextResponse.json({ error: 'Already a stam scribe' }, { status: 409 });
    }
    if (seller.stam_upgrade_status === 'pending') {
      return NextResponse.json({ error: 'Upgrade already pending' }, { status: 409 });
    }

    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {}

    const fields: Record<string, any> = {};
    for (const key of PROFESSIONAL_FIELDS) {
      if (key in body) fields[key] = body[key];
    }
    const validationError = validate(fields);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    if (fields.age !== undefined) fields.age = Number(fields.age) || null;
    fields.experience_years = Number(fields.experience_years);

    const now = new Date().toISOString();
    const { error: updateError } = await serviceClient
      .from('sellers')
      .update({
        ...fields,
        stam_upgrade_status: 'pending',
        stam_upgrade_requested_at: now,
        updated_at: now,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[request-stam-upgrade] update failed:', updateError.message);
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    await notifyAdmins(serviceClient, { ...seller, email: seller.email || user.email }, fields.experience_years);

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (error: any) {
    console.error('[request-stam-upgrade] unexpected error:', error?.message ?? error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
