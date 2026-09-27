DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "reviews_buyer_delete" ON public.reviews;
CREATE POLICY "reviews_buyer_delete" ON public.reviews
  FOR DELETE
  USING (auth.uid()::text = buyer_id);

DROP POLICY IF EXISTS "reviews_buyer_insert" ON public.reviews;
CREATE POLICY "reviews_buyer_insert" ON public.reviews
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = buyer_id
    AND (
      order_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = reviews.order_id
          AND o.buyer_id = auth.uid()::text
          AND o.seller_id = reviews.seller_id
          AND o.status = 'completed'
      )
    )
  );

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.supermarket_reviews;
DROP POLICY IF EXISTS "supermarket_reviews_own_insert" ON public.supermarket_reviews;
CREATE POLICY "supermarket_reviews_own_insert" ON public.supermarket_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = buyer_id
    AND buyer_id <> supermarket_id
  );

DROP POLICY IF EXISTS "Allow public read" ON public.messages;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "messages_participant_read" ON public.messages;
CREATE POLICY "messages_participant_read" ON public.messages
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND auth.uid()::text = ANY (c.participants)
    )
  );

DROP POLICY IF EXISTS "messages_participant_insert" ON public.messages;
CREATE POLICY "messages_participant_insert" ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND auth.uid()::text = ANY (c.participants)
    )
  );

DROP POLICY IF EXISTS "Allow public read" ON public.chats;
DROP POLICY IF EXISTS "chats_participant_read" ON public.chats;
CREATE POLICY "chats_participant_read" ON public.chats
  FOR SELECT
  USING (
    auth.uid()::text = ANY (participants)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Allow public read" ON public.admins;
DROP POLICY IF EXISTS "admins_self_read" ON public.admins;
CREATE POLICY "admins_self_read" ON public.admins
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Allow public read" ON public.reports;
DROP POLICY IF EXISTS "reports_reporter_read" ON public.reports;
CREATE POLICY "reports_reporter_read" ON public.reports
  FOR SELECT
  USING (
    auth.uid()::text = reporter_id
    OR public.is_admin()
  );
