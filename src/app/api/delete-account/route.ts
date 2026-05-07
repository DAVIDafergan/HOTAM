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

    const uid = user.id;
    const role = user.user_metadata?.role as string | undefined;

    // Delete all products uploaded by the seller
    if (role === 'seller') {
      const { error: productsError } = await serviceClient
        .from('products')
        .delete()
        .eq('seller_id', uid);
      if (productsError) {
        console.error('[delete-account] products delete error:', productsError);
      }

      await serviceClient.from('sellers').delete().eq('id', uid);
    } else {
      await serviceClient.from('customers').delete().eq('id', uid);
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
