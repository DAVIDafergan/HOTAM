-- =============================================================================
-- HOTAM — Recover sellers' certificate + writing samples from image_assets
-- =============================================================================
-- Context: until hotfix/seller-data-overwrite, every seller page load re-sent
-- sign-up-time auth metadata and overwrote the seller row. Sellers whose
-- metadata never held these fields (customer→seller upgrades, Google sign-ups)
-- had certificate_url / writing_samples wiped; others lost files added later.
--
-- The files themselves were never deleted: every upload made while logged in
-- is recorded in public.image_assets with owner_id + kind. This script puts
-- those links back — ONLY into fields that are currently EMPTY. It never
-- overwrites a value a seller has now.
--
-- NOT recoverable from here: uploads made during first-time sign-up (no
-- owner_id yet — but those links are also in the seller's auth metadata, so
-- those sellers were not wiped), and any text field (phone, address, bank...).
--
-- HOW TO RUN (Supabase → SQL Editor):
--   1. THIS FILE — setup + preview. Changes no seller data (only creates a
--      private "recovery" schema with a view). Run it whole; review the rows.
--   2. recover-seller-documents-2-apply.sql — only after reviewing step 1.
-- Deploy the hotfix FIRST — otherwise the next page load wipes it again.
-- =============================================================================


-- ─── Private schema ─────────────────────────────────────────────────────────
-- NOT public: Supabase exposes the public schema through its REST API, and a
-- view there would run with the owner's rights (bypassing RLS) — sellers'
-- emails would be readable from outside. The "recovery" schema isn't exposed.
CREATE SCHEMA IF NOT EXISTS recovery;
REVOKE ALL ON SCHEMA recovery FROM PUBLIC, anon, authenticated;

-- ─── Candidate links per seller (used by A and B) ───────────────────────────
-- Link to restore: the Cloudinary URL when the original was HEIC/HEIF (browsers
-- can't display those bytes); otherwise the original source URL, which is what
-- the app itself stores in sellers.*.
CREATE OR REPLACE VIEW recovery.seller_documents AS
WITH assets AS (
  SELECT
    a.owner_id,
    a.kind,
    a.created_at,
    CASE
      WHEN a.source_url ~* '\.(heic|heif)(\?|$)' AND a.cloudinary_secure_url IS NOT NULL
        THEN a.cloudinary_secure_url
      ELSE a.source_url
    END AS url
  FROM public.image_assets a
  WHERE a.owner_id IS NOT NULL
    AND a.kind IN ('certificate', 'writing_sample')
    AND a.migration_status <> 'deleted'          -- files the seller removed on purpose
)
SELECT
  s.id,
  s.email,
  s.first_name || ' ' || s.last_name                                   AS name,
  s.certificate_url                                                    AS current_certificate,
  COALESCE(array_length(s.writing_samples, 1), 0)                      AS current_samples,
  (SELECT url FROM assets
     WHERE owner_id = s.id AND kind = 'certificate'
     ORDER BY created_at DESC LIMIT 1)                                 AS recovered_certificate,
  (SELECT array_agg(url ORDER BY created_at) FROM assets
     WHERE owner_id = s.id AND kind = 'writing_sample')                AS recovered_samples
FROM public.sellers s;


-- ─── PART A — PREVIEW (read-only) ───────────────────────────────────────────
-- Only sellers where something would actually be restored.
SELECT
  email,
  name,
  CASE WHEN COALESCE(current_certificate, '') = '' AND recovered_certificate IS NOT NULL
       THEN recovered_certificate END                                  AS will_restore_certificate,
  CASE WHEN current_samples = 0 AND recovered_samples IS NOT NULL
       THEN array_length(recovered_samples, 1) END                     AS will_restore_sample_count
FROM recovery.seller_documents
WHERE (COALESCE(current_certificate, '') = '' AND recovered_certificate IS NOT NULL)
   OR (current_samples = 0 AND recovered_samples IS NOT NULL)
ORDER BY email;
