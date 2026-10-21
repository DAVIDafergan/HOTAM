
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { SupabaseClientProvider } from '@/lib/supabase-hooks';
import { ClientWrapper } from '@/components/ClientWrapper';
import { Analytics } from '@vercel/analytics/next';
import { IBM_Plex_Sans_Hebrew, Noto_Serif_Hebrew, Bellefair } from 'next/font/google';
import { AccessibilityButton } from '@/components/AccessibilityButton';
import { SplashScreen } from '@/components/SplashScreen';

// Typography — direction B ("luxury fashion"), chosen by David (2026-10):
//   body / UI  → IBM Plex Sans Hebrew (300 long text, 400 UI, 500 labels, 600 buttons/emphasis)
//   headings   → Noto Serif Hebrew Light (300 display, 400 small headings) — large and airy
//   accent     → Bellefair (prices, numbers/stats, HOTAM wordmark) — thin lining figures
// Max three families. To revert to the previous system, swap these three loaders back to
// Assistant (--font-body) + Frank_Ruhl_Libre weight ['500','700'] (--font-heading) and point
// --font-accent at --font-heading in globals.css.
const bodyFont = IBM_Plex_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});

const headingFont = Noto_Serif_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400'],
  variable: '--font-heading',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

const accentFont = Bellefair({
  subsets: ['hebrew', 'latin'],
  weight: '400',
  variable: '--font-accent',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'חותם - זירת המסחר לכלי קודש מהודרים | ספרי תורה, תפילין ומזוזות',
    template: '%s | חותם - כלי קודש מהודרים'
  },
  description: 'חותם היא זירת מסחר יוקרתית לכלי קודש מהודרים — ספרי תורה, תפילין, מזוזות ויודאיקה ישירות מסופרי סת\'\'ם מוסמכים, עם שקיפות מלאה וליווי אישי.',
  metadataBase: new URL('https://www.hotam.shop'),
  alternates: {
    canonical: '/',
  },
  keywords: ['סופר סתם', 'מזוזה מהודרת', 'תפילין', 'ספר תורה', 'קניית מזוזות', 'בדיקת מזוזות', 'יודאיקה', 'כתיבת סת\'\'ם'],
  openGraph: {
    title: 'חותם - זירת המסחר היוקרתית לכלי קודש מהודרים',
    description: 'ספרי תורה, תפילין, מזוזות ויודאיקה ישירות מהסופר — שקיפות מלאה, כשרות ללא פשרות וחוויית רכישה יוקרתית.',
    url: 'https://www.hotam.shop',
    siteName: 'חותם',
    locale: 'he_IL',
    type: 'website',
    images: [
      {
        // Versioned name: WhatsApp/Facebook cache link previews by image URL.
        url: '/og-image-v2.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: 'חותם - זירת המסחר היוקרתית לכלי קודש מהודרים',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'חותם - כלי קודש מהודרים',
    description: 'זירת המסחר היוקרתית של עולם הסת\'\'ם.',
    images: ['https://www.hotam.shop/og-image-v2.jpg'],
  },
  icons: {
    icon: [
      // favicon.ico itself now embeds 16/32/48px (was 16/32 only) — Google's
      // own guidance wants 48px+, ideally a multiple of 48px, which the old
      // file didn't provide at any embedded resolution.
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    // Was '/icon.svg' — iOS does not support SVG for home-screen/apple-touch
    // icons, so this never actually worked; PNG is required.
    apple: '/apple-icon.png',
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
  verification: {
    google: 'RTp8vScMh5m5KUQ1mDv2D-_R5txu_2xM7gZSSEdY9Q4',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${bodyFont.variable} ${headingFont.variable} ${accentFont.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html,body{margin:0;padding:0;background:#FBF8F3;color:#14110D}
              body{font-family:var(--font-body),Arial,sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
              h1,h2,h3,h4,h5,h6{font-family:var(--font-heading),Georgia,serif;font-weight:300}
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "חותם - Hotam",
              "url": "https://www.hotam.shop",
              "logo": "https://www.hotam.shop/icon.svg",
              "description": "זירת המסחר המובילה לכלי קודש מהודרים ישירות מסופרי סת''ם.",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IL"
              }
            })
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:bg-white focus:p-4 focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary">
          דילוג לתוכן המרכזי
        </a>
        <SplashScreen />
        <SupabaseClientProvider>
          <ClientWrapper>
            <div id="main-content">
              {children}
            </div>
            <AccessibilityButton />
          </ClientWrapper>
        </SupabaseClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
