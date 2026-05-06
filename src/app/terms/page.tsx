import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-32 max-w-4xl">
        <Card className="border-none shadow-premium rounded-[3rem] overflow-hidden bg-white">
          <CardHeader className="text-center bg-primary text-white p-12">
            <CardTitle className="text-4xl font-headline font-black tracking-tight">תקנון ותנאי שימוש</CardTitle>
            <p className="text-white/60 mt-2 font-medium">Hotam.shop</p>
          </CardHeader>
          <CardContent className="p-8 md:p-12 space-y-10 text-right leading-relaxed">

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">1. מבוא והסכמה לתנאים</h2>
              <p className="text-muted-foreground font-medium">ברוכים הבאים לאתר Hotam.shop (להלן: "האתר"), המופעל על ידי "DA Projects &amp; Entrepreneurship" (להלן: "ההנהלה" או "החברה").</p>
              <p className="text-muted-foreground font-medium">השימוש באתר, לרבות גלישה בו, פתיחת חנות, רכישת מוצרים או שימוש במערכת הצ'אט, מעיד על הסכמתך המלאה לתנאים המפורטים בתקנון זה. אם אינך מסכים לאחד או יותר מתנאים אלו, הנך מתבקש שלא לעשות כל שימוש באתר.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">2. מהות האתר והגבלת אחריות יסודית</h2>
              <p className="text-muted-foreground font-medium">האתר משמש כזירת מסחר (Marketplace) מקוונת המקשרת בין מוכרים עצמאיים לבין קונים.</p>
              <p className="text-muted-foreground font-medium">ההנהלה אינה צד לעסקה בין הקונה למוכר, אינה מייצרת את המוצרים, אינה אורזת אותם, אינה אחראית לטיבם, חוקיותם, איכותם או התאמתם לתיאור המופיע באתר.</p>
              <p className="text-muted-foreground font-medium">כל טענה, דרישה או תביעה בגין מוצר פגום, אי-אספקה, או נזק שנגרם כתוצאה מהשימוש במוצר, תופנה אך ורק למוכר הספציפי ממנו נרכש המוצר. ההנהלה מסירה מעצמה כל אחריות מכל סוג שהוא בעניינים אלו.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">3. מנגנון תשלום, נאמנות (Escrow) וקוד אימות</h2>
              <p className="text-muted-foreground font-medium">כדי להגן על הקונים והמוכרים, האתר מפעיל מנגנון אבטחת תשלומים. בעת ביצוע הזמנה, כספי הקונה מוחזקים בנאמנות.</p>
              <p className="text-muted-foreground font-medium"><strong className="text-primary">לקונה:</strong> עם השלמת התשלום, יונפק עבורך קוד אימות סודי בן 6 ספרות. באחריותך לשמור על הקוד בסוד ולא למסור אותו למוכר בשום שלב, אלא רק לאחר קבלת המוצר לידיך ובדיקתו. מסירת הקוד למוכר מהווה אישור סופי ומוחלט כי קיבלת את המוצר לשביעות רצונך וכי אתה מאשר את שחרור הכספים למוכר.</p>
              <p className="text-muted-foreground font-medium"><strong className="text-primary">למוכר:</strong> הכספים בגין העסקה יועברו אליך אך ורק לאחר שהזנת במערכת את קוד האימות המדויק שנמסר לך על ידי הקונה במעמד המסירה. לא תישמע כל טענה כלפי ההנהלה על עיכוב כספים במידה והקונה לא מסר את הקוד או במידה והמוצר לא סופק כדין.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">4. שימוש במערכת הצ'אט והתראות</h2>
              <p className="text-muted-foreground font-medium">האתר מספק מערכת הודעות פנימית לצורך תקשורת בין קונים למוכרים.</p>
              <p className="text-muted-foreground font-medium">חל איסור מוחלט להשתמש בצ'אט לשליחת תוכן פוגעני, מאיים, פרסומי (ספאם), או כזה המפר זכויות יוצרים.</p>
              <p className="text-muted-foreground font-medium">ההנהלה שומרת לעצמה את הזכות, אך לא את החובה, לנטר את ההודעות במקרה של חשד להונאה או הפרה של תנאי השימוש, ולחסום משתמשים בהתאם לשיקול דעתה הבלעדי.</p>
              <p className="text-muted-foreground font-medium">המשתמש מסכים לקבל התראות דואר אלקטרוני (Email) מהאתר בגין הודעות חדשות, סטטוס הזמנות ועדכוני מערכת.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">5. מדיניות ביטולים והחזרות</h2>
              <p className="text-muted-foreground font-medium">ביטול עסקה ייעשה בכפוף להוראות חוק הגנת הצרכן, התשמ"א-1981.</p>
              <p className="text-muted-foreground font-medium">מכיוון שהאתר משמש מתווך בלבד, בקשות לביטול עסקה והחזר כספי יתנהלו ישירות מול המוכר ועל פי מדיניות ההחזרות הספציפית של חנותו, כל עוד זו אינה סותרת את החוק.</p>
              <p className="text-muted-foreground font-medium">במקרה של מחלוקת שאינה נפתרת, ההנהלה רשאית (אך אינה חייבת) לשמש כבורר, ופסיקתה תהיה סופית לגבי שחרור או החזרת הכספים המוחזקים במערכת.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">6. שיפוי</h2>
              <p className="text-muted-foreground font-medium">המשתמש מתחייב לשפות את DA Projects &amp; Entrepreneurship, עובדיה, מנהליה ומי מטעמה, בגין כל נזק, הפסד, אובדן רווח, תשלום או הוצאה (לרבות שכר טרחת עו"ד והוצאות משפט) שייגרמו להם עקב הפרת תנאי שימוש אלה או עקב כל טענה של צד שלישי (כולל קונה או מוכר אחר) הנובעת משימוש המשתמש באתר.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-black text-primary border-b pb-2">7. סמכות שיפוט</h2>
              <p className="text-muted-foreground font-medium">על תקנון זה יחולו אך ורק דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל עניין ומחלוקת הנתונה לבתי המשפט המוסמכים במחוז תל אביב.</p>
            </section>

            <div className="border-t-4 border-primary/10 pt-10">
              <h2 className="text-3xl font-headline font-black text-primary mb-8">מדיניות פרטיות (Privacy Policy)</h2>

              <div className="space-y-8">
                <section className="space-y-4">
                  <h3 className="text-xl font-black text-primary border-b pb-2">1. איסוף מידע אישי</h3>
                  <p className="text-muted-foreground font-medium">אנו אוספים מידע שאתה מוסר לנו ביודעין, לרבות אך לא רק:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground font-medium pr-4">
                    <li><strong className="text-primary">מידע הרשמה:</strong> שם מלא, כתובת דואר אלקטרוני (באמצעות התחברות ישירה או דרך ספקי צד שלישי כגון Google).</li>
                    <li><strong className="text-primary">מידע מסחרי:</strong> נתוני הזמנות, פרטי מוצרים המועלים למכירה, היסטוריית רכישות, וקודי אימות עסקאות.</li>
                    <li><strong className="text-primary">תקשורת:</strong> תוכן ההודעות המועברות במערכת הצ'אט הפנימית של האתר.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-black text-primary border-b pb-2">2. שימוש במידע</h3>
                  <p className="text-muted-foreground font-medium">המידע הנאסף משמש למטרות הבאות:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground font-medium pr-4">
                    <li>תפעול תקין של האתר, לרבות יצירת חשבונות משתמש וניהול זירת המסחר.</li>
                    <li>הפעלת מנגנון הנאמנות (Escrow) ואבטחת העסקאות בין הצדדים.</li>
                    <li>שליחת התראות תפעוליות לדואר האלקטרוני (כגון: הזמנות חדשות, הודעות צ'אט שנתקבלו, קודי אימות).</li>
                    <li>איתור, מניעה וטיפול בבעיות אבטחה, הונאה או פעילות בלתי חוקית.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-black text-primary border-b pb-2">3. העברת מידע לצד שלישי</h3>
                  <p className="text-muted-foreground font-medium">אנו מתחייבים לא למכור, לסחור או להשכיר את המידע האישי שלך לצדדים שלישיים למטרות שיווקיות. המידע יועבר לצד שלישי רק במקרים הבאים:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground font-medium pr-4">
                    <li>העברת פרטי הקונה (שם ודרכי התקשרות) למוכר הספציפי ממנו בוצעה הרכישה, אך ורק לצורך השלמת האספקה.</li>
                    <li>שימוש בשירותי ענן וספקי תשתית (כגון שרתי מסדי נתונים ושירותי דיוור) המספקים עבורנו שירותים טכניים תחת הסכמי סודיות קפדניים.</li>
                    <li>על פי צו שיפוטי או דרישה חוקית מרשות מוסמכת.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-black text-primary border-b pb-2">4. אבטחת מידע</h3>
                  <p className="text-muted-foreground font-medium">אנו מיישמים מערכות ונהלים מתקדמים לאבטחת המידע במסדי הנתונים שלנו. עם זאת, בעוד שמערכות אלו מצמצמות את הסיכונים לחדירה בלתי מורשית, הן אינן מספקות אבטחה מוחלטת. לכן, ההנהלה אינה מתחייבת שהאתר יהיה חסין לחלוטין מגישה בלתי מורשית למידע המאוחסן בו.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-black text-primary border-b pb-2">5. עוגיות (Cookies)</h3>
                  <p className="text-muted-foreground font-medium">האתר עושה שימוש ב"עוגיות" לצורך תפעולו השוטף והתקין, ובכלל זה כדי לאסוף נתונים סטטיסטיים אודות השימוש באתר, לאימות פרטים, לשמירת העדפות המשתמש (כגון שמירת התחברות קודמת) ולצורכי אבטחת מידע.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-black text-primary border-b pb-2">6. זכות עיון ומחיקה</h3>
                  <p className="text-muted-foreground font-medium">על פי חוק הגנת הפרטיות, התשמ"א-1981, הנך זכאי לעיין במידע שעליך המוחזק במאגר המידע שלנו. אם תמצא שהמידע אינו נכון, שלם או מעודכן, או אם ברצונך למחוק את חשבונך כליל ממסדי הנתונים, תוכל לפנות אלינו בבקשה למחיקה. מחיקת המידע עלולה לגרור את הפסקת השירותים וסגירת החשבון. מובהר כי מידע הדרוש לנו לשם ניהול עסקינו, לרבות תיעוד עסקאות שבוצעו ופעולות מסחריות, יישמר אצלנו על פי דין.</p>
                </section>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
