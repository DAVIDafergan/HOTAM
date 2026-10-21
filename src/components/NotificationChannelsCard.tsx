'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquareText, PhoneCall, Megaphone, ShieldCheck, Smartphone, Trash2, Pencil, Info } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

// Phone updates (SMS / automated voice call in Hebrew) next to the emails. Everything starts off:
// the user enters a number, confirms it with a one-time code (by SMS or by a call), and switches on
// the channels they want. They can switch them off or remove the number at any time.

type View = {
  ready: boolean;
  available: { sms: boolean; voice: boolean };
  phone: string;
  verified: boolean;
  isMobile: boolean;
  sms: boolean;
  voice: boolean;
  marketing: boolean;
};

export function NotificationChannelsCard({ defaultPhone = '', className = '' }: { defaultPhone?: string; className?: string }) {
  const db = useSupabaseClient();
  const { toast } = useToast();
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [want, setWant] = useState({ sms: false, voice: false, marketing: false });
  const [codeSentTo, setCodeSentTo] = useState<{ phone: string; channel: 'sms' | 'voice' } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const call = useCallback(async (method: 'GET' | 'POST', body?: Record<string, unknown>) => {
    const { data: { session } } = await db.auth.getSession();
    const res = await fetch('/api/notifications/phone', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'אירעה שגיאה. נסו שוב.');
    return data;
  }, [db]);

  useEffect(() => {
    call('GET').then((v: View) => { setView(v); if (v.phone) setPhone(v.phone); }).catch(() => setLoadError(true));
  }, [call]);

  useEffect(() => { if (!phone && defaultPhone) setPhone(defaultPhone); }, [defaultPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (err: any) { toast({ variant: 'destructive', title: err?.message || 'אירעה שגיאה' }); } finally { setBusy(null); }
  };

  const sendCode = (channel: 'sms' | 'voice') => run(`send-${channel}`, async () => {
    const r = await call('POST', { action: 'send-code', phone, channel });
    setCodeSentTo({ phone: r.phone, channel });
    setCode('');
    toast({ title: channel === 'sms' ? `שלחנו קוד ב-SMS למספר ${r.phone}` : `מתקשרים עכשיו למספר ${r.phone} עם הקוד` });
  });

  const verify = () => run('verify', async () => {
    let v: View = await call('POST', { action: 'verify', code });
    // apply the channels the user picked before verifying
    if (!view?.verified || editing) {
      v = await call('POST', { action: 'prefs', sms: want.sms && v.isMobile && v.available.sms, voice: want.voice && v.available.voice, marketing: want.marketing });
    }
    setView(v);
    setCodeSentTo(null);
    setEditing(false);
    toast({ variant: 'success', title: 'המספר אומת ונשמר' });
  });

  const toggle = (key: 'sms' | 'voice' | 'marketing', value: boolean) => run(key, async () => {
    setView(await call('POST', { action: 'prefs', [key]: value }));
  });

  const remove = () => run('remove', async () => {
    const v = await call('POST', { action: 'remove' });
    setView(v); setPhone(defaultPhone); setEditing(false); setCodeSentTo(null);
    toast({ title: 'המספר הוסר. לא יישלחו הודעות לטלפון.' });
  });

  const shell = `rounded-[1.75rem] border border-border/80 bg-card p-5 shadow-premium sm:p-7 ${className}`;
  const header = (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-accent-strong"><Smartphone className="h-5 w-5" strokeWidth={1.6} /></span>
      <div>
        <h3 className="font-body text-[22px] font-semibold leading-snug text-primary">עדכונים לטלפון</h3>
        <p className="mt-1 text-base font-light leading-relaxed text-muted-foreground">בנוסף למייל: הודעות SMS ו/או שיחה קולית בעברית על הודעות, הזמנות ועדכוני חשבון.</p>
      </div>
    </div>
  );

  if (loadError) return null;
  if (!view) return <div className={shell}>{header}<div className="mt-5 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div></div>;
  if (!view.ready || (!view.available.sms && !view.available.voice)) {
    return (
      <div className={shell}>
        {header}
        <p className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">האפשרות תיפתח בקרוב.</p>
      </div>
    );
  }

  const showForm = !view.verified || editing;

  return (
    <div className={shell}>
      {header}

      {showForm ? (
        <div className="mt-5 space-y-4">
          {!codeSentTo ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="notif-phone" className="text-sm font-medium text-primary">מספר טלפון</label>
                <Input id="notif-phone" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="050-1234567" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl text-left text-base" />
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-sm font-medium text-primary">איך לעדכן אותך?</legend>
                <ChoiceRow icon={<MessageSquareText className="h-4 w-4" />} label="הודעת SMS" checked={want.sms} disabled={!view.available.sms} onChange={(v) => setWant({ ...want, sms: v })} />
                <ChoiceRow icon={<PhoneCall className="h-4 w-4" />} label="שיחה קולית אוטומטית" checked={want.voice} disabled={!view.available.voice} onChange={(v) => setWant({ ...want, voice: v })} />
                <ChoiceRow icon={<Megaphone className="h-4 w-4" />} label="גם מבצעים ודיוורים (פרסומת)" checked={want.marketing} onChange={(v) => setWant({ ...want, marketing: v })} />
              </fieldset>
              <p className="text-xs leading-relaxed text-muted-foreground">כדי לוודא שהמספר שלך, נשלח אליו קוד אימות חד-פעמי.</p>
              <div className="flex flex-wrap gap-2">
                {view.available.sms && (
                  <Button type="button" onClick={() => sendCode('sms')} disabled={!!busy || !phone.trim() || (!want.sms && !want.voice)} className="h-11 px-5">
                    {busy === 'send-sms' && <Loader2 className="ml-1 h-4 w-4 animate-spin" />} שלחו לי קוד ב-SMS
                  </Button>
                )}
                {view.available.voice && (
                  <Button type="button" variant="outline" onClick={() => sendCode('voice')} disabled={!!busy || !phone.trim() || (!want.sms && !want.voice)} className="h-11 px-5">
                    {busy === 'send-voice' && <Loader2 className="ml-1 h-4 w-4 animate-spin" />} התקשרו אליי עם הקוד
                  </Button>
                )}
                {editing && <Button type="button" variant="ghost" onClick={() => setEditing(false)} className="h-11 rounded-full">ביטול</Button>}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-primary">
                {codeSentTo.channel === 'sms' ? 'שלחנו קוד בן 6 ספרות ב-SMS למספר ' : 'אנחנו מתקשרים עכשיו למספר '}
                <b dir="ltr">{codeSentTo.phone}</b>{codeSentTo.channel === 'voice' ? ' ונקריא את הקוד.' : '.'}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <label htmlFor="notif-code" className="text-sm font-medium text-primary">קוד אימות</label>
                  <Input id="notif-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-12 w-40 rounded-xl text-center text-lg tracking-[0.4em]" />
                </div>
                <Button type="button" onClick={verify} disabled={!!busy || code.length !== 6} className="h-12 px-6">
                  {busy === 'verify' && <Loader2 className="ml-1 h-4 w-4 animate-spin" />} אישור
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <button type="button" onClick={() => sendCode(codeSentTo.channel)} disabled={!!busy} className="min-h-[44px] font-medium text-accent-strong underline-offset-4 hover:underline disabled:opacity-50">שליחת קוד חדש</button>
                <button type="button" onClick={() => setCodeSentTo(null)} className="min-h-[44px] text-muted-foreground underline-offset-4 hover:underline">שינוי מספר</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary/60 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-primary">
              <ShieldCheck className="h-4 w-4 text-emerald-700" /> מספר מאומת: <b dir="ltr">{view.phone}</b>
            </span>
            <span className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(true); setWant({ sms: view.sms, voice: view.voice, marketing: view.marketing }); }} className="h-10 rounded-full gap-1"><Pencil className="h-3.5 w-3.5" /> שינוי</Button>
              <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={!!busy} className="h-10 rounded-full gap-1 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> הסרה</Button>
            </span>
          </div>
          <SwitchRow icon={<MessageSquareText className="h-4 w-4" />} label="הודעות SMS" hint={!view.isMobile ? 'זמין רק במספר נייד' : undefined}
            checked={view.sms} disabled={!!busy || !view.available.sms || !view.isMobile} onChange={(v) => toggle('sms', v)} />
          <SwitchRow icon={<PhoneCall className="h-4 w-4" />} label="שיחה קולית אוטומטית" hint="הודעה מוקלטת בעברית שמקריאה את העדכון"
            checked={view.voice} disabled={!!busy || !view.available.voice} onChange={(v) => toggle('voice', v)} />
          <SwitchRow icon={<Megaphone className="h-4 w-4" />} label="גם מבצעים ודיוורים (פרסומת)" hint="בלי זה תקבל/י לטלפון רק עדכונים על החשבון וההזמנות"
            checked={view.marketing} disabled={!!busy || (!view.sms && !view.voice)} onChange={(v) => toggle('marketing', v)} />
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        בהפעלה את/ה מאשר/ת לקבל מחותם הודעות SMS ו/או שיחות קוליות אוטומטיות לפי הבחירה שלך. לא נשלח הודעות בשבת ובחג, ושיחות רק בין 08:00 ל-21:30.
        אפשר לבטל בכל רגע כאן, או בקישור "להסרה" שבכל SMS. המיילים ממשיכים להגיע כרגיל.
      </p>
    </div>
  );
}

function ChoiceRow({ icon, label, checked, disabled, onChange }: { icon: React.ReactNode; label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border px-4 py-2.5 transition-colors ${disabled ? 'opacity-50' : 'hover:border-primary/30'}`}>
      <span className="flex items-center gap-2.5 text-sm font-medium text-primary"><span className="text-accent-strong">{icon}</span>{label}</span>
      <Switch checked={checked && !disabled} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

function SwitchRow({ icon, label, hint, checked, disabled, onChange }: { icon: React.ReactNode; label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-border px-4 py-2.5">
      <span className="flex items-start gap-2.5">
        <span className="mt-0.5 text-accent-strong">{icon}</span>
        <span>
          <span className="block text-sm font-medium text-primary">{label}</span>
          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export default NotificationChannelsCard;
