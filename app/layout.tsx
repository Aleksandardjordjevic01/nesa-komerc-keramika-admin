import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Admin — Moje Stvari',
  icons: {
    icon: [
      { url: '/images/favicon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/images/favicon.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/images/favicon.png',
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
