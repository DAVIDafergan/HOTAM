-- =============================================================================
-- HOTAM — Supabase PostgreSQL Schema
-- =============================================================================
-- Run this SQL in the Supabase SQL Editor (Project → SQL Editor → New Query).
-- Column names are snake_case to follow PostgreSQL conventions.
--
-- IDEMPOTENT: This script drops and recreates all tables on every run so that
-- it always succeeds, even if the database already has stale table definitions
-- from a previous partial run.  All data will be lost on re-run — only use
-- in development or for a clean initial setup.
--
-- TROUBLESHOOTING — "400 Bad Request" on REST queries (e.g. orders table):
--   If the frontend logs a 400 error like
--     GET /rest/v1/orders?select=*&buyer_id=eq.<uid>  400 Bad Request
--   it almost always means this SQL file has not been applied to the Supabase
--   project yet, OR was applied before a recent schema change.
--   Fix: paste the entire file into Supabase → SQL Editor and run it.
--   NOTE: running this script drops all tables and deletes all data — backup
--   production data first.
-- =============================================================================

-- Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DROP EXISTING TABLES (reverse dependency order, CASCADE removes policies/
-- indexes/foreign-key constraints automatically)
-- =============================================================================

DROP TABLE IF EXISTS public.messages              CASCADE;
DROP TABLE IF EXISTS public.profiles              CASCADE;
DROP TABLE IF EXISTS public.supermarket_reviews   CASCADE;
DROP TABLE IF EXISTS public.reviews               CASCADE;
DROP TABLE IF EXISTS public.reports               CASCADE;
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
  first_name           TEXT NOT NULL DEFAULT '',
  last_name            TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL DEFAULT '',
  phone                 TEXT,
  address               TEXT,
  age                   INTEGER,
  marital_status       TEXT,
  business_type        TEXT,
  business_id          TEXT,
  business_name        TEXT,
  bank_name            TEXT,
  bank_branch          TEXT,
  bank_account_number   TEXT,
  has_scribe_certificate TEXT,
  certificate_url      TEXT,
  torah_study_frequency TEXT,
  mikveh_frequency     TEXT,
  notes                 TEXT,
  experience_years     INTEGER,
  script_level         TEXT,
  script_types         TEXT[]        NOT NULL DEFAULT '{}',
  writing_samples      TEXT[]        NOT NULL DEFAULT '{}',
  profile_image        TEXT,
  is_approved          BOOLEAN       NOT NULL DEFAULT FALSE,
  sales_count          INTEGER       NOT NULL DEFAULT 0,
  notification_email   BOOLEAN       NOT NULL DEFAULT TRUE,
  notification_sms     BOOLEAN       NOT NULL DEFAULT TRUE,
  notification_voice   BOOLEAN       NOT NULL DEFAULT FALSE,
  favorite_product_ids  TEXT[]        NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ
);

-- ── customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name          TEXT          NOT NULL DEFAULT '',
  last_name           TEXT          NOT NULL DEFAULT '',
  email                TEXT          NOT NULL DEFAULT '',
  phone                TEXT,
  address              TEXT,
  favorite_product_ids TEXT[]        NOT NULL DEFAULT '{}',
  notif_msg_email      BOOLEAN       NOT NULL DEFAULT TRUE,
  notif_status_email   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);

-- ── admins ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admins (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Canonical display name for any authenticated user.
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT        NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- ── products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id          UUID        NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  product_type       TEXT        NOT NULL DEFAULT '',
  sub_type           TEXT,
  description         TEXT,
  quantity            INTEGER     NOT NULL DEFAULT 0,
  script_type        TEXT,
  script_level       TEXT,
  price               NUMERIC(10,2) NOT NULL DEFAULT 0,
  images              TEXT[]      NOT NULL DEFAULT '{}',
  parchment_size     TEXT,
  proofreading_level TEXT,
  delivery_time      TEXT,
  delivery_type      TEXT,
  delivery_fee       NUMERIC(10,2),
  delivery_area      TEXT[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ
);

-- ── orders ────────────────────────────────────────────────────────────────────
-- buyer_id / seller_id / product_id are stored as plain strings by the frontend
-- (Supabase Auth UIDs and Firestore-style document IDs).
CREATE TABLE IF NOT EXISTS public.orders (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  buyer_id           TEXT        NOT NULL,
  seller_id          TEXT        NOT NULL,
  product_id         TEXT        NOT NULL,
  product_name       TEXT        NOT NULL DEFAULT '',
  product_image      TEXT,
  amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'pending_payment',
  delivery_method    TEXT,
  verification_code  TEXT,
  is_rated           BOOLEAN     NOT NULL DEFAULT FALSE,
  seller_net         NUMERIC(10,2),
  platform_fee       NUMERIC(10,2),
  completed_at       TIMESTAMPTZ,
  verified_by_seller  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_seen_by_seller    BOOLEAN     NOT NULL DEFAULT FALSE,
  buyer_name         TEXT,
  buyer_phone        TEXT,
  buyer_email        TEXT,
  buyer_address      TEXT,
  paid_at            TIMESTAMPTZ,
  invoice_generated  BOOLEAN     NOT NULL DEFAULT FALSE,
  payment_provider   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ
);

-- ── chats ─────────────────────────────────────────────────────────────────────
-- `unread_state` is a JSONB object: { "<userId>": true/false, ... }
-- The frontend spreads it into the row so `chat["unread_<uid>"]` works.
-- `lastViolationAt` / `lastViolationText` are written by the security filter
-- in chat/[id]/page.tsx when a contact-sharing attempt is detected.
CREATE TABLE IF NOT EXISTS public.chats (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  participants        TEXT[]      NOT NULL DEFAULT '{}',
  last_message_at     TIMESTAMPTZ,
  last_message_text   TEXT,
  origin_product_id   TEXT,
  is_suspicious      BOOLEAN     NOT NULL DEFAULT FALSE,
  last_violation_at   TIMESTAMPTZ,
  last_violation_text TEXT,
  unread_state        JSONB       NOT NULL DEFAULT '{}',
  last_email_notif_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ
);

-- ── messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id          TEXT        NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id        TEXT        NOT NULL,
  text              TEXT        NOT NULL DEFAULT '',
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_payment_request BOOLEAN    NOT NULL DEFAULT FALSE,
  amount            NUMERIC(10,2),
  product_name     TEXT,
  product_image    TEXT,
  product_id       TEXT,
  is_read          BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── reviews ───────────────────────────────────────────────────────────────────
-- seller_id / product_id / buyer_id are stored as plain strings by the frontend.
-- order_id and product_id are nullable to support reviews from non-buyers.
-- is_anonymous hides the reviewer's name in the display.
CREATE TABLE IF NOT EXISTS public.reviews (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      TEXT,
  seller_id     TEXT        NOT NULL,
  product_id    TEXT,
  buyer_id      TEXT        NOT NULL,
  buyer_user_id UUID GENERATED ALWAYS AS (
    CASE
      WHEN buyer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN buyer_id::UUID
      ELSE NULL
    END
  ) STORED REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_name    TEXT,
  is_anonymous  BOOLEAN     NOT NULL DEFAULT false,
  rating         INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  product_rating INTEGER    NOT NULL CHECK (product_rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reviews_buyer_not_seller CHECK (buyer_id <> seller_id)
);

-- ── supermarket_reviews ────────────────────────────────────────────────────────
-- Stores vendor/supermarket ratings submitted from the seller profile page.
-- Completely separate from product reviews (reviews table).
CREATE TABLE IF NOT EXISTS public.supermarket_reviews (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  supermarket_id  TEXT        NOT NULL,
  buyer_id        TEXT        NOT NULL,
  buyer_user_id   UUID GENERATED ALWAYS AS (
    CASE
      WHEN buyer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN buyer_id::UUID
      ELSE NULL
    END
  ) STORED REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_name      TEXT,
  is_anonymous    BOOLEAN     NOT NULL DEFAULT false,
  rating          INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supermarket_reviews_buyer_not_owner CHECK (buyer_id <> supermarket_id)
);

-- ── reports ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id     TEXT        NOT NULL,
  seller_name   TEXT,
  reporter_id   TEXT        NOT NULL,
  reporter_name TEXT,
  reason         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_seller_id    ON public.products (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id        ON public.orders   (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id       ON public.orders   (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id      ON public.orders   (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders   (status);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id       ON public.messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp     ON public.messages (timestamp);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id      ON public.reviews  (seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id     ON public.reviews  (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_user_id  ON public.reviews  (buyer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_product_per_buyer
  ON public.reviews (product_id, buyer_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supermarket_reviews_id ON public.supermarket_reviews (supermarket_id);
CREATE INDEX IF NOT EXISTS idx_supermarket_reviews_buyer_user_id ON public.supermarket_reviews (buyer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supermarket_reviews_one_per_seller_per_buyer
  ON public.supermarket_reviews (supermarket_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_participants     ON public.chats USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_chats_unread_state     ON public.chats USING GIN (unread_state);
CREATE INDEX IF NOT EXISTS idx_sellers_is_approved    ON public.sellers (is_approved);

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
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supermarket_reviews   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports               ENABLE ROW LEVEL SECURITY;

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
  WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "products_seller_update"  ON public.products FOR UPDATE
  USING (auth.uid() = seller_id);
CREATE POLICY "products_seller_delete"  ON public.products FOR DELETE
  USING (auth.uid() = seller_id);
CREATE POLICY "products_admin_all"      ON public.products FOR ALL USING (public.is_admin());

-- ── orders policies ───────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"     ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders_buyer_insert"   ON public.orders FOR INSERT
  WITH CHECK (auth.uid()::TEXT = buyer_id);
CREATE POLICY "orders_parties_update" ON public.orders FOR UPDATE
  USING (auth.uid()::TEXT = buyer_id OR auth.uid()::TEXT = seller_id);
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
  WITH CHECK (
    auth.uid()::TEXT = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.chats
      WHERE chats.id = messages.chat_id
        AND auth.uid()::TEXT = ANY(chats.participants)
    )
  );
-- Allow the recipient (a chat participant who is not the sender) to mark is_read = true
CREATE POLICY "messages_recipient_update_read" ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id
        AND auth.uid()::TEXT = ANY(chats.participants)
        AND auth.uid()::TEXT != messages.sender_id
    )
  );
CREATE POLICY "messages_admin_all"          ON public.messages FOR ALL USING (public.is_admin());

-- ── profiles policies ─────────────────────────────────────────────────────────
CREATE POLICY "profiles_public_read"  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_insert"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_own_update"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all"    ON public.profiles FOR ALL USING (public.is_admin());

-- ── reviews policies ──────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"  ON public.reviews FOR SELECT USING (true);
-- Any authenticated user can insert a review; buyer_id must match their uid.
CREATE POLICY "reviews_any_user_insert" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid()::TEXT = buyer_id);
CREATE POLICY "reviews_user_delete_own" ON public.reviews FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid()::TEXT = buyer_id);
CREATE POLICY "reviews_admin_all"    ON public.reviews FOR ALL USING (public.is_admin());

-- ── supermarket_reviews policies ──────────────────────────────────────────────
CREATE POLICY "supermarket_reviews_public_read"  ON public.supermarket_reviews FOR SELECT USING (true);
CREATE POLICY "supermarket_reviews_user_insert"  ON public.supermarket_reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid()::TEXT = buyer_id);
CREATE POLICY "supermarket_reviews_user_delete_own" ON public.supermarket_reviews FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid()::TEXT = buyer_id);
CREATE POLICY "supermarket_reviews_admin_all"    ON public.supermarket_reviews FOR ALL USING (public.is_admin());

-- ── reports policies ──────────────────────────────────────────────────────────
CREATE POLICY "Allow public read"       ON public.reports FOR SELECT USING (true);
CREATE POLICY "reports_reporter_insert" ON public.reports FOR INSERT
  WITH CHECK (auth.uid()::TEXT = reporter_id);
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

CREATE OR REPLACE FUNCTION public.block_prohibited_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_text TEXT := lower(coalesce(NEW.text, ''));
  compact_text    TEXT;
  digits_text     TEXT;
BEGIN
  -- Strip common separators/punctuation used to obfuscate contact details.
  normalized_text := regexp_replace(normalized_text, '[_~`''"|,:;\(\)\[\]\{\}<>]+', ' ', 'g');
  normalized_text := regexp_replace(normalized_text, '[[:space:]]+', ' ', 'g');

  normalized_text := regexp_replace(normalized_text, '\mzero\M', ' 0 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mone\M', ' 1 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mtwo\M', ' 2 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mthree\M', ' 3 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mfour\M', ' 4 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mfive\M', ' 5 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\msix\M', ' 6 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mseven\M', ' 7 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\meight\M', ' 8 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mnine\M', ' 9 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mאפס\M', ' 0 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(אחת|אחד)\M', ' 1 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(שתיים|שניים|שתים)\M', ' 2 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(שלוש|שלושה)\M', ' 3 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(ארבע|ארבעה)\M', ' 4 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(חמש|חמישה)\M', ' 5 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(שש|שישה)\M', ' 6 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(שבע|שבעה)\M', ' 7 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\mשמונה\M', ' 8 ', 'g');
  normalized_text := regexp_replace(normalized_text, '\m(תשע|תשעה)\M', ' 9 ', 'g');

  compact_text := regexp_replace(normalized_text, '[^0-9a-zא-ת]+', '', 'g');
  digits_text := regexp_replace(normalized_text, '[^0-9]+', '', 'g');

  IF normalized_text ~ '[a-z0-9._%+\-]+([[:space:]]*(\@|\(at\)|\[at\]| at )[[:space:]]*)[a-z0-9.-]+([[:space:]]*(\.|\(dot\)|\[dot\]| dot )[[:space:]]*)[a-z]{2,}'
    OR normalized_text ~ '(https?://|www\.|wa\.me/|t\.me/|discord(app)?\.com/|instagram\.com/|facebook\.com/|telegram\.me/|bit\.ly/|tinyurl\.com/)'
    OR normalized_text ~ '((\+|00)[[:space:]]*972|0)([^0-9]*[23489]|[^0-9]*5[^0-9]*[0-9])([^0-9]*[0-9]){7,8}'
    OR digits_text ~ '(972|0)([23489][0-9]{7,8}|5[0-9]{8})'
    OR compact_text LIKE ANY (ARRAY[
      '%מספר%',
      '%טלפון%',
      '%נייד%',
      '%פלאפון%',
      '%סלולרי%',
      '%וואטסאפ%',
      '%ווצאפ%',
      '%צורקשר%',
      '%תתקשר%',
      '%מחוץלאתר%',
      '%מחוץלמערכת%',
      '%מחוץלצאט%',
      '%בפרטי%',
      '%באישי%',
      '%instagram%',
      '%facebook%',
      '%telegram%',
      '%טלגרם%',
      '%אינסטגרם%',
      '%פייסבוק%',
      '%קוראיםלי%',
      '%השםשלי%',
      '%שמי%',
      '%תחפשותי%',
      '%חפשותי%',
      '%nameis%',
      '%mynameis%',
      '%lookmeup%',
      '%searchforme%',
      '%username%',
      '%contactme%',
      '%callme%',
      '%phone%',
      '%email%'
    ])
  THEN
    UPDATE public.chats
    SET is_suspicious = TRUE,
        last_violation_at = NOW(),
        last_violation_text = left(coalesce(NEW.text, ''), 1000),
        updated_at = NOW()
    WHERE id = NEW.chat_id;

    -- Keep this message aligned with CHAT_BLOCK_ERROR_MESSAGE in src/lib/chat-guard.ts.
    RAISE EXCEPTION USING MESSAGE = 'Contact details are not allowed in chat';
  END IF;

  RETURN NEW;
END;
$$;

-- Grant execute on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_increment        TO authenticated;
GRANT EXECUTE ON FUNCTION public.array_union_elem      TO authenticated;
GRANT EXECUTE ON FUNCTION public.array_remove_elem     TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_unread_state   TO authenticated;

DROP TRIGGER IF EXISTS trg_block_prohibited_chat_message ON public.messages;
CREATE TRIGGER trg_block_prohibited_chat_message
BEFORE INSERT OR UPDATE OF text ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.block_prohibited_chat_message();

-- =============================================================================
-- REALTIME
-- Enable Postgres Realtime for live updates in the app.
-- =============================================================================

-- In Supabase Dashboard → Database → Replication, enable the following tables:
-- • sellers   • customers  • products  • orders
-- • chats     • messages   • profiles  • reviews
-- • supermarket_reviews     • reports
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
      public.profiles,
      public.reviews,
      public.reports;
  EXCEPTION WHEN others THEN
    -- Tables may already be in the publication; safe to ignore.
    NULL;
  END;
END;
$$;

-- =============================================================================
-- AUTH TRIGGER — auto-create profile row on new user signup
-- =============================================================================
-- This trigger fires immediately after Supabase inserts a row in auth.users,
-- regardless of whether email confirmation is required.
-- The frontend must NOT manually insert into sellers/customers; the trigger
-- is the single source of truth for row creation.
--
-- Routing rules (driven by raw_user_meta_data->>'role'):
--   'seller' → public.sellers (minimal row; frontend updates with full data)
--   'admin'  → public.admins
--   default  → public.customers
-- =============================================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      TEXT;
  v_first     TEXT;
  v_last      TEXT;
  v_full_name TEXT;
BEGIN
  v_role  := NEW.raw_user_meta_data->>'role';
  -- Accept both snake_case (first_name) and camelCase (firstName) to be robust
  -- against whichever format the frontend sends in options.data.
  v_first := COALESCE(NEW.raw_user_meta_data->>'first_name',
                      NEW.raw_user_meta_data->>'firstName',
                      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name',
                                          NEW.raw_user_meta_data->>'name', ''), ' ', 1),
                      '');
  v_last  := COALESCE(NEW.raw_user_meta_data->>'last_name',
                      NEW.raw_user_meta_data->>'lastName',
                      NULLIF(
                        substring(COALESCE(NEW.raw_user_meta_data->>'full_name',
                                           NEW.raw_user_meta_data->>'name', '')
                                  FROM position(' ' IN COALESCE(NEW.raw_user_meta_data->>'full_name',
                                                                 NEW.raw_user_meta_data->>'name', '')) + 1),
                        ''
                      ),
                      '');
  v_full_name := NULLIF(trim(concat_ws(' ', v_first, v_last)), '');

  INSERT INTO public.profiles (
    id, full_name, avatar_url, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(v_full_name,
             NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1),
             'משתמש'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();

  IF v_role = 'seller' THEN
    INSERT INTO public.sellers (
      id, email, first_name, last_name
    ) VALUES (
      NEW.id, NEW.email, v_first, v_last
    )
    ON CONFLICT (id) DO UPDATE
      SET email      = EXCLUDED.email,
          first_name = CASE WHEN public.sellers.first_name = '' THEN EXCLUDED.first_name ELSE public.sellers.first_name END,
          last_name  = CASE WHEN public.sellers.last_name  = '' THEN EXCLUDED.last_name  ELSE public.sellers.last_name  END;

  ELSIF v_role = 'admin' THEN
    INSERT INTO public.admins (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  ELSE
    -- Default: customer
    INSERT INTO public.customers (
      id, email, first_name, last_name
    ) VALUES (
      NEW.id, NEW.email, v_first, v_last
    )
    ON CONFLICT (id) DO UPDATE
      SET email      = EXCLUDED.email,
          first_name = CASE WHEN public.customers.first_name = '' THEN EXCLUDED.first_name ELSE public.customers.first_name END,
          last_name  = CASE WHEN public.customers.last_name  = '' THEN EXCLUDED.last_name  ELSE public.customers.last_name  END;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill profiles for already-existing auth users.
INSERT INTO public.profiles (id, full_name, avatar_url, updated_at)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(concat_ws(
      ' ',
      COALESCE(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'firstName'),
      COALESCE(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'lastName')
    )), ''),
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1),
    'משתמש'
  ),
  COALESCE(NULLIF(u.raw_user_meta_data->>'avatar_url', ''), NULLIF(u.raw_user_meta_data->>'picture', '')),
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET full_name  = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW();

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- STORAGE (optional — for profile images if migrating from base64 to files)
-- =============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
-- CREATE POLICY "images_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'images');
-- CREATE POLICY "images_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images');
