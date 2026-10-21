"use client";

import { useState, type ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Mail,
  MessageCircle,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  Headphones,
  Inbox,
  PhoneCall,
} from 'lucide-react';
import Link from 'next/link';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PLATFORM_WHATSAPP_NUMBER, PLATFORM_WHATSAPP_DISPLAY } from '@/lib/constants';

const CONTACT_EMAIL = 'DA@101.ORG.IL';
const WHATSAPP_HREF = `https://wa.me/${PLATFORM_WHATSAPP_NUMBER}`;
const BUSINESS_HOURS = "א'-ה' 09:00 - 18:00";

// Stored in contact_messages.subject so the admin inbox can see what each inquiry is about.
const CONTACT_TOPICS = ['רכישה והזמנות', 'כשרות ובדיקה', 'הצטרפות כסופר', 'עזרה טכנית', 'אחר'] as const;

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: 'איך עובד קוד המסירה?',
    a: 'אחרי הרכישה נשלח אליכם במייל קוד סודי. קבלו את המוצר מהסופר, בדקו שהוא תקין ומתאים להזמנה — ורק אז מסרו לו את הקוד. הקוד הוא שמשחרר את התשלום לסופר.',
  },
  {
    q: 'איך מצטרפים כסופר?',
    a: (
      <>
        נרשמים דרך <Link href="/onboarding/seller" className="font-bold text-primary underline decoration-accent underline-offset-4">עמוד ההצטרפות לסופרים</Link>, ממלאים פרופיל ודוגמאות כתיבה, והצוות שלנו מאשר את הפרופיל לפני שהוא מופיע באתר.
      </>
    ),
  },
  {
    q: 'איך מזמינים ספר תורה?',
    a: 'ספרי תורה וספרי הפטרות מוזמנים בתיאום אישי: משאירים בקשה בעמוד המוצר, ונציג של חותם חוזר אליכם לתיאום פגישה והתרשמות.',
  },
  {
    q: 'האם המחירים באתר כוללים מע״מ?',
    a: 'כן. כל המחירים המוצגים באתר כוללים מע״מ.',
  },
];

export default function ContactPageClient() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/80 via-secondary/30 to-background pb-28 pt-32 text-primary md:pb-36 md:pt-40">
        <div className="container relative mx-auto max-w-5xl px-4 text-center">
          <p className="eyebrow eyebrow-center">אנחנו כאן בשבילכם</p>
          <h1 className="mt-4 font-headline text-[40px] font-semibold leading-tight md:text-[60px]">דברו עם חותם</h1>
          <p className="lead mx-auto mt-4 max-w-xl">
            שאלה על רכישה, כשרות או הצטרפות כסופר? בחרו את הדרך הנוחה לכם — ואנחנו נחזור אליכם.
          </p>
        </div>
      </section>

      <main className="container mx-auto max-w-5xl px-4 pb-24">
        {/* Quick channels — overlap the hero */}
        <div className="relative z-10 -mt-16 grid gap-3 sm:grid-cols-3 md:-mt-20 md:gap-5">
          <ChannelCard
            href={WHATSAPP_HREF}
            external
            highlight
            icon={<MessageCircle className="h-6 w-6" />}
            title="וואטסאפ"
            value={PLATFORM_WHATSAPP_DISPLAY}
            note="הדרך המהירה ביותר"
          />
          <ChannelCard
            href={`mailto:${CONTACT_EMAIL}`}
            icon={<Mail className="h-6 w-6" />}
            title="אימייל"
            value={CONTACT_EMAIL}
            valueDir="ltr"
            note="לפניות מפורטות"
          />
          <ChannelCard
            icon={<Clock className="h-6 w-6" />}
            title="שעות פעילות"
            value={BUSINESS_HOURS}
            note="ירושלים, ישראל"
          />
        </div>

        <div className="mt-12 grid gap-8 md:mt-16 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          <aside className="space-y-6 lg:col-span-2">
            <div className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-premium md:p-7">
              <h2 className="flex items-center gap-2 font-body text-xl font-semibold text-primary">
                <Headphones className="h-5 w-5 text-accent-strong" /> מה קורה אחרי שפונים?
              </h2>
              <ol className="mt-5 space-y-5">
                <Step n={1} icon={<Inbox className="h-4 w-4" />} title="הפנייה מגיעה אלינו" text="כל פנייה נכנסת לתיבה של צוות חותם ונבדקת." />
                <Step n={2} icon={<PhoneCall className="h-4 w-4" />} title="חוזרים אליכם" text={`במייל, בטלפון או בוואטסאפ — בשעות הפעילות (${BUSINESS_HOURS}).`} />
                <Step n={3} icon={<CheckCircle2 className="h-4 w-4" />} title="מלווים עד הסוף" text="עד שהשאלה נפתרה או שההזמנה הגיעה אליכם." />
              </ol>
            </div>

            <div className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-premium md:p-7">
              <h2 className="font-body text-xl font-semibold text-primary">שאלות נפוצות</h2>
              <Accordion type="single" collapsible dir="rtl" className="mt-2">
                {FAQ_ITEMS.map((item, i) => (
                  <AccordionItem key={item.q} value={`faq-${i}`} className="border-border/70 last:border-b-0">
                    <AccordionTrigger className="gap-3 py-4 text-right text-[15px] font-semibold text-primary hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-right text-[15px] leading-relaxed text-primary/75">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <div className="flex items-center gap-3 rounded-[1.5rem] bg-emerald-50/70 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium leading-relaxed text-emerald-900">
                כל הפניות באתר מוצפנות ומטופלות בסטנדרט הגבוה ביותר.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-12 flex justify-center">
          <Button variant="ghost" asChild className="gap-2 text-sm">
            <Link href="/">חזרה לדף הבית <ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function ChannelCard({
  icon, title, value, note, href, external, highlight, valueDir,
}: {
  icon: ReactNode; title: string; value: string; note: string;
  href?: string; external?: boolean; highlight?: boolean; valueDir?: 'ltr' | 'rtl';
}) {
  const body = (
    <div
      className={cn(
        "group flex h-full items-center gap-4 rounded-[1.75rem] border p-5 text-right shadow-premium transition-shadow duration-300 sm:flex-col sm:items-start sm:p-6",
        highlight ? "border-accent/50 bg-card ring-1 ring-accent/25" : "border-border/70 bg-card",
        href && "hover:shadow-premium-lg",
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors",
          highlight ? "bg-accent text-primary" : "bg-secondary/70 text-primary",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <p className="mt-0.5 truncate text-[17px] font-bold text-primary" dir={valueDir}>{value}</p>
        <p className={cn("mt-1 text-[13px] font-medium", highlight ? "text-accent-strong" : "text-muted-foreground")}>{note}</p>
      </div>
      {href && <ArrowLeft className="h-4 w-4 shrink-0 text-primary/30 transition-transform group-hover:-translate-x-1 sm:hidden" />}
    </div>
  );

  if (!href) return body;
  return (
    <a
      href={href}
      className="block rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {body}
    </a>
  );
}

function Step({ n, icon, title, text }: { n: number; icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
        {icon}
        <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-foreground num">{n}</span>
      </span>
      <div>
        <p className="text-[15px] font-bold text-primary">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function ContactForm() {
  const db = useSupabaseClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [topic, setTopic] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const updateField = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({
        variant: 'destructive',
        title: 'חסרים פרטים',
        description: 'יש למלא שם, אימייל והודעה לפני השליחה.',
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await db.from('contact_messages').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      subject: topic || null,
      message: form.message.trim(),
    });
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'שליחת הפנייה נכשלה',
        description: error.message || 'אנא נסו שוב מאוחר יותר, או פנו אלינו בוואטסאפ.',
      });
      return;
    }

    setIsSubmitted(true);
    setForm({ name: '', email: '', phone: '', message: '' });
    setTopic('');
    toast({ variant: "success", title: 'הפנייה נשלחה בהצלחה', description: 'נחזור אליכם בהקדם האפשרי.' });
  };

  if (isSubmitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-border/70 bg-card p-10 text-center shadow-premium md:p-14">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="mt-6 font-headline text-[30px] font-semibold text-primary">הפנייה התקבלה!</h2>
        <p className="mt-2 max-w-sm text-primary/85">תודה שפניתם אלינו. צוות חותם יחזור אליכם בהקדם האפשרי.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setIsSubmitted(false)} className="px-6">
            שליחת פנייה נוספת
          </Button>
          <Button asChild className="gap-2 px-6">
            <Link href="/search?view=all">לכל המוצרים <ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-premium md:p-9">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Send className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-body text-2xl font-semibold text-primary md:text-[28px]">השאירו לנו הודעה</h2>
          <p className="text-sm text-muted-foreground">נחזור אליכם בשעות הפעילות</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5 text-right">
        <fieldset className="space-y-2.5">
          <legend className="mb-2.5 text-sm font-semibold text-primary">במה נוכל לעזור?</legend>
          <div className="flex flex-wrap gap-2">
            {CONTACT_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(prev => (prev === t ? '' : t))}
                aria-pressed={topic === t}
                className={cn(
                  "min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  topic === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-primary/80 hover:border-primary/40 hover:text-primary",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="contact-name" label="שם מלא" required>
            <Input
              id="contact-name"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="ישראל ישראלי"
              
              required
            />
          </Field>
          <Field id="contact-phone" label="טלפון" hint="אופציונלי">
            <Input
              id="contact-phone"
              type="tel"
              dir="ltr"
              value={form.phone}
              onChange={e => updateField('phone', e.target.value)}
              placeholder="050-0000000"
              className="text-right"
            />
          </Field>
        </div>
        <Field id="contact-email" label="אימייל" required>
          <Input
            id="contact-email"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
            placeholder="your@email.com"
            className="text-right"
            required
          />
        </Field>
        <Field id="contact-message" label="הודעה" required>
          <Textarea
            id="contact-message"
            value={form.message}
            onChange={e => updateField('message', e.target.value)}
            placeholder="כתבו לנו במה נוכל לעזור..."
            className="min-h-36 resize-none"
            required
          />
        </Field>

        <div className="flex flex-col-reverse items-stretch gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg" className="gap-2 px-10"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            שליחת הפנייה
          </Button>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center gap-1.5 text-sm font-semibold text-primary/75 transition-colors hover:text-primary"
          >
            <MessageCircle className="h-4 w-4 text-emerald-700" /> דחוף? כתבו לנו בוואטסאפ
          </a>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {required && <span className="text-accent-strong">*</span>}
        {hint && <span className="text-[13px] font-normal text-muted-foreground">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}
