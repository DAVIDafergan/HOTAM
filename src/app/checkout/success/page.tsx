import { Metadata } from 'next';
import CheckoutSuccessPageClient from './CheckoutSuccessPageClient';

export const metadata: Metadata = {
  title: 'התשלום התקבל בהצלחה',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessPageClient />;
}
