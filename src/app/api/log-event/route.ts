import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_SESSION_ID_LENGTH = 100;
const VALID_ROLES = new Set(['customer', 'seller', 'admin', 'anonymous']);

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Generous relative to other endpoints here (register-seller: 10/min) — this fires on
    // routine navigation (onboarding step changes, saves), not just deliberate submissions.
    if (!checkRateLimit(ip, { key: 'log-event', maxRequests: 60, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const eventType = typeof body?.event_type === 'string' ? body.event_type.trim().slice(0, MAX_EVENT_TYPE_LENGTH) : '';
    if (!eventType) {
      return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });
    }

    const sessionId = typeof body?.session_id === 'string' ? body.session_id.slice(0, MAX_SESSION_ID_LENGTH) : null;
    const eventData = body?.event_data && typeof body.event_data === 'object' ? body.event_data : {};

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // actor_id/actor_role are derived server-side from the caller's own session token, never
    // taken from the client's own claim in the request body — a client could otherwise log
    // events under someone else's identity.
    let actorId: string | null = null;
    let actorRole: string = 'anonymous';

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await serviceClient.auth.getUser(token);
      if (user) {
        actorId = user.id;
        const metaRole = user.user_metadata?.role;
        actorRole = VALID_ROLES.has(metaRole) && metaRole !== 'anonymous' ? metaRole : 'customer';
      }
    }

    const { error } = await serviceClient.from('activity_events').insert({
      actor_id: actorId,
      actor_role: actorRole,
      session_id: sessionId,
      event_type: eventType,
      event_data: eventData,
      ip_address: ip,
    });

    if (error) {
      console.error('[log-event] insert failed', error);
      return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[log-event] error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
