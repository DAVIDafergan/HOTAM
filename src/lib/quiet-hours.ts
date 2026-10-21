import 'server-only';
import { HebrewCalendar, Location, flags } from '@hebcal/core';

// When not to ring or text people. Email is passive and still goes out as usual; SMS and calls
// are skipped (not queued) during these windows.
//   - Shabbat and Yom Tov: from Jerusalem candle lighting (the earliest in Israel) until Jerusalem
//     havdalah (8.5°) + 20 minutes. No SMS and no calls.
//   - Night (Israel time): no calls between 21:30 and 08:00; no promotional SMS between 21:00 and 08:00.

const JERUSALEM = Location.lookup('Jerusalem')!;
let cache: { day: string; windows: { from: Date; to: Date }[] } | null = null;

function restWindows(now: Date) {
  const day = now.toISOString().slice(0, 10);
  if (cache?.day === day) return cache.windows;
  const events = HebrewCalendar.calendar({
    start: new Date(now.getTime() - 3 * 864e5),
    end: new Date(now.getTime() + 4 * 864e5),
    location: JERUSALEM, candlelighting: true, il: true, havdalahDeg: 8.5,
  });
  const candles = events.filter((e) => e.getFlags() & flags.LIGHT_CANDLES).map((e: any) => e.eventTime as Date).filter(Boolean);
  const havdalot = events.filter((e) => (e.getFlags() & flags.LIGHT_CANDLES_TZEIS) || /^Havdalah/.test(e.getDesc())).map((e: any) => e.eventTime as Date).filter(Boolean);
  const windows = candles.map((c) => {
    const h = havdalot.find((x) => x > c);
    return h ? { from: c, to: new Date(h.getTime() + 20 * 60 * 1000) } : null;
  }).filter(Boolean) as { from: Date; to: Date }[];
  cache = { day, windows };
  return windows;
}

export function isShabbatOrYomTov(now = new Date()) {
  try { return restWindows(now).some((w) => now >= w.from && now < w.to); } catch { return false; }
}

/** Minutes since midnight, Israel time. */
function israelMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Why this channel must not be used right now, or null when it's fine. */
export function quietReason(channel: 'sms' | 'voice', opts: { marketing?: boolean } = {}, now = new Date()): string | null {
  if (isShabbatOrYomTov(now)) return 'shabbat';
  const min = israelMinutes(now);
  if (channel === 'voice' && (min >= 21 * 60 + 30 || min < 8 * 60)) return 'night';
  if (channel === 'sms' && opts.marketing && (min >= 21 * 60 || min < 8 * 60)) return 'night';
  return null;
}
