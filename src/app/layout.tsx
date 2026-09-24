import type { Metadata } from 'next';
import Script from 'next/script';
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
    <html
      lang="es"
      className="h-full bg-zinc-950 antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script
          id="theme-preference"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(() => { const theme = window.localStorage.getItem('rial-ticket-theme'); if (theme === 'light') { document.documentElement.classList.add('light'); document.documentElement.style.colorScheme = 'light'; } })();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
