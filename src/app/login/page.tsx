import { Metadata } from 'next';
import LoginPageClient from './LoginPageClient';

export const metadata: Metadata = {
  title: 'התחברות',
  description: 'התחברו לחשבון חותם שלכם כדי לעקוב אחר הזמנות, לנהל את חנות הסופר שלכם או לשוחח עם סופרי סת"ם.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginPage() {
  return <LoginPageClient />;
}
