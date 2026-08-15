import { Metadata } from 'next';
import TatproLegalPageClient from './TatproLegalPageClient';

export const metadata: Metadata = {
  title: 'הסכם שירותי תוכנה - TATPRO',
  description: 'הסכם למתן שירותי תוכנה (SaaS) עבור מערכת TATPRO — הגדרות השירות, ספקי צד ג׳ ואחריות סליקה, ותנאים מסחריים.',
  alternates: {
    canonical: '/legal/tatpro',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function TatproLegalPage() {
  return <TatproLegalPageClient />;
}
