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
      .select('id, is_approved, seller_type, stam_upgrade_status')
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

    return NextResponse.json({ ok: true, status: 'pending' });
  } catch (error: any) {
    console.error('[request-stam-upgrade] unexpected error:', error?.message ?? error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
