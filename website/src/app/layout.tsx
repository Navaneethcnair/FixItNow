import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
import SidebarDock from '@/components/SidebarDock';
import GlobalWorkerNotification from '@/components/GlobalWorkerNotification';
import { LanguageProvider } from '@/context/LanguageContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4f46e5',
};

export const metadata: Metadata = {
  title: 'FixItNow — AI-Powered Hyperlocal Services',
  description: 'Upload a photo or video of your problem. Our AI identifies the issue and connects you with the right blue-collar professional near you.',
  keywords: 'plumber, electrician, carpenter, home repair, hyperlocal, blue collar workers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <LanguageProvider>
          <Navbar />
          <Suspense fallback={null}>
            <SidebarDock />
          </Suspense>
          <GlobalWorkerNotification />
          <main>{children}</main>
          <Footer />
          <MobileBottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}
