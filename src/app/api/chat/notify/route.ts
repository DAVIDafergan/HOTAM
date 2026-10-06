import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// "You have new messages" email to the other side of a chat. The browser only sends the chat id:
// the recipient, their email and their notification preference are looked up here, so no one's
// email address has to reach the other participant's browser. At most one email per chat per hour.

const THROTTLE_MS = 60 * 60 * 1000;
const MAX_PREVIEW = 300;

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'chat-notify', maxRequests: 20, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
    const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: { user }, error: authError } = await service.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { chatId?: string; message?: string } = {};
    try { body = await req.json(); } catch {}
    const chatId = String(body.chatId || '');
    if (!chatId) return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });

    const { data: chat } = await service.from('chats').select('id, participants, last_email_notif_at').eq('id', chatId).maybeSingle();
    const participants: string[] = Array.isArray(chat?.participants) ? chat!.participants : [];
    if (!chat || !participants.includes(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const recipientId = participants.find((p) => p !== user.id);
    if (!recipientId) return NextResponse.json({ sent: false, reason: 'no-recipient' });

    if (chat.last_email_notif_at && Date.now() - new Date(chat.last_email_notif_at).getTime() < THROTTLE_MS) {
      return NextResponse.json({ sent: false, reason: 'throttled' });
    }

    // Recipient: sellers use notification_email, customers notif_msg_email (default on).
    const [{ data: sellerTo }, { data: customerTo }] = await Promise.all([
      service.from('sellers').select('email, notification_email').eq('id', recipientId).maybeSingle(),
      service.from('customers').select('email, notif_msg_email').eq('id', recipientId).maybeSingle(),
    ]);
    const to = sellerTo?.email || customerTo?.email;
    const enabled = sellerTo ? sellerTo.notification_email !== false : customerTo?.notif_msg_email !== false;
    if (!to || !enabled) return NextResponse.json({ sent: false, reason: 'opted-out-or-no-email' });

    const [{ data: sellerFrom }, { data: customerFrom }] = await Promise.all([
      service.from('sellers').select('first_name, last_name').eq('id', user.id).maybeSingle(),
      service.from('customers').select('first_name, last_name').eq('id', user.id).maybeSingle(),
    ]);
    const from = sellerFrom || customerFrom;
    const senderName = from?.first_name ? `${from.first_name}${from.last_name ? ` ${from.last_name}` : ''}` : (user.email?.split('@')[0] || 'משתמש');
    const preview = String(body.message || '').slice(0, MAX_PREVIEW);
    const link = `https://hotam.shop/chat/${user.id}`;

    // Claim the hour first so two quick messages can't both send.
    await service.from('chats').update({ last_email_notif_at: new Date().toISOString() }).eq('id', chatId);

    const { sendEmail } = await import('@/lib/send-email');
    await sendEmail({
      to,
      subject: 'הודעות ממתינות לך ב-Hotam',
      text: `יש לך הודעות חדשות מ-${senderName}. לצפייה ולהשבה, כנס/י לאתר: ${link}`,
      html: `
        <div dir="rtl" style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(212,175,55,0.18);">
            <div style="background:#111827;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:900;">הודעה חדשה מ${escapeHtml(senderName)}</h1>
            </div>
            <div style="padding:24px;text-align:right;">
              ${preview ? `<p style="margin:0 0 20px;font-size:16px;line-height:1.8;background:#f9fafb;border-radius:12px;padding:14px;">${escapeHtml(preview)}</p>` : ''}
              <div style="text-align:center;">
                <a href="${link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-size:15px;font-weight:800;">לצפייה ולהשבה</a>
              </div>
            </div>
          </div>
        </div>`,
    });
    return NextResponse.json({ sent: true });
  } catch (error: any) {
    console.error('[chat-notify] failed:', error?.message ?? error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
