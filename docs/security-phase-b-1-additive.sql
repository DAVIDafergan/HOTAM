CREATE OR REPLACE VIEW public.sellers_public AS
SELECT
  s.id,
  s.first_name,
  s.last_name,
  COALESCE(
    NULLIF(btrim(s.city), ''),
    CASE WHEN position(',' IN COALESCE(s.address, '')) > 0 THEN NULLIF(btrim(split_part(s.address, ',', -1)), '') END
  ) AS city,
  s.notes,
  s.profile_image,
  s.is_approved,
  s.created_at,
  s.seller_type,
  s.script_types,
  s.script_level,
  s.experience_years,
  CASE WHEN s.seller_type = 'stam_scribe' THEN s.writing_samples END AS writing_samples,
  s.torah_study_frequency,
  s.mikveh_frequency,
  s.has_scribe_certificate,
  CASE WHEN s.seller_type = 'stam_scribe' THEN s.certificate_url END AS certificate_url,
  s.marital_status,
  s.sales_count
FROM public.sellers s;

CREATE OR REPLACE VIEW public.customers_public AS
SELECT c.id, c.first_name, c.last_name
FROM public.customers c;

REVOKE ALL ON public.sellers_public FROM anon, authenticated;
REVOKE ALL ON public.customers_public FROM anon, authenticated;
GRANT SELECT ON public.sellers_public TO anon, authenticated;
GRANT SELECT ON public.customers_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_order_codes()
RETURNS TABLE (order_id TEXT, verification_code TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id::text, o.verification_code::text
  FROM public.orders o
  WHERE o.buyer_id = auth.uid()::text;
$$;

REVOKE ALL ON FUNCTION public.my_order_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_order_codes() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_client_chat_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_client_request() OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.participants := OLD.participants;
  IF OLD.is_suspicious THEN
    NEW.is_suspicious := TRUE;
    NEW.last_violation_at := COALESCE(NEW.last_violation_at, OLD.last_violation_at);
    NEW.last_violation_text := COALESCE(NEW.last_violation_text, OLD.last_violation_text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_client_chat_writes ON public.chats;
CREATE TRIGGER trg_guard_client_chat_writes
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_chat_writes();

CREATE OR REPLACE FUNCTION public.guard_client_message_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_client_request() OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.chat_id, NEW.sender_id, NEW.text, NEW."timestamp", NEW.is_payment_request, NEW.amount, NEW.product_name, NEW.product_image, NEW.product_id)
     IS DISTINCT FROM
     (OLD.id, OLD.chat_id, OLD.sender_id, OLD.text, OLD."timestamp", OLD.is_payment_request, OLD.amount, OLD.product_name, OLD.product_image, OLD.product_id) THEN
    RAISE EXCEPTION 'MESSAGE_ONLY_READ_STATE_EDITABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_client_message_writes ON public.messages;
CREATE TRIGGER trg_guard_client_message_writes
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_message_writes();

DROP POLICY IF EXISTS "messages_recipient_mark_read" ON public.messages;
CREATE POLICY "messages_recipient_mark_read" ON public.messages
  FOR UPDATE
  USING (
    sender_id <> auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND auth.uid()::text = ANY (c.participants))
  )
  WITH CHECK (
    sender_id <> auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND auth.uid()::text = ANY (c.participants))
  );
