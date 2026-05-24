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

    const sellerData = await req.json();
    const recoverySource = typeof sellerData?.recovery_source === 'string'
      ? sellerData.recovery_source
      : 'unknown';

    if (sellerData.id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isEmailVerified = user.email_confirmed_at != null;
    console.info('[register-seller] start', {
      source: recoverySource,
      userId: user.id,
      emailVerified: isEmailVerified,
    });

    // Strip fields that must only be set server-side — never allow client to overwrite them.
    const {
      is_approved: _isApproved,
      welcome_email_sent: _welcomeEmailSent,
      is_email_verified: _isEmailVerified,
      recovery_source: _recoverySource,
      ...safeSellerData
    } = sellerData;

    const basePayload = {
      ...safeSellerData,
      id: user.id,
      email: user.email ?? safeSellerData.email,
      is_email_verified: isEmailVerified,
    };

    let { error: dbError } = await serviceClient
      .from('sellers')
      .upsert(basePayload, { onConflict: 'id' });

    if (dbError?.message?.includes('is_email_verified')) {
      console.warn('[register-seller] is_email_verified column missing, retrying without it');
      const retry = await serviceClient
        .from('sellers')
        .upsert(
          {
            ...safeSellerData,
            id: user.id,
            email: user.email ?? safeSellerData.email,
          },
          { onConflict: 'id' },
        );
      dbError = retry.error;
    }

    if (dbError) {
      console.error('Seller registration DB error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    console.info('[register-seller] seller upserted', { source: recoverySource, userId: user.id });

    // Remove any erroneous customers row for this user (e.g. created by the DB
    // trigger when role metadata was missing at signup time).
    const { error: custDeleteError } = await serviceClient
      .from('customers')
      .delete()
      .eq('id', user.id);
    if (custDeleteError) {
      console.error('[register-seller] Failed to clean up customers row:', custDeleteError);
    } else {
      console.info('[register-seller] customers cleanup completed', { source: recoverySource, userId: user.id });
    }

    // Ensure auth metadata reflects seller role so redirects work correctly
    const { error: roleUpdateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      { user_metadata: { ...user.user_metadata, role: 'seller' } }
    );
    if (roleUpdateError) {
      console.error('[register-seller] Failed to update auth role:', roleUpdateError);
    } else {
      console.info('[register-seller] auth role updated', { source: recoverySource, userId: user.id });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Seller registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
