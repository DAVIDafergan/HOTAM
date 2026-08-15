import { Metadata } from 'next';
import SearchPageClient from './SearchPageClient';

export const metadata: Metadata = {
  title: 'חיפוש כלי קודש - ספרי תורה, תפילין, מזוזות וסת"ם',
  description: 'חפשו וסננו כלי קודש מהודרים — ספרי תורה, תפילין, מזוזות ויודאיקה — לפי סוג כתב, רמת הידור, גודל ומיקום, ישירות מסופרי סת"ם מוסמכים.',
  alternates: {
    canonical: '/search',
  },
};

export default function SearchPage() {
  return <SearchPageClient />;
}
