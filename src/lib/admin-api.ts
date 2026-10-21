import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// Shared guard for /api/admin/* routes: the caller's bearer token must belong to a row in
// `admins`. Returns the service-role client (bypasses RLS) only after that check passes.
// Same check as the older admin routes (broadcast, orders/remind, customers-created-at).

export type AdminContext = { service: SupabaseClient; user: User; adminEmail: string | null };

export async function requireAdmin(req: Request): Promise<{ ok: true; ctx: AdminContext } | { ok: false; response: NextResponse }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, response: NextResponse.json({ error: 'Service unavailable' }, { status: 500 }) };
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: { user }, error } = await service.auth.getUser(token);
  if (error || !user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: adminRow } = await service.from('admins').select('id, email').eq('id', user.id).maybeSingle();
  if (!adminRow) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  return { ok: true, ctx: { service, user, adminEmail: (adminRow as any).email || user.email || null } };
}

/** True when a PostgREST error means "the table isn't there" (migration not run yet). */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '');
}
