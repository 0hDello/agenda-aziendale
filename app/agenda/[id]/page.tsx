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
      {/* Bottone per tornare alla home */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-[#005CA9] transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          Torna alle Agende
        </button>
      </div>

      {/* Calendario */}
      <Calendar agendaId={id} />
    </div>
  );
}
