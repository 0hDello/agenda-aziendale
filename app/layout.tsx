import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
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
    <html lang="it">
      <body>
        <UpdateBanner />
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
