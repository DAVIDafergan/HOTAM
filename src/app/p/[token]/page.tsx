import { Metadata } from 'next';
import PhoneOptOutClient from './PhoneOptOutClient';

// Short link from the bottom of every SMS ("להסרה: hotam.shop/p/…").
export const metadata: Metadata = {
  title: 'הפסקת הודעות SMS ושיחות',
  robots: { index: false, follow: false },
};

export default async function PhoneOptOutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PhoneOptOutClient token={token} />;
}
