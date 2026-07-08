// Shared value/label source of truth for ספר תורה delivery-time estimates — used by both the
// seller's product form (src/app/seller/dashboard/page.tsx) and the product page display
// (src/app/products/[id]/ProductDetailsClient.tsx). A ספר תורה takes months to write, so it
// gets its own coarse-grained scale instead of the day-based one used by every other product.
export const TORAH_DELIVERY_TIME_OPTIONS: { value: string; label: string }[] = [
  { value: 'month', label: 'חודש' },
  { value: '2months', label: 'חודשיים' },
  { value: '6months', label: 'חצי שנה' },
  { value: 'year', label: 'שנה' },
];

export function getTorahDeliveryTimeLabel(value: string | undefined | null): string {
  return TORAH_DELIVERY_TIME_OPTIONS.find(o => o.value === value)?.label || 'בתיאום אישי';
}
