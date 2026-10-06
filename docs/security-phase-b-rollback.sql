GRANT SELECT ON public.orders TO anon, authenticated;

DROP POLICY IF EXISTS "sellers_own_read" ON public.sellers;
DROP POLICY IF EXISTS "Allow public read" ON public.sellers;
CREATE POLICY "Allow public read" ON public.sellers FOR SELECT USING (true);

DROP POLICY IF EXISTS "customers_own_read" ON public.customers;
DROP POLICY IF EXISTS "Allow public read" ON public.customers;
CREATE POLICY "Allow public read" ON public.customers FOR SELECT USING (true);

DROP POLICY IF EXISTS "messages_recipient_mark_read" ON public.messages;
DROP TRIGGER IF EXISTS trg_guard_client_message_writes ON public.messages;
DROP FUNCTION IF EXISTS public.guard_client_message_writes();
DROP TRIGGER IF EXISTS trg_guard_client_chat_writes ON public.chats;
DROP FUNCTION IF EXISTS public.guard_client_chat_writes();
DROP FUNCTION IF EXISTS public.my_order_codes();
DROP VIEW IF EXISTS public.customers_public;
DROP VIEW IF EXISTS public.sellers_public;
