import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import AnnouncementBanner from '../components/layout/AnnouncementBanner';
import { Providers } from '../components/Providers';
import { GoogleAnalytics } from '@next/third-parties/google';

export const metadata: Metadata = {
  title: {
    default: 'Rajshree Jewels | Premium 1-Gram Gold & Antique Jewellery',
    template: '%s | Rajshree Jewels',
  },
  description: 'Shop premium handcrafted 1-gram gold, imitation, antique, kundan and fashion jewellery. Each physical creation is completely one-of-a-kind. Delivered India-wide.',
  keywords: ['1 gram gold jewellery online', 'artificial jewellery sets online', 'imitation earrings online India', 'kundan bangles', 'fashion jewellery'],
  metadataBase: new URL('https://rajshreejewels.com'),
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rajshree Jewels | Premium Handcrafted Jewellery',
    description: 'Shop unique, premium handcrafted 1-gram gold and antique imitation jewellery designs. Delivered across India.',
    url: 'https://rajshreejewels.com',
    siteName: 'Rajshree Jewels',
    images: [
      {
        url: '/og-default.svg',
        width: 1200,
        height: 630,
        alt: 'Rajshree Jewels Collection',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="flex flex-col min-h-screen bg-surface text-primary antialiased">
        <Providers>
          <AnnouncementBanner />
          <Navbar />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </Providers>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!} />
      </body>
    </html>
  );
}

