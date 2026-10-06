import { Metadata } from 'next';
import { isValidUnsubscribeToken } from '@/lib/unsubscribe-token';
import UnsubscribeClient from './UnsubscribeClient';

export const metadata: Metadata = {
  title: 'הסרה מרשימת התפוצה',
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e = '', t = '' } = await searchParams;
  const valid = !!e && !!t && isValidUnsubscribeToken(e, t);
  return <UnsubscribeClient email={valid ? e : null} token={valid ? t : null} />;
}
