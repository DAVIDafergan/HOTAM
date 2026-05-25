import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ResolvedRole = 'customer' | 'seller' | 'admin' | null;

export async function GET(req: Request) {
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

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: adminRow }, { data: sellerRow }, { data: customerRow }] = await Promise.all([
      serviceClient.from('admins').select('id').eq('id', user.id).maybeSingle(),
      serviceClient.from('sellers').select('id').eq('id', user.id).maybeSingle(),
      serviceClient.from('customers').select('id').eq('id', user.id).maybeSingle(),
    ]);

    const metadataRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const role: ResolvedRole = adminRow
      ? 'admin'
      : sellerRow
        ? 'seller'
        : customerRow
          ? 'customer'
          : metadataRole === 'admin' || metadataRole === 'seller' || metadataRole === 'customer'
            ? metadataRole
            : null;

    return NextResponse.json({ role });
  } catch (error) {
    console.error('[auth/session-role] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
