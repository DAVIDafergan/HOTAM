-- =============================================================================
-- HOTAM — Supabase PostgreSQL Schema
-- =============================================================================
-- Run this SQL in the Supabase SQL Editor (Project → SQL Editor → New Query).
-- Column names are camelCase (quoted) to match the Firestore field names used
-- in the frontend code, avoiding any client-side transformation.
--
-- IDEMPOTENT: This script drops and recreates all tables on every run so that
-- it always succeeds, even if the database already has stale table definitions
-- from a previous partial run.  All data will be lost on re-run — only use
-- in development or for a clean initial setup.
-- =============================================================================

-- Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DROP EXISTING TABLES (reverse dependency order, CASCADE removes policies/
-- indexes/foreign-key constraints automatically)
-- =============================================================================

DROP TABLE IF EXISTS public.messages  CASCADE;
DROP TABLE IF EXISTS public.reviews   CASCADE;
DROP TABLE IF EXISTS public.reports   CASCADE;
DROP TABLE IF EXISTS public.orders    CASCADE;
DROP TABLE IF EXISTS public.products  CASCADE;
DROP TABLE IF EXISTS public.chats     CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.sellers   CASCADE;
DROP TABLE IF EXISTS public.admins    CASCADE;

-- Drop helper functions so they can be cleanly recreated below.
-- The table DROPs above already removed all policies that referenced these
-- functions, so the drops succeed without needing CASCADE.
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.safe_increment(TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.array_union_elem(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.array_remove_elem(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_unread_state(TEXT, TEXT, BOOLEAN);

-- =============================================================================
-- TABLES
-- =============================================================================

-- ── sellers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sellers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "firstName"           TEXT NOT NULL DEFAULT '',
  "lastName"            TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL DEFAULT '',
  phone                 TEXT,
  address               TEXT,
  age                   INTEGER,
  "maritalStatus"       TEXT,
  "businessType"        TEXT,
  "businessId"          TEXT,
  "businessName"        TEXT,
  "bankName"            TEXT,
  "bankBranch"          TEXT,
  "bankAccountNumber"   TEXT,
  "hasScribeCertificate" TEXT,
  "certificateUrl"      TEXT,
  "torahStudyFrequency" TEXT,
  "mikvehFrequency"     TEXT,
  notes                 TEXT,
  "experienceYears"     INTEGER,
  "scriptLevel"         TEXT,
  "scriptTypes"         TEXT[]        NOT NULL DEFAULT '{}',
  "writingSamples"      TEXT[]        NOT NULL DEFAULT '{}',
  "profileImage"        TEXT,
  "isApproved"          BOOLEAN       NOT NULL DEFAULT FALSE,
  "salesCount"          INTEGER       NOT NULL DEFAULT 0,
  "notificationEmail"   BOOLEAN       NOT NULL DEFAULT TRUE,
  "notificationSMS"     BOOLEAN       NOT NULL DEFAULT TRUE,
  "notificationVoice"   BOOLEAN       NOT NULL DEFAULT FALSE,
  "favoriteProductIds"  TEXT[]        NOT NULL DEFAULT '{}',
  "createdAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ
);

-- ── customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  "firstName"          TEXT          NOT NULL DEFAULT '',
  "lastName"           TEXT          NOT NULL DEFAULT '',
  email                TEXT          NOT NULL DEFAULT '',
  phone                TEXT,
  address              TEXT,
  "favoriteProductIds" TEXT[]        NOT NULL DEFAULT '{}',
  "notifMsgEmail"      BOOLEAN       NOT NULL DEFAULT TRUE,
  "notifStatusEmail"   BOOLEAN       NOT NULL DEFAULT TRUE,
  "createdAt"          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ
);

-- ── admins ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admins (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "sellerId"          UUID        NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  "productType"       TEXT        NOT NULL DEFAULT '',
  "subType"           TEXT,
  description         TEXT,
  quantity            INTEGER     NOT NULL DEFAULT 0,
  "scriptType"        TEXT,
  "scriptLevel"       TEXT,
  price               NUMERIC(10,2) NOT NULL DEFAULT 0,
  images              TEXT[]      NOT NULL DEFAULT '{}',
  "parchmentSize"     TEXT,
  "proofreadingLevel" TEXT,
  "deliveryTime"      TEXT,
  "deliveryType"      TEXT,
  "deliveryFee"       NUMERIC(10,2),
  "deliveryArea"      TEXT[]      NOT NULL DEFAULT '{}',
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ
);

-- ── orders ────────────────────────────────────────────────────────────────────
-- buyerId / sellerId / productId are stored as plain strings by the frontend
-- (Supabase Auth UIDs and Firestore-style document IDs).
CREATE TABLE IF NOT EXISTS public.orders (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "buyerId"           TEXT        NOT NULL,
  "sellerId"          TEXT        NOT NULL,
  "productId"         TEXT        NOT NULL,
  "productName"       TEXT        NOT NULL DEFAULT '',
  "productImage"      TEXT,
  amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'pending_payment',
  "deliveryMethod"    TEXT,
  "verificationCode"  TEXT,
  "isRated"           BOOLEAN     NOT NULL DEFAULT FALSE,
  "sellerNet"         NUMERIC(10,2),
  "platformFee"       NUMERIC(10,2),
  "completedAt"       TIMESTAMPTZ,
  "verifiedBySeller"  BOOLEAN     NOT NULL DEFAULT FALSE,
  "isSeenBySeller"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "buyerName"         TEXT,
  "buyerPhone"        TEXT,
  "buyerEmail"        TEXT,
  "buyerAddress"      TEXT,
  "paidAt"            TIMESTAMPTZ,
  "invoiceGenerated"  BOOLEAN     NOT NULL DEFAULT FALSE,
  "paymentProvider"   TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ
);

-- ── chats ─────────────────────────────────────────────────────────────────────
-- `unread_state` is a JSONB object: { "<userId>": true/false, ... }
-- The frontend spreads it into the row so `chat["unread_<uid>"]` works.
-- `lastViolationAt` / `lastViolationText` are written by the security filter
-- in chat/[id]/page.tsx when a contact-sharing attempt is detected.
CREATE TABLE IF NOT EXISTS public.chats (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  participants        TEXT[]      NOT NULL DEFAULT '{}',
  "lastMessageAt"     TIMESTAMPTZ,
  "lastMessageText"   TEXT,
  "originProductId"   TEXT,
  "isSuspicious"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "lastViolationAt"   TIMESTAMPTZ,
  "lastViolationText" TEXT,
  unread_state        JSONB       NOT NULL DEFAULT '{}',
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ
);

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "chatId"          TEXT        NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  "senderId"        TEXT        NOT NULL,
  text              TEXT        NOT NULL DEFAULT '',
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isPaymentRequest" BOOLEAN    NOT NULL DEFAULT FALSE,
  amount            NUMERIC(10,2),
  "productName"     TEXT,
  "productImage"    TEXT,
  "productId"       TEXT
);

-- ── reviews ───────────────────────────────────────────────────────────────────
-- sellerId / productId / buyerId are stored as plain strings by the frontend.
CREATE TABLE IF NOT EXISTS public.reviews (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orderId"      TEXT        NOT NULL,
  "sellerId"     TEXT        NOT NULL,
  "productId"    TEXT        NOT NULL,
  "buyerId"      TEXT        NOT NULL,
  "buyerName"    TEXT,
  rating         INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "productRating" INTEGER    NOT NULL CHECK ("productRating" BETWEEN 1 AND 5),
  comment        TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── reports ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  "sellerId"     TEXT        NOT NULL,
  "sellerName"   TEXT,
  "reporterId"   TEXT        NOT NULL,
  "reporterName" TEXT,
  reason         TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_seller_id    ON public.products ("sellerId");
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id        ON public.orders   ("buyerId");
CREATE INDEX IF NOT EXISTS idx_orders_seller_id       ON public.orders   ("sellerId");
CREATE INDEX IF NOT EXISTS idx_orders_product_id      ON public.orders   ("productId");
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders   (status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id       ON public.messages ("chatId");
CREATE INDEX IF NOT EXISTS idx_messages_timestamp     ON public.messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id      ON public.reviews  ("sellerId");
CREATE INDEX IF NOT EXISTS idx_reviews_product_id     ON public.reviews  ("productId");
CREATE INDEX IF NOT EXISTS idx_chats_participants     ON public.chats USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_chats_unread_state     ON public.chats USING GIN (unread_state);
CREATE INDEX IF NOT EXISTS idx_sellers_is_approved    ON public.sellers ("isApproved");

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.sellers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports    ENABLE ROW LEVEL SECURITY;

-- ── Admin helper (SECURITY DEFINER avoids infinite recursion when policies
--    on other tables query the admins table, which itself has policies) ────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid());
$$;

-- ── sellers policies ──────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"  ON public.sellers FOR SELECT USING (true);
CREATE POLICY "sellers_own_insert" ON public.sellers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "sellers_own_update" ON public.sellers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "sellers_admin_all"  ON public.sellers FOR ALL USING (public.is_admin());

-- ── customers policies ────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"   ON public.customers FOR SELECT USING (true);
CREATE POLICY "customers_own_insert" ON public.customers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "customers_own_update" ON public.customers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "customers_admin_all"  ON public.customers FOR ALL USING (public.is_admin());

-- ── admins policies ───────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"  ON public.admins FOR SELECT USING (true);
CREATE POLICY "admins_own_write"   ON public.admins FOR ALL USING (public.is_admin());

-- ── products policies ─────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"       ON public.products FOR SELECT USING (true);
CREATE POLICY "products_seller_insert"  ON public.products FOR INSERT
  WITH CHECK (auth.uid() = "sellerId");
CREATE POLICY "products_seller_update"  ON public.products FOR UPDATE
  USING (auth.uid() = "sellerId");
CREATE POLICY "products_seller_delete"  ON public.products FOR DELETE
  USING (auth.uid() = "sellerId");
CREATE POLICY "products_admin_all"      ON public.products FOR ALL USING (public.is_admin());

-- ── orders policies ───────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"     ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders_buyer_insert"   ON public.orders FOR INSERT
  WITH CHECK (auth.uid()::TEXT = "buyerId");
CREATE POLICY "orders_parties_update" ON public.orders FOR UPDATE
  USING (auth.uid()::TEXT = "buyerId" OR auth.uid()::TEXT = "sellerId");
CREATE POLICY "orders_admin_all"      ON public.orders FOR ALL USING (public.is_admin());

-- ── chats policies ────────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"        ON public.chats FOR SELECT USING (true);
CREATE POLICY "chats_participant_insert" ON public.chats FOR INSERT
  WITH CHECK (auth.uid()::TEXT = ANY(participants));
CREATE POLICY "chats_participant_update" ON public.chats FOR UPDATE
  USING (auth.uid()::TEXT = ANY(participants));
CREATE POLICY "chats_admin_all"          ON public.chats FOR ALL USING (public.is_admin());

-- ── messages policies ─────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"           ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_participant_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid()::TEXT = "senderId");
CREATE POLICY "messages_admin_all"          ON public.messages FOR ALL USING (public.is_admin());

-- ── reviews policies ──────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"  ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_buyer_insert" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid()::TEXT = "buyerId");
CREATE POLICY "reviews_admin_all"    ON public.reviews FOR ALL USING (public.is_admin());

-- ── reports policies ──────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"       ON public.reports FOR SELECT USING (true);
CREATE POLICY "reports_reporter_insert" ON public.reports FOR INSERT
  WITH CHECK (auth.uid()::TEXT = "reporterId");
CREATE POLICY "reports_admin_all"       ON public.reports FOR ALL USING (public.is_admin());

-- =============================================================================
-- RPC HELPER FUNCTIONS
-- These are called by non-blocking-updates.tsx for special field operations.
-- =============================================================================

-- ── safe_increment: atomically add delta to an integer column ─────────────────
CREATE OR REPLACE FUNCTION public.safe_increment(
  row_id     TEXT,
  table_name TEXT,
  col_name   TEXT,
  delta      INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET %I = COALESCE(%I, 0) + $1 WHERE id::text = $2',
    table_name, col_name, col_name
  ) USING delta, row_id;
END;
$$;

-- ── array_union_elem: add element to TEXT[] if not already present ────────────
CREATE OR REPLACE FUNCTION public.array_union_elem(
  row_id     TEXT,
  table_name TEXT,
  col_name   TEXT,
  element    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I
     SET %I = array_append(%I, $1)
     WHERE id::text = $2 AND NOT ($1 = ANY(COALESCE(%I, ARRAY[]::TEXT[])))',
    table_name, col_name, col_name, col_name
  ) USING element, row_id;
END;
$$;

-- ── array_remove_elem: remove element from TEXT[] ────────────────────────────
CREATE OR REPLACE FUNCTION public.array_remove_elem(
  row_id     TEXT,
  table_name TEXT,
  col_name   TEXT,
  element    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET %I = array_remove(%I, $1) WHERE id::text = $2',
    table_name, col_name, col_name
  ) USING element, row_id;
END;
$$;

-- ── update_unread_state: merge {uid: is_unread} into the unread_state JSONB ───
CREATE OR REPLACE FUNCTION public.update_unread_state(
  chat_id   TEXT,
  uid       TEXT,
  is_unread BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chats
  SET unread_state = unread_state || jsonb_build_object(uid, is_unread)
  WHERE id = chat_id;
END;
$$;

-- Grant execute on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_increment        TO authenticated;
GRANT EXECUTE ON FUNCTION public.array_union_elem      TO authenticated;
GRANT EXECUTE ON FUNCTION public.array_remove_elem     TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_unread_state   TO authenticated;

-- =============================================================================
-- REALTIME
-- Enable Postgres Realtime for live updates in the app.
-- =============================================================================

-- In Supabase Dashboard → Database → Replication, enable the following tables:
-- • sellers   • customers  • products  • orders
-- • chats     • messages   • reviews   • reports
--
-- Or run the statements below. Each uses IF EXISTS to avoid errors on re-runs.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.sellers,
      public.customers,
      public.products,
      public.orders,
      public.chats,
      public.messages,
      public.reviews,
      public.reports;
  EXCEPTION WHEN others THEN
    -- Tables may already be in the publication; safe to ignore.
    NULL;
  END;
END;
$$;

-- =============================================================================
-- STORAGE (optional — for profile images if migrating from base64 to files)
-- =============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
-- CREATE POLICY "images_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'images');
-- CREATE POLICY "images_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');
