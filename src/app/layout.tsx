import type { Metadata } from 'next';
import { Crimson_Pro } from 'next/font/google';
import '@/styles/globals.css';

const crimson = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://starshipalexandria.vercel.app'),
  title: 'Starship Alexandria',
  description:
    'A cozy roguelike web game — recover fragments of lost classic literature.',
  openGraph: {
    type: 'website',
    siteName: 'Starship Alexandria',
    title: 'Starship Alexandria',
    description:
      'A cozy roguelike web game — recover fragments of lost classic literature.',
    images: [
      {
        url: '/images/og.png',
        width: 1024,
        height: 540,
        alt: 'Starship Alexandria — a library ship orbits Earth while astronauts recover lost books from the ruins below',
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
    <html lang="en" className={crimson.variable}>
      <body>{children}</body>
    </html>
  );
}
