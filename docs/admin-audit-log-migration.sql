CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_kind TEXT NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
DROP POLICY IF EXISTS "audit_log_admin_read" ON public.audit_log;
CREATE POLICY "audit_log_admin_read" ON public.audit_log
  FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_actor_kind()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role' THEN 'server'
    WHEN auth.uid() IS NULL THEN 'database'
    WHEN public.is_admin() THEN 'admin'
    ELSE 'user'
  END;
$$;

CREATE OR REPLACE FUNCTION public.audit_write(p_action TEXT, p_table TEXT, p_record TEXT, p_details JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_log (actor_id, actor_kind, action, table_name, record_id, details)
  VALUES (auth.uid(), public.audit_actor_kind(), p_action, p_table, p_record, COALESCE(p_details, '{}'::jsonb));
$$;

REVOKE ALL ON FUNCTION public.audit_write(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_actor_kind() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_sellers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.audit_write('seller_deleted', 'sellers', OLD.id::text,
      jsonb_build_object('name', concat_ws(' ', OLD.first_name, OLD.last_name), 'email', OLD.email));
    RETURN OLD;
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    v := v || jsonb_build_object('is_approved', jsonb_build_array(OLD.is_approved, NEW.is_approved));
  END IF;
  IF NEW.seller_type IS DISTINCT FROM OLD.seller_type THEN
    v := v || jsonb_build_object('seller_type', jsonb_build_array(OLD.seller_type, NEW.seller_type));
  END IF;
  IF NEW.stam_upgrade_status IS DISTINCT FROM OLD.stam_upgrade_status THEN
    v := v || jsonb_build_object('stam_upgrade_status', jsonb_build_array(OLD.stam_upgrade_status, NEW.stam_upgrade_status));
  END IF;
  IF (NEW.bank_name, NEW.bank_branch, NEW.bank_account_number) IS DISTINCT FROM (OLD.bank_name, OLD.bank_branch, OLD.bank_account_number) THEN
    v := v || jsonb_build_object('bank_details_changed', true);
  END IF;
  IF (NEW.business_type, NEW.business_id, NEW.business_name) IS DISTINCT FROM (OLD.business_type, OLD.business_id, OLD.business_name) THEN
    v := v || jsonb_build_object('business_details_changed', true);
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    v := v || jsonb_build_object('email_changed', true);
  END IF;
  IF v <> '{}'::jsonb THEN
    PERFORM public.audit_write('seller_updated', 'sellers', NEW.id::text,
      v || jsonb_build_object('name', concat_ws(' ', NEW.first_name, NEW.last_name)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sellers ON public.sellers;
CREATE TRIGGER trg_audit_sellers
  AFTER UPDATE OR DELETE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.audit_sellers();

CREATE OR REPLACE FUNCTION public.audit_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.audit_write('order_deleted', 'orders', OLD.id::text,
      jsonb_build_object('status', OLD.status, 'amount', OLD.amount, 'product_name', OLD.product_name));
    RETURN OLD;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.audit_write('order_status_changed', 'orders', NEW.id::text,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'amount', NEW.amount, 'product_name', NEW.product_name));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
  AFTER UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_orders();

CREATE OR REPLACE FUNCTION public.audit_deletions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'customers' THEN
    PERFORM public.audit_write('customer_deleted', 'customers', OLD.id::text,
      jsonb_build_object('name', concat_ws(' ', OLD.first_name, OLD.last_name), 'email', OLD.email));
  ELSIF TG_TABLE_NAME = 'products' THEN
    PERFORM public.audit_write('product_deleted', 'products', OLD.id::text,
      jsonb_build_object('product_type', OLD.product_type, 'seller_id', OLD.seller_id, 'price', OLD.price));
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_customers_delete ON public.customers;
CREATE TRIGGER trg_audit_customers_delete
  AFTER DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_deletions();

DROP TRIGGER IF EXISTS trg_audit_products_delete ON public.products;
CREATE TRIGGER trg_audit_products_delete
  AFTER DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_deletions();

CREATE OR REPLACE FUNCTION public.audit_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.audit_write('admin_added', 'admins', NEW.id::text, jsonb_build_object('email', NEW.email));
    RETURN NEW;
  END IF;
  PERFORM public.audit_write('admin_removed', 'admins', OLD.id::text, jsonb_build_object('email', OLD.email));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admins ON public.admins;
CREATE TRIGGER trg_audit_admins
  AFTER INSERT OR DELETE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_admins();
