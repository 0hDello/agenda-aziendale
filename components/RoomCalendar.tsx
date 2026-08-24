'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Building2, ChevronDown } from 'lucide-react';
import RoomAppointmentModal from './RoomAppointmentModal';

interface RoomCalendarProps {
  agendaId: string;
}

interface Room {
  id: string;
  nome: string;
  colore: string;
}

interface Appointment {
  id: string;
  sala_id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  titolo: string;
  mese: string;
}

interface RoomData {
  [date: string]: {
    [time: string]: { id: string; title: string; ora_fine: string } | null;
  };
}

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'
];

const APPOINTMENT_COLORS: { [key: string]: string } = {
  'VISITE PATENTI': '#DC2626',
  'CORSO CQC': '#2563EB',
  'CORSO': '#16A34A',
  'CORSO AMB': '#16A34A',
  'RIUNIONE': '#9333EA',
  'VIDEO FISCALE': '#EA580C',
  'DEFAULT': '#6B7280'
};

const SSE_RELOAD_DEBOUNCE = 800;
const LOCAL_MUTATION_WINDOW = 3000;

function getColorForAppointment(title: string): string {
  const upperTitle = title.toUpperCase();
  for (const key in APPOINTMENT_COLORS) {
    if (upperTitle.includes(key)) return APPOINTMENT_COLORS[key];
  }
  return APPOINTMENT_COLORS['DEFAULT'];
}

function getSlotSpan(startTime: string, endTime: string): number {
  const startIdx = TIME_SLOTS.indexOf(startTime);
  const endIdx = TIME_SLOTS.indexOf(endTime);
  if (startIdx === -1 || endIdx === -1) return 1;
  return endIdx - startIdx;
}

export default function RoomCalendar({ agendaId }: RoomCalendarProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear]   = useState(() => new Date().getFullYear());
  const [roomData, setRoomData] = useState<RoomData>({});
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [realtimeFlash, setRealtimeFlash] = useState(false);

  const sseReloadTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const localMutationAtRef = useRef<number>(0);

  const markLocalMutation = () => { localMutationAtRef.current = Date.now(); };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const es = new EventSource('/api/room-appuntamenti/events');
    es.addEventListener('update', () => {
      if (Date.now() - localMutationAtRef.current < LOCAL_MUTATION_WINDOW) return;
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
      sseReloadTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/room-appuntamenti');
          const data = await res.json();
          if (data) setAllAppointments(data);
          setRealtimeFlash(true);
          setTimeout(() => setRealtimeFlash(false), 1500);
        } catch { }
      }, SSE_RELOAD_DEBOUNCE);
    });
    es.onerror = () => {};
    return () => {
      es.close();
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      const imolaSala = rooms.find(r => r.id === 'imola');
      setSelectedRoom(imolaSala || rooms[0]);
    }
  }, [rooms, selectedRoom]);

  useEffect(() => {
    if (allAppointments.length > 0 && selectedRoom) {
      processRoomData();
    }
  }, [selectedRoom, currentMonth, currentYear, allAppointments]);

  const loadData = async () => {
    setLoading(true);
    try {
      const roomsRes = await fetch('/api/room-sale');
      const roomsData = await roomsRes.json();
      if (roomsData) setRooms(roomsData);

      const appointmentsRes = await fetch('/api/room-appuntamenti');
      const appointmentsData = await appointmentsRes.json();
      if (appointmentsData) setAllAppointments(appointmentsData);

      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
      setLoading(false);
    }
  };

  const processRoomData = () => {
    if (!selectedRoom) return;

    const newRoomData: RoomData = {};
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      newRoomData[dateKey] = {};
      TIME_SLOTS.forEach(time => { newRoomData[dateKey][time] = null; });
    }

    const filteredAppointments = allAppointments.filter(app => {
      if (app.sala_id !== selectedRoom.id) return false;
      const appDate = new Date(app.data + 'T00:00:00');
      return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
    });

    filteredAppointments.forEach(app => {
      if (newRoomData[app.data] && TIME_SLOTS.includes(app.ora_inizio)) {
        newRoomData[app.data][app.ora_inizio] = {
          id: app.id,
          title: app.titolo,
          ora_fine: app.ora_fine
        };
      }
    });

    setRoomData(newRoomData);
  };

  const handleCellClick = (date: string, time: string) => {
    setSelectedSlot({ date, time });
    setIsModalOpen(true);
  };

  const handleSaveAppointment = async (data: { date: string; time: string; title: string; endTime?: string }) => {
    if (!selectedRoom) return;

    const date = new Date(data.date + 'T00:00:00');
    const mese = MONTHS[date.getMonth()];
    const startIdx = TIME_SLOTS.indexOf(data.time);
    const defaultEndTime = TIME_SLOTS[startIdx + 1] || '20:00';
    const ora_fine = data.endTime || defaultEndTime;

    const existing = allAppointments.find(
      app => app.sala_id === selectedRoom.id && app.data === data.date && app.ora_inizio === data.time
    );

    if (existing) {
      const optimisticUpdated: Appointment = { ...existing, titolo: data.title, ora_fine, mese };
      markLocalMutation();
      setAllAppointments(prev => prev.map(apt => apt.id === existing.id ? optimisticUpdated : apt));
      try {
        const response = await fetch(`/api/room-appuntamenti/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titolo: data.title, ora_fine, mese, sala_id: selectedRoom.id, data: data.date, ora_inizio: data.time }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Errore aggiornamento');
        }
        const updated: Appointment = await response.json();
        setAllAppointments(prev => prev.map(apt => apt.id === existing.id ? updated : apt));
      } catch (error) {
        setAllAppointments(prev => prev.map(apt => apt.id === existing.id ? existing : apt));
        console.error('Errore aggiornamento appuntamento:', error);
        alert(error instanceof Error ? error.message : "Errore durante l'aggiornamento dell'appuntamento");
      }
    } else {
      const tempId = `__optimistic_${Date.now()}`;
      const optimisticApt: Appointment = { id: tempId, sala_id: selectedRoom.id, data: data.date, ora_inizio: data.time, ora_fine, titolo: data.title, mese };
      markLocalMutation();
      setAllAppointments(prev => [...prev, optimisticApt]);
      try {
        const response = await fetch('/api/room-appuntamenti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sala_id: selectedRoom.id, data: data.date, ora_inizio: data.time, ora_fine, titolo: data.title, mese }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Errore creazione');
        }
        const newAppointment: Appointment = await response.json();
        setAllAppointments(prev => prev.map(apt => apt.id === tempId ? newAppointment : apt));
      } catch (error) {
        setAllAppointments(prev => prev.filter(apt => apt.id !== tempId));
        console.error('Errore creazione appuntamento:', error);
        alert(error instanceof Error ? error.message : "Errore durante la creazione dell'appuntamento");
      }
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedSlot || !selectedRoom) return;

    const appointment = allAppointments.find(
      app => app.sala_id === selectedRoom.id &&
             app.data === selectedSlot.date &&
             app.ora_inizio === selectedSlot.time
    );
    if (!appointment) return;

    markLocalMutation();
    setAllAppointments(prev => prev.filter(apt => apt.id !== appointment.id));
    try {
      const response = await fetch(`/api/room-appuntamenti/${appointment.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore eliminazione');
      }
    } catch (error) {
      setAllAppointments(prev => [...prev, appointment]);
      console.error('Errore eliminazione appuntamento:', error);
      alert(error instanceof Error ? error.message : "Errore durante l'eliminazione dell'appuntamento");
    }
  };

  const getDaysInMonth = () => new Date(currentYear, currentMonth + 1, 0).getDate();

  const previousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const isCellCovered = (dateKey: string, timeSlot: string): boolean => {
    const timeIndex = TIME_SLOTS.indexOf(timeSlot);
    for (let i = 0; i < timeIndex; i++) {
      const prevTime = TIME_SLOTS[i];
      const prevAppointment = roomData[dateKey]?.[prevTime];
      if (prevAppointment) {
        const endIndex = TIME_SLOTS.indexOf(prevAppointment.ora_fine);
        if (endIndex > timeIndex) return true;
      }
    }
    return false;
  };

  if (loading || !selectedRoom) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento sale riunioni...</p>
        </div>
      </div>
    );
  }

  const monthAppointmentsCount = allAppointments.filter(a => {
    const appDate = new Date(a.data + 'T00:00:00');
    return a.sala_id === selectedRoom.id && appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
  }).length;

  const currentAppointment = selectedSlot
    ? roomData[selectedSlot.date]?.[selectedSlot.time]
    : null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white border-t-4 border-[#005CA9]">

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 bg-white border-b-2 border-[#005CA9]/20 px-4 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#005CA9]">
                  {selectedRoom.nome}
                </h1>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-500 ${
                  realtimeFlash
                    ? 'bg-green-100 text-green-700 border border-green-300 scale-105'
                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    realtimeFlash ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                  }`} />
                  {realtimeFlash ? 'Aggiornato' : 'Live'}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {monthAppointmentsCount} prenotazioni in {MONTHS[currentMonth]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-blue-50 rounded-lg transition-all border border-gray-200"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 w-44 text-center flex items-center justify-center">
              <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                {MONTHS[currentMonth]} {currentYear}
              </span>
            </div>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-blue-50 rounded-lg transition-all border border-gray-200"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>

            <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
              <div className="relative">
                <select
                  value={selectedRoom.id}
                  onChange={(e) => {
                    const room = rooms.find(r => r.id === e.target.value);
                    if (room) setSelectedRoom(room);
                  }}
                  className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none"
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id} className="text-gray-800 bg-white">
                      {room.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#005CA9] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" style={{ maxHeight: 'calc(100vh - 65px)' }}>
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
                    <div className="px-2 py-2 text-xs font-semibold text-gray-700">{time}</div>
                  </td>
                  {Array.from({ length: getDaysInMonth() }, (_, i) => {
                    const day = i + 1;
                    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const appointment = roomData[dateKey]?.[time];
                    const date = new Date(currentYear, currentMonth, day);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const covered = isCellCovered(dateKey, time);

                    if (covered) return null;

                    if (appointment) {
                      const rowSpan = getSlotSpan(time, appointment.ora_fine);
                      return (
                        <td
                          key={day}
                          className={`relative p-0 border-r border-gray-100 border-b border-gray-100 ${
                            isWeekend ? 'bg-gray-50' : ''
                          }`}
                          rowSpan={rowSpan}
                          style={{ height: `${rowSpan * 45}px` }}
                        >
                          <div
                            className="w-full h-full cursor-pointer hover:opacity-90 transition-all flex items-center justify-center text-white text-[11px] font-semibold px-2"
                            style={{ backgroundColor: getColorForAppointment(appointment.title) }}
                            title={`${appointment.title}\n${time} - ${appointment.ora_fine}`}
                            onClick={() => handleCellClick(dateKey, time)}
                          >
                            <span className="text-center leading-tight">{appointment.title}</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={day}
                        className={`relative p-0 border-r border-gray-100 border-b border-gray-100 ${
                          isWeekend ? 'bg-gray-50' : ''
                        }`}
                        style={{ height: '45px' }}
                      >
                        <div
                          className="w-full h-full hover:bg-blue-50/30 transition-colors cursor-pointer"
                          onClick={() => handleCellClick(dateKey, time)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSlot && (
        <RoomAppointmentModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedSlot(null);
          }}
          onSave={handleSaveAppointment}
          onDelete={currentAppointment ? handleDeleteAppointment : undefined}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          existingAppointment={currentAppointment?.title}
          existingEndTime={currentAppointment?.ora_fine}
          roomName={selectedRoom.nome}
        />
      )}
    </div>
  );
}
