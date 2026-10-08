// Admin broadcast ("דיוור") email: audiences + the one renderer used both for the live preview
// in /admin and for the email that is actually sent, so what the admin sees is what goes out.
// No server-only imports here — this file is bundled into the admin page too.

export const BROADCAST_AUDIENCES = ['all', 'sellers', 'stam_scribes', 'judaica_sellers', 'customers'] as const;
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export const BROADCAST_AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: 'כל הרשומים',
  sellers: 'כל המוכרים',
  stam_scribes: 'סופרי סת"ם',
  judaica_sellers: 'מוכרי יודאיקה',
  customers: 'לקוחות',
};

export const NAME_PLACEHOLDER = '{שם}';
// Canonical host (hotam.shop redirects to www); mail clients load the logo without a redirect.
export const EMAIL_LOGO_URL = 'https://www.hotam.shop/icon-192.png';
export const AD_SUBJECT_PREFIX = 'פרסומת';
export const MAX_SUBJECT_LENGTH = 150;
export const MAX_BODY_LENGTH = 8000;

export interface BroadcastContent {
  subject: string;
  heading: string;
  body: string;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  isAdvertisement: boolean;
}

export function isBroadcastAudience(value: unknown): value is BroadcastAudience {
  return typeof value === 'string' && (BROADCAST_AUDIENCES as readonly string[]).includes(value);
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Israeli anti-spam law: an advertisement's subject must open with the word "פרסומת". */
export function finalSubject(content: Pick<BroadcastContent, 'subject' | 'isAdvertisement'>, isTest = false) {
  const subject = content.subject.trim();
  const withPrefix = content.isAdvertisement && !subject.startsWith(AD_SUBJECT_PREFIX) ? `${AD_SUBJECT_PREFIX}: ${subject}` : subject;
  return isTest ? `[ניסיון] ${withPrefix}` : withPrefix;
}

/** Returns the first problem with the content, or null when it can be sent. */
export function validateBroadcastContent(content: Partial<BroadcastContent>): string | null {
  if (!String(content.subject ?? '').trim()) return 'יש למלא נושא למייל';
  if (String(content.subject).length > MAX_SUBJECT_LENGTH) return `הנושא ארוך מדי (עד ${MAX_SUBJECT_LENGTH} תווים)`;
  if (!String(content.body ?? '').trim()) return 'יש לכתוב את תוכן ההודעה';
  if (String(content.body).length > MAX_BODY_LENGTH) return `התוכן ארוך מדי (עד ${MAX_BODY_LENGTH} תווים)`;
  if (content.imageUrl && !isHttpsUrl(content.imageUrl)) return 'כתובת התמונה אינה תקינה';
  const hasCtaText = !!String(content.ctaText ?? '').trim();
  const hasCtaUrl = !!String(content.ctaUrl ?? '').trim();
  if (hasCtaText !== hasCtaUrl) return 'לכפתור צריך גם טקסט וגם קישור';
  if (hasCtaUrl && !isHttpsUrl(content.ctaUrl)) return 'קישור הכפתור צריך להתחיל ב-https://';
  return null;
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function personalize(text: string, firstName?: string | null) {
  const name = String(firstName ?? '').trim();
  return text
    .split(NAME_PLACEHOLDER).join(name)
    .replace(/[ \t]+([,.!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

// Escaped text → links for bare https URLs, **bold**, line breaks; blank lines split paragraphs.
function bodyToHtml(body: string) {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph.trim())
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#111827;">$1</strong>')
        .replace(/(https:\/\/[^\s<]+[^\s<.,!?)])/g, '<a href="$1" style="color:#9a7b1c;text-decoration:underline;">$1</a>')
        .replace(/\n/g, '<br>');
      return `<p style="margin:0 0 18px;font-size:16px;line-height:1.85;color:#374151;">${html}</p>`;
    })
    .join('');
}

export interface RenderOptions {
  firstName?: string | null;
  unsubscribeUrl?: string | null;
  siteUrl: string;
}

export function renderBroadcastEmail(content: BroadcastContent, { firstName, unsubscribeUrl, siteUrl }: RenderOptions) {
  // The heading is optional; without one the subject is shown as the email's title.
  const heading = personalize(String(content.heading ?? '').trim() || content.subject.trim(), firstName);
  const body = personalize(content.body, firstName);
  const ctaText = String(content.ctaText ?? '').trim();
  const ctaUrl = String(content.ctaUrl ?? '').trim();
  const hasCta = !!ctaText && isHttpsUrl(ctaUrl);
  const imageUrl = content.imageUrl && isHttpsUrl(content.imageUrl) ? content.imageUrl : null;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f1e8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f1e8;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="max-width:620px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(212,175,55,0.25);font-family:Arial,'Segoe UI',Tahoma,sans-serif;">
<tr><td align="center" style="background:#111827;padding:30px 24px 26px;">
<a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
<img src="${escapeHtml(EMAIL_LOGO_URL)}" width="56" height="56" alt="HOTAM" style="display:block;margin:0 auto 12px;border-radius:16px;border:1px solid rgba(212,175,55,0.45);">
<span style="display:block;color:#d4af37;font-size:22px;font-weight:900;letter-spacing:6px;">HOTAM</span>
<span style="display:block;color:rgba(255,255,255,0.6);font-size:12px;font-weight:700;letter-spacing:1px;margin-top:6px;">סת״ם ויודאיקה מהסופר אליך</span>
</a>
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background:#d4af37;">&nbsp;</td></tr>
${imageUrl ? `<tr><td style="padding:24px 24px 0;"><img src="${escapeHtml(imageUrl)}" width="572" alt="" style="display:block;width:100%;max-width:572px;height:auto;border-radius:18px;"></td></tr>` : ''}
<tr><td dir="rtl" style="padding:28px 32px 8px;text-align:right;">
<h1 style="margin:0 0 18px;font-size:26px;line-height:1.35;font-weight:900;color:#111827;">${escapeHtml(heading)}</h1>
${bodyToHtml(body)}
</td></tr>
${hasCta ? `<tr><td align="center" style="padding:4px 32px 32px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#d4af37;color:#111827;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:16px;font-weight:900;">${escapeHtml(ctaText)}</a></td></tr>` : ''}
<tr><td dir="rtl" style="padding:22px 32px 26px;background:#faf8f3;border-top:1px solid #eee6d3;text-align:center;">
<p style="margin:0;font-size:12px;line-height:1.8;color:#6b7280;">קיבלת את המייל הזה כי נרשמת לאתר <a href="${escapeHtml(siteUrl)}" style="color:#9a7b1c;text-decoration:none;font-weight:700;">HOTAM</a>.</p>
${unsubscribeUrl ? `<p style="margin:6px 0 0;font-size:12px;line-height:1.8;color:#6b7280;">לא מעוניין/ת לקבל עדכונים? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">להסרה מרשימת התפוצה</a></p>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    '',
    body.trim().replace(/\*\*(.+?)\*\*/g, '$1'),
    hasCta ? `\n${ctaText}: ${ctaUrl}` : '',
    '\n—\nHOTAM · ' + siteUrl,
    unsubscribeUrl ? `להסרה מרשימת התפוצה: ${unsubscribeUrl}` : '',
  ].filter((line) => line !== '').join('\n');

  return { html, text };
}
