-- Removes the SMS / voice notification tables (see sms-voice-notifications-migration.sql).
-- Users' phone opt-ins and the send log are deleted with them.
DROP TABLE IF EXISTS public.notification_log;
DROP TABLE IF EXISTS public.phone_verifications;
DROP TABLE IF EXISTS public.notification_channels;
