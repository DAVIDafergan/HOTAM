// Orders that have waited too long in a state that needs someone to act. Shared by the admin
// overview ("דורש טיפול") and the sales log's "תקועות" filter, so both count the same thing.
// Unfinished checkouts (pending_payment) are not stuck — nobody can act on them — and are
// counted separately as "נטישת תשלום" (see isAbandonedPayment).

export type StuckKind = 'awaiting_delivery' | 'torah_request';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an order may sit in each state before it counts as stuck. */
export const STUCK_THRESHOLDS: Record<StuckKind, { status: string; afterMs: number; label: string; hint: string }> = {
  awaiting_delivery: { status: 'paid', afterMs: 10 * DAY_MS, label: 'שולמה ולא נמסרה', hint: 'עברו יותר מ-10 ימים מהתשלום בלי שהמוכר הזין קוד מסירה' },
  torah_request: { status: 'torah_request', afterMs: 7 * DAY_MS, label: 'בקשת ספר תורה ללא טיפול', hint: 'עברו יותר מ-7 ימים מהבקשה' },
};

export type StuckInfo = { kind: StuckKind; days: number; since: Date };

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The stuck reason for an order, or null. The clock starts at payment for paid orders. */
export function classifyStuckOrder(order: { status?: string; paid_at?: any; created_at?: any }, now: Date = new Date()): StuckInfo | null {
  for (const [kind, rule] of Object.entries(STUCK_THRESHOLDS) as [StuckKind, (typeof STUCK_THRESHOLDS)[StuckKind]][]) {
    if (order.status !== rule.status) continue;
    const since = (kind === 'awaiting_delivery' ? toDate(order.paid_at) : null) || toDate(order.created_at);
    if (!since) return null;
    const age = now.getTime() - since.getTime();
    if (age < rule.afterMs) return null;
    return { kind, days: Math.floor(age / DAY_MS), since };
  }
  return null;
}

export const STUCK_STATUSES = Object.values(STUCK_THRESHOLDS).map((rule) => rule.status);

/** A checkout the buyer started and didn't finish within this time counts as abandoned. */
export const ABANDONED_PAYMENT_AFTER_MS = 2 * DAY_MS;

export function isAbandonedPayment(order: { status?: string; created_at?: any }, now: Date = new Date()): boolean {
  if (order.status !== 'pending_payment') return false;
  const since = toDate(order.created_at);
  return !!since && now.getTime() - since.getTime() >= ABANDONED_PAYMENT_AFTER_MS;
}
