'use client';

import Calendar from '@/components/Calendar';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: { id: string };
}

export default function AgendaPage({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();

  return (
    <div className="min-h-screen">
      

      {/* Calendario */}
      <Calendar agendaId={id} />
    </div>
  );
}
