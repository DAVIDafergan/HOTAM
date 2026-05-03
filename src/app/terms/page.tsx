import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-32 max-w-4xl">
        <Card className="border-none shadow-premium rounded-[3rem] overflow-hidden bg-white">
          <CardHeader className="text-center bg-primary text-white p-12">
            <CardTitle className="text-4xl font-headline font-black tracking-tight">תנאי שימוש והגדרות כשרות</CardTitle>
            <p className="text-white/60 mt-2 font-medium">HOTAM - Sacred Scribal Art Platform</p>
          </CardHeader>
          <CardContent className="p-12 space-y-8 text-right leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-2xl font-black text-primary border-b pb-2">1. כללי</h2>
              <p className="text-muted-foreground font-medium">ברוכים הבאים ל-HOTAM. האתר מהווה פלטפורמה לחיבור בין סופרי סת"ם לבין לקוחות המחפשים מוצרי קודש ברמה הגבוהה ביותר.</p>
            </section>
            <section className="space-y-3">
              <h2 className="text-2xl font-black text-primary border-b pb-2">2. אחריות כשרות</h2>
              <p className="text-muted-foreground font-medium">האתר עושה מאמצים לוודא את הסמכת הסופרים, אך האחריות ההלכתית הסופית על כשרות המוצר היא על הסופר ועל הלקוח.</p>
              <p className="text-muted-foreground font-medium">אנו ממליצים תמיד לבצע הגהה נוספת על ידי מומחה מוסמך לאחר הרכישה.</p>
            </section>
            <section className="space-y-3">
              <h2 className="text-2xl font-black text-primary border-b pb-2">3. ביטולים והחזרות</h2>
              <p className="text-muted-foreground font-medium">בשל אופיים המיוחד של מוצרי סת"ם (מוצרים שיוצרו במיוחד עבור הצרכן), מדיניות ההחזרות כפופה לחוק הגנת הצרכן הישראלי ובהתאם לסיכום מול הסופר.</p>
            </section>
            <section className="space-y-3">
              <h2 className="text-2xl font-black text-primary border-b pb-2">4. אבטחה ופרטיות</h2>
              <p className="text-muted-foreground font-medium">אנו מחויבים לשמירה על פרטיות המשתמשים ועל אבטחת העסקאות. העברת פרטי קשר מחוץ לפלטפורמה מהווה הפרה של התנאים.</p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
