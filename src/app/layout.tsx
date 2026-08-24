import type { Metadata } from 'next';
import { Providers } from '@/app/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ticketera Rial',
  description: 'Soporte interno sincronizado con Discord',
  icons: {
    icon: '/ticket.png',
    apple: '/ticket.png',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full bg-zinc-950 antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
