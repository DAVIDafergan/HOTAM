-- =============================================================================
-- HOTAM — Additive migration: seller types (סופר סת"ם / מוכר יודאיקה)
-- =============================================================================
-- Safe to run against the LIVE production database as-is: it only adds
-- columns, a trigger and re-creates one RLS policy. Every statement is
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS), unlike
-- docs/supabase-schema.sql which starts with DROP TABLE ... CASCADE and would
-- wipe production data.
--
-- ORDER: run this BEFORE merging/deploying branch feature/judaica-sellers
-- (Supabase → SQL Editor → New Query, once). It is safe to run while the
-- current code is live: every seller — existing and new — stays a
-- 'stam_scribe' exactly as today, so nothing changes until the new code
-- ships. The new code needs these columns (it writes seller_type and
-- products.attributes), so deploying it first would break Judaica signups.
-- The same definitions are folded into docs/supabase-schema.sql for fresh
-- installs, so the two files stay in sync.
--
-- What it does:
--   1. sellers.seller_type — 'stam_scribe' (can sell scribal items + Judaica)
--      or 'judaica_seller' (Judaica only). Every EXISTING seller is backfilled
--      to 'stam_scribe' with immediate Judaica access, no extra verification.
--      The column default stays 'stam_scribe' (today's behaviour) so running
--      this before the deploy changes nothing for the live code; the new
--      registration API always sets the type explicitly, and every new
--      seller is unapproved until an admin reviews them either way.
--   2. sellers.stam_upgrade_status / stam_upgrade_requested_at — a Judaica
--      seller's request to be verified as a סופר סת"ם. While 'pending', the
--      seller keeps selling Judaica as usual; an admin approval flips
--      seller_type to 'stam_scribe'.
--   3. products.attributes — per-category fields for the new Judaica
--      categories (material, size, nusach...). Existing columns untouched.
--   4. Server-side enforcement: a trigger rejects any scribal product
--      (מזוזה / תפילין / מגילה / ספר תורה / מוצרי קלף) whose seller is not a
--      'stam_scribe'. Products are written straight through PostgREST (there
--      is no app API route in between), so enforcing it in the database is
--      what makes a direct API call unable to bypass the UI restriction.
--   5. RLS: a seller can no longer change their own seller_type or upgrade
--      status (only an admin / the service-role API can), and sales_count
--      stays frozen as before.
-- =============================================================================

-- ── 1+2. sellers columns ──────────────────────────────────────────────────────
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS seller_type TEXT NOT NULL DEFAULT 'stam_scribe';

-- Backfill is implicit (the ADD COLUMN default filled every existing row with
-- 'stam_scribe'); make it explicit in case the column pre-existed as nullable.
UPDATE public.sellers SET seller_type = 'stam_scribe' WHERE seller_type IS NULL;

ALTER TABLE public.sellers DROP CONSTRAINT IF EXISTS sellers_seller_type_check;
ALTER TABLE public.sellers
  ADD CONSTRAINT sellers_seller_type_check
  CHECK (seller_type IN ('stam_scribe', 'judaica_seller'));

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS stam_upgrade_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.sellers DROP CONSTRAINT IF EXISTS sellers_stam_upgrade_status_check;
ALTER TABLE public.sellers
  ADD CONSTRAINT sellers_stam_upgrade_status_check
  CHECK (stam_upgrade_status IN ('none', 'pending', 'approved', 'rejected'));

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS stam_upgrade_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sellers_stam_upgrade_status
  ON public.sellers (stam_upgrade_status)
  WHERE stam_upgrade_status = 'pending';

-- ── 3. products.attributes ────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 4. Enforcement trigger ────────────────────────────────────────────────────
-- Keep this list in sync with STAM_PRODUCT_TYPES in src/lib/product-catalog.ts.
CREATE OR REPLACE FUNCTION public.enforce_product_seller_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_type TEXT;
BEGIN
  IF NEW.product_type IN ('מזוזה', 'תפילין', 'מגילה', 'ספר תורה', 'מוצרי יודאיקה שונים') THEN
    SELECT seller_type INTO v_seller_type FROM public.sellers WHERE id = NEW.seller_id;
    IF v_seller_type IS DISTINCT FROM 'stam_scribe' THEN
      RAISE EXCEPTION 'STAM_PRODUCT_REQUIRES_STAM_SCRIBE'
        USING ERRCODE = '42501',
              DETAIL = 'Only a verified סופר סת"ם (seller_type = stam_scribe) can list scribal products.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_product_seller_type ON public.products;
CREATE TRIGGER trg_enforce_product_seller_type
  BEFORE INSERT OR UPDATE OF product_type, seller_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_seller_type();

-- ── 5. RLS: freeze seller_type / upgrade fields for the seller themselves ─────
DROP POLICY IF EXISTS "sellers_own_update" ON public.sellers;
CREATE POLICY "sellers_own_update" ON public.sellers
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND email = (SELECT s.email FROM public.sellers s WHERE s.id = sellers.id)
      AND is_approved = (SELECT s.is_approved FROM public.sellers s WHERE s.id = sellers.id)
      AND sales_count = (SELECT s.sales_count FROM public.sellers s WHERE s.id = sellers.id)
      AND welcome_email_sent = (SELECT s.welcome_email_sent FROM public.sellers s WHERE s.id = sellers.id)
      AND created_at = (SELECT s.created_at FROM public.sellers s WHERE s.id = sellers.id)
      AND seller_type = (SELECT s.seller_type FROM public.sellers s WHERE s.id = sellers.id)
      AND stam_upgrade_status = (SELECT s.stam_upgrade_status FROM public.sellers s WHERE s.id = sellers.id)
      AND stam_upgrade_requested_at IS NOT DISTINCT FROM (SELECT s.stam_upgrade_requested_at FROM public.sellers s WHERE s.id = sellers.id)
    )
  );

-- ── Verify (optional, read-only) ──────────────────────────────────────────────
-- SELECT seller_type, stam_upgrade_status, COUNT(*) FROM public.sellers GROUP BY 1, 2;
