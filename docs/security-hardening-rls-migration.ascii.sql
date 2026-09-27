CREATE OR REPLACE FUNCTION public.is_client_request()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.role(), '') IN ('authenticated', 'anon');
$$;

CREATE OR REPLACE FUNCTION public.guard_client_order_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price        NUMERIC;
  v_delivery_fee NUMERIC;
  v_seller_id    TEXT;
  v_is_buyer     BOOLEAN;
  v_is_seller    BOOLEAN;
BEGIN
  IF NOT public.is_client_request() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending_payment', 'torah_request') THEN
      RAISE EXCEPTION 'ORDER_STATUS_NOT_ALLOWED' USING ERRCODE = '42501';
    END IF;
    SELECT p.price, COALESCE(p.delivery_fee, 0), p.seller_id::text
      INTO v_price, v_delivery_fee, v_seller_id
      FROM public.products p WHERE p.id::text = NEW.product_id;
    IF v_price IS NULL THEN
      RAISE EXCEPTION 'ORDER_PRODUCT_NOT_FOUND' USING ERRCODE = '23503';
    END IF;
    NEW.seller_id          := v_seller_id;
    NEW.amount             := CASE
                                WHEN NEW.status = 'torah_request' THEN v_price
                                ELSE v_price + ROUND(v_price * 0.18)
                                     + CASE WHEN NEW.delivery_method = U&'\05DE\05E9\05DC\05D5\05D7' THEN v_delivery_fee ELSE 0 END
                              END;
    NEW.verification_code  := NULL;
    NEW.paid_at            := NULL;
    NEW.completed_at       := NULL;
    NEW.seller_net         := NULL;
    NEW.platform_fee       := NULL;
    NEW.verified_by_seller := FALSE;
    NEW.is_seen_by_seller  := FALSE;
    NEW.is_rated           := FALSE;
    NEW.invoice_generated  := FALSE;
    NEW.payment_provider   := NULL;
    NEW.created_at         := NOW();
    RETURN NEW;
  END IF;

  v_is_buyer  := auth.uid()::text = OLD.buyer_id;
  v_is_seller := auth.uid()::text = OLD.seller_id;

  NEW.id                 := OLD.id;
  NEW.buyer_id           := OLD.buyer_id;
  NEW.seller_id          := OLD.seller_id;
  NEW.product_id         := OLD.product_id;
  NEW.product_name       := OLD.product_name;
  NEW.product_image      := OLD.product_image;
  NEW.status             := OLD.status;
  NEW.verification_code  := OLD.verification_code;
  NEW.paid_at            := OLD.paid_at;
  NEW.completed_at       := OLD.completed_at;
  NEW.seller_net         := OLD.seller_net;
  NEW.platform_fee       := OLD.platform_fee;
  NEW.verified_by_seller := OLD.verified_by_seller;
  NEW.invoice_generated  := OLD.invoice_generated;
  NEW.payment_provider   := OLD.payment_provider;
  NEW.created_at         := OLD.created_at;

  IF NOT v_is_seller THEN
    NEW.is_seen_by_seller := OLD.is_seen_by_seller;
  END IF;
  IF NOT (v_is_buyer AND OLD.status = 'completed') THEN
    NEW.is_rated := OLD.is_rated;
  END IF;

  IF v_is_buyer AND OLD.status = 'pending_payment' THEN
    SELECT p.price, COALESCE(p.delivery_fee, 0)
      INTO v_price, v_delivery_fee
      FROM public.products p WHERE p.id::text = OLD.product_id;
    NEW.amount := v_price + ROUND(v_price * 0.18)
                  + CASE WHEN NEW.delivery_method = U&'\05DE\05E9\05DC\05D5\05D7' THEN v_delivery_fee ELSE 0 END;
  ELSE
    NEW.amount          := OLD.amount;
    NEW.buyer_name      := OLD.buyer_name;
    NEW.buyer_phone     := OLD.buyer_phone;
    NEW.buyer_email     := OLD.buyer_email;
    NEW.buyer_address   := OLD.buyer_address;
    NEW.delivery_method := OLD.delivery_method;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_client_order_writes ON public.orders;
CREATE TRIGGER trg_guard_client_order_writes
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_order_writes();
DROP POLICY IF EXISTS "sellers_own_insert" ON public.sellers;
CREATE POLICY "sellers_own_insert" ON public.sellers
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND is_approved = FALSE
    AND sales_count = 0
    AND welcome_email_sent = FALSE
  );
DROP POLICY IF EXISTS "products_seller_insert" ON public.products;
CREATE POLICY "products_seller_insert" ON public.products
  FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = auth.uid() AND s.is_approved)
  );

DROP POLICY IF EXISTS "products_seller_update" ON public.products;
CREATE POLICY "products_seller_update" ON public.products
  FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = auth.uid() AND s.is_approved)
  );
