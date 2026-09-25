import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Fields a client must never set on a seller row. seller_type is decided below from the
// requested type + the row's approval state; the upgrade fields only change via
// /api/seller/request-stam-upgrade (seller) or the admin dashboard.
const SERVER_ONLY_SELLER_FIELDS = [
  'is_approved', 'welcome_email_sent', 'is_email_verified', 'recovery_source', 'sales_count',
  'seller_type', 'requested_seller_type', 'stam_upgrade_status', 'stam_upgrade_requested_at',
] as const;

function stripServerOnlyFields<T extends Record<string, any>>(fields: T): Partial<T> {
  const safe: Record<string, any> = { ...fields };
  for (const key of SERVER_ONLY_SELLER_FIELDS) delete safe[key];
  return safe as Partial<T>;
}

function normalizeRequestedSellerType(value: unknown): 'stam_scribe' | 'judaica_seller' {
  return value === 'judaica_seller' ? 'judaica_seller' : 'stam_scribe';
}

// Pre-migration databases don't have seller_type yet — retry without it instead of failing
// the whole registration (see docs/add-seller-types-migration.sql).
function isMissingSellerTypeColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message?.includes('seller_type'));
}

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

      // Strip server-only fields so the client cannot forge them. A brand-new seller is
      // always unapproved, so honouring the requested type is safe: an admin still has to
      // approve the account before anything can be sold.
      const requestedSellerType = normalizeRequestedSellerType(sellerFields.requested_seller_type);
      const { id: _id, ...safeFields } = stripServerOnlyFields(sellerFields);

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
      const newSellerRow = {
        ...safeFields,
        id: newUser.id,
        email: newUser.email,
        is_approved: false,
        is_email_verified: true,
        updated_at: new Date().toISOString(),
      };
      let { error: dbError } = await serviceClient
        .from('sellers')
        .upsert({ ...newSellerRow, seller_type: requestedSellerType }, { onConflict: 'id' });
      if (isMissingSellerTypeColumn(dbError)) {
        console.warn('[register-seller] seller_type column missing (migration not run), retrying without it');
        ({ error: dbError } = await serviceClient.from('sellers').upsert(newSellerRow, { onConflict: 'id' }));
      }

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
    const safeSellerData = stripServerOnlyFields(sellerData);

    // The seller type may only be chosen while the account is still an unapproved applicant
    // (customer→seller upgrade, or recovering an unfinished signup). An approved seller can
    // never change type here — a Judaica seller becomes a scribe only via admin approval of
    // an upgrade request.
    const { data: existingSeller } = await serviceClient
      .from('sellers')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    const canChooseSellerType = !existingSeller || existingSeller.is_approved !== true;

    // Automatic recovery calls (app-provider on sign-in/page load, dashboard fallback) rebuild
    // the payload from sign-up-time auth metadata. Against an EXISTING row they must only fill
    // in empty fields — never overwrite — or every later change (profile edits, a stam-upgrade
    // request's certificate/samples) would be reverted on the next page load. Only the
    // deliberate customer→seller upgrade from the onboarding form writes its values as given.
    const isDeliberateSubmission = recoverySource === 'existing-customer-upgrade';
    const isEmptyValue = (value: unknown) =>
      value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    const profileFields: Record<string, any> = existingSeller && !isDeliberateSubmission
      ? Object.fromEntries(
          Object.entries(safeSellerData).filter(([key]) => key !== 'id' && isEmptyValue((existingSeller as any)[key])),
        )
      : safeSellerData;

    const basePayload: Record<string, any> = {
      ...profileFields,
      id: user.id,
      email: user.email ?? safeSellerData.email,
      is_email_verified: isEmailVerified,
      ...(canChooseSellerType && (!existingSeller || isDeliberateSubmission)
        ? { seller_type: normalizeRequestedSellerType(sellerData.requested_seller_type) }
        : {}),
    };

    let { error: dbError } = await serviceClient
      .from('sellers')
      .upsert(basePayload, { onConflict: 'id' });

    if (isMissingSellerTypeColumn(dbError)) {
      console.warn('[register-seller] seller_type column missing (migration not run), retrying without it');
      delete basePayload.seller_type;
      ({ error: dbError } = await serviceClient.from('sellers').upsert(basePayload, { onConflict: 'id' }));
    }

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
