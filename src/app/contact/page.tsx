import { Metadata } from 'next';
import ContactPageClient from './ContactPageClient';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'צור קשר',
  description: 'יש לכם שאלה על מוצר, הזמנה, או רוצים להצטרף כסופר סת"ם? צוות חותם זמין בטלפון, בוואטסאפ ובטופס יצירת קשר מקוון.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <>
      <ContactPageClient />
      <SiteFooter />
    </>
  );
}
