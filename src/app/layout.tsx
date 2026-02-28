import type { Metadata } from 'next';
import { Crimson_Pro } from 'next/font/google';
import '@/styles/globals.css';

const crimson = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson',
});

export const metadata: Metadata = {
  title: 'Starship Alexandria',
  description:
    'A cozy roguelike web game — recover fragments of lost classic literature.',
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
