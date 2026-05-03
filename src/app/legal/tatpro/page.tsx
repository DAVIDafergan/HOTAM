
'use client';

import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TatproLegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-32 max-w-4xl">
        <Card className="border-none shadow-premium rounded-[3rem] overflow-hidden bg-white">
          <CardHeader className="text-center bg-primary text-white p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="relative z-10 space-y-4">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                <FileText className="w-10 h-10 text-accent" />
              </div>
              <CardTitle className="text-3xl md:text-4xl font-headline font-black tracking-tight leading-tight">הסכם למתן שירותי תוכנה (SaaS)<br />מערכת TATPRO</CardTitle>
              <div className="inline-block px-6 py-2 bg-accent text-primary font-black rounded-full text-sm uppercase tracking-widest">מסר גו בע"מ</div>
            </div>
          </CardHeader>
          <CardContent className="p-8 md:p-16 space-y-12 text-right leading-relaxed text-primary/90" dir="rtl">
            
            <div className="grid md:grid-cols-2 gap-6 bg-muted/30 p-8 rounded-3xl border border-primary/5">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">תאריך חתימה</p>
                <div className="h-10 border-b border-primary/20 flex items-end font-bold">_______ / _______ / _______</div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">סוכן מחתים</p>
                <div className="h-10 border-b border-primary/20 flex items-end font-bold">______________________</div>
              </div>
            </div>

            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <h2 className="text-2xl font-black text-primary">1. הגדרות ומהות השירות</h2>
                <ShieldCheck className="w-6 h-6 text-accent" />
              </div>
              <div className="grid gap-4 font-medium text-sm">
                <p><strong>"החברה"</strong> – מסר גו בע"מ (ח.פ. 516456811), מושב חדיד.</p>
                <p><strong>"המערכת"</strong> – תוכנת TATPRO, פלטפורמת ניהול קמפייני התרמה מבוססת ענן.</p>
                <p><strong>"השירות"</strong> – העמדת גישה למערכת במודל SaaS (Software as a Service) ללא התקנה מקומית.</p>
                <p><strong>"הרישיון"</strong> – החברה מעניקה ללקוח רישיון שימוש אישי, מוגבל ובלתי עביר למשך תקופת ההתקשרות.</p>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <h2 className="text-2xl font-black text-primary">2. ספקי צד ג' ואחריות סליקה</h2>
                <AlertCircle className="w-6 h-6 text-accent" />
              </div>
              <div className="bg-accent/5 p-6 rounded-2xl border-r-4 border-accent space-y-4 text-sm font-medium">
                <p>גביית תרומות וסליקה מחייבת התקשרות ישירה של הלקוח עם חברת "צ'רידי ישראל" ו/או חברת סליקה מאושרת.</p>
                <p>מובהר כי לחברה <strong>אין כל קשר או אחריות</strong> להליכי הסליקה, עמלות, ביטולים, חסימות או כל תקלה הקשורה לספקי התשלום.</p>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <h2 className="text-2xl font-black text-primary">3. תנאים מסחריים (SLA)</h2>
                <CheckCircle2 className="w-6 h-6 text-accent" />
              </div>
              <div className="space-y-4 text-sm font-medium">
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>תמיכת פורים:</strong> מר"ח אדר ועד י"ז אדר יינתן מענה דיגיטלי 24/6.</li>
                  <li><strong>שיא הקמפיין:</strong> תמיכה טלפונית מורחבת בין השעות 14:00–00:00.</li>
                  <li><strong>מיפוי:</strong> הרישיון כולל עד 10,000 טרנזקציות Google Maps.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <h2 className="text-2xl font-black text-primary">4. חבילות ותמחור (ללא מע"מ)</h2>
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <div className="overflow-x-auto rounded-[2rem] border border-primary/10 shadow-sm">
                <table className="w-full text-center text-sm">
                  <thead className="bg-primary text-white">
                    <tr>
                      <th className="p-4 font-black">כמות תורמים</th>
                      <th className="p-4 font-black">מחיר סופי לקמפיין</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr className="border-t">
                      <td className="p-4 font-bold">עד 50,000 תורמים</td>
                      <td className="p-4 font-black text-xl text-accent">8,000 ₪</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-muted/20 p-6 rounded-2xl space-y-2 text-xs italic text-muted-foreground">
                <p>* המחירים אינם כוללים מע"מ כחוק.</p>
                <p>* אי תשלום במועד יאפשר לחברה להשעות את השירות עד להסדרת החוב.</p>
              </div>
            </section>

            <div className="pt-12 grid grid-cols-2 gap-12 border-t border-primary/10">
              <div className="text-center space-y-6">
                <p className="font-black text-lg underline decoration-accent decoration-2 underline-offset-8 uppercase tracking-widest">חתימת מסר גו בע"מ</p>
                <div className="h-24 bg-muted/30 rounded-2xl border border-dashed border-primary/20 flex items-center justify-center opacity-50 italic text-xs">חותמת החברה</div>
              </div>
              <div className="text-center space-y-6">
                <p className="font-black text-lg underline decoration-accent decoration-2 underline-offset-8 uppercase tracking-widest">חתימת וחותמת הלקוח</p>
                <div className="h-24 bg-muted/30 rounded-2xl border border-dashed border-primary/20 flex items-center justify-center opacity-50 italic text-xs">חתימת המוסד</div>
              </div>
            </div>

            <div className="text-center pt-8 opacity-30">
              <p className="text-[10px] font-black uppercase tracking-[0.5em]">TATPRO • SaaS Agreement • 2024</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
