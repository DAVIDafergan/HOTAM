
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
  description: 'הפלטפורמה המובילה לרכישת ספרי תורה, תפילין ומזוזות ישירות מסופרי סת\'\'ם מוסמכים. פיקוח הלכתי קפדני, שקיפות מלאה וכשרות ללא פשרות.',
  metadataBase: new URL('https://hotam.shop'),
  alternates: {
    canonical: '/',
  },
  keywords: ['סופר סתם', 'מזוזה מהודרת', 'תפילין', 'ספר תורה', 'קניית מזוזות', 'בדיקת מזוזות', 'יודאיקה', 'כתיבת סת\'\'ם'],
  openGraph: {
    title: 'חותם - יודאיקה וסת\'\'ם מהודר ישירות מהסופר',
    description: 'קנייה ישירה מסופרי סת\'\'ם יראי שמיים. שקיפות מלאה, כשרות ללא פשרות ומחירים ללא פערי תיווך.',
    url: 'https://hotam.shop',
    siteName: 'חותם',
    locale: 'he_IL',
    type: 'website',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1626767110251-c63fa319b75b?q=80&w=1200&h=630&auto=format&fit=crop',
        width: 1200,
        height: 630,
        alt: 'חותם - מלאכת קודש וסת\'\'ם מהודר',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'חותם - כלי קודש מהודרים',
    description: 'זירת המסחר המאובטחת של עולם הסת\'\'ם.',
    images: ['https://images.unsplash.com/photo-1626767110251-c63fa319b75b?q=80&w=1200&h=630&auto=format&fit=crop'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${assistant.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {googleMapsApiKey ? (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&loading=async&libraries=places&language=he&region=IL`}
            async
            defer
            data-google-maps-places="true"
          />
        ) : null}
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
