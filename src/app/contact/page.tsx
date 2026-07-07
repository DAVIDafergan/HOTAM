
"use client";

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Mail,
  MessageCircle,
  MapPin,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { useToast } from '@/hooks/use-toast';

export default function ContactPage() {
  const formattedPhone = '055-667-4329';
  const whatsappPhoneIntl = '972556674329';
  const whatsappHref = `https://wa.me/${whatsappPhoneIntl}`;
  const contactEmail = 'DA@101.ORG.IL';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-32 max-w-4xl">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-headline font-black text-primary tracking-tight">צרו קשר עם חותם</h1>
          <p className="text-muted-foreground text-lg font-medium">אנחנו כאן לכל שאלה בנושא כשרות, רכישה או הצטרפות כסופר.</p>
          <div className="w-16 h-1 bg-accent mx-auto rounded-full" />
        </div>

        <ContactFormCard />

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <Card className="border border-primary/10 shadow-premium rounded-[2.5rem] bg-white/90 backdrop-blur-sm p-8 space-y-8">
            <CardHeader className="p-0 text-right">
              <CardTitle className="text-2xl font-black text-primary">פרטי התקשרות</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <ContactItem
                icon={<Mail className="w-5 h-5 text-accent" />}
                label="דואר אלקטרוני"
                value={contactEmail}
                href={`mailto:${contactEmail}`}
              />
              <ContactItem
                icon={<MessageCircle className="w-5 h-5 text-accent" />}
                label="וואטסאפ"
                value={formattedPhone}
                href={whatsappHref}
                external
              />
              <ContactItem
                icon={<MapPin className="w-5 h-5 text-accent" />}
                label="מיקום"
                value="ירושלים, ישראל"
              />
              <ContactItem
                icon={<Clock className="w-5 h-5 text-accent" />}
                label="שעות פעילות"
                value="א'-ה' 09:00 - 18:00"
              />
            </CardContent>
          </Card>

          <Card className="border-none shadow-premium rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/90 text-white p-8 flex flex-col justify-center text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 rounded-full -ml-14 -mb-14 blur-2xl" />
            <div className="relative z-10 space-y-6">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto border border-white/20">
                <MessageCircle className="w-10 h-10 text-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-headline font-black">מענה מהיר בוואטסאפ</h2>
                <p className="text-white/80 font-medium">לעזרה טכנית, שלחו לנו הודעה ונחזור אליכם בהקדם.</p>
              </div>
              <Button asChild className="bg-accent text-primary hover:bg-accent/90 rounded-full h-14 px-10 font-bold uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                   דברו איתנו בוואטסאפ
                </a>
              </Button>
              <p className="text-xs text-white/70 font-semibold tracking-wide">{formattedPhone}</p>
            </div>
          </Card>
        </div>

        <div className="mt-12 bg-white/70 backdrop-blur-sm rounded-[2rem] p-8 border border-primary/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 text-right">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="font-black text-primary">אבטחה ופרטיות</h3>
                 <p className="text-xs text-muted-foreground font-medium">כל הפניות באתר מוצפנות ומטופלות בסטנדרט הגבוה ביותר.</p>
              </div>
           </div>
           <Button variant="ghost" asChild className="rounded-full font-bold text-xs uppercase tracking-widest gap-2">
              <Link href="/"><ArrowLeft className="w-4 h-4" /> חזרה לדף הבית</Link>
           </Button>
        </div>
      </main>
    </div>
  );
}

function ContactFormCard() {
  const db = useSupabaseClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
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
    toast({ title: 'הפנייה נשלחה בהצלחה', description: 'נחזור אליכם בהקדם האפשרי.' });
  };

  if (isSubmitted) {
    return (
      <Card className="border border-emerald-100 shadow-premium rounded-[2.5rem] bg-emerald-50/60 backdrop-blur-sm p-10 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-headline font-black text-primary">הפנייה שלכם התקבלה!</h2>
        <p className="text-muted-foreground font-medium">תודה שפניתם אלינו, צוות חותם יחזור אליכם בהקדם האפשרי.</p>
        <Button variant="outline" onClick={() => setIsSubmitted(false)} className="rounded-full font-bold h-11 px-8 mt-2">
          שליחת פנייה נוספת
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border border-primary/10 shadow-premium-lg rounded-[2.5rem] bg-white/95 backdrop-blur-sm p-8 md:p-10">
      <CardHeader className="p-0 text-right mb-6">
        <CardTitle className="text-2xl font-black text-primary flex items-center justify-end gap-3">
          השאירו לנו הודעה
          <span className="w-11 h-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0"><Send className="w-5 h-5" /></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSubmit} className="space-y-5 text-right">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="text-xs font-bold">שם מלא *</Label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="ישראל ישראלי"
                className="h-12 rounded-2xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="text-xs font-bold">אימייל *</Label>
              <Input
                id="contact-email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                placeholder="your@email.com"
                className="h-12 rounded-2xl text-right"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone" className="text-xs font-bold">טלפון (אופציונלי)</Label>
            <Input
              id="contact-phone"
              type="tel"
              dir="ltr"
              value={form.phone}
              onChange={e => updateField('phone', e.target.value)}
              placeholder="050-0000000"
              className="h-12 rounded-2xl text-right"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-message" className="text-xs font-bold">הודעה *</Label>
            <Textarea
              id="contact-message"
              value={form.message}
              onChange={e => updateField('message', e.target.value)}
              placeholder="כתבו לנו במה נוכל לעזור..."
              className="min-h-36 rounded-2xl resize-none"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-full h-14 px-12 font-bold uppercase tracking-widest bg-primary text-white hover:bg-primary/90 shadow-xl transition-all hover:scale-[1.02] active:scale-95 gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            שליחת הפנייה
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ContactItem({ icon, label, value, href, external }: any) {
  const content = (
    <div className="flex items-center justify-end gap-4 group p-3 rounded-2xl border border-transparent hover:border-primary/10 hover:bg-primary/5 transition-all">
      <div className="text-right">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-base font-bold text-primary group-hover:text-accent transition-colors">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-accent group-hover:text-primary transition-all">
        {icon}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition-all" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {content}
      </a>
    );
  }

  return content;
}
