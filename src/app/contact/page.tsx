
"use client";

import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Phone, 
  MessageCircle, 
  MapPin, 
  Clock, 
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  const contactPhone = '0556674329';
  const formattedPhone = '055-667-4329';
  const whatsappPhoneIntl = '972556674329';
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

        <div className="grid md:grid-cols-2 gap-8">
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
                icon={<Phone className="w-5 h-5 text-accent" />}
                label="טלפון המשרד"
                value={formattedPhone}
                href={`tel:${contactPhone}`}
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
              <Button asChild className="bg-accent text-primary hover:bg-accent/90 rounded-full h-14 px-10 font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                <a href={`https://wa.me/${whatsappPhoneIntl}`} target="_blank" rel="noopener noreferrer">
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
           <Button variant="ghost" asChild className="rounded-full font-black text-xs uppercase tracking-widest gap-2">
              <Link href="/"><ArrowLeft className="w-4 h-4" /> חזרה לדף הבית</Link>
           </Button>
        </div>
      </main>
    </div>
  );
}

function ContactItem({ icon, label, value, href }: any) {
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
    return <a href={href} className="block transition-all">{content}</a>;
  }

  return content;
}
