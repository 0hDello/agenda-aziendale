'use client';

import Calendar from '@/components/Calendar';

interface PageProps {
  params: { id: string };
}

export default function AgendaPage({ params }: PageProps) {
  const { id } = params;

  return (
    <div className="min-h-screen bg-gray-50">
      <Calendar agendaId={id} />
    </div>
  );
}
