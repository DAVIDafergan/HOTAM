// Google Merchant Center product feed (RSS 2.0 + the g: namespace). Shared mapping: one product row
// → one Merchant item, so a later Merchant API sync can reuse it unchanged.
import { STAM_PRODUCT_LABELS, describeJudaicaAttributes, getJudaicaCategory, isStamProductType } from '@/lib/product-catalog';

export const SITE_URL = 'https://www.hotam.shop';
const VAT_MULTIPLIER = 1.18;
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_EXTRA_IMAGES = 10;
const GOOGLE_CATEGORY = 'Religious & Ceremonial > Religious Items';

export type FeedSeller = { id: string; first_name?: string | null; last_name?: string | null; is_approved?: boolean | null };

export type FeedItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  price: string;
  availability: 'in_stock';
  brand: string;
  productType: string;
  shippingPrice: string;
  maxHandlingDays: number | null;
};

/** Why a product is left out of the feed (null = included). */
export function feedExclusionReason(product: any, seller: FeedSeller | undefined): string | null {
  if (!seller || seller.is_approved !== true) return 'seller-not-approved';
  if (!(Number(product.quantity) > 0)) return 'out-of-stock';
  if (!(Number(product.price) > 0)) return 'no-price';
  if (!firstImage(product)) return 'no-image';
  // Google Shopping needs a shipping offer; pickup-only listings would advertise a cost that doesn't exist.
  if (product.delivery_type === 'pickup') return 'pickup-only';
  return null;
}

function firstImage(product: any): string | null {
  const images = Array.isArray(product.images) ? product.images : [];
  return images.find((src: unknown) => typeof src === 'string' && /^https:\/\//.test(src)) || null;
}

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);
const money = (amount: number) => `${amount.toFixed(2)} ILS`;

/** Display name: "מזוזה קלף 12 ס"מ בכתב ספרדי מהודר" / "טלית צמר, 60". */
function productTitle(product: any): string {
  const type = product.product_type === 'מוצרי יודאיקה שונים' ? (product.sub_type || STAM_PRODUCT_LABELS[product.product_type]) : product.product_type;
  const parts = [clean(type)];
  if (product.sub_type && product.sub_type !== 'all' && product.product_type !== 'מוצרי יודאיקה שונים') parts.push(clean(product.sub_type));
  const judaica = getJudaicaCategory(product.product_type);
  if (judaica) {
    const specs = describeJudaicaAttributes(judaica, product.attributes || {}).map(([, value]) => value).slice(0, 2);
    if (specs.length) return clip(`${parts.join(' ')}, ${specs.join(', ')}`, MAX_TITLE);
    return clip(parts.join(' '), MAX_TITLE);
  }
  if (product.parchment_size) parts.push(`${clean(product.parchment_size)} ס"מ`);
  if (product.script_type) parts.push(`בכתב ${clean(product.script_type)}`);
  if (product.script_level) parts.push(clean(product.script_level));
  return clip(parts.join(' '), MAX_TITLE);
}

function productDescription(product: any, title: string, sellerName: string): string {
  const own = clean(product.description);
  if (own) return clip(own, MAX_DESCRIPTION);
  const from = isStamProductType(product.product_type) ? `נכתב בידי ${sellerName}, סופר סת"ם מאומת.` : `נמכר על ידי ${sellerName}, מוכר מאומת.`;
  return clip(`${title}. ${from} חותם - זירת המסחר לכלי קודש ויודאיקה.`, MAX_DESCRIPTION);
}

export function toFeedItem(product: any, seller: FeedSeller): FeedItem {
  const sellerName = clean(`${seller.first_name || ''} ${seller.last_name || ''}`) || 'חותם';
  const title = productTitle(product);
  const images = (Array.isArray(product.images) ? product.images : []).filter((src: unknown) => typeof src === 'string' && /^https:\/\//.test(src));
  const days = /^\d+$/.test(String(product.delivery_time ?? '')) ? Number(product.delivery_time) : null;
  return {
    id: String(product.id),
    title,
    description: productDescription(product, title, sellerName),
    link: `${SITE_URL}/products/${product.id}`,
    imageLink: images[0],
    additionalImageLinks: images.slice(1, 1 + MAX_EXTRA_IMAGES),
    price: money(Math.round(Number(product.price) * VAT_MULTIPLIER)),
    availability: 'in_stock',
    brand: sellerName,
    productType: `${isStamProductType(product.product_type) ? 'סת"ם' : 'יודאיקה'} > ${clean(product.product_type)}`,
    shippingPrice: money(Number(product.delivery_fee) > 0 ? Number(product.delivery_fee) : 0),
    maxHandlingDays: days !== null && days > 0 && days <= 30 ? days : null,
  };
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function renderFeed(items: FeedItem[]): string {
  const entries = items.map((item) => [
    '    <item>',
    `      <g:id>${xml(item.id)}</g:id>`,
    `      <title>${xml(item.title)}</title>`,
    `      <description>${xml(item.description)}</description>`,
    `      <link>${xml(item.link)}</link>`,
    `      <g:image_link>${xml(item.imageLink)}</g:image_link>`,
    ...item.additionalImageLinks.map((src) => `      <g:additional_image_link>${xml(src)}</g:additional_image_link>`),
    `      <g:availability>${item.availability}</g:availability>`,
    `      <g:price>${item.price}</g:price>`,
    '      <g:condition>new</g:condition>',
    `      <g:brand>${xml(item.brand)}</g:brand>`,
    '      <g:identifier_exists>no</g:identifier_exists>',
    `      <g:google_product_category>${xml(GOOGLE_CATEGORY)}</g:google_product_category>`,
    `      <g:product_type>${xml(item.productType)}</g:product_type>`,
    '      <g:shipping>',
    '        <g:country>IL</g:country>',
    `        <g:price>${item.shippingPrice}</g:price>`,
    '      </g:shipping>',
    ...(item.maxHandlingDays ? [`      <g:max_handling_time>${item.maxHandlingDays}</g:max_handling_time>`] : []),
    '    </item>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    '    <title>חותם - כלי קודש ויודאיקה</title>',
    `    <link>${SITE_URL}</link>`,
    '    <description>כל המוצרים באתר חותם</description>',
    ...entries,
    '  </channel>',
    '</rss>',
  ].join('\n');
}
