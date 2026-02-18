'use client';

import { use } from 'react';
import Calendar from '@/components/Calendar';
import RoomCalendar from '@/components/RoomCalendar';
import EpasaCalendar from '@/components/EpasaCalendar';

interface PageProps {
  params: Promise<{ id: string }>; 
}

export default function AgendaPage({ params }: PageProps) {
  
  const { id } = use(params);

  
  if (id === 'sale' || id === 'sala-riunioni-2026') {
    return (
      <div className="min-h-screen bg-gray-50">
        <RoomCalendar agendaId={id} />
      </div>
    );
  }

  
  if (id === 'epasa') {
    return (
      <div className="min-h-screen bg-gray-50">
        <EpasaCalendar agendaId={id} />
      </div>
    );
  }

  
  return (
    <div className="min-h-screen bg-gray-50">
      <Calendar agendaId={id} />
    </div>
  );
}
