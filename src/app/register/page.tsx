import { Metadata } from 'next';
import RegisterPageClient from './RegisterPageClient';

export const metadata: Metadata = {
  title: 'הרשמה',
  description: 'הצטרפו לחותם כלקוח לרכישת כלי קודש מהודרים, או כסופר סת"ם למכירה ישירה ללא עמלות תיווך.',
  alternates: {
    canonical: '/register',
  },
};

export default function RegisterPage() {
  return <RegisterPageClient />;
}
