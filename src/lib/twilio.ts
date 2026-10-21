import 'server-only';

// Twilio over plain HTTPS (no SDK): SMS and text-to-speech calls in Hebrew. Server-only.
//
// Environment (Vercel → Project → Settings → Environment Variables):
//   TWILIO_ACCOUNT_SID   Account SID (AC…)
//   TWILIO_AUTH_TOKEN    Auth Token
//   TWILIO_SMS_FROM      Sender for SMS — an alphanumeric name such as HOTAM (supported in Israel
//                        without registration; recipients can't reply) or a Twilio number in E.164
//   TWILIO_VOICE_FROM    Twilio phone number (E.164) that places the voice calls
// Optional:
//   TWILIO_MESSAGING_SERVICE_SID  if set, SMS go through this Messaging Service instead of TWILIO_SMS_FROM
//   TWILIO_VOICE_NAME             text-to-speech voice, default Google.he-IL-Wavenet-A
//
// When the variables are missing, every send returns { ok: false, error: 'not-configured' } and
// nothing is sent, so the site works exactly as before until the keys are added.

const API = 'https://api.twilio.com/2010-04-01';

export type TwilioResult = { ok: true; sid: string } | { ok: false; error: string };

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  return sid && token ? { sid, token } : null;
}

export function smsConfigured() {
  return !!creds() && !!(process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || process.env.TWILIO_SMS_FROM?.trim());
}

export function voiceConfigured() {
  return !!creds() && !!process.env.TWILIO_VOICE_FROM?.trim();
}

async function post(path: string, form: Record<string, string>): Promise<TwilioResult> {
  const c = creds();
  if (!c) return { ok: false, error: 'not-configured' };
  try {
    const res = await fetch(`${API}/Accounts/${c.sid}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `twilio ${res.status}${data?.code ? ` #${data.code}` : ''}: ${data?.message || 'request failed'}` };
    return { ok: true, sid: String(data?.sid || '') };
  } catch (error: any) {
    return { ok: false, error: error?.name === 'TimeoutError' ? 'twilio timeout' : String(error?.message || error) };
  }
}

export async function sendSms(to: string, body: string): Promise<TwilioResult> {
  if (!smsConfigured()) return { ok: false, error: 'not-configured' };
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  return post('Messages.json', {
    To: to,
    Body: body,
    ...(service ? { MessagingServiceSid: service } : { From: process.env.TWILIO_SMS_FROM!.trim() }),
  });
}

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));

/** Places a call that reads `text` in Hebrew, twice, with a short pause between. */
export async function placeVoiceCall(to: string, text: string): Promise<TwilioResult> {
  if (!voiceConfigured()) return { ok: false, error: 'not-configured' };
  const voice = process.env.TWILIO_VOICE_NAME?.trim() || 'Google.he-IL-Wavenet-A';
  const say = `<Say language="he-IL" voice="${xml(voice)}">${xml(text)}</Say>`;
  const twiml = `<Response><Pause length="1"/>${say}<Pause length="2"/><Say language="he-IL" voice="${xml(voice)}">אחזור שוב.</Say>${say}</Response>`;
  return post('Calls.json', {
    To: to,
    From: process.env.TWILIO_VOICE_FROM!.trim(),
    Twiml: twiml,
    Timeout: '30', // seconds of ringing before giving up
  });
}
