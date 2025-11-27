'use client';

import Calendar from '@/components/Calendar';
import RoomCalendar from '@/components/RoomCalendar';

interface PageProps {
  params: { id: string };
}

export default function AgendaPage({ params }: PageProps) {
  const { id } = params;

  // Se l'agenda è sala-riunioni-2026, usa il RoomCalendar
  if (id === 'sala-riunioni-2026') {
    return (
      <div className="min-h-screen bg-gray-50">
        <RoomCalendar agendaId={id} />
      </div>
    );
  }

  // Altrimenti usa il Calendar standard
  return (
    <div className="min-h-screen bg-gray-50">
      <Calendar agendaId={id} />
    </div>
  );
}
