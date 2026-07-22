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

const socialImageAlt =
  'Starship Alexandria hovers above a moonlit Arcadian city of temples and a ruined cathedral while a lone archivist stands in a blue transporter beam.';

const socialImage = {
  url: '/images/og.png',
  width: 1200,
  height: 630,
  alt: socialImageAlt,
  type: 'image/png',
};

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
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Starship Alexandria',
    title: 'Starship Alexandria',
    description:
      'A cozy roguelike web game — recover fragments of lost classic literature.',
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Starship Alexandria',
    description:
      'A cozy roguelike web game — recover fragments of lost classic literature.',
    images: [socialImage],
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
