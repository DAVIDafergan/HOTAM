import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  BROADCAST_AUDIENCES,
  finalSubject,
  isBroadcastAudience,
  isValidEmail,
  renderBroadcastEmail,
  validateBroadcastContent,
  type BroadcastAudience,
  type BroadcastContent,
} from '@/lib/broadcast-email';
import { normalizeEmail, unsubscribeApiUrl, unsubscribeUrl } from '@/lib/unsubscribe-token';

// Admin broadcast email ("דיוור"): recipient counts, a test send to one address, and the real
// send to an audience. Admin-only. Every recipient gets their own message (no shared To/BCC),
// with a signed unsubscribe link; opted-out addresses are skipped. Each real send is logged in
// activity_events.

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_SIZE = 100;
const PAUSE_BETWEEN_BATCHES_MS = 600;
const REPEAT_WINDOW_MS = 15 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function siteUrl() {
  const value = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(value) ? value : 'https://www.hotam.shop';
}

interface Recipient {
  email: string;
  firstName: string;
  isCustomer: boolean;
  sellerType: 'stam_scribe' | 'judaica_seller' | null;
  sellerApproved: boolean;
}

async function fetchAll(service: SupabaseClient, table: string, columns: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function loadRecipients(service: SupabaseClient) {
  const [sellers, customers] = await Promise.all([
    fetchAll(service, 'sellers', 'email, first_name, seller_type, is_approved'),
    fetchAll(service, 'customers', 'email, first_name'),
  ]);
  const byEmail = new Map<string, Recipient>();
  for (const s of sellers) {
    if (!isValidEmail(s.email)) continue;
    const email = normalizeEmail(s.email);
    byEmail.set(email, {
      email,
      firstName: String(s.first_name || '').trim(),
      isCustomer: false,
      sellerType: s.seller_type === 'judaica_seller' ? 'judaica_seller' : 'stam_scribe',
      sellerApproved: s.is_approved === true,
    });
  }
  for (const c of customers) {
    if (!isValidEmail(c.email)) continue;
    const email = normalizeEmail(c.email);
    const existing = byEmail.get(email);
    if (existing) {
      existing.isCustomer = true;
      if (!existing.firstName) existing.firstName = String(c.first_name || '').trim();
    } else {
      byEmail.set(email, { email, firstName: String(c.first_name || '').trim(), isCustomer: true, sellerType: null, sellerApproved: false });
    }
  }

  // Missing table = the migration hasn't been run yet; counted so the screen can say so.
  const { data: unsubscribed, error } = await service.from('email_unsubscribes').select('email');
  const unsubscribeReady = !error;
  const optedOut = new Set((unsubscribed || []).map((row: any) => normalizeEmail(String(row.email))));
  const recipients = Array.from(byEmail.values()).filter((r) => !optedOut.has(r.email));
  return { recipients, unsubscribeReady, optedOutCount: byEmail.size - recipients.length };
}

function inAudience(r: Recipient, audience: BroadcastAudience, approvedOnly: boolean) {
  const seller = r.sellerType !== null && (!approvedOnly || r.sellerApproved);
  switch (audience) {
    case 'all': return r.isCustomer || seller;
    case 'sellers': return seller;
    case 'stam_scribes': return seller && r.sellerType === 'stam_scribe';
    case 'judaica_sellers': return seller && r.sellerType === 'judaica_seller';
    case 'customers': return r.isCustomer;
  }
}

function readContent(raw: any): BroadcastContent {
  return {
    subject: String(raw?.subject ?? ''),
    heading: String(raw?.heading ?? ''),
    body: String(raw?.body ?? ''),
    imageUrl: raw?.imageUrl ? String(raw.imageUrl) : null,
    ctaText: raw?.ctaText ? String(raw.ctaText) : null,
    ctaUrl: raw?.ctaUrl ? String(raw.ctaUrl).trim() : null,
    isAdvertisement: raw?.isAdvertisement !== false,
  };
}

function buildEmail(content: BroadcastContent, r: { email: string; firstName: string }, isTest: boolean) {
  const site = siteUrl();
  const { html, text } = renderBroadcastEmail(content, {
    firstName: r.firstName,
    unsubscribeUrl: unsubscribeUrl(site, r.email),
    siteUrl: site,
  });
  return {
    to: r.email,
    subject: finalSubject(content, isTest),
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeApiUrl(site, r.email)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
    const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: { user }, error: authError } = await service.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: adminRow } = await service.from('admins').select('id, email').eq('id', user.id).maybeSingle();
    if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body?.action;

    if (action === 'stats') {
      const { recipients, unsubscribeReady, optedOutCount } = await loadRecipients(service);
      const counts: Record<string, { approvedOnly: number; everyone: number }> = {};
      for (const audience of BROADCAST_AUDIENCES) {
        counts[audience] = {
          approvedOnly: recipients.filter((r) => inAudience(r, audience, true)).length,
          everyone: recipients.filter((r) => inAudience(r, audience, false)).length,
        };
      }
      const { data: history } = await service
        .from('activity_events')
        .select('created_at, event_data')
        .eq('event_type', 'admin_broadcast_sent')
        .order('created_at', { ascending: false })
        .limit(10);
      return NextResponse.json({ counts, unsubscribeReady, optedOutCount, history: history || [], adminEmail: adminRow.email || user.email || '' });
    }

    const content = readContent(body?.content);
    const problem = validateBroadcastContent(content);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const { sendEmailBatch } = await import('@/lib/send-email');

    if (action === 'test') {
      const to = String(body?.testEmail ?? '').trim();
      if (!isValidEmail(to)) return NextResponse.json({ error: 'כתובת המייל לניסיון אינה תקינה' }, { status: 400 });
      const { data: me } = await service.from('sellers').select('first_name').eq('id', user.id).maybeSingle();
      const { data: meCustomer } = me ? { data: null } : await service.from('customers').select('first_name').eq('id', user.id).maybeSingle();
      const firstName = String(me?.first_name || meCustomer?.first_name || user.user_metadata?.first_name || '').trim();
      try {
        await sendEmailBatch([buildEmail(content, { email: normalizeEmail(to), firstName }, true)]);
      } catch (error: any) {
        console.error('[admin/broadcast] test send failed:', error?.message ?? error);
        return NextResponse.json({ error: `שליחת מייל הניסיון נכשלה: ${String(error?.message || 'שגיאה בשירות המייל')}` }, { status: 502 });
      }
      return NextResponse.json({ ok: true, to });
    }

    if (action === 'send') {
      if (!isBroadcastAudience(body?.audience)) return NextResponse.json({ error: 'קהל יעד לא תקין' }, { status: 400 });
      const audience = body.audience as BroadcastAudience;
      const approvedOnly = body?.approvedOnly !== false;
      const { recipients, unsubscribeReady } = await loadRecipients(service);
      if (!unsubscribeReady) {
        return NextResponse.json({ error: 'רשימת ההסרה עדיין לא הותקנה במסד הנתונים (יש להריץ את המיגרציה). בינתיים אפשר לשלוח רק מייל ניסיון.' }, { status: 409 });
      }
      const targets = recipients.filter((r) => inAudience(r, audience, approvedOnly));
      if (targets.length === 0) return NextResponse.json({ error: 'אין נמענים בקהל שנבחר' }, { status: 400 });
      // The admin confirmed a specific number; if the list changed since, they confirm again.
      if (Number(body?.expectedCount) !== targets.length) {
        return NextResponse.json({ error: `מספר הנמענים השתנה (${targets.length}). יש לאשר שוב.`, count: targets.length }, { status: 409 });
      }
      const since = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString();
      const { data: recent } = await service
        .from('activity_events')
        .select('event_data')
        .eq('event_type', 'admin_broadcast_sent')
        .gte('created_at', since);
      if ((recent || []).some((e: any) => e.event_data?.subject === content.subject.trim() && e.event_data?.audience === audience)) {
        return NextResponse.json({ error: 'דיוור עם אותו נושא כבר נשלח לקהל הזה ברבע השעה האחרונה' }, { status: 409 });
      }

      let sent = 0;
      let failed = 0;
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const chunk = targets.slice(i, i + BATCH_SIZE);
        const emails = chunk.map((r) => buildEmail(content, r, false));
        try {
          await sendEmailBatch(emails);
          sent += chunk.length;
        } catch (firstError: any) {
          await sleep(2000);
          try {
            await sendEmailBatch(emails);
            sent += chunk.length;
          } catch (error: any) {
            failed += chunk.length;
            console.error('[admin/broadcast] batch failed:', firstError?.message ?? firstError, '/', error?.message ?? error);
          }
        }
        if (i + BATCH_SIZE < targets.length) await sleep(PAUSE_BETWEEN_BATCHES_MS);
      }

      await service.from('activity_events').insert({
        actor_id: user.id,
        actor_role: 'admin',
        event_type: 'admin_broadcast_sent',
        event_data: {
          subject: content.subject.trim(),
          audience,
          approved_only: approvedOnly,
          recipients: targets.length,
          sent,
          failed,
          has_image: !!content.imageUrl,
          admin_email: adminRow.email || user.email || null,
        },
      });
      return NextResponse.json({ ok: failed === 0, sent, failed });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[admin/broadcast] error:', error?.message ?? error);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
}
