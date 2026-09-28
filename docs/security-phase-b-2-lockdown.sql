DROP POLICY IF EXISTS "Allow public read" ON public.sellers;
DROP POLICY IF EXISTS "sellers_own_read" ON public.sellers;
CREATE POLICY "sellers_own_read" ON public.sellers
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow public read" ON public.customers;
DROP POLICY IF EXISTS "customers_own_read" ON public.customers;
CREATE POLICY "customers_own_read" ON public.customers
  FOR SELECT
  USING (auth.uid() = id);

REVOKE SELECT ON public.orders FROM anon, authenticated;
GRANT SELECT (
  id, buyer_id, seller_id, product_id, product_name, product_image, amount,
  status, delivery_method, is_rated, seller_net, platform_fee, completed_at,
  verified_by_seller, is_seen_by_seller, buyer_name, buyer_phone, buyer_email,
  buyer_address, paid_at, invoice_generated, payment_provider, created_at, updated_at
) ON public.orders TO authenticated;
