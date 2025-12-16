'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Building2, ChevronDown, User, Filter } from 'lucide-react';

interface EpasaCalendarProps {
  agendaId: string;
}

interface Appointment {
  sede: string;
  date: string;
  time: string;
  client: string;
  month: string;
  operator: string; // "MILECE" o "LOREDANA"
}

interface SedeData {
  [date: string]: {
    [time: string]: Appointment | null;
  };
}

const SEDI = [
  { id: 'imola', name: 'Imola', color: '#005CA9' },
  { id: 'cspt', name: 'CSPT', color: '#DC2626' },
  { id: 'borgo', name: 'Borgo', color: '#16A34A' }
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

const OPERATORS = [
  { id: 'all', name: 'Tutti', color: '#005CA9' },
  { id: 'MILECE', name: 'MILECE', color: '#DC2626' },
  { id: 'LOREDANA', name: 'LOREDANA', color: '#16A34A' }
];

export default function EpasaCalendar({ agendaId }: EpasaCalendarProps) {
  const [selectedSede, setSelectedSede] = useState(SEDI[0]);
  const [selectedOperator, setSelectedOperator] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(0);
  const [currentYear] = useState(2026);
  const [sedeData, setSedeData] = useState<SedeData>({});
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointmentsData();
  }, []);

  useEffect(() => {
    if (allAppointments.length > 0) {
      processSedeData();
    }
  }, [selectedSede, selectedOperator, currentMonth, allAppointments]);

  const loadAppointmentsData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/data/epasa_appointments.json');
      if (!response.ok) {
        throw new Error('Failed to load appointments data');
      }
      const data = await response.json();

      const allApps: Appointment[] = [];
      Object.keys(data.sedi).forEach(sedeId => {
        allApps.push(...data.sedi[sedeId]);
      });

      setAllAppointments(allApps);
      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento dati appuntamenti:', error);
      setAllAppointments([]);
      setLoading(false);
    }
  };

  const processSedeData = () => {
    const newSedeData: SedeData = {};

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      newSedeData[dateKey] = {};

      TIME_SLOTS.forEach(time => {
        newSedeData[dateKey][time] = null;
      });
    }

    const filteredAppointments = allAppointments.filter(app => {
      if (app.sede !== selectedSede.id) return false;

      // Filtra per operatore se selezionato
      if (selectedOperator !== 'all' && app.operator !== selectedOperator) return false;

      const appDate = new Date(app.date);
      return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
    });

    filteredAppointments.forEach(app => {
      if (newSedeData[app.date] && TIME_SLOTS.includes(app.time)) {
        newSedeData[app.date][app.time] = app;
      }
    });

    setSedeData(newSedeData);
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

  // Calcola statistiche per il mese corrente
  const monthStats = allAppointments.reduce((acc, app) => {
    if (app.sede === selectedSede.id && new Date(app.date).getMonth() === currentMonth) {
      if (!acc[app.operator]) acc[app.operator] = 0;
      acc[app.operator]++;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalMonthAppointments = Object.values(monthStats).reduce((sum, count) => sum + count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento agenda EPASA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        {/* Contenitore principale */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">

          {/* Header superiore */}
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Sinistra: Info sede e statistiche */}
              <div className="flex items-center gap-3">
                <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#005CA9]">
                    EPASA - {selectedSede.name}
                  </h1>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {totalMonthAppointments} appuntamenti in {MONTHS[currentMonth]}
                    {monthStats.MILECE && ` (MILECE: ${monthStats.MILECE})`}
                    {monthStats.LOREDANA && ` (LOREDANA: ${monthStats.LOREDANA})`}
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

                {/* Selettore operatore */}
                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <div className="relative">
                    <select
                      value={selectedOperator}
                      onChange={(e) => setSelectedOperator(e.target.value)}
                      className="px-3 py-2 pr-8 text-sm bg-white text-gray-700 border-2 border-gray-200 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-gray-50 appearance-none"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.id} value={op.id} className="text-gray-800 bg-white">
                          {op.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                  </div>
                </div>

                {/* Selettore sede */}
                <div className="flex items-center gap-2 border-l border-gray-300 pl-2">
                  <div className="relative">
                    <select
                      value={selectedSede.id}
                      onChange={(e) => {
                        const sede = SEDI.find(s => s.id === e.target.value);
                        if (sede) setSelectedSede(sede);
                      }}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none"
                    >
                      {SEDI.map((sede) => (
                        <option key={sede.id} value={sede.id} className="text-gray-800 bg-white">
                          {sede.name}
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
                        className={`p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[140px] ${ 
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
                      const appointment = sedeData[dateKey]?.[time];
                      const date = new Date(currentYear, currentMonth, day);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                      // Colori per operatore
                      const operatorColors = {
                        MILECE: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
                        LOREDANA: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100' }
                      };

                      const colors = appointment ? operatorColors[appointment.operator as keyof typeof operatorColors] : null;

                      return (
                        <td
                          key={day}
                          className={`relative p-0 border-r border-gray-100 border-b border-gray-100 ${
                            isWeekend ? 'bg-gray-50' : ''
                          }`}
                          style={{ height: '45px' }}
                        >
                          {appointment ? (
                            <div
                              className={`w-full h-full px-2 py-1 cursor-pointer transition-all flex flex-col justify-center ${colors?.bg} hover:opacity-80 border-l-2 ${colors?.border}`}
                              title={`${appointment.client} - ${time} (${appointment.operator})`}
                            >
                              <div className="flex items-center gap-1.5 w-full mb-0.5">
                                <User size={10} className={colors?.text + " flex-shrink-0"} />
                                <span className={`text-[9px] font-medium truncate ${colors?.text}`}>
                                  {appointment.client}
                                </span>
                              </div>
                              <div className="flex justify-end">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded ${colors?.badge} ${colors?.text} font-bold`}>
                                  {appointment.operator}
                                </span>
                              </div>
                            </div>
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