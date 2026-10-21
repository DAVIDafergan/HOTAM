-- SMS and voice-call notifications (Twilio), next to the existing emails.
-- Additive only: three new tables, nothing existing is changed. Safe to run more than once.
--
-- notification_channels: one row per user (seller or customer) who set up a phone for updates.
--   Everything starts OFF. A channel is used only after the user verified the number with a
--   code and switched the channel on (explicit opt-in). The old sellers.notification_sms /
--   notification_voice columns are NOT used: they defaulted to true without anyone choosing it.
-- phone_verifications: the pending code while a user confirms a number (hashed, 10 minutes).
-- notification_log: every SMS / call attempt with its result, for support and cost tracking. The rate
--   limits (codes per user / per number / per day, phone updates per recipient) are counted here,
--   so removing a number or verifying it never resets them.
--
-- All three are server-only (service role); the browser reaches them through /api/notifications/*.

CREATE TABLE IF NOT EXISTS public.notification_channels (
  user_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone              TEXT,                         -- E.164 (+9725…), set only after verification
  phone_verified_at  TIMESTAMPTZ,
  sms_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
  voice_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  marketing_enabled  BOOLEAN     NOT NULL DEFAULT FALSE, -- also mailings marked "פרסומת" (separate consent)
  sms_consent_at     TIMESTAMPTZ,
  voice_consent_at   TIMESTAMPTZ,
  marketing_consent_at TIMESTAMPTZ,
  optout_token       TEXT        UNIQUE,         -- short random token for the "להסרה" link in every SMS
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  user_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone              TEXT        NOT NULL,
  channel            TEXT        NOT NULL CHECK (channel IN ('sms', 'voice')),
  code_hash          TEXT        NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  attempts           INTEGER     NOT NULL DEFAULT 0,
  sent_count         INTEGER     NOT NULL DEFAULT 0,
  window_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_log (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID,
  channel     TEXT        NOT NULL,              -- 'sms' | 'voice'
  kind        TEXT        NOT NULL,              -- 'chat', 'order_paid_buyer', 'broadcast', 'verify_code', …
  phone       TEXT,                              -- number it went to (rate limits per number)
  status      TEXT        NOT NULL,              -- 'reserved' | 'sent' | 'failed' | 'skipped:<reason>'
  provider_id TEXT,                              -- Twilio SID
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notification_log_user_idx ON public.notification_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_created_idx ON public.notification_log (created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_phone_idx ON public.notification_log (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_kind_idx ON public.notification_log (kind, created_at DESC);

ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log     ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_channels FROM anon, authenticated;
REVOKE ALL ON public.phone_verifications  FROM anon, authenticated;
REVOKE ALL ON public.notification_log     FROM anon, authenticated;
