import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@/styles/globals.css';

const atkinson = localFont({
  variable: '--font-atkinson',
  display: 'swap',
  src: [
    { path: '../../public/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2', weight: '700', style: 'normal' },
  ],
});

const literata = localFont({
  variable: '--font-literata',
  display: 'swap',
  src: '../../public/fonts/literata/Literata-Latin-Variable.woff2',
  weight: '200 900',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://starship-alexandria.vercel.app'),
  title: 'Starship Alexandria — Recover the Lost Library',
  description:
    'A cozy roguelike web game — recover fragments of lost classic literature.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Starship Alexandria',
    title: 'Starship Alexandria',
    description:
      'A cozy roguelike web game — recover fragments of lost classic literature.',
    images: [
      {
        url: '/images/og.png',
        width: 1200,
        height: 630,
        alt: 'An archivist aboard the Starship Alexandria overlooks Earth and four recovered visions: a cathedral, scriptorium, university, and garden conservatory.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Starship Alexandria',
    description:
      'A cozy roguelike web game — recover fragments of lost classic literature.',
    images: ['/images/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${literata.variable}`}>
      <body>{children}</body>
    </html>
  );
}
