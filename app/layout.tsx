import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { LanguageProvider } from '@/src/contexts/LanguageContext';

export const metadata: Metadata = {
  title: 'STREET LIFE',
  description: 'STREET LIFE - Premium Dark Luxury Tap & Hustle WebApp',
  openGraph: {
    title: 'STREET LIFE',
    description: 'STREET LIFE - Premium Dark Luxury Tap & Hustle WebApp',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STREET LIFE',
    description: 'STREET LIFE - Premium Dark Luxury Tap & Hustle WebApp',
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
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark bg-[#0A0A0A] text-white">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-[#0A0A0A] text-white antialiased selection:bg-[#FFD700] selection:text-black overflow-x-hidden overflow-y-auto">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
