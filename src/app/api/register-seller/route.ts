import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'register-seller', maxRequests: 10, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // Read body once — used by both code paths below.
    const body = await req.json();

    // ── New seller signup (no session yet) ─────────────────────────────────────
    // When there is no Authorization header, the client is a brand-new seller who
    // does not have an account yet.  We create the user via the Admin API with
    // email_confirm=true so that the seller can sign in immediately without having
    // to click a confirmation link.  This does NOT affect the project-wide Email
    // Confirmation setting that governs customer registrations.
    if (!token) {
      const { email, password, ...sellerFields } = body;

      if (!email || !password) {
        return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      // Strip server-only fields so the client cannot forge them.
      const {
        is_approved: _ia,
        welcome_email_sent: _wes,
        is_email_verified: _iev,
        recovery_source: _rs,
        id: _id,
        ...safeFields
      } = sellerFields;

      const { data: createData, error: createError } =
        await serviceClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: { role: 'seller', ...safeFields },
        });

      if (createError) {
        const msg = createError.message?.toLowerCase() ?? '';
        const isAlreadyExists =
          msg.includes('already registered') ||
          msg.includes('user already exists') ||
          (createError as any).status === 422;
        if (isAlreadyExists) {
          return NextResponse.json({ error: 'email-already-in-use' }, { status: 409 });
        }
        console.error('[register-seller] createUser failed', createError);
        return NextResponse.json(
          { error: 'Registration failed', message: createError.message },
          { status: 500 },
        );
      }

      const newUser = createData.user;
      console.info('[register-seller] auth user created', { userId: newUser.id });

      // Upsert the full seller profile.  The DB trigger already created a minimal
      // row; this call enriches it with all onboarding form data.
      const { error: dbError } = await serviceClient
        .from('sellers')
        .upsert(
          {
            ...safeFields,
            id: newUser.id,
            email: newUser.email,
            is_approved: false,
            is_email_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );

      if (dbError) {
        // Rollback: delete the auth user to leave no orphan behind.
        // The sellers row is removed automatically via ON DELETE CASCADE.
        console.error('[register-seller] DB upsert failed — rolling back auth user', dbError);
        await serviceClient.auth.admin.deleteUser(newUser.id).catch((delErr) => {
          console.error('[register-seller] rollback deleteUser failed', delErr);
        });
        return NextResponse.json(
          { error: 'Database error', message: dbError.message },
          { status: 500 },
        );
      }

      // Remove any customers row the DB trigger may have created (shouldn't
      // happen when role='seller' is in metadata, but guard just in case).
      await serviceClient.from('customers').delete().eq('id', newUser.id)
        .then(({ error }) => {
          if (error) console.warn('[register-seller] customers cleanup error (non-critical)', error);
        });

      // Ensure role metadata is explicitly seller (trigger should set it, but
      // be explicit to avoid any reconcile overhead on first sign-in).
      await serviceClient.auth.admin
        .updateUserById(newUser.id, { user_metadata: { role: 'seller' } })
        .catch((err) => console.error('[register-seller] role update failed (non-critical)', err));

      console.info('[register-seller] new seller registered', { userId: newUser.id });
      return NextResponse.json({ success: true });
    }

    // ── Authenticated path: existing user update / reconcile ──────────────────
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sellerData = body;
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
      console.error('Seller registration DB error:', JSON.stringify(dbError));
      return NextResponse.json({
        error: 'Database error',
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
      }, { status: 500 });
    }
    console.info('[register-seller] seller upserted', { source: recoverySource, userId: user.id });

    // ⚠️ CRITICAL FIX: Remove any erroneous customers row for this user
    // This can happen if:
    // 1. User was initially registered as customer
    // 2. User later converted to seller
    // 3. The trigger created a customer row on initial auth signup
    // If we don't clean this up, the user will be classified as 'customer' on next
    // login because the session-role endpoint checks customers after sellers.
    const { error: custDeleteError } = await serviceClient
      .from('customers')
      .delete()
      .eq('id', user.id);

    if (custDeleteError) {
      console.error('[register-seller] CRITICAL: Failed to clean up erroneous customer row', {
        userId: user.id,
        email: user.email,
        error: custDeleteError,
      });

      // Log for monitoring/alerting - this needs manual review
      // The user's role resolution will be broken on next login
      return NextResponse.json(
        {
          error: 'Account setup incomplete',
          message: 'Could not fully update your seller account. Please contact support.',
          code: 'SELLER_CLEANUP_FAILED'
        },
        { status: 500 },
      );
    } else {
      console.info('[register-seller] customers cleanup completed', {
        source: recoverySource,
        userId: user.id,
        email: user.email
      });
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

    const { error: confirmError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    if (confirmError) {
      console.error('[register-seller] Failed to confirm seller email:', confirmError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Seller registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
