import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// TECH-DEBT: This endpoint pages through all auth.users to find created_at.
// Long-term fix: store created_at in the customers/sellers tables at signup time
// (via DB trigger or register-seller API), then query it directly.
// For now, cap MAX_PAGES lower to protect against timeout on large user bases.
const PAGE_SIZE = 200;
const MAX_PAGES = 20; // Reduced from 50 — covers ~4,000 users before timeout risk.

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminRow } = await serviceClient
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (!adminRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: { ids?: unknown } = {};
    try {
      body = await req.json();
    } catch {}

    const requestedIds = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    if (requestedIds.length === 0) {
      return NextResponse.json({ usersCreatedAt: {} });
    }

    const unresolved = new Set(requestedIds);
    const usersCreatedAt: Record<string, string> = {};

    for (let page = 1; page <= MAX_PAGES && unresolved.size > 0; page += 1) {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const users = data?.users ?? [];
      for (const authUser of users) {
        if (unresolved.has(authUser.id)) {
          usersCreatedAt[authUser.id] = authUser.created_at;
          unresolved.delete(authUser.id);
        }
      }

      if (users.length < PAGE_SIZE) {
        break;
      }
    }

    return NextResponse.json({ usersCreatedAt });
  } catch (error) {
    console.error('[admin/customers-created-at] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
