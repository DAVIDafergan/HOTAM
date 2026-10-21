"use client";

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { ABANDONED_PAYMENT_AFTER_MS, STUCK_STATUSES, classifyStuckOrder } from '@/lib/stuck-orders';

// Everything that needs the admin, counted once and shared by the "דורש טיפול" queue on the
// overview and the badges in the navigation (before, each had its own queries, and the badges
// changed while you typed in the search box). Cheap head-count queries plus two small samples.

const DAY_MS = 864e5;
const WAITING_AFTER_MS = DAY_MS;          // buyer waiting this long for a seller reply
const WAITING_LOOKBACK_MS = 14 * DAY_MS;  // older silent chats are considered dead, not waiting

export type AdminAttention = {
  loaded: boolean;
  pendingStam: number;
  pendingJudaica: number;
  oldestPendingAt: string | null;
  stamUpgrades: number;
  stuckOrders: number;
  stuckMaxDays: number;
  awaitingDelivery: number;
  abandonedPayments: number;
  torahRequests: number;
  newInquiries: number;
  oldestInquiryAt: string | null;
  reports: number;
  flaggedChats: number;
  waitingChatIds: string[];
  sms: { installed: boolean; failed24h: number; sent24h: number; configured: { sms: boolean; voice: boolean } } | null;
};

const EMPTY: AdminAttention = {
  loaded: false, pendingStam: 0, pendingJudaica: 0, oldestPendingAt: null, stamUpgrades: 0, stuckOrders: 0, stuckMaxDays: 0,
  awaitingDelivery: 0, abandonedPayments: 0, torahRequests: 0, newInquiries: 0, oldestInquiryAt: null, reports: 0,
  flaggedChats: 0, waitingChatIds: [], sms: null,
};

/** Authorized GET/POST to an /api/admin/* route with the current session token. */
export async function adminFetch(db: SupabaseClient, url: string, init: RequestInit = {}) {
  const { data: { session } } = await db.auth.getSession();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}), Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `שגיאה ${res.status}`);
  return body;
}

/** Chats where the buyer wrote last, 1–14 days ago, and no seller answered since. */
async function loadWaitingChats(db: SupabaseClient): Promise<string[]> {
  const now = Date.now();
  const { data: chats } = await db.from('chats').select('id, participants')
    .lt('last_message_at', new Date(now - WAITING_AFTER_MS).toISOString())
    .gt('last_message_at', new Date(now - WAITING_LOOKBACK_MS).toISOString())
    .order('last_message_at', { ascending: false })
    .limit(150);
  if (!chats?.length) return [];
  const participantIds = Array.from(new Set(chats.flatMap((c: any) => c.participants || [])));
  const [{ data: sellerRows }, { data: msgs }] = await Promise.all([
    db.from('sellers').select('id').in('id', participantIds),
    db.from('messages').select('chat_id, sender_id, timestamp').in('chat_id', chats.map((c: any) => c.id)).order('timestamp', { ascending: false }).limit(1500),
  ]);
  const sellerIds = new Set((sellerRows || []).map((s: any) => String(s.id)));
  const lastSender = new Map<string, string>();
  for (const m of msgs || []) if (!lastSender.has(m.chat_id)) lastSender.set(m.chat_id, String(m.sender_id));
  return chats
    .filter((c: any) => {
      const sender = lastSender.get(c.id);
      // only chats that actually have a seller in them (buyer ↔ seller), last word from the buyer
      return sender && !sellerIds.has(sender) && (c.participants || []).some((p: string) => sellerIds.has(String(p)));
    })
    .map((c: any) => String(c.id));
}

export function useAdminAttention(enabled: boolean, refreshKey: number = 0): AdminAttention & { refresh: () => void } {
  const db = useSupabaseClient();
  const [state, setState] = useState<AdminAttention>(EMPTY);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const head = { count: 'exact' as const, head: true };
    const oldest = (q: any) => q.select('created_at').order('created_at', { ascending: true }).limit(1);

    (async () => {
      const [
        pendingStam, pendingJudaica, oldestPending, upgrades, stuckRows, awaiting, abandoned, torah,
        inquiries, oldestInquiry, reports, flagged,
      ] = await Promise.all([
        db.from('sellers').select('id', head).eq('is_approved', false).eq('seller_type', 'stam_scribe'),
        db.from('sellers').select('id', head).eq('is_approved', false).eq('seller_type', 'judaica_seller'),
        oldest(db.from('sellers')).eq('is_approved', false),
        db.from('sellers').select('id', head).eq('stam_upgrade_status', 'pending'),
        db.from('orders').select('id, status, paid_at, created_at').in('status', STUCK_STATUSES).limit(2000),
        db.from('orders').select('id', head).eq('status', 'paid'),
        db.from('orders').select('id', head).eq('status', 'pending_payment').lt('created_at', new Date(Date.now() - ABANDONED_PAYMENT_AFTER_MS).toISOString()),
        db.from('orders').select('id', head).eq('status', 'torah_request'),
        db.from('contact_messages').select('id', head).eq('status', 'new'),
        oldest(db.from('contact_messages')).eq('status', 'new'),
        db.from('reports').select('id', head),
        db.from('chats').select('id', head).eq('is_suspicious', true),
      ]);
      const now = new Date();
      const stuck = (stuckRows.data || []).map((o: any) => classifyStuckOrder(o, now)).filter(Boolean) as { days: number }[];
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        loaded: true,
        pendingStam: pendingStam.count ?? 0,
        pendingJudaica: pendingJudaica.error ? 0 : (pendingJudaica.count ?? 0),
        oldestPendingAt: (oldestPending.data as any)?.[0]?.created_at ?? null,
        // before the seller-types migration the column is missing → none
        stamUpgrades: upgrades.error ? 0 : (upgrades.count ?? 0),
        stuckOrders: stuck.length,
        stuckMaxDays: stuck.reduce((m, s) => Math.max(m, s.days), 0),
        awaitingDelivery: awaiting.count ?? 0,
        abandonedPayments: abandoned.count ?? 0,
        torahRequests: torah.count ?? 0,
        newInquiries: inquiries.count ?? 0,
        oldestInquiryAt: (oldestInquiry.data as any)?.[0]?.created_at ?? null,
        reports: reports.count ?? 0,
        flaggedChats: flagged.count ?? 0,
      }));

      // slower extras — fill in when ready, never block the counts above
      loadWaitingChats(db).then((ids) => { if (!cancelled) setState((prev) => ({ ...prev, waitingChatIds: ids })); }).catch(() => {});
      adminFetch(db, '/api/admin/notifications?mode=summary')
        .then((s) => { if (!cancelled) setState((prev) => ({ ...prev, sms: { installed: !!s.installed, failed24h: s.failed24h ?? 0, sent24h: s.sent24h ?? 0, configured: s.configured ?? { sms: false, voice: false } } })); })
        .catch(() => {});
    })().catch((error) => console.error('[admin attention] failed:', error?.message ?? error));

    return () => { cancelled = true; };
  }, [db, enabled, refreshKey, tick]);

  return { ...state, refresh };
}
