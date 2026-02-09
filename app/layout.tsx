import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="it">
      <body className="min-h-screen bg-gray-50">
        <main>{children}</main>
      </body>
    </html>
  );
}
