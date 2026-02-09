'use client';

import { use } from 'react';
import Calendar from '@/components/Calendar';
import RoomCalendar from '@/components/RoomCalendar';
import EpasaCalendar from '@/components/EpasaCalendar';

interface PageProps {
  params: Promise<{ id: string }>; //  : params è ora una Promise
}

export default function AgendaPage({ params }: PageProps) {
  //  : Unwrap la Promise con React.use()
  const { id } = use(params);

  // Se l'agenda è sale o sala-riunioni-2026, usa il RoomCalendar
  if (id === 'sale' || id === 'sala-riunioni-2026') {
    return (
      <div className="min-h-screen bg-gray-50">
        <RoomCalendar agendaId={id} />
      </div>
    );
  }

  // Se l'agenda è epasa, usa l'EpasaCalendar
  if (id === 'epasa') {
    return (
      <div className="min-h-screen bg-gray-50">
        <EpasaCalendar agendaId={id} />
      </div>
    );
  }

  // Altrimenti usa il Calendar standard (Agenda 730)
  return (
    <div className="min-h-screen bg-gray-50">
      <Calendar agendaId={id} />
    </div>
  );
}
