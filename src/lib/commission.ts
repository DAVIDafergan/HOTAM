// Single source of truth for the platform's commission rate by product category.
// Keep this in sync with any server-side/DB logic that persists `orders.seller_net`.
// Platform commission is retired — sellers keep 100% of the sale price. This is separate
// from VAT_MULTIPLIER (18%), which stays untouched; commission and VAT are not the same
// line item and this file has no bearing on VAT.
const MEGILLAH_COMMISSION_RATE = 0;
const TORAH_SCROLL_COMMISSION_RATE = 0;
const DEFAULT_COMMISSION_RATE = 0;

export function getCommissionRate(productType?: string | null): number {
  if (productType === 'מגילה') return MEGILLAH_COMMISSION_RATE;
  if (productType === 'ספר תורה') return TORAH_SCROLL_COMMISSION_RATE;
  return DEFAULT_COMMISSION_RATE;
}

export function getSellerPayoutRate(productType?: string | null): number {
  return 1 - getCommissionRate(productType);
}

export function calculateCommissionAmount(amount: number, productType?: string | null): number {
  return Number(amount || 0) * getCommissionRate(productType);
}

// Best-effort seller net payout for an order: prefer the authoritative stored value
// (`seller_net`, if the backend has already computed and persisted it), and otherwise
// derive it from the order amount and the commission rate for its product category.
export function resolveSellerNet(order: { seller_net?: number | null; amount?: number | null; product_name?: string | null } | null | undefined): number {
  if (!order) return 0;
  const storedNet = Number(order.seller_net);
  if (Number.isFinite(storedNet) && storedNet > 0) return storedNet;
  return Number(order.amount || 0) * getSellerPayoutRate(order.product_name);
}
