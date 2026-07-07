-- =============================================================================
-- HOTAM — Additive migration: contact_messages
-- =============================================================================
-- Safe to run against the LIVE production database as-is — this file only
-- creates a new table and its policies (all statements are idempotent via
-- IF NOT EXISTS), unlike docs/supabase-schema.sql which starts with
-- DROP TABLE ... CASCADE for every table and would wipe production data.
--
-- Run this in Supabase → SQL Editor → New Query, once. The full definitions
-- have also been folded into docs/supabase-schema.sql for future fresh
-- installs, so the two files stay in sync.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  subject     TEXT,
  message     TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created_at
  ON public.contact_messages (status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_public_insert" ON public.contact_messages;
CREATE POLICY "contact_messages_public_insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "contact_messages_admin_all" ON public.contact_messages;
CREATE POLICY "contact_messages_admin_all" ON public.contact_messages
  FOR ALL USING (public.is_admin());
