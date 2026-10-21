// Hebrew labels for the SMS / voice log (notification_log). Client-safe (no server imports).

export const NOTIFY_KIND_LABELS: Record<string, string> = {
  chat: 'הודעה חדשה בצ׳אט',
  order_paid_buyer: 'אישור הזמנה לקונה',
  order_paid_seller: 'הזמנה חדשה למוכר',
  order_reminder: 'תזכורת למוכר על הזמנה',
  account: 'עדכון חשבון',
  broadcast: 'דיוור',
  verify_code: 'קוד אימות טלפון',
};

export const NOTIFY_CHANNEL_LABELS: Record<string, string> = { sms: 'SMS', voice: 'שיחה קולית' };

const SKIP_REASONS: Record<string, string> = {
  'not-configured': 'Twilio עוד לא מחובר',
  throttled: 'הגבלת כמות למשתמש',
  night: 'שעות הלילה',
  shabbat: 'שבת / חג',
  'no-optout-link': 'לא נוצר קישור הסרה',
};

export type NotifyStatusTone = 'sent' | 'failed' | 'skipped' | 'pending';

export function notifyStatusInfo(status: string): { label: string; tone: NotifyStatusTone } {
  if (status === 'sent') return { label: 'נשלח', tone: 'sent' };
  if (status === 'failed') return { label: 'נכשל', tone: 'failed' };
  if (status === 'reserved') return { label: 'בשליחה', tone: 'pending' };
  if (status.startsWith('skipped:')) {
    const reason = status.slice('skipped:'.length);
    return { label: `דולג — ${SKIP_REASONS[reason] || reason}`, tone: 'skipped' };
  }
  return { label: status, tone: 'skipped' };
}

export const NOTIFY_TONE_CLASSES: Record<NotifyStatusTone, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-slate-100 text-slate-600 border-slate-200',
  pending: 'bg-sky-50 text-sky-700 border-sky-100',
};
