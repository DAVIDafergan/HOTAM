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
    const canAdminDeleteUsers = !!adminRow;

    let uid = requesterUid;
    let role = requesterRole;

    if (body.targetUserId) {
      if (!canAdminDeleteUsers) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      uid = body.targetUserId;
      role = body.targetRole;
    }

    // תיקון באג: אם ה-role עדיין לא מוגדר (עבור המשתמש עצמו או אם אדמין לא שלח רול)
    // מבררים את התפקיד האמיתי מול מסד הנתונים כדי למנוע מחיקה שגויה
    if (!role) {
      const [{ data: seller }, { data: customer }, { data: admin }] = await Promise.all([
        serviceClient.from('sellers').select('id').eq('id', uid).maybeSingle(),
        serviceClient.from('customers').select('id').eq('id', uid).maybeSingle(),
        serviceClient.from('admins').select('id').eq('id', uid).maybeSingle(),
      ]);
      role = seller ? 'seller' : admin ? 'admin' : 'customer';
    }

    // Delete all products uploaded by the seller.
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
      const cleanupResults = await Promise.allSettled([
        serviceClient.from('reports').delete().eq('reporter_id', uid),
        serviceClient.from('reviews').delete().eq('buyer_id', uid),
        serviceClient.from('supermarket_reviews').delete().eq('buyer_id', uid),
        serviceClient.from('chats').delete().contains('participants', [uid]),
      ]);

      cleanupResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.error) {
          console.error(`[delete-account] customer cleanup error ${index}:`, result.value.error);
        }
        if (result.status === 'rejected') {
          console.error(`[delete-account] customer cleanup rejected ${index}:`, result.reason);
        }
      });

      const { error: customerError } = await serviceClient.from('customers').delete().eq('id', uid);
      if (customerError) {
        console.error('[delete-account] customers row delete error:', customerError);
      }
    }

    // Finally, delete the auth user
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(uid);
    if (deleteError) {
      // תיקון שגיאת 500: אם המשתמש כבר לא קיים ב-Auth (שגיאת 404), נתייחס לזה כהצלחה
      if ((deleteError as any).status === 404 || (deleteError as any).code === 'user_not_found') {
        console.info(`[delete-account] User ${uid} was already missing from auth. Proceeding as success.`);
        return NextResponse.json({ success: true, note: 'User already deleted' });
      }
      
      console.error('[delete-account] auth delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete-account] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
