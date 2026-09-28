// Site-wide constants that need to stay identical everywhere they're used.

// "חותם" staff WhatsApp number (0556674329) in wa.me international format — used for the
// site's own contact channel, distinct from any individual seller's phone number.
export const PLATFORM_WHATSAPP_NUMBER = '972556674329';
export const PLATFORM_WHATSAPP_DISPLAY = '055-667-4329';

// Seller columns that may reach anyone's browser: public profile, search filters, cards.
// Never bank/business details, phone, email, street address or age.
export const PUBLIC_SELLER_PROFILE_COLUMNS = [
  'id', 'first_name', 'last_name', 'city', 'notes', 'profile_image', 'is_approved', 'created_at',
  'seller_type', 'script_types', 'script_level', 'experience_years', 'writing_samples',
  'torah_study_frequency', 'mikveh_frequency', 'has_scribe_certificate', 'certificate_url',
  'marital_status', 'sales_count',
].join(', ');

// What the search page needs per seller: card header + the halachic filters.
export const SEARCH_SELLER_COLUMNS = [
  'id', 'first_name', 'last_name', 'profile_image', 'city', 'is_approved',
  'marital_status', 'mikveh_frequency', 'has_scribe_certificate', 'torah_study_frequency',
].join(', ');

// Every orders column except verification_code — the buyer's delivery code must never
// reach the seller's browser (it's checked server-side in /api/orders/verify-delivery).
export const SELLER_ORDER_COLUMNS = [
  'id', 'buyer_id', 'seller_id', 'product_id', 'product_name', 'product_image', 'amount',
  'status', 'delivery_method', 'is_rated', 'seller_net', 'platform_fee', 'completed_at',
  'verified_by_seller', 'is_seen_by_seller', 'buyer_name', 'buyer_phone', 'buyer_email',
  'buyer_address', 'paid_at', 'invoice_generated', 'payment_provider', 'created_at', 'updated_at',
].join(', ');

// Same list for any browser read of orders (buyer, admin): after security Phase B the
// database only lets the browser read these columns. The buyer's own codes come from
// the my_order_codes() function.
export const ORDER_CLIENT_COLUMNS = SELLER_ORDER_COLUMNS;
