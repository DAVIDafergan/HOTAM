DROP POLICY IF EXISTS "reviews_buyer_delete" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Users can delete their own reviews" ON public.reviews
  FOR DELETE
  USING (buyer_id IS NOT NULL);

DROP POLICY IF EXISTS "reviews_buyer_insert" ON public.reviews;
CREATE POLICY "reviews_buyer_insert" ON public.reviews
  FOR INSERT
  WITH CHECK (auth.uid()::text = buyer_id);

DROP POLICY IF EXISTS "supermarket_reviews_own_insert" ON public.supermarket_reviews;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.supermarket_reviews;
CREATE POLICY "Enable insert for authenticated users only" ON public.supermarket_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "messages_participant_read" ON public.messages;
DROP POLICY IF EXISTS "Allow public read" ON public.messages;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.messages;
CREATE POLICY "Allow public read" ON public.messages
  FOR SELECT
  USING (true);
CREATE POLICY "Enable read for authenticated users" ON public.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "messages_participant_insert" ON public.messages;
CREATE POLICY "messages_participant_insert" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id);

DROP POLICY IF EXISTS "chats_participant_read" ON public.chats;
DROP POLICY IF EXISTS "Allow public read" ON public.chats;
CREATE POLICY "Allow public read" ON public.chats
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admins_self_read" ON public.admins;
DROP POLICY IF EXISTS "Allow public read" ON public.admins;
CREATE POLICY "Allow public read" ON public.admins
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "reports_reporter_read" ON public.reports;
DROP POLICY IF EXISTS "Allow public read" ON public.reports;
CREATE POLICY "Allow public read" ON public.reports
  FOR SELECT
  USING (true);
