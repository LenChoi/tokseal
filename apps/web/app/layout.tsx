import type { Metadata } from 'next';
import { Press_Start_2P, VT323 } from 'next/font/google';
import './globals.css';
import { Footer, Nav } from '@/components/Nav';
import { Sky } from '@/components/pixel/Sky';
import { RevealObserver } from '@/components/pixel/Reveal';
import { SITE_URL } from '@/lib/env';

const press = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-press', display: 'swap' });
const vt = VT323({ weight: '400', subsets: ['latin'], variable: '--font-vt', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'tokseal — seal your AI coding usage into a badge', template: '%s · tokseal' },
  description:
    'Local-first token stats for AI coding tools. Get a grade (S–C) and a GitHub profile card. Your data never leaves your machine unless you opt in.',
  openGraph: { title: 'tokseal', description: 'Seal your AI coding usage into a GitHub badge.', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${press.variable} ${vt.variable}`}>
      <body className="min-h-screen antialiased">
        <Sky />
        <RevealObserver />
        <Nav />
        <main className="mx-auto max-w-6xl px-5">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
