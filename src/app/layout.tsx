
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { SupabaseClientProvider } from '@/lib/supabase-hooks';
import { ClientWrapper } from '@/components/ClientWrapper';
import { Frank_Ruhl_Libre, Assistant } from 'next/font/google';
import { AccessibilityButton } from '@/components/AccessibilityButton';

const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  variable: '--font-frank',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  variable: '--font-assistant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'חותם - זירת המסחר לכלי קודש מהודרים | ספרי תורה, תפילין ומזוזות',
    template: '%s | חותם - כלי קודש מהודרים'
  },
  description: 'חותם היא זירת מסחר יוקרתית לכלי קודש מהודרים — ספרי תורה, תפילין, מזוזות ויודאיקה ישירות מסופרי סת\'\'ם מוסמכים, עם שקיפות מלאה וליווי אישי.',
  metadataBase: new URL('https://hotam.shop'),
  alternates: {
    canonical: '/',
  },
  keywords: ['סופר סתם', 'מזוזה מהודרת', 'תפילין', 'ספר תורה', 'קניית מזוזות', 'בדיקת מזוזות', 'יודאיקה', 'כתיבת סת\'\'ם'],
  openGraph: {
    title: 'חותם - זירת המסחר היוקרתית לכלי קודש מהודרים',
    description: 'ספרי תורה, תפילין, מזוזות ויודאיקה ישירות מהסופר — שקיפות מלאה, כשרות ללא פשרות וחוויית רכישה יוקרתית.',
    url: 'https://hotam.shop',
    siteName: 'חותם',
    locale: 'he_IL',
    type: 'website',
    images: [
      {
        url: 'https://github.com/user-attachments/assets/07eed66d-b4c2-4355-a08b-ee6366ebd19f',
        width: 1200,
        height: 630,
        alt: 'חותם - זירת המסחר היוקרתית לכלי קודש מהודרים',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'חותם - כלי קודש מהודרים',
    description: 'זירת המסחר היוקרתית של עולם הסת\'\'ם.',
    images: ['https://github.com/user-attachments/assets/07eed66d-b4c2-4355-a08b-ee6366ebd19f'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${assistant.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "חותם - Hotam",
              "url": "https://hotam.shop",
              "logo": "https://hotam.shop/icon.svg",
              "description": "זירת המסחר המובילה לכלי קודש מהודרים ישירות מסופרי סת''ם.",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IL"
              }
            })
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen selection:bg-accent/30 selection:text-primary">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:bg-white focus:p-4 focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary">
          דילוג לתוכן המרכזי
        </a>
        <SupabaseClientProvider>
          <ClientWrapper>
            <div id="main-content">
              {children}
            </div>
            <AccessibilityButton />
          </ClientWrapper>
        </SupabaseClientProvider>
      </body>
    </html>
  );
}
