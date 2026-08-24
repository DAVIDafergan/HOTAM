"use client";

import { supabase } from '@/lib/supabase';

// Fire-and-forget activity logging for the admin dashboard's activity timeline / seller-
// onboarding funnel (see docs/add-activity-events-migration.sql). Never awaited by callers,
// never throws, never blocks the actual user-facing action being instrumented — a failed
// log write should never break a save/submit.
//
// Anonymous callers (no session yet — e.g. onboarding steps 1-3, before any account exists)
// get a persistent per-browser session id so those events can later be correlated with the
// account that completes signup, and still count in aggregate funnel stats even if it
// never does.
const SESSION_ID_KEY = 'hotam_activity_session_id';

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function logEvent(eventType: string, eventData?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/log-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          event_type: eventType,
          event_data: eventData ?? {},
          session_id: getOrCreateSessionId(),
        }),
        // Survives the page unloading right after (e.g. a redirect fired immediately after
        // logging a completed step).
        keepalive: true,
      });
    } catch {
      // Best-effort — activity logging must never surface an error to the user.
    }
  })();
}
