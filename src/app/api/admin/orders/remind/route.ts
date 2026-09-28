import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { classifyStuckOrder, STUCK_THRESHOLDS } from '@/lib/stuck-orders';

// Admin-only: email the seller of a stuck order (paid and not delivered, or an unhandled
// ספר תורה request). The seller's email is looked up here; the send is logged in activity_events.

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'admin-order-remind', maxRequests: 20, windowMs: 60_000 })) {
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
    const { data: admin } = await service.from('admins').select('id').eq('id', user.id).maybeSingle();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: { orderId?: string } = {};
    try { body = await req.json(); } catch {}
    const orderId = String(body.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const { data: order } = await service
      .from('orders')
      .select('id, seller_id, status, product_name, buyer_name, amount, paid_at, created_at')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const stuck = classifyStuckOrder(order);
    if (!stuck || stuck.kind === 'abandoned_payment') {
      return NextResponse.json({ error: 'ההזמנה אינה ממתינה לטיפול המוכר' }, { status: 409 });
    }

    const { data: seller } = await service.from('sellers').select('email, first_name').eq('id', order.seller_id).maybeSingle();
    if (!seller?.email) return NextResponse.json({ error: 'למוכר אין כתובת מייל' }, { status: 422 });

    const shortId = String(order.id).slice(0, 8);
    const what = stuck.kind === 'torah_request' ? 'בקשת ספר תורה' : 'הזמנה ששולמה וממתינה למסירה';
    const link = 'https://hotam.shop/seller/dashboard?tab=sales';
    const { sendEmail } = await import('@/lib/send-email');
    await sendEmail({
      to: seller.email,
      subject: `תזכורת: הזמנה #${shortId} ממתינה לטיפולך`,
      text: `שלום ${seller.first_name || ''}, ${what} (${order.product_name || ''}, #${shortId}) ממתינה לטיפולך כבר ${stuck.days} ימים. לטיפול: ${link}`,
      html: `
        <div dir="rtl" style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(212,175,55,0.18);">
            <div style="background:#111827;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:900;">תזכורת: הזמנה ממתינה לטיפולך</h1>
            </div>
            <div style="padding:24px;text-align:right;font-size:16px;line-height:1.8;">
              <p style="margin:0 0 12px;">שלום ${escapeHtml(seller.first_name)},</p>
              <p style="margin:0 0 12px;">${escapeHtml(what)}: <strong>${escapeHtml(order.product_name)}</strong> (#${escapeHtml(shortId)}), של ${escapeHtml(order.buyer_name || 'הקונה')}, ממתינה כבר <strong>${stuck.days} ימים</strong>.</p>
              <p style="margin:0 0 24px;color:#374151;">${stuck.kind === 'awaiting_delivery' ? 'לאחר המסירה, הזינו בדשבורד את קוד המסירה שקיבלתם מהקונה כדי להשלים את העסקה.' : 'אנא צרו קשר עם הלקוח לתיאום.'}</p>
              <div style="text-align:center;">
                <a href="${link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-size:15px;font-weight:800;">למכירות שלי</a>
              </div>
            </div>
          </div>
        </div>`,
    });

    await service.from('activity_events').insert({
      actor_id: user.id,
      actor_role: 'admin',
      event_type: 'admin_order_reminder',
      event_data: { order_id: order.id, seller_id: order.seller_id, kind: stuck.kind, days: stuck.days, label: STUCK_THRESHOLDS[stuck.kind].label },
    });
    return NextResponse.json({ sent: true });
  } catch (error: any) {
    console.error('[admin-order-remind] failed:', error?.message ?? error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
