'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Building2,
  User,
  ChevronDown,
  X,
  Plus,
  LayoutGrid,
  List,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isWeekend,
  getDay,
  differenceInDays,
} from 'date-fns';
import { it } from 'date-fns/locale';
import React from 'react';
import EpasaAppointmentModal from './EpasaAppointmentModal';

interface EpasaCalendarProps {
  agendaId: string;
}

interface Sede {
  id: string;
  nome: string;
  colore: string;
}

interface Operatore {
  id: string;
  nome: string;
  colore: string;
}

interface Appointment {
  id: string;
  sede_id: string;
  operatore_id: string;
  data: string;
  ora: string;
  cliente: string;
  mese: string;
  note?: string;
}

const TIME_SLOTS = [
  '08:00','08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00'
];

type ViewMode = 'daily' | 'monthly';
type DayAvailability = 'free' | 'partial' | 'full';

// 🔧 LIMITE MASSIMO di giorni da tenere in memoria
const MAX_VISIBLE_DAYS = 40;
const DAYS_TO_LOAD = 7;

export default function EpasaCalendar({ agendaId }: EpasaCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [selectedSede, setSelectedSede] = useState<Sede | null>(null);
  const [visibleDays, setVisibleDays] = useState<Date[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    time: string;
    operator?: string;
  } | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const isLoadingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const scrollListenerAttachedRef = useRef(false);

  const isWorkingDay = (date: Date): boolean => {
    const day = getDay(date);
    return day !== 0 && day !== 6;
  };

  const scrollToSelectedDate = () => {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const dateElement = document.querySelector<HTMLElement>(
      `[data-epasa-date="${selectedDateStr}"]`,
    );
    if (dateElement && scrollContainerRef.current) {
      dateElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 🔧 Funzione per caricare più giorni in avanti E RIMUOVERE quelli vecchi
  const loadMoreDaysForward = () => {
    if (isLoadingRef.current) return;
    
    console.log('🔽 Caricamento giorni futuri...');
    isLoadingRef.current = true;

    setVisibleDays(prev => {
      const lastDay = prev[prev.length - 1];
      const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => addDays(lastDay, i + 1));
      
      let updatedDays = [...prev, ...newDays];
      
      // 🔧 RIMUOVI i giorni vecchi se supera il limite
      if (updatedDays.length > MAX_VISIBLE_DAYS) {
        const daysToRemove = updatedDays.length - MAX_VISIBLE_DAYS;
        updatedDays = updatedDays.slice(daysToRemove);
        console.log(`🗑️ Rimossi ${daysToRemove} giorni vecchi`);
      }
      
      console.log(`✅ Ora visibili ${updatedDays.length} giorni (da ${format(updatedDays[0], 'dd/MM')} a ${format(updatedDays[updatedDays.length - 1], 'dd/MM')})`);
      return updatedDays;
    });

    setTimeout(() => {
      isLoadingRef.current = false;
    }, 500);
  };

  // 🔧 Funzione per caricare più giorni indietro E RIMUOVERE quelli futuri
  const loadMoreDaysBackward = () => {
    if (isLoadingRef.current) return;

    setVisibleDays(prev => {
      const firstDay = prev[0];
      
      if (firstDay <= new Date(2026, 0, 1)) {
        console.log('⛔ Limite minimo raggiunto (1 gennaio 2026)');
        return prev;
      }

      console.log('🔼 Caricamento giorni passati...');
      isLoadingRef.current = true;

      const container = scrollContainerRef.current;
      if (container) {
        const scrollBefore = container.scrollTop;
        const scrollHeightBefore = container.scrollHeight;

        const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => subDays(firstDay, DAYS_TO_LOAD - i));
        
        let updatedDays = [...newDays, ...prev];
        
        // 🔧 RIMUOVI i giorni futuri se supera il limite
        if (updatedDays.length > MAX_VISIBLE_DAYS) {
          const daysToRemove = updatedDays.length - MAX_VISIBLE_DAYS;
          updatedDays = updatedDays.slice(0, -daysToRemove);
          console.log(`🗑️ Rimossi ${daysToRemove} giorni futuri`);
        }

        console.log(`✅ Ora visibili ${updatedDays.length} giorni (da ${format(updatedDays[0], 'dd/MM')} a ${format(updatedDays[updatedDays.length - 1], 'dd/MM')})`);

        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const heightDiff = newScrollHeight - scrollHeightBefore;
            container.scrollTop = scrollBefore + heightDiff;
          }
          isLoadingRef.current = false;
        }, 50);

        return updatedDays;
      }

      isLoadingRef.current = false;
      return prev;
    });
  };

  // 🔧 Handler scroll principale
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollDirection = scrollTop > lastScrollTopRef.current ? 'down' : 'up';
    lastScrollTopRef.current = scrollTop;

    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const distanceFromTop = scrollTop;

    // SCROLL VERSO IL BASSO
    if (scrollDirection === 'down' && distanceFromBottom < 1000) {
      loadMoreDaysForward();
    }
    
    // SCROLL VERSO L'ALTO
    else if (scrollDirection === 'up' && distanceFromTop < 1000 && distanceFromTop > 0) {
      loadMoreDaysBackward();
    }
  };

  // 🔧 INIZIALIZZAZIONE: Carica 20 giorni
  useEffect(() => {
    console.log('🚀 Inizializzazione calendario...');
    const days = Array.from({ length: 20 }, (_, i) => addDays(selectedDate, i));
    setVisibleDays(days);
    
    setTimeout(() => {
      scrollToSelectedDate();
      if (scrollContainerRef.current && !scrollListenerAttachedRef.current) {
        console.log('🔗 Attaching scroll listener dopo inizializzazione...');
        attachScrollListener();
      }
    }, 200);
  }, [selectedDate]);

  // 🔧 Funzione per attaccare il listener
  const attachScrollListener = () => {
    const container = scrollContainerRef.current;
    if (!container || scrollListenerAttachedRef.current) return;

    console.log('✅ Scroll listener ATTIVATO!');
    container.addEventListener('scroll', handleScroll, { passive: true });
    scrollListenerAttachedRef.current = true;
  };

  // 🔧 useEffect che si attiva SOLO quando il container è pronto E dati caricati
  useEffect(() => {
    if (!loading && scrollContainerRef.current && viewMode === 'daily' && !scrollListenerAttachedRef.current) {
      console.log('🎯 Container pronto, attacco listener...');
      attachScrollListener();
    }

    return () => {
      const container = scrollContainerRef.current;
      if (container && scrollListenerAttachedRef.current) {
        console.log('🔌 Rimuovo scroll listener');
        container.removeEventListener('scroll', handleScroll);
        scrollListenerAttachedRef.current = false;
      }
    };
  }, [loading, viewMode]);

  // 🔧 Cleanup quando cambia view mode
  useEffect(() => {
    if (viewMode === 'monthly' && scrollListenerAttachedRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        console.log('🔌 Rimuovo listener (vista mensile)');
        container.removeEventListener('scroll', handleScroll);
        scrollListenerAttachedRef.current = false;
      }
    }
  }, [viewMode]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSede) {
      const imola = sedi.find(s => s.id === 'imola');
      setSelectedSede(imola || sedi[0]);
    }
  }, [sedi, selectedSede]);

  const loadData = async () => {
    console.log('📥 Caricamento dati agenda...');
    setLoading(true);
    try {
      const sediRes = await fetch('/api/epasa/sedi');
      const sediData = await sediRes.json();
      if (sediData) setSedi(sediData);

      const operatoriRes = await fetch('/api/epasa/operatori');
      const operatoriData = await operatoriRes.json();
      if (operatoriData) setOperatori(operatoriData);

      const appointmentsRes = await fetch('/api/epasa/appuntamenti');
      const appointmentsData = await appointmentsRes.json();
      if (appointmentsData) {
        setAllAppointments(appointmentsData);
      }

      console.log('✅ Dati caricati con successo!');
      setLoading(false);
    } catch (error) {
      console.error('❌ Errore caricamento dati:', error);
      setLoading(false);
    }
  };

  const handleCreateAppointment = async (data: any) => {
    try {
      const response = await fetch('/api/epasa/appuntamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Errore creazione appuntamento');

      const newAppointment = await response.json();
      setAllAppointments(prev => [...prev, newAppointment]);
    } catch (error) {
      console.error('Errore creazione appuntamento:', error);
      alert("Errore durante la creazione dell'appuntamento");
    }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    try {
      const response = await fetch(`/api/epasa/appuntamenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Errore aggiornamento appuntamento');

      const updatedAppointment = await response.json();
      setAllAppointments(prev =>
        prev.map(apt => (apt.id === id ? updatedAppointment : apt)),
      );
    } catch (error) {
      console.error('Errore aggiornamento appuntamento:', error);
      alert("Errore durante l'aggiornamento dell'appuntamento");
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      const response = await fetch(`/api/epasa/appuntamenti/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Errore eliminazione appuntamento');

      setAllAppointments(prev => prev.filter(apt => apt.id !== id));
    } catch (error) {
      console.error('Errore eliminazione appuntamento:', error);
      alert("Errore durante l'eliminazione dell'appuntamento");
    }
  };

  const openModalForNewAppointment = (
    date: string,
    time: string,
    operator: string,
  ) => {
    setSelectedSlot({ date, time, operator });
    setEditingAppointment(null);
    setShowModal(true);
  };

  const openModalForEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedSlot({
      date: appointment.data,
      time: appointment.ora,
      operator: appointment.operatore_id,
    });
    setShowModal(true);
  };

  const formatDate = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  };

  const getAppointmentsForSlot = (
    date: string,
    time: string,
    operator: string,
  ) => {
    if (!selectedSede) return [];

    return allAppointments.filter(apt => {
      return (
        apt.sede_id === selectedSede.id &&
        apt.data === date &&
        apt.ora === time &&
        apt.operatore_id === operator
      );
    });
  };

  const getDayAvailability = (date: string, operator: string): DayAvailability => {
    if (!selectedSede) return 'free';

    const dayAppointments = allAppointments.filter(
      apt =>
        apt.sede_id === selectedSede.id &&
        apt.data === date &&
        apt.operatore_id === operator,
    );

    const totalSlots = TIME_SLOTS.length;
    const occupiedSlots = dayAppointments.length;

    if (occupiedSlots === 0) return 'free';
    if (occupiedSlots >= totalSlots * 0.8) return 'full';
    return 'partial';
  };

  const getFirstAvailableDay = (operator: string): string | null => {
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const checkDate = addDays(today, i);
      
      if (!isWorkingDay(checkDate)) {
        continue;
      }
      
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const availability = getDayAvailability(dateStr, operator);
      
      if (availability === 'free' || availability === 'partial') {
        return dateStr;
      }
    }
    return null;
  };

  const getOperatorsForSede = () => {
    return operatori.map(op => op.id).sort();
  };

  const operatorsInSede = getOperatorsForSede();

  const handlePreviousDay = () => {
    const newDate = subDays(selectedDate, 1);
    if (newDate >= new Date(2026, 0, 1)) {
      setSelectedDate(newDate);
    }
  };

  const handlePreviousMonth = () => {
    const newDate = subMonths(selectedDate, 1);
    if (newDate >= new Date(2026, 0, 1)) {
      setSelectedDate(newDate);
    }
  };

  const renderMonthlyView = () => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-xs font-medium text-gray-700">Libero</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500"></div>
            <span className="text-xs font-medium text-gray-700">Parzialmente occupato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-xs font-medium text-gray-700">Pieno</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-300"></div>
            <span className="text-xs font-medium text-gray-700">Weekend (chiuso)</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-b border-r">
                  Giorno
                </th>
                {operatorsInSede.map(operator => {
                  const operatorColor = operator === 'MILECE' ? '#DC2626' : '#16A34A';
                  const firstAvailable = getFirstAvailableDay(operator);
                  
                  return (
                    <th
                      key={operator}
                      className="p-3 text-center text-sm font-semibold border-b"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: operatorColor }}
                          >
                            <User size={14} className="text-white" />
                          </div>
                          <span style={{ color: operatorColor }}>{operator}</span>
                        </div>
                        {firstAvailable && (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            Primo libero: {format(new Date(firstAvailable), 'dd/MM')}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dateStr = formatDate(day);
                const today = new Date();
                const isToday = formatDate(today) === dateStr;
                const isBefore2026 = day < new Date(2026, 0, 1);
                const isWeekendDay = isWeekend(day);

                return (
                  <tr
                    key={dateStr}
                    className="border-b hover:bg-gray-50 transition-colors"
                  >
                    <td
                      className={`p-3 font-medium border-r ${
                        isToday
                          ? 'bg-[#005CA9] text-white'
                          : isWeekendDay
                          ? 'bg-gray-200 text-gray-400'
                          : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{format(day, 'd')}</span>
                        <span className="text-xs capitalize">
                          {format(day, 'EEE', { locale: it })}
                        </span>
                      </div>
                    </td>
                    
                    {operatorsInSede.map(operator => {
                      if (isWeekendDay) {
                        return (
                          <td
                            key={`${dateStr}-${operator}`}
                            className="p-2 text-center bg-gray-200 opacity-50"
                            title="Weekend - Chiuso"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-gray-500">-</span>
                            </div>
                          </td>
                        );
                      }

                      const availability = getDayAvailability(dateStr, operator);
                      const bgColor =
                        availability === 'free'
                          ? 'bg-green-100'
                          : availability === 'partial'
                          ? 'bg-yellow-100'
                          : 'bg-red-100';
                      const borderColor =
                        availability === 'free'
                          ? 'border-green-500'
                          : availability === 'partial'
                          ? 'border-yellow-500'
                          : 'border-red-500';

                      const dayAppointments = allAppointments.filter(
                        apt =>
                          apt.sede_id === selectedSede?.id &&
                          apt.data === dateStr &&
                          apt.operatore_id === operator,
                      );

                      return (
                        <td
                          key={`${dateStr}-${operator}`}
                          className={`p-2 text-center cursor-pointer ${bgColor} border-l-4 ${borderColor} ${
                            isBefore2026
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:opacity-80'
                          }`}
                          onClick={() => {
                            if (!isBefore2026) {
                              setSelectedDate(day);
                              setViewMode('daily');
                            }
                          }}
                          title={`${operator} - ${format(day, 'dd/MM/yyyy')}\n${
                            dayAppointments.length
                          } appuntamenti\nClicca per dettagli`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-gray-700">
                              {dayAppointments.length}
                            </span>
                            <span className="text-xs text-gray-600">
                              {availability === 'free'
                                ? 'Vuoto'
                                : availability === 'partial'
                                ? 'App.'
                                : 'Pieno'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDailyView = () => {
    return (
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 107px)' }}
      >
        <table
          className="w-full"
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        >
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2 border-[#005CA9]/20">
              <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 w-[60px] border-r border-gray-200">
                <span className="text-[#005CA9]">Orario</span>
              </th>
              {operatorsInSede.length > 0 ? (
                operatorsInSede.map(operator => {
                  const operatorColor =
                    operator === 'MILECE' ? '#DC2626' : '#16A34A';
                  return (
                    <th
                      key={operator}
                      className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[200px]"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: operatorColor }}
                        >
                          <User size={14} className="text-white" />
                        </div>
                        <span
                          style={{ color: operatorColor }}
                          className="font-bold"
                        >
                          {operator}
                        </span>
                      </div>
                    </th>
                  );
                })
              ) : (
                <th className="p-2 text-center text-xs text-gray-500">
                  Nessun operatore per questa sede
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(day => {
              const dateStr = formatDate(day);
              const today = new Date();
              const isToday = formatDate(today) === dateStr;
              const isWeekendDay = isWeekend(day);

              return (
                <React.Fragment key={dateStr}>
                  <tr data-epasa-date={dateStr}>
                    <td
                      colSpan={Math.max(operatorsInSede.length + 1, 2)}
                      className={`p-2 text-center font-bold text-sm sticky left-0 z-10 ${
                        isToday
                          ? 'bg-[#005CA9] text-white'
                          : isWeekendDay
                          ? 'bg-gray-300 text-gray-600'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {format(day, 'EEEE dd MMMM yyyy', { locale: it })}
                      {isWeekendDay && <span className="ml-2 text-xs">(CHIUSO)</span>}
                    </td>
                  </tr>

                  {!isWeekendDay && TIME_SLOTS.map(time => {
                    return (
                      <tr key={`${dateStr}-${time}`}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                          <div className="px-1 py-2 text-xs font-semibold text-gray-700">
                            {time}
                          </div>
                        </td>
                        {operatorsInSede.length > 0 ? (
                          operatorsInSede.map(operator => {
                            const appointmentsInSlot =
                              getAppointmentsForSlot(
                                dateStr,
                                time,
                                operator,
                              );
                            const operatorColors = {
                              MILECE: {
                                bg: 'bg-red-50',
                                border: 'border-l-4 border-red-500',
                                text: 'text-red-700',
                                hover: 'hover:bg-red-100',
                              },
                              LOREDANA: {
                                bg: 'bg-green-50',
                                border: 'border-l-4 border-green-500',
                                text: 'text-green-700',
                                hover: 'hover:bg-green-100',
                              },
                            } as const;
                            const colors =
                              operatorColors[
                                operator as keyof typeof operatorColors
                              ] ||
                              operatorColors.LOREDANA;

                            return (
                              <td
                                key={`${operator}-${time}`}
                                className="relative p-0 border-r border-gray-100 border-b border-gray-100 group"
                                style={{ height: '45px' }}
                              >
                                {appointmentsInSlot.length > 0 ? (
                                  <div
                                    onClick={() =>
                                      openModalForEditAppointment(
                                        appointmentsInSlot[0],
                                      )
                                    }
                                    className={`w-full h-full px-2 py-1 ${colors.bg} ${colors.border} ${colors.hover} transition-all cursor-pointer flex items-center`}
                                  >
                                    <div className="w-full">
                                      {appointmentsInSlot.map(
                                        (apt, idx) => (
                                          <div
                                            key={apt.id}
                                            className={`flex items-center gap-1.5 ${
                                              idx > 0 ? 'mt-1' : ''
                                            }`}
                                            title={`${apt.cliente} - ${time} (${operator})\nClicca per modificare`}
                                          >
                                            <User
                                              size={10}
                                              className={`${colors.text} flex-shrink-0`}
                                            />
                                            <span
                                              className={`text-[10px] font-medium truncate ${colors.text}`}
                                            >
                                              {apt.cliente}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() =>
                                      openModalForNewAppointment(
                                        dateStr,
                                        time,
                                        operator,
                                      )
                                    }
                                    className="w-full h-full hover:bg-blue-50/30 transition-colors cursor-pointer flex items-center justify-center group-hover:bg-blue-50"
                                  >
                                    <Plus
                                      size={14}
                                      className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                  </div>
                                )}
                              </td>
                            );
                          })
                        ) : (
                          <td className="p-2 text-center text-xs text-gray-400">
                            -
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">
            Caricamento agenda EPASA...
          </p>
        </div>
      </div>
    );
  }

  if (!selectedSede) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Nessuna sede disponibile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
                  <CalendarIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#005CA9]">
                    EPASA - {selectedSede.nome}
                  </h1>
                  <p className="text-xs text-gray-600 mt-0.5">Agenda 2026 (Lun-Ven 8:30-12:30)</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
                  <button
                    onClick={() => setViewMode('daily')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'daily'
                        ? 'bg-[#005CA9] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <List className="w-4 h-4 inline mr-1" />
                    Giornaliera
                  </button>
                  <button
                    onClick={() => setViewMode('monthly')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'monthly'
                        ? 'bg-[#005CA9] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 inline mr-1" />
                    Mensile
                  </button>
                </div>

                {viewMode === 'daily' && (
                  <>
                    <button
                      onClick={handlePreviousDay}
                      disabled={selectedDate <= new Date(2026, 0, 1)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                  </>
                )}

                {viewMode === 'monthly' && (
                  <button
                    onClick={handlePreviousMonth}
                    disabled={selectedDate <= new Date(2026, 0, 1)}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] transition-colors cursor-pointer"
                >
                  <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                    {viewMode === 'daily'
                      ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it })
                      : format(selectedDate, 'MMMM yyyy', { locale: it })}
                  </span>
                </button>

                {viewMode === 'daily' && (
                  <button
                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                {viewMode === 'monthly' && (
                  <button
                    onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Building2 className="w-5 h-5 text-[#005CA9]" />
                  <div className="relative">
                    <select
                      value={selectedSede.id}
                      onChange={e => {
                        const sede = sedi.find(s => s.id === e.target.value);
                        if (sede) setSelectedSede(sede);
                      }}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none"
                    >
                      {sedi.map(sede => (
                        <option
                          key={sede.id}
                          value={sede.id}
                          className="text-gray-800 bg-white"
                        >
                          {sede.nome}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#005CA9] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'daily' ? renderDailyView() : renderMonthlyView()}
        </div>
      </div>

      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#005CA9]">
                Seleziona Data
              </h3>
              <button
                onClick={() => setShowDatePicker(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePreviousMonth}
                disabled={selectedDate <= new Date(2026, 0, 1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} className="text-[#005CA9]" />
              </button>
              <h4 className="text-lg font-bold text-gray-800 capitalize">
                {format(selectedDate, 'MMMM yyyy', { locale: it })}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={20} className="text-[#005CA9]" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-gray-600 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 mb-6">
              {(() => {
                const monthStart = startOfMonth(selectedDate);
                const monthEnd = endOfMonth(selectedDate);
                const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                
                const firstDayOfWeek = (getDay(monthStart) + 6) % 7;
                const emptyDays = Array(firstDayOfWeek).fill(null);

                return (
                  <>
                    {emptyDays.map((_, index) => (
                      <div key={`empty-${index}`} className="aspect-square" />
                    ))}
                    
                    {days.map((day, index) => {
                      const isSelected =
                        format(day, 'yyyy-MM-dd') ===
                        format(selectedDate, 'yyyy-MM-dd');
                      const today = new Date();
                      const isToday =
                        format(day, 'yyyy-MM-dd') ===
                        format(today, 'yyyy-MM-dd');
                      const isBefore2026 = day < new Date(2026, 0, 1);
                      const isWeekendDay = isWeekend(day);

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!isBefore2026) {
                              setSelectedDate(day);
                              setShowDatePicker(false);
                            }
                          }}
                          disabled={isBefore2026}
                          className={`
                            aspect-square rounded-lg text-sm font-medium transition-all
                            ${
                              isBefore2026
                                ? 'bg-transparent text-gray-300 cursor-not-allowed'
                                : isSelected
                                ? 'bg-[#005CA9] text-white shadow-md scale-105'
                                : isToday
                                ? 'bg-[#E6F2FF] text-[#005CA9] font-bold'
                                : isWeekendDay
                                ? 'bg-gray-200 text-gray-400'
                                : 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105'
                            }
                            ${!isBefore2026 ? 'cursor-pointer' : ''} 
                          `}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(new Date());
                setShowDatePicker(false);
              }}
              className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold"
            >
              Vai a Oggi
            </button>
          </div>
        </div>
      )}

      {showModal && selectedSlot && (
        <EpasaAppointmentModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingAppointment(null);
            setSelectedSlot(null);
          }}
          onSave={handleCreateAppointment}
          onUpdate={handleUpdateAppointment}
          onDelete={handleDeleteAppointment}
          existingAppointment={editingAppointment}
          sedi={sedi}
          operatori={operatori}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          selectedSedeId={selectedSede.id}
          defaultOperatoreId={selectedSlot.operator}
        />
      )}
    </div>
  );
}
