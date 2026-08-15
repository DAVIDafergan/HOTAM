import { Metadata } from 'next';
import DiagnosisPageClient from './DiagnosisPageClient';

export const metadata: Metadata = {
  title: 'בדיקת מזוזה מקוונת בבינה מלאכותית',
  description: 'העלו תמונה של המזוזה שלכם וקבלו הערכה ראשונית באמצעות בינה מלאכותית. כלי עזר נוח לזיהוי בעיות נפוצות — אינו תחליף לבדיקת סופר סת"ם מוסמך.',
  alternates: {
    canonical: '/diagnosis',
  },
};

export default function DiagnosisPage() {
  return <DiagnosisPageClient />;
}
