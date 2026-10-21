// Israeli phone numbers for SMS / voice notifications.

/**
 * Normalizes what a user typed into E.164 (+972…). Accepts 05X-XXXXXXX, 0X-XXXXXXX (landlines for
 * voice), +972…, 972…, with spaces/dashes/brackets. Returns null for anything that isn't a
 * plausible Israeli number.
 */
export function normalizeIsraeliPhone(input: unknown): string | null {
  let digits = String(input ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('972')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  // mobile: 5X + 7 digits (9 digits); landline: 2/3/4/8/9 + 7 digits (8 digits); 7X VoIP: 9 digits
  if (/^5\d{8}$/.test(digits) || /^7\d{8}$/.test(digits) || /^[23489]\d{7}$/.test(digits)) return `+972${digits}`;
  return null;
}

export const isMobile = (e164: string) => /^\+9725\d{8}$/.test(e164);

/** 050-123-4567 style for showing a stored number back to its owner. */
export function formatIsraeliPhone(e164: string | null | undefined) {
  if (!e164) return '';
  const local = '0' + e164.replace(/^\+972/, '');
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`; // 050-123-4567
  if (local.length === 9) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;   // 03-612-3456
  return local;
}

/** 050-•••-•567 for places where the full number isn't needed. */
export function maskIsraeliPhone(e164: string | null | undefined) {
  const f = formatIsraeliPhone(e164);
  return f ? f.replace(/^(\d{2,3})-\d{3}-\d(\d{3})$/, '$1-•••-•$2') : '';
}
