import { Metadata } from 'next';
import ChooseRolePageClient from './ChooseRolePageClient';

export const metadata: Metadata = {
  title: 'בחירת סוג חשבון',
  robots: { index: false, follow: false },
};

export default function ChooseRolePage() {
  return <ChooseRolePageClient />;
}
