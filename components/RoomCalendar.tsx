'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

interface RoomCalendarProps {
  agendaId: string;
}

interface Appointment {
  room: string;
  date: string;
  time: string;
  title: string;
  month: string;
}

interface RoomData {
  [date: string]: {
    [time: string]: string | null;
  };
}

const ROOMS = [
  { id: 'imola', name: 'Sala Riunioni Imola', file: 'Sala-riunioni-2026-Imola.xlsx', color: '#16A34A' },
  { id: 'cspt', name: 'Sala Riunioni CSPT', file: 'Sala-riunioni-2026-CSPT.xlsx', color: '#DC2626' },
  { id: 'saletta', name: 'Saletta Primo Piano', file: 'Saletta-primo-piano-2026-Imola.xlsx', color: '#9333EA' }
];

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
];

export default function RoomCalendar({ agendaId }: RoomCalendarProps) {
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [currentMonth, setCurrentMonth] = useState(0); // 0 = Gennaio
  const [currentYear] = useState(2026);
  const [roomData, setRoomData] = useState<RoomData>({});
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Carica i dati dal JSON al mount del componente
  useEffect(() => {
    loadAppointmentsData();
  }, []);

  // Aggiorna la visualizzazione quando cambia sala o mese
  useEffect(() => {
    if (allAppointments.length > 0) {
      processRoomData();
    }
  }, [selectedRoom, currentMonth, allAppointments]);

  const loadAppointmentsData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/data/room_appointments.json');
      if (!response.ok) {
        throw new Error('Failed to load appointments data');
      }
      const data = await response.json();
      
      // Combina tutti gli appuntamenti di tutte le sale
      const allApps: Appointment[] = [];
      Object.keys(data.rooms).forEach(roomId => {
        allApps.push(...data.rooms[roomId]);
      });
      
      setAllAppointments(allApps);
      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento dati appuntamenti:', error);
      setAllAppointments([]);
      setLoading(false);
    }
  };

  const processRoomData = () => {
    const newRoomData: RoomData = {};
    
    // Inizializza tutti i giorni del mese corrente
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      newRoomData[dateKey] = {};
      
      TIME_SLOTS.forEach(time => {
        newRoomData[dateKey][time] = null;
      });
    }
    
    // Filtra gli appuntamenti per la sala e il mese correnti
    const filteredAppointments = allAppointments.filter(app => {
      if (app.room !== selectedRoom.id) return false;
      
      const appDate = new Date(app.date);
      return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
    });
    
    // Popola i dati con gli appuntamenti
    filteredAppointments.forEach(app => {
      if (newRoomData[app.date] && TIME_SLOTS.includes(app.time)) {
        newRoomData[app.date][app.time] = app.title;
      }
    });
    
    setRoomData(newRoomData);
  };

  const getDaysInMonth = () => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  };

  const previousMonth = () => {
    if (currentMonth > 0) {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth < 11) {
      setCurrentMonth(currentMonth + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento dati sale riunioni...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header con selettore sale */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Sala Riunioni 2026</h1>
          <div className="text-sm text-gray-600">
            {allAppointments.filter(a => a.room === selectedRoom.id).length} prenotazioni totali
          </div>
        </div>
        
        {/* Selettore Sale */}
        <div className="flex gap-3 mb-6">
          {ROOMS.map(room => {
            const roomAppointmentsCount = allAppointments.filter(a => a.room === room.id).length;
            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  selectedRoom.id === room.id
                    ? 'shadow-lg scale-105'
                    : 'bg-white hover:shadow-md'
                }`}
                style={{
                  backgroundColor: selectedRoom.id === room.id ? room.color : 'white',
                  color: selectedRoom.id === room.id ? 'white' : '#374151'
                }}
              >
                <Building2 size={20} />
                <div className="flex flex-col items-start">
                  <span>{room.name}</span>
                  <span className={`text-xs ${
                    selectedRoom.id === room.id ? 'text-white/80' : 'text-gray-500'
                  }`}>
                    {roomAppointmentsCount} prenotazioni
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigazione mesi */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-md">
          <button
            onClick={previousMonth}
            disabled={currentMonth === 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={nextMonth}
            disabled={currentMonth === 11}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Tabella Calendario */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="sticky left-0 z-10 bg-gray-100 p-3 text-left font-semibold border-r border-gray-300">
                  Orario
                </th>
                {Array.from({ length: getDaysInMonth() }, (_, i) => {
                  const day = i + 1;
                  const date = new Date(currentYear, currentMonth, day);
                  const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' });
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <th
                      key={day}
                      className={`p-3 text-center min-w-[80px] border-l border-gray-200 ${
                        isWeekend ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="font-semibold">{day}</div>
                      <div className="text-xs text-gray-600 capitalize">{dayName}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((time, timeIndex) => (
                <tr key={time} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white p-3 font-medium border-r border-gray-300">
                    {time}
                  </td>
                  {Array.from({ length: getDaysInMonth() }, (_, i) => {
                    const day = i + 1;
                    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const appointment = roomData[dateKey]?.[time];
                    const date = new Date(currentYear, currentMonth, day);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    
                    return (
                      <td
                        key={day}
                        className={`p-1 border-l border-gray-200 ${
                          isWeekend ? 'bg-gray-50' : ''
                        }`}
                      >
                        {appointment ? (
                          <div
                            className="p-2 rounded text-xs font-medium text-center cursor-pointer hover:opacity-80 transition-all"
                            style={{ backgroundColor: `${selectedRoom.color}20`, color: selectedRoom.color }}
                            title={`${appointment} - ${time}`}
                          >
                            {appointment}
                          </div>
                        ) : (
                          <div className="p-2 text-center cursor-pointer hover:bg-gray-100 rounded transition-all">
                            <span className="text-gray-400 text-xs">-</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-6 bg-white p-4 rounded-lg shadow-md">
        <h3 className="font-semibold mb-2">Legenda</h3>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: `${selectedRoom.color}40` }}></div>
            <span className="text-sm">Occupato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100"></div>
            <span className="text-sm">Libero</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-50"></div>
            <span className="text-sm">Weekend</span>
          </div>
        </div>
      </div>
    </div>
  );
}
