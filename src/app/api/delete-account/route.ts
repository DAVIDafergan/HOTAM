import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requesterUid = user.id;
    const requesterRole = user.user_metadata?.role as string | undefined;
    const requesterEmail = (user.email ?? '').toLowerCase();
    const superAdminEmails = new Set([
      'admin@hotam.co.il',
      'davidafergan999@gmail.com',
      'davidafergan@gmail.com',
      'da@101.org.il',
    ]);
    const superAdminUids = new Set([
      'f9hcxiHpzKYMzw7UNpi5II2F13l1',
      'aMqKTe1Y4NSQdupLPupviiyrdyj2',
    ]);

    let body: { reason?: string; targetUserId?: string; targetRole?: 'seller' | 'customer' | 'admin' } = {};
    try { body = await req.json(); } catch {}
    if (body.reason) {
      console.info(`[delete-account] requester_uid=${requesterUid} requester_role=${requesterRole} reason="${body.reason}"`);
    }

    const { data: adminRow } = await serviceClient
      .from('admins')
      .select('id')
      .eq('id', requesterUid)
      .maybeSingle();
    const isSuperAdmin = superAdminUids.has(requesterUid) || superAdminEmails.has(requesterEmail);
    const canAdminDeleteUsers = isSuperAdmin || !!adminRow;

    let uid = requesterUid;
    let role = requesterRole;

    if (body.targetUserId) {
      if (!canAdminDeleteUsers) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      uid = body.targetUserId;
      role = body.targetRole;

      if (!role) {
        const [{ data: seller }, { data: customer }, { data: admin }] = await Promise.all([
          serviceClient.from('sellers').select('id').eq('id', uid).maybeSingle(),
          serviceClient.from('customers').select('id').eq('id', uid).maybeSingle(),
          serviceClient.from('admins').select('id').eq('id', uid).maybeSingle(),
        ]);
        role = seller ? 'seller' : admin ? 'admin' : customer ? 'customer' : 'customer';
      }
    }

    // Delete all products uploaded by the seller.
    // Even if this fails we still proceed to delete the auth user so the account
    // is fully removed; any orphaned rows can be cleaned up by a DB admin.
    if (role === 'seller') {
      const { error: productsError } = await serviceClient
        .from('products')
        .delete()
        .eq('seller_id', uid);
      if (productsError) {
        console.error('[delete-account] products delete error:', productsError);
      }

      const { error: sellerError } = await serviceClient.from('sellers').delete().eq('id', uid);
      if (sellerError) {
        console.error('[delete-account] sellers row delete error:', sellerError);
      }
    } else if (role === 'admin') {
      const { error: adminDeleteError } = await serviceClient.from('admins').delete().eq('id', uid);
      if (adminDeleteError) {
        console.error('[delete-account] admins row delete error:', adminDeleteError);
      }
    } else {
      const { error: customerError } = await serviceClient.from('customers').delete().eq('id', uid);
      if (customerError) {
        console.error('[delete-account] customers row delete error:', customerError);
      }
    }

    // Finally, delete the auth user (this cascades via DB trigger if set up)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(uid);
    if (deleteError) {
      console.error('[delete-account] auth delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete-account] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
