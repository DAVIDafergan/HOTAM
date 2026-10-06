SELECT 'views' AS check_name, string_agg(table_name, ', ' ORDER BY table_name) AS result
FROM information_schema.views
WHERE table_schema = 'public' AND table_name IN ('sellers_public', 'customers_public')
UNION ALL
SELECT 'public read policies left on sellers/customers', COALESCE(string_agg(tablename || '.' || policyname, ', '), 'none')
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('sellers', 'customers') AND cmd = 'SELECT' AND qual = 'true'
UNION ALL
SELECT 'own-read policies', string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename)
FROM pg_policies
WHERE schemaname = 'public' AND policyname IN ('sellers_own_read', 'customers_own_read')
UNION ALL
SELECT 'authenticated can read orders.verification_code', CASE WHEN has_column_privilege('authenticated', 'public.orders', 'verification_code', 'SELECT') THEN 'YES - not locked' ELSE 'no (locked)' END
UNION ALL
SELECT 'anon can read orders', CASE WHEN has_table_privilege('anon', 'public.orders', 'SELECT') THEN 'YES' ELSE 'no' END
UNION ALL
SELECT 'triggers', string_agg(tgname, ', ' ORDER BY tgname)
FROM pg_trigger
WHERE tgname IN ('trg_guard_client_chat_writes', 'trg_guard_client_message_writes')
UNION ALL
SELECT 'message read policy', COALESCE(string_agg(policyname, ', '), 'missing')
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_recipient_mark_read'
UNION ALL
SELECT 'my_order_codes()', CASE WHEN to_regprocedure('public.my_order_codes()') IS NOT NULL THEN 'exists' ELSE 'missing' END;
