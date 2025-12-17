'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2, User, ChevronDown, X, Plus } from 'lucide-react';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
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
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'  
];

export default function EpasaCalendar({ agendaId }: EpasaCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 0, 1));
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [selectedSede, setSelectedSede] = useState<Sede | null>(null);
  const [visibleDays, setVisibleDays] = useState<Date[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string, operator?: string} | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));
    setVisibleDays(days);
  }, [selectedDate]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage > 0.9 && !isLoadingMore) {
        setIsLoadingMore(true);
        const lastDay = visibleDays[visibleDays.length - 1];
        const newDays = Array.from({ length: 3 }, (_, i) => addDays(lastDay, i + 1));
        setVisibleDays((prev) => [...prev, ...newDays]);
        setTimeout(() => setIsLoadingMore(false), 500);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [visibleDays, isLoadingMore]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSede) {
      const imola = sedi.find(s => s.id === 'imola');
      setSelectedSede(imola || sedi[0]);
    }
  }, [sedi, selectedSede]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: sediData, error: sediError } = await supabase
        .from('epasa_sedi')
        .select('*')
        .order('id');

      if (sediError) throw sediError;
      if (sediData) setSedi(sediData);

      const { data: operatoriData, error: operatoriError } = await supabase
        .from('epasa_operatori')
        .select('*')
        .order('id');

      if (operatoriError) throw operatoriError;
      if (operatoriData) setOperatori(operatoriData);

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('epasa_appuntamenti')
        .select('*')
        .order('data', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      if (appointmentsData) {
        const normalized = appointmentsData.map(apt => ({
          ...apt,
          data: apt.data.split('T')[0],
          ora: typeof apt.ora === 'string' 
            ? apt.ora.substring(0, 5) 
            : apt.ora
        }));

        setAllAppointments(normalized);
      }

      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('epasa_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'epasa_appuntamenti' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleCreateAppointment = async (data: any) => {
  try {
    const { data: newAppointment, error } = await supabase
      .from('epasa_appuntamenti')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    
    // Aggiorna lo stato locale senza ricaricare tutto
    if (newAppointment) {
      const normalized = {
        ...newAppointment,
        data: newAppointment.data.split('T')[0],
        ora: typeof newAppointment.ora === 'string' 
          ? newAppointment.ora.substring(0, 5) 
          : newAppointment.ora
      };
      setAllAppointments(prev => [...prev, normalized]);
    }
  } catch (error) {
    console.error('Errore creazione appuntamento:', error);
    alert('Errore durante la creazione dell\'appuntamento');
  }
};

const handleUpdateAppointment = async (id: string, data: any) => {
  try {
    const { data: updatedAppointment, error } = await supabase
      .from('epasa_appuntamenti')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    // Aggiorna lo stato locale
    if (updatedAppointment) {
      const normalized = {
        ...updatedAppointment,
        data: updatedAppointment.data.split('T')[0],
        ora: typeof updatedAppointment.ora === 'string' 
          ? updatedAppointment.ora.substring(0, 5) 
          : updatedAppointment.ora
      };
      setAllAppointments(prev => 
        prev.map(apt => apt.id === id ? normalized : apt)
      );
    }
  } catch (error) {
    console.error('Errore aggiornamento appuntamento:', error);
    alert('Errore durante l\'aggiornamento dell\'appuntamento');
  }
};

const handleDeleteAppointment = async (id: string) => {
  try {
    const { error } = await supabase
      .from('epasa_appuntamenti')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    // Rimuovi dall'array locale
    setAllAppointments(prev => prev.filter(apt => apt.id !== id));
  } catch (error) {
    console.error('Errore eliminazione appuntamento:', error);
    alert('Errore durante l\'eliminazione dell\'appuntamento');
  }
};


  const openModalForNewAppointment = (date: string, time: string, operator: string) => {
    setSelectedSlot({ date, time, operator });
    setEditingAppointment(null);
    setShowModal(true);
  };

  const openModalForEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedSlot({ date: appointment.data, time: appointment.ora, operator: appointment.operatore_id });
    setShowModal(true);
  };

  const formatDate = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  };

  const getAppointmentsForSlot = (date: string, time: string, operator: string) => {
    if (!selectedSede) return [];

    return allAppointments.filter((apt) => {
      return apt.sede_id === selectedSede.id &&
             apt.data === date &&
             apt.ora === time &&
             apt.operatore_id === operator;
    });
  };

  const getOperatorsForSede = () => {
    if (!selectedSede) return [];

    const operators = new Set<string>();
    allAppointments.forEach(apt => {
      if (apt.sede_id === selectedSede.id) {
        operators.add(apt.operatore_id);
      }
    });

    return Array.from(operators).sort();
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
                  <p className="text-xs text-gray-600 mt-0.5">Agenda 2026</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePreviousDay}
                  disabled={selectedDate <= new Date(2026, 0, 1)}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] transition-colors cursor-pointer"
                >
                  <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                    {format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it })}
                  </span>
                </button>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Building2 className="w-5 h-5 text-[#005CA9]" />
                  <div className="relative">
                    <select
                      value={selectedSede.id}
                      onChange={(e) => {
                        const sede = sedi.find(s => s.id === e.target.value);
                        if (sede) setSelectedSede(sede);
                      }}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none"
                    >
                      {sedi.map((sede) => (
                        <option key={sede.id} value={sede.id} className="text-gray-800 bg-white">
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

          <div 
            ref={scrollContainerRef}
            className="overflow-y-auto" 
            style={{ maxHeight: 'calc(100vh - 107px)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead className="sticky top-0 z-20">
                <tr className="border-b-2 border-[#005CA9]/20">
                  <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 w-[60px] border-r border-gray-200">
                    <span className="text-[#005CA9]">Orario</span>
                  </th>
                  {operatorsInSede.length > 0 ? (
                    operatorsInSede.map((operator) => {
                      const operatorColor = operator === 'MILECE' ? '#DC2626' : '#16A34A';
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
                            <span style={{ color: operatorColor }} className="font-bold">{operator}</span>
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
                {visibleDays.map((day) => {
                  const dateStr = formatDate(day);
                  const today = new Date();
                  const isToday = formatDate(today) === dateStr;

                  return (
                    <React.Fragment key={dateStr}>
                      <tr>
                        <td 
                          colSpan={Math.max(operatorsInSede.length + 1, 2)}
                          className={`p-2 text-center font-bold text-sm sticky left-0 z-10 ${
                            isToday 
                              ? 'bg-[#005CA9] text-white' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {format(day, 'EEEE dd MMMM yyyy', { locale: it })}
                        </td>
                      </tr>

                      {TIME_SLOTS.map((time) => {
                        return (
                          <tr key={`${dateStr}-${time}`}>
                            <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                              <div className="px-1 py-2 text-xs font-semibold text-gray-700">
                                {time}
                              </div>
                            </td>
                            {operatorsInSede.length > 0 ? (
                              operatorsInSede.map((operator) => {
                                const appointmentsInSlot = getAppointmentsForSlot(dateStr, time, operator);
                                const operatorColors = {
                                  MILECE: { bg: 'bg-red-50', border: 'border-l-4 border-red-500', text: 'text-red-700', hover: 'hover:bg-red-100' },
                                  LOREDANA: { bg: 'bg-green-50', border: 'border-l-4 border-green-500', text: 'text-green-700', hover: 'hover:bg-green-100' }
                                };
                                const colors = operatorColors[operator as keyof typeof operatorColors];

                                return (
                                  <td
                                    key={`${operator}-${time}`}
                                    className="relative p-0 border-r border-gray-100 border-b border-gray-100 group"
                                    style={{ height: '45px' }}
                                  >
                                    {appointmentsInSlot.length > 0 ? (
                                      <div 
                                        onClick={() => openModalForEditAppointment(appointmentsInSlot[0])}
                                        className={`w-full h-full px-2 py-1 ${colors.bg} ${colors.border} ${colors.hover} transition-all cursor-pointer flex items-center`}
                                      >
                                        <div className="w-full">
                                          {appointmentsInSlot.map((apt, idx) => (
                                            <div 
                                              key={apt.id} 
                                              className={`flex items-center gap-1.5 ${idx > 0 ? 'mt-1' : ''}`}
                                              title={`${apt.cliente} - ${time} (${operator})\nClicca per modificare`}
                                            >
                                              <User size={10} className={`${colors.text} flex-shrink-0`} />
                                              <span className={`text-[10px] font-medium truncate ${colors.text}`}>
                                                {apt.cliente}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        onClick={() => openModalForNewAppointment(dateStr, time, operator)}
                                        className="w-full h-full hover:bg-blue-50/30 transition-colors cursor-pointer flex items-center justify-center group-hover:bg-blue-50"
                                      >
                                        <Plus size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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

                {isLoadingMore && (
                  <tr>
                    <td colSpan={Math.max(operatorsInSede.length + 1, 2)} className="p-4 text-center text-gray-500">
                      Caricamento...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 mb-6">
              {(() => {
                const monthStart = startOfMonth(selectedDate);
                const monthEnd = endOfMonth(selectedDate);
                const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
                const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: startDate, end: endDate });

                return days.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, selectedDate);
                  const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const today = new Date();
                  const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const isBefore2026 = day < new Date(2026, 0, 1);

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
                        ${isBefore2026
                          ? 'bg-transparent text-gray-300 cursor-not-allowed'
                          : isSelected 
                            ? 'bg-[#005CA9] text-white shadow-md scale-105' 
                            : isToday
                              ? 'bg-[#E6F2FF] text-[#005CA9] font-bold'
                              : isCurrentMonth 
                                ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105' 
                                : 'bg-transparent text-gray-300'
                        }
                        ${!isBefore2026 ? 'cursor-pointer' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                });
              })()}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(new Date(2026, 0, 1));
                setShowDatePicker(false);
              }}
              className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold"
            >
              Vai a 1 Gennaio 2026
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