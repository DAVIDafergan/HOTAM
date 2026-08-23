-- =============================================================================
-- HOTAM — Find accounts affected by the "silent customer" Google-signup bug
-- =============================================================================
-- Root cause: Supabase's signInWithOAuth() cannot inject app metadata into a
-- new user the way auth.signUp() can, so any brand-new Google sign-in lands
-- in public.handle_new_user() with raw_user_meta_data->>'role' empty, and the
-- trigger's default (customer) applies — see docs/supabase-schema.sql line ~879.
-- This means EVERY customer row below with metadata_role IS NULL is a user who
-- never got an explicit role choice, not just ones who clicked through
-- /onboarding/seller (that page has no Google button, so it was never the
-- literal trigger — the ambiguous entry point is the "המשך עם חשבון Google"
-- button on /login, which has no role concept at all).
--
-- Run in the Supabase SQL Editor (Project → SQL Editor → New Query).
-- =============================================================================

-- Query A — all customers with no explicit role ever set (the full affected
-- population; a legitimate customer signup always has a role string, either
-- 'customer' from the email-signup form's metadata or a queued localStorage
-- intent flag consumed right after — so NULL here is specifically diagnostic
-- of the bug, not a normal state).
SELECT
  c.id,
  c.email,
  c.first_name,
  c.last_name,
  c.created_at                                   AS customer_row_created_at,
  u.last_sign_in_at,
  u.raw_user_meta_data ->> 'role'                 AS metadata_role,
  (SELECT string_agg(DISTINCT i.provider, ', ')
     FROM auth.identities i WHERE i.user_id = u.id) AS identity_providers
FROM public.customers c
JOIN auth.users u ON u.id = c.id
WHERE NOT EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = c.id)
  AND (u.raw_user_meta_data ->> 'role' IS NULL OR u.raw_user_meta_data ->> 'role' = '')
ORDER BY c.created_at DESC;

-- Query B — same population, restricted to a specific signup window.
-- Edit the two dates below before running.
-- SELECT
--   c.id, c.email, c.first_name, c.last_name, c.created_at AS customer_row_created_at,
--   u.last_sign_in_at, u.raw_user_meta_data ->> 'role' AS metadata_role,
--   (SELECT string_agg(DISTINCT i.provider, ', ') FROM auth.identities i WHERE i.user_id = u.id) AS identity_providers
-- FROM public.customers c
-- JOIN auth.users u ON u.id = c.id
-- WHERE NOT EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = c.id)
--   AND (u.raw_user_meta_data ->> 'role' IS NULL OR u.raw_user_meta_data ->> 'role' = '')
--   AND c.created_at BETWEEN '2026-01-01' AND '2026-08-24'
-- ORDER BY c.created_at DESC;

-- =============================================================================
-- Remediation — do NOT hand-edit raw_user_meta_data alone.
-- =============================================================================
-- Setting role='seller' via SQL only patches auth.users; it does not create
-- the public.sellers row or delete the public.customers row, so the account
-- would stay broken (session-role checks the sellers/customers tables first,
-- metadata is only a fast-path). The app already has a tested path that does
-- all three correctly: log in as the affected user (or have them log in) and
-- visit /onboarding/seller — the form detects the existing customer row
-- (isExistingCustomer) and upgrades it via POST /api/register-seller, the
-- same "existing-customer-upgrade" path used whenever any customer decides to
-- become a seller. That's the safe fix for every row this query returns.
