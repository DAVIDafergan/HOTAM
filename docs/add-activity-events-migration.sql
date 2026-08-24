-- =============================================================================
-- HOTAM — Additive migration: activity_events
-- =============================================================================
-- Safe to run against the LIVE production database as-is — this file only
-- creates a new table and its policies (all statements are idempotent via
-- IF NOT EXISTS / DROP POLICY IF EXISTS), unlike docs/supabase-schema.sql
-- which starts with DROP TABLE ... CASCADE for every table and would wipe
-- production data.
--
-- Run this in Supabase → SQL Editor → New Query, once. The full definition
-- has also been folded into docs/supabase-schema.sql for future fresh
-- installs, so the two files stay in sync.
--
-- Purpose: single general-purpose event log backing two admin-dashboard
-- features (see the admin-dashboard plan discussed in-session):
--   1. Per-user activity timeline — every significant action a customer or
--      seller takes, queryable chronologically.
--   2. Seller-onboarding funnel — today, steps 1-3 of /onboarding/seller are
--      pure client-side state with zero persistence, so anyone who abandons
--      before the final step leaves no trace at all. This table is written
--      to on each step transition (see the app-code follow-up commit), which
--      is the only way funnel drop-off becomes measurable.
--
-- Writes go through a server API route using the service-role key, not
-- direct client inserts — so there is deliberately no anon/authenticated
-- INSERT policy below (service role bypasses RLS regardless). This keeps
-- actor_id/actor_role authoritative (derived server-side from the caller's
-- session token, never taken from the client's own claim) and lets the
-- write path apply IP-based rate limiting, consistent with how
-- /api/register-seller already handles privileged writes elsewhere in
-- this codebase.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.activity_events (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Null for a pre-signup/anonymous event (e.g. onboarding steps 1-3 before
  -- any account exists). session_id lets those be linked to the resulting
  -- user later if the signup completes, and still counted in aggregate
  -- funnel stats either way.
  actor_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role   TEXT        CHECK (actor_role IN ('customer', 'seller', 'admin', 'anonymous')),
  session_id   TEXT,
  event_type   TEXT        NOT NULL,
  event_data   JSONB       NOT NULL DEFAULT '{}',
  ip_address   TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_events_actor_created_at
  ON public.activity_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_session_id
  ON public.activity_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_events_type_created_at
  ON public.activity_events (event_type, created_at DESC);
-- Supports cursor-based pagination (created_at < :cursor) without the
-- limit(1000)-then-slice-in-memory pattern the rest of the admin dashboard
-- currently uses — this table is expected to grow much faster than any
-- other, so it gets real pagination from the start.
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at
  ON public.activity_events (created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_events_admin_read" ON public.activity_events;
CREATE POLICY "activity_events_admin_read" ON public.activity_events
  FOR SELECT USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policy for anon/authenticated on purpose — see the
-- note above. service_role (used by /api/log-event) bypasses RLS entirely.
