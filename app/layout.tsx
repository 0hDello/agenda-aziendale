import type { Metadata } from 'next';
import './globals.css';
import UpdateBanner from '@/components/UpdateBanner';

export const metadata: Metadata = {
  title: 'Agenda Aziendale',
  description: 'Sistema di gestione appuntamenti condiviso',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="h-full w-full overflow-hidden">
      <body className="h-full w-full overflow-hidden bg-gray-50">
        <UpdateBanner />
        <main className="h-full w-full overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
