'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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

// Mappa colori per diversi tipi di appuntamenti
const APPOINTMENT_COLORS: { [key: string]: string } = {
  'VISITE PATENTI': '#DC2626',
  'CORSO CQC': '#2563EB',
  'RIUNIONE': '#16A34A',
  'FORMAZIONE': '#9333EA',
  'COLLOQUIO': '#EA580C',
  'DEFAULT': '#6B7280'
};

function getColorForAppointment(title: string): string {
  if (APPOINTMENT_COLORS[title]) {
    return APPOINTMENT_COLORS[title];
  }

  for (const key in APPOINTMENT_COLORS) {
    if (title.includes(key)) {
      return APPOINTMENT_COLORS[key];
    }
  }

  return APPOINTMENT_COLORS['DEFAULT'];
}

export default function RoomCalendar({ agendaId }: RoomCalendarProps) {
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [currentYear] = useState(2026);
  const [roomData, setRoomData] = useState<RoomData>({});
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointmentsData();
  }, []);

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

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      newRoomData[dateKey] = {};

      TIME_SLOTS.forEach(time => {
        newRoomData[dateKey][time] = null;
      });
    }

    const filteredAppointments = allAppointments.filter(app => {
      if (app.room !== selectedRoom.id) return false;

      const appDate = new Date(app.date);
      return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
    });

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

  // Calcola prenotazioni del mese corrente per la sala selezionata
  const monthAppointmentsCount = allAppointments.filter(
    a => a.room === selectedRoom.id && new Date(a.date).getMonth() === currentMonth
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento dati sale riunioni...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        {/* Contenitore principale */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">

          {/* Header superiore UNICO con tutto */}
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Sinistra: Info sala e statistiche */}
              <div className="flex items-center gap-3">
                <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#005CA9]">
                    {selectedRoom.name}
                  </h1>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {monthAppointmentsCount} prenotazioni in {MONTHS[currentMonth]}
                  </p>
                </div>
              </div>

              {/* Destra: Controlli */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Navigazione mesi */}
                <button
                  onClick={previousMonth}
                  disabled={currentMonth === 0}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <div className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20">
                  <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                    {MONTHS[currentMonth]} {currentYear}
                  </span>
                </div>
                <button
                  onClick={nextMonth}
                  disabled={currentMonth === 11}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                {/* Selettore sala */}
                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <div className="relative">
                    <select
                      value={selectedRoom.id}
                      onChange={(e) => {
                        const room = ROOMS.find(r => r.id === e.target.value);
                        if (room) setSelectedRoom(room);
                      }}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none"
                    >
                      {ROOMS.map((room) => (
                        <option key={room.id} value={room.id} className="text-gray-800 bg-white">
                          {room.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#005CA9] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabella calendario */}
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 107px)' }}>
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead className="sticky top-0 z-20">
                <tr className="border-b-2 border-[#005CA9]/20">
                  <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 w-[60px] border-r border-gray-200">
                    <span className="text-[#005CA9]">Ora</span>
                  </th>
                  {Array.from({ length: getDaysInMonth() }, (_, i) => {
                    const day = i + 1;
                    const date = new Date(currentYear, currentMonth, day);
                    const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' });
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    return (
                      <th
                        key={day}
                        className={`p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[45px] ${
                          isWeekend ? 'bg-gray-100' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[#005CA9] font-bold">{day}</span>
                          <span className="text-gray-600 text-[10px] capitalize">{dayName}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time}>
                    <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                      <div className="px-2 py-2 text-xs font-semibold text-gray-700">
                        {time}
                      </div>
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
                          className={`relative p-0 border-r border-gray-100 border-b border-gray-100 ${
                            isWeekend ? 'bg-gray-50' : ''
                          }`}
                          style={{ height: '45px' }}
                        >
                          {appointment ? (
<<<<<<< HEAD
  <div
    className="w-full h-full cursor-pointer hover:opacity-80 transition-all flex items-center justify-center text-white text-[10px] font-semibold px-1"
    style={{ 
      backgroundColor: getColorForAppointment(appointment)
    }}
    title={`${appointment} - ${time}`}
  >
    <span className="text-center leading-tight overflow-hidden text-ellipsis line-clamp-2">
      {appointment}
    </span>
  </div>

=======
                            <div
                              className="w-full h-full cursor-pointer hover:opacity-80 transition-all flex items-center justify-center text-white text-[10px] font-semibold px-1"
                              style={{ 
                                backgroundColor: getColorForAppointment(appointment)
                              }}
                              title={`${appointment} - ${time}`}
                            >
                              <span className="text-center leading-tight overflow-hidden text-ellipsis line-clamp-2">
                                {appointment}
                              </span>
                            </div>
>>>>>>> 1f744369ca37f406ed07706b9e665944a1106b85
                          ) : (
                            <div className="w-full h-full hover:bg-blue-50/30 transition-colors"></div>
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
      </div>
    </div>
  );
}