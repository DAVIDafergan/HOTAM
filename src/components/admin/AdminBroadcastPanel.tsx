"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, FlaskConical, ImagePlus, Loader2, Mail, Monitor, PenLine, Send,
  ShoppingBag, Smartphone, Sparkles, Trash2, UserRound, Users, Scroll, Store, History,
} from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { useToast } from '@/hooks/use-toast';
import { uploadImageViaApi } from '@/lib/image-upload';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  BROADCAST_AUDIENCE_LABELS, MAX_SUBJECT_LENGTH, NAME_PLACEHOLDER, finalSubject, isValidEmail,
  renderBroadcastEmail, validateBroadcastContent, type BroadcastAudience, type BroadcastContent,
} from '@/lib/broadcast-email';
import { cn } from '@/lib/utils';

const PREVIEW_SITE_URL = 'https://www.hotam.shop';

const AUDIENCES: { id: BroadcastAudience; hint: string; icon: React.ReactNode; involvesSellers: boolean }[] = [
  { id: 'all', hint: 'לקוחות וכל המוכרים', icon: <Users className="w-5 h-5" />, involvesSellers: true },
  { id: 'sellers', hint: 'סופרים ומוכרי יודאיקה', icon: <Store className="w-5 h-5" />, involvesSellers: true },
  { id: 'stam_scribes', hint: 'כותבי סת"ם', icon: <Scroll className="w-5 h-5" />, involvesSellers: true },
  { id: 'judaica_sellers', hint: 'חנויות ומוכרים', icon: <ShoppingBag className="w-5 h-5" />, involvesSellers: true },
  { id: 'customers', hint: 'כל הקונים הרשומים', icon: <UserRound className="w-5 h-5" />, involvesSellers: false },
];

interface Stats {
  counts: Record<BroadcastAudience, { approvedOnly: number; everyone: number }>;
  unsubscribeReady: boolean;
  optedOutCount: number;
  history: { created_at: string; event_data: any }[];
  adminEmail: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SectionTitle({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-accent font-black text-sm flex items-center justify-center">{step}</span>
      <div>
        <h3 className="font-headline font-black text-lg text-primary leading-tight">{title}</h3>
        {subtitle && <p className="text-xs font-medium text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export function AdminBroadcastPanel() {
  const db = useSupabaseClient();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [content, setContent] = useState<BroadcastContent>({
    subject: '', heading: '', body: '', imageUrl: null, ctaText: '', ctaUrl: '', isAdvertisement: true,
  });
  const [testEmail, setTestEmail] = useState('');
  const [testedSnapshot, setTestedSnapshot] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number } | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const { data: { session } } = await db.auth.getSession();
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }, [db]);

  const loadStats = useCallback(async () => {
    const { ok, data } = await call({ action: 'stats' });
    if (!ok) { setStatsError(data?.error || 'טעינת נתוני הנמענים נכשלה'); return; }
    setStatsError('');
    setStats(data);
    setTestEmail((current) => current || data.adminEmail || '');
  }, [call]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const update = (patch: Partial<BroadcastContent>) => setContent((prev) => ({ ...prev, ...patch }));
  const count = stats ? stats.counts[audience][approvedOnly ? 'approvedOnly' : 'everyone'] : null;
  const involvesSellers = AUDIENCES.find((a) => a.id === audience)?.involvesSellers ?? false;
  const contentProblem = validateBroadcastContent(content);
  const snapshot = JSON.stringify(content);
  const testedCurrentVersion = testedSnapshot === snapshot;

  const previewHtml = useMemo(() => renderBroadcastEmail(
    {
      ...content,
      subject: content.subject || 'נושא המייל',
      heading: content.heading || 'כותרת ההודעה',
      body: content.body || 'כאן יופיע תוכן ההודעה.\n\nאפשר לכתוב כמה פסקאות, להדגיש **מילים חשובות** ולהוסיף קישורים.',
    },
    { firstName: 'ישראל', unsubscribeUrl: '#', siteUrl: PREVIEW_SITE_URL },
  ).html, [content]);

  const insertName = () => {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : content.body.length;
    const next = content.body.slice(0, at) + NAME_PLACEHOLDER + content.body.slice(el ? el.selectionEnd : at);
    update({ body: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + NAME_PLACEHOLDER.length, at + NAME_PLACEHOLDER.length);
    });
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadImageViaApi(file, { client: db, onProgress: setUploadProgress });
      update({ imageUrl: url });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'העלאת התמונה נכשלה', description: error?.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendTest = async () => {
    if (contentProblem) { toast({ variant: 'destructive', title: contentProblem }); return; }
    if (!isValidEmail(testEmail)) { toast({ variant: 'destructive', title: 'כתובת המייל לניסיון אינה תקינה' }); return; }
    setIsTesting(true);
    const { ok, data } = await call({ action: 'test', content, testEmail: testEmail.trim() });
    setIsTesting(false);
    if (!ok) { toast({ variant: 'destructive', title: data?.error || 'שליחת מייל הניסיון נכשלה' }); return; }
    setTestedSnapshot(snapshot);
    toast({ variant: 'success', title: 'מייל ניסיון נשלח', description: `נשלח אל ${data.to}` });
  };

  const sendBroadcast = async () => {
    if (count === null) return;
    setIsSending(true);
    const { ok, data } = await call({ action: 'send', audience, approvedOnly, content, expectedCount: count });
    setIsSending(false);
    setConfirmOpen(false);
    if (!ok) {
      toast({ variant: 'destructive', title: 'הדיוור לא נשלח', description: data?.error });
      void loadStats();
      return;
    }
    setLastResult({ sent: data.sent, failed: data.failed });
    toast({
      variant: data.failed ? 'destructive' : 'success',
      title: data.failed ? `נשלח ל-${data.sent}, נכשל ל-${data.failed}` : `הדיוור נשלח ל-${data.sent} נמענים`,
    });
    void loadStats();
  };

  const canSend = !contentProblem && !!count && !!stats?.unsubscribeReady && !isUploading;

  return (
    <div className="space-y-6" data-broadcast-panel>
      <div className="relative overflow-hidden rounded-[2rem] bg-primary text-white p-6 sm:p-8 shadow-premium">
        <div className="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-accent/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Mail className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h2 className="font-headline font-black text-2xl">דיוור במייל</h2>
              <p className="text-white/60 text-sm font-medium">הודעה מעוצבת לכל הרשומים או לקבוצה מסוימת, עם תמונה, כפתור ומייל ניסיון</p>
            </div>
          </div>
          {stats && (
            <div className="flex gap-3 text-center">
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-2xl font-black text-accent tabular-nums" data-total-recipients>{stats.counts.all.everyone}</p>
                <p className="text-[11px] font-bold text-white/60">רשומים</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-2">
                <p className="text-2xl font-black tabular-nums">{stats.optedOutCount}</p>
                <p className="text-[11px] font-bold text-white/60">הוסרו מהתפוצה</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {stats && !stats.unsubscribeReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900" data-unsubscribe-missing>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-bold leading-relaxed">רשימת ההסרה מהתפוצה עדיין לא הותקנה במסד הנתונים. עד שתותקן אפשר לשלוח רק מיילי ניסיון, כדי שכל נמען יוכל להסיר את עצמו כנדרש בחוק.</p>
        </div>
      )}
      {statsError && <p className="text-sm font-bold text-destructive">{statsError}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        <div className="space-y-6 min-w-0">
          <section className="bg-white rounded-[2rem] shadow-premium border border-primary/5 p-5 sm:p-7">
            <SectionTitle step={1} title="למי שולחים" subtitle="כל כתובת מקבלת מייל אחד בלבד, גם אם היא רשומה גם כלקוח וגם כמוכר" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
              {AUDIENCES.map((a) => {
                const n = stats ? stats.counts[a.id][approvedOnly ? 'approvedOnly' : 'everyone'] : null;
                const active = audience === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    data-audience={a.id}
                    aria-pressed={active}
                    onClick={() => setAudience(a.id)}
                    className={cn(
                      'text-start rounded-2xl border-2 p-4 transition-all',
                      active ? 'border-accent bg-accent/10 shadow-md' : 'border-primary/5 bg-[#F8F9FA] hover:border-accent/40',
                      a.id === 'all' && 'col-span-2 sm:col-span-1 xl:col-span-2 2xl:col-span-1',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', active ? 'bg-primary text-accent' : 'bg-white text-primary/60')}>{a.icon}</span>
                      <span className="text-xl font-black text-primary tabular-nums" data-audience-count>{n ?? '—'}</span>
                    </div>
                    <p className="font-black text-sm text-primary">{BROADCAST_AUDIENCE_LABELS[a.id]}</p>
                    <p className="text-[11px] font-medium text-muted-foreground">{a.hint}</p>
                  </button>
                );
              })}
            </div>
            {involvesSellers && (
              <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#F8F9FA] px-4 py-3 cursor-pointer">
                <span>
                  <span className="block text-sm font-black text-primary">רק מוכרים מאושרים</span>
                  <span className="block text-[11px] font-medium text-muted-foreground">כבוי = כולל מוכרים שנרשמו וממתינים לאישור</span>
                </span>
                <Switch checked={approvedOnly} onCheckedChange={setApprovedOnly} data-approved-only />
              </label>
            )}
          </section>

          <section className="bg-white rounded-[2rem] shadow-premium border border-primary/5 p-5 sm:p-7 space-y-5">
            <SectionTitle step={2} title="תוכן המייל" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bc-subject" className="font-black text-primary">נושא</Label>
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{content.subject.length}/{MAX_SUBJECT_LENGTH}</span>
              </div>
              <Input id="bc-subject" value={content.subject} maxLength={MAX_SUBJECT_LENGTH} onChange={(e) => update({ subject: e.target.value })} placeholder="לדוגמה: מבצע לקראת החגים" className="h-12 rounded-xl font-bold" />
              {content.subject.trim() && (
                <p className="text-[11px] font-medium text-muted-foreground">בתיבת הדואר יופיע: <span className="font-bold text-primary" data-final-subject>{finalSubject(content)}</span></p>
              )}
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8F9FA] px-4 py-3 cursor-pointer">
              <span>
                <span className="block text-sm font-black text-primary">הודעה פרסומית</span>
                <span className="block text-[11px] font-medium text-muted-foreground">מבצעים ושיווק: החוק מחייב שהנושא יתחיל במילה &quot;פרסומת&quot;. לכבות רק בהודעת שירות (שינוי תנאים, עדכון מערכת).</span>
              </span>
              <Switch checked={content.isAdvertisement} onCheckedChange={(v) => update({ isAdvertisement: v })} data-ad-switch />
            </label>
            <div className="space-y-2">
              <Label htmlFor="bc-heading" className="font-black text-primary">כותרת בתוך המייל</Label>
              <Input id="bc-heading" value={content.heading} onChange={(e) => update({ heading: e.target.value })} placeholder={`לדוגמה: שלום ${NAME_PLACEHOLDER}, חג שמח!`} className="h-12 rounded-xl font-bold" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="bc-body" className="font-black text-primary">תוכן ההודעה</Label>
                <Button type="button" variant="outline" size="sm" onClick={insertName} className="h-8 rounded-full text-xs font-black gap-1.5">
                  <PenLine className="w-3.5 h-3.5" /> הוסף שם הנמען
                </Button>
              </div>
              <Textarea id="bc-body" ref={bodyRef} value={content.body} onChange={(e) => update({ body: e.target.value })} rows={9} placeholder="כתבו כאן את ההודעה. שורה ריקה מתחילה פסקה חדשה." className="rounded-xl font-medium leading-relaxed" />
              <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                <span className="font-black">{NAME_PLACEHOLDER}</span> יוחלף בשם הפרטי של כל נמען · <span className="font-black">**טקסט**</span> להדגשה · קישורים שמתחילים ב-https הופכים ללחיצים
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-primary">תמונה (לא חובה)</Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" data-image-input onChange={(e) => onPickImage(e.target.files?.[0])} />
              {content.imageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-primary/10 bg-[#F8F9FA]" data-image-attached>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={content.imageUrl} alt="" className="w-full max-h-64 object-contain" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} className="rounded-full font-black h-8 text-xs shadow">החלף</Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => update({ imageUrl: null })} className="rounded-full h-8 w-8 p-0 shadow" aria-label="הסר תמונה"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full rounded-2xl border-2 border-dashed border-primary/15 hover:border-accent bg-[#F8F9FA] py-8 flex flex-col items-center gap-2 text-primary/60 transition-colors"
                >
                  {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <ImagePlus className="w-7 h-7" />}
                  <span className="text-sm font-black">{isUploading ? `מעלה… ${uploadProgress}%` : 'הוספת תמונה'}</span>
                  <span className="text-[11px] font-medium">JPG / PNG / WEBP, תוצג ברוחב המייל</span>
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bc-cta-text" className="font-black text-primary">טקסט על הכפתור (לא חובה)</Label>
                <Input id="bc-cta-text" value={content.ctaText || ''} onChange={(e) => update({ ctaText: e.target.value })} placeholder="לדוגמה: לצפייה במבצע" className="h-12 rounded-xl font-bold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bc-cta-url" className="font-black text-primary">קישור הכפתור</Label>
                <Input id="bc-cta-url" dir="ltr" value={content.ctaUrl || ''} onChange={(e) => update({ ctaUrl: e.target.value })} placeholder="https://hotam.shop/search" className="h-12 rounded-xl font-bold text-left" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] shadow-premium border border-primary/5 p-5 sm:p-7 space-y-5">
            <SectionTitle step={3} title="בדיקה ושליחה" subtitle="מומלץ לשלוח קודם מייל ניסיון ולבדוק אותו בטלפון" />
            <div className="space-y-2">
              <Label htmlFor="bc-test" className="font-black text-primary">מייל ניסיון אל</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input id="bc-test" dir="ltr" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="name@example.com" className="h-12 rounded-xl font-bold text-left flex-1" />
                <Button type="button" variant="outline" onClick={sendTest} disabled={isTesting || isUploading} className="h-12 rounded-xl font-black gap-2 border-primary/20" data-send-test>
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} שלח מייל ניסיון
                </Button>
              </div>
              {testedCurrentVersion && (
                <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> מייל ניסיון של הגרסה הנוכחית נשלח</p>
              )}
            </div>
            {contentProblem && (content.subject || content.heading || content.body) && (
              <p className="text-xs font-bold text-muted-foreground">חסר: {contentProblem}</p>
            )}
            <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canSend} className="w-full h-14 rounded-2xl bg-accent text-primary hover:bg-accent/90 font-black text-base gap-2 shadow-lg" data-open-send>
              <Send className="w-5 h-5" /> שליחה ל-{count ?? '…'} נמענים
            </Button>
            {lastResult && (
              <div className={cn('rounded-2xl p-4 text-sm font-bold', lastResult.failed ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800')} data-send-result>
                {lastResult.failed ? `נשלח ל-${lastResult.sent} נמענים, נכשל ל-${lastResult.failed}. אפשר לבדוק את יומן השליחות ב-Resend.` : `הדיוור נשלח בהצלחה ל-${lastResult.sent} נמענים.`}
              </div>
            )}
          </section>
        </div>

        <div className="xl:sticky xl:top-28 space-y-6 min-w-0">
          <section className="bg-white rounded-[2rem] shadow-premium border border-primary/5 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="font-headline font-black text-primary flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> תצוגה מקדימה</h3>
              <div className="flex rounded-full bg-[#F8F9FA] p-1">
                {(['desktop', 'mobile'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setPreviewMode(mode)} aria-label={mode === 'desktop' ? 'תצוגת מחשב' : 'תצוגת נייד'}
                    className={cn('w-9 h-8 rounded-full flex items-center justify-center transition-colors', previewMode === mode ? 'bg-primary text-accent' : 'text-primary/50')}>
                    {mode === 'desktop' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-[#F1F3F5] border border-primary/5 overflow-hidden">
              <div className="bg-white border-b border-primary/5 px-4 py-3 text-right" dir="rtl">
                <p className="text-[11px] font-bold text-muted-foreground">מאת: Hotam Shop &lt;updates@hotam.shop&gt;</p>
                <p className="text-sm font-black text-primary truncate">{content.subject.trim() ? finalSubject(content) : 'נושא המייל'}</p>
              </div>
              <div className="flex justify-center p-3">
                <iframe
                  title="תצוגה מקדימה של המייל"
                  srcDoc={previewHtml}
                  sandbox=""
                  data-broadcast-preview
                  className={cn('bg-[#f5f1e8] rounded-xl border-0 transition-all', previewMode === 'mobile' ? 'w-[375px] max-w-full' : 'w-full')}
                  style={{ height: 640 }}
                />
              </div>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground mt-3 px-1">בתצוגה השם {NAME_PLACEHOLDER} מוחלף בשם לדוגמה &quot;ישראל&quot;.</p>
          </section>

          <section className="bg-white rounded-[2rem] shadow-premium border border-primary/5 p-5 sm:p-6" data-broadcast-history>
            <h3 className="font-headline font-black text-primary flex items-center gap-2 mb-4"><History className="w-4 h-4 text-accent" /> דיוורים אחרונים</h3>
            {!stats || stats.history.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">עוד לא נשלחו דיוורים.</p>
            ) : (
              <ul className="divide-y divide-primary/5">
                {stats.history.map((h, i) => (
                  <li key={i} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-primary truncate">{h.event_data?.subject}</p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {BROADCAST_AUDIENCE_LABELS[h.event_data?.audience as BroadcastAudience] || h.event_data?.audience} · {formatDateTime(h.created_at)}
                        {h.event_data?.admin_email ? ` · ${h.event_data.admin_email}` : ''}
                      </p>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums', h.event_data?.failed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                      {h.event_data?.sent}{h.event_data?.failed ? ` / ${h.event_data.failed} נכשלו` : ' נשלחו'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !isSending && setConfirmOpen(open)}>
        <AlertDialogContent dir="rtl" className="rounded-[2rem]">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle className="font-headline font-black text-primary text-xl">לשלוח את הדיוור?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-right text-sm">
                <div className="rounded-2xl bg-[#F8F9FA] p-4 space-y-1.5 text-primary">
                  <p><span className="font-black">קהל:</span> {BROADCAST_AUDIENCE_LABELS[audience]}{involvesSellers && audience !== 'customers' ? (approvedOnly ? ' (מוכרים מאושרים בלבד)' : ' (כולל מוכרים ממתינים)') : ''}</p>
                  <p><span className="font-black">נמענים:</span> <span data-confirm-count>{count}</span></p>
                  <p className="truncate"><span className="font-black">נושא:</span> {finalSubject(content)}</p>
                </div>
                {!testedCurrentVersion && (
                  <p className="flex items-start gap-2 font-bold text-amber-700"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> לא נשלח מייל ניסיון לגרסה הזו של ההודעה.</p>
                )}
                <p className="font-medium text-muted-foreground">אי אפשר לבטל דיוור אחרי שנשלח.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void sendBroadcast(); }}
              disabled={isSending}
              className="rounded-full bg-accent text-primary hover:bg-accent/90 font-black gap-2"
              data-confirm-send
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSending ? 'שולח…' : `כן, לשלוח ל-${count}`}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isSending} className="rounded-full font-black">ביטול</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
