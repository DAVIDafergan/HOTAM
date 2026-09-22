// Site-wide constants that need to stay identical everywhere they're used.

// "חותם" staff WhatsApp number (0556674329) in wa.me international format — used for the
// site's own contact channel, distinct from any individual seller's phone number.
export const PLATFORM_WHATSAPP_NUMBER = '972556674329';
export const PLATFORM_WHATSAPP_DISPLAY = '055-667-4329';

// Every orders column except verification_code — the buyer's delivery code must never
// reach the seller's browser (it's checked server-side in /api/orders/verify-delivery).
export const SELLER_ORDER_COLUMNS = [
  'id', 'buyer_id', 'seller_id', 'product_id', 'product_name', 'product_image', 'amount',
  'status', 'delivery_method', 'is_rated', 'seller_net', 'platform_fee', 'completed_at',
  'verified_by_seller', 'is_seen_by_seller', 'buyer_name', 'buyer_phone', 'buyer_email',
  'buyer_address', 'paid_at', 'invoice_generated', 'payment_provider', 'created_at', 'updated_at',
].join(', ');
