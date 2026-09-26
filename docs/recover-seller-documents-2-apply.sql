-- =============================================================================
-- HOTAM — Recover sellers' certificate + writing samples: STEP 2 (APPLY)
-- =============================================================================
-- Run ONLY after recover-seller-documents-1-preview.sql and reviewing its rows.
-- Fills EMPTY certificate_url / writing_samples only — never overwrites a value
-- a seller has now. Backs up the pre-restore values first. Safe to re-run.
-- Requires the hotfix to be deployed already.
-- =============================================================================

-- Run as one block. Safe to re-run: fills empty fields only, and the backup
-- keeps the FIRST pre-restore value per seller.
BEGIN;

CREATE TABLE IF NOT EXISTS recovery.seller_documents_backup_20260927 (
  seller_id       UUID PRIMARY KEY,
  certificate_url TEXT,
  writing_samples TEXT[],
  backed_up_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO recovery.seller_documents_backup_20260927 (seller_id, certificate_url, writing_samples)
SELECT s.id, s.certificate_url, s.writing_samples
FROM public.sellers s
JOIN recovery.seller_documents r ON r.id = s.id
WHERE (COALESCE(r.current_certificate, '') = '' AND r.recovered_certificate IS NOT NULL)
   OR (r.current_samples = 0 AND r.recovered_samples IS NOT NULL)
ON CONFLICT (seller_id) DO NOTHING;

UPDATE public.sellers s
SET certificate_url = r.recovered_certificate,
    updated_at      = NOW()
FROM recovery.seller_documents r
WHERE r.id = s.id
  AND COALESCE(s.certificate_url, '') = ''
  AND r.recovered_certificate IS NOT NULL;

UPDATE public.sellers s
SET writing_samples = r.recovered_samples,
    updated_at      = NOW()
FROM recovery.seller_documents r
WHERE r.id = s.id
  AND COALESCE(array_length(s.writing_samples, 1), 0) = 0
  AND r.recovered_samples IS NOT NULL;

COMMIT;

-- Check: restored sellers now vs. backup
-- SELECT s.email, b.certificate_url AS before_cert, s.certificate_url AS now_cert,
--        COALESCE(array_length(b.writing_samples,1),0) AS before_samples,
--        COALESCE(array_length(s.writing_samples,1),0) AS now_samples
-- FROM recovery.seller_documents_backup_20260927 b JOIN public.sellers s ON s.id = b.seller_id;


-- ─── UNDO (only if needed) ─────────────────────────────────────────
-- BEGIN;
-- UPDATE public.sellers s
-- SET certificate_url = b.certificate_url, writing_samples = b.writing_samples, updated_at = NOW()
-- FROM recovery.seller_documents_backup_20260927 b
-- WHERE b.seller_id = s.id;
-- COMMIT;


-- ─── Cleanup (after you're satisfied) ───────────────────────────────────────
-- DROP SCHEMA IF EXISTS recovery CASCADE;   -- removes the view and the backup table
