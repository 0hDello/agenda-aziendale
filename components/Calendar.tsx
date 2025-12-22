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
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import { formatDate, TIME_SLOTS } from '@/utils/dateUtils';
import TimeSlot from './TimeSlot';
import AppointmentModal from './AppointmentModal';
import React from 'react';

interface CalendarProps {
  agendaId?: string;
}

export default function Calendar({ agendaId = '730' }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleDays, setVisibleDays] = useState<Date[]>([]);
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [personaSede, setPersonaSede] = useState<PersonaSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({
    date: '',
    time: '',
    personaId: '',
  });
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appuntamento | null>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<{
    appointment: Appuntamento;
    originalTime: string;
  } | null>(null);
  const [resizingAppointment, setResizingAppointment] =
    useState<Appuntamento | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // funzione che porta in vista il giorno selezionato
  const scrollToSelectedDate = () => {
    const selectedDateStr = formatDate(selectedDate);
    const dateElement = document.querySelector<HTMLElement>(
      `[data-date="${selectedDateStr}"]`,
    );
    if (dateElement && scrollContainerRef.current) {
      dateElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Inizializza con 7 giorni a partire dalla data selezionata
  useEffect(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));
    setVisibleDays(days);
    setHasInitialLoad(false);

    // ogni volta che cambia la data, porta il calendario su quel giorno
    setTimeout(scrollToSelectedDate, 100);
  }, [selectedDate]);

  // Scroll infinito: carica più giorni quando si arriva in fondo
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Quando si raggiunge il 90% dello scroll, carica altri 3 giorni
      if (scrollPercentage > 0.9 && !isLoadingMore) {
        setIsLoadingMore(true);
        const lastDay = visibleDays[visibleDays.length - 1];
        const newDays = Array.from({ length: 3 }, (_, i) =>
          addDays(lastDay, i + 1),
        );
        setVisibleDays(prev => [...prev, ...newDays]);
        setTimeout(() => setIsLoadingMore(false), 500);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [visibleDays, isLoadingMore]);

  // Forza il refresh iniziale simulando il click su "Oggi"
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedDate(new Date());
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-caricamento quando il contenuto è troppo corto
  useEffect(() => {
    if (visibleDays.length === 0 || isLoadingMore) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { scrollHeight, clientHeight } = container;

        if (scrollHeight <= clientHeight + 20 && visibleDays.length < 60) {
          const lastDay = visibleDays[visibleDays.length - 1];
          const newDays = Array.from({ length: 5 }, (_, i) =>
            addDays(lastDay, i + 1),
          );
          setVisibleDays(prev => [...prev, ...newDays]);
        } else if (!hasInitialLoad) {
          setHasInitialLoad(true);
        }
      });
    });
  }, [visibleDays.length, isLoadingMore, hasInitialLoad]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToChanges();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSedeId) {
      setSelectedSedeId(sedi[0].id);
    }
  }, [sedi, selectedSedeId]);

  useEffect(() => {
    const handleMouseEnter = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const cell = target.closest('[data-appointment-id]');
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) {
          document
            .querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`)
            .forEach(el => {
              el.classList.add('appointment-hover');
            });
        }
      }
    };

    const handleMouseLeave = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const cell = target.closest('[data-appointment-id]');
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) {
          document
            .querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`)
            .forEach(el => {
              el.classList.remove('appointment-hover');
            });
        }
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      document
        .querySelectorAll<HTMLElement>('.appointment-hover')
        .forEach(el => {
          el.classList.remove('appointment-hover');
        });
    };
  }, []);

  useEffect(() => {
    if (!resizingAppointment) {
      document.querySelectorAll('.resize-overlay').forEach(el => {
        el.remove();
      });
      document.querySelectorAll<HTMLElement>('[data-appointment-id]').forEach(
        el => {
          el.style.opacity = '';
        },
      );
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) {
        setIsResizing(true);
      }

      const table = document.querySelector('table tbody');
      if (!table) return;

      const rect = table.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const rowHeight = 45;

      const exactSlotPosition = relativeY / rowHeight;
      const targetSlotIndex = Math.floor(exactSlotPosition);

      if (targetSlotIndex >= 0 && targetSlotIndex < TIME_SLOTS.length) {
        const startTime = resizingAppointment.ora_inizio.substring(0, 5);
        const startIndex = TIME_SLOTS.findIndex(
          slot => slot.label === startTime,
        );

        const appointmentElement = document.querySelector<HTMLElement>(
          `[data-appointment-id="${resizingAppointment.id}"]`,
        );

        if (appointmentElement) {
          const oldOverlay =
            appointmentElement.querySelector<HTMLElement>('.resize-overlay');
          if (oldOverlay) {
            oldOverlay.remove();
          }

          const newEndSlotIndex = targetSlotIndex;

          const currentEndTime = resizingAppointment.ora_fine.substring(0, 5);
          let currentEndIndex = TIME_SLOTS.findIndex(
            slot => slot.label === currentEndTime,
          );
          if (currentEndIndex === -1 && currentEndTime === '18:00') {
            currentEndIndex = TIME_SLOTS.length;
          }

          if (newEndSlotIndex > currentEndIndex) {
            const newSlotCount = newEndSlotIndex - startIndex;
            const newHeight = newSlotCount * rowHeight;

            const overlay = document.createElement('div');
            overlay.className = 'resize-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.height = `${newHeight}px`;
            overlay.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
            overlay.style.border = '2px dashed rgb(34, 197, 94)';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '20';

            appointmentElement.appendChild(overlay);
            appointmentElement.style.opacity = '0.7';
          } else if (
            newEndSlotIndex < currentEndIndex &&
            newEndSlotIndex > startIndex
          ) {
            const newSlotCount = newEndSlotIndex - startIndex;
            const newHeight = newSlotCount * rowHeight;

            const overlay = document.createElement('div');
            overlay.className = 'resize-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = `${newHeight}px`;
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
            overlay.style.border = '2px dashed rgb(239, 68, 68)';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '20';

            appointmentElement.appendChild(overlay);
            appointmentElement.style.opacity = '0.8';
          }
        }
      }
    };

    const cleanupResizeEffects = () => {
      document.querySelectorAll('.resize-overlay').forEach(el => {
        el.remove();
      });

      document.querySelectorAll<HTMLElement>('[data-appointment-id]').forEach(
        el => {
          el.style.opacity = '';
        },
      );
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (!resizingAppointment) return;

      cleanupResizeEffects();

      const table = document.querySelector('table tbody');
      if (!table) {
        setResizingAppointment(null);
        setTimeout(() => {
          setIsResizing(false);
        }, 100);
        return;
      }

      const rect = table.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const rowHeight = 45;

      const exactSlotPosition = relativeY / rowHeight;
      const targetSlotIndex = Math.floor(exactSlotPosition);

      if (targetSlotIndex >= 0 && targetSlotIndex < TIME_SLOTS.length) {
        const newEndSlotIndex = targetSlotIndex;

        if (newEndSlotIndex <= TIME_SLOTS.length && newEndSlotIndex > 0) {
          const newEndTime =
            newEndSlotIndex < TIME_SLOTS.length
              ? TIME_SLOTS[newEndSlotIndex].label
              : '18:00';
          const startTime = resizingAppointment.ora_inizio.substring(0, 5);

          const startIndex = TIME_SLOTS.findIndex(
            slot => slot.label === startTime,
          );
          if (newEndSlotIndex <= startIndex) {
            alert("La durata minima dell'appuntamento è 30 minuti");
            setResizingAppointment(null);
            setTimeout(() => {
              setIsResizing(false);
            }, 100);
            return;
          }

          if (newEndTime > startTime) {
            const hasConflict = appointments.some(apt => {
              if (apt.id === resizingAppointment.id) return false;
              if (apt.persona_id !== resizingAppointment.persona_id)
                return false;
              if (apt.sede_id !== resizingAppointment.sede_id) return false;
              if (apt.data !== resizingAppointment.data) return false;

              const aptStart = apt.ora_inizio.substring(0, 5);
              const aptEnd = apt.ora_fine.substring(0, 5);

              return startTime < aptEnd && newEndTime > aptStart;
            });

            if (hasConflict) {
              alert(
                'Impossibile ridimensionare: fascia oraria già occupata',
              );
              setResizingAppointment(null);
              setTimeout(() => {
                setIsResizing(false);
              }, 100);
              return;
            } else {
              try {
                const { error } = await supabase
                  .from('appuntamenti')
                  .update({
                    ora_fine: newEndTime,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', resizingAppointment.id);

                if (error) {
                  console.error('Errore resize:', error);
                  alert(
                    'Errore durante il ridimensionamento: ' + error.message,
                  );
                } else {
                  await loadData();
                }
              } catch (err) {
                console.error('Errore:', err);
              }
            }
          }
        }
      }

      setResizingAppointment(null);
      setTimeout(() => {
        setIsResizing(false);
      }, 100);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      cleanupResizeEffects();
    };
  }, [resizingAppointment, appointments, isResizing]);

  const loadData = async () => {
    const { data: sediData } = await supabase.from('sedi').select('*');
    if (sediData) setSedi(sediData);

    const { data: personeData } = await supabase.from('persone').select('*');
    if (personeData) setPersone(personeData);

    const { data: personaSedeData } = await supabase
      .from('persona_sede')
      .select('*');
    if (personaSedeData) setPersonaSede(personaSedeData);

    const { data: appointmentsData } = await supabase
      .from('appuntamenti')
      .select('*, persona:persone(*), sede:sedi(*)');
    if (appointmentsData) setAppointments(appointmentsData);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('appointments_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appuntamenti' },
        () => loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleCreateAppointment = async (data: any) => {
    try {
      if (
        !data.persona_id ||
        !data.sede_id ||
        !data.data ||
        !data.ora_inizio ||
        !data.ora_fine
      ) {
        alert('Compila tutti i campi obbligatori');
        return;
      }
      const { error } = await supabase.from('appuntamenti').insert([
        {
          persona_id: data.persona_id,
          sede_id: data.sede_id,
          data: data.data,
          ora_inizio: data.ora_inizio,
          ora_fine: data.ora_fine,
          cliente: data.cliente || null,
          note: data.note || null,
        },
      ]);
      if (error) {
        alert('Errore durante il salvataggio:\n' + error.message);
        return;
      }
      setTimeout(async () => {
        await loadData();
      }, 300);
    } catch (err) {
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    try {
      const { error } = await supabase
        .from('appuntamenti')
        .update({
          persona_id: data.persona_id,
          ora_inizio: data.ora_inizio,
          ora_fine: data.ora_fine,
          cliente: data.cliente || null,
          note: data.note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) {
        alert("Errore durante l'aggiornamento: " + error.message);
        return;
      }
      setTimeout(async () => {
        await loadData();
      }, 300);
    } catch (err) {
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
    try {
      const { error } = await supabase
        .from('appuntamenti')
        .delete()
        .eq('id', id);
      if (error) {
        alert("Errore durante l'eliminazione: " + error.message);
        return;
      }
      setTimeout(async () => {
        await loadData();
      }, 300);
    } catch (err) {
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleSlotClick = (
    date: string,
    time: string,
    personaId: string,
    existingAppointment?: Appuntamento,
  ) => {
    if (isResizing) {
      return;
    }

    if (existingAppointment) {
      setSelectedAppointment(existingAppointment);
    } else {
      setSelectedAppointment(null);
      setSelectedSlot({ date, time, personaId });
    }
    setIsModalOpen(true);
  };

  const getAppointmentsForSlot = (
    date: string,
    time: string,
    personaId: string,
  ) => {
    const found = appointments.filter(apt => {
      const aptOraInizio = apt.ora_inizio ? apt.ora_inizio.substring(0, 5) : '';
      const aptOraFine = apt.ora_fine ? apt.ora_fine.substring(0, 5) : '';
      return (
        apt.data === date &&
        apt.sede_id === selectedSedeId &&
        time >= aptOraInizio &&
        time < aptOraFine &&
        apt.persona_id === personaId
      );
    });
    return found;
  };

  const handleDragStart = (appointment: Appuntamento, time: string) => {
    setDraggedAppointment({ appointment, originalTime: time });
  };

  const handleDrop = async (date: string, newTime: string, personaId: string) => {
    if (!draggedAppointment) return;

    const { appointment, originalTime } = draggedAppointment;

    const originalIndex = TIME_SLOTS.findIndex(
      slot => slot.label === originalTime,
    );
    const newIndex = TIME_SLOTS.findIndex(slot => slot.label === newTime);

    if (originalIndex === -1 || newIndex === -1) {
      setDraggedAppointment(null);
      return;
    }

    const timeDiff = newIndex - originalIndex;

    const startIndex = TIME_SLOTS.findIndex(
      slot => slot.label === appointment.ora_inizio.substring(0, 5),
    );
    let endIndex = TIME_SLOTS.findIndex(
      slot => slot.label === appointment.ora_fine.substring(0, 5),
    );
    if (endIndex === -1 && appointment.ora_fine.substring(0, 5) === '18:00') {
      endIndex = TIME_SLOTS.length;
    }

    const newStartIndex = startIndex + timeDiff;
    const newEndIndex = endIndex + timeDiff;

    if (newStartIndex < 0 || newEndIndex > TIME_SLOTS.length) {
      alert("Impossibile spostare l'appuntamento in questo orario");
      setDraggedAppointment(null);
      return;
    }

    const newOraInizio = TIME_SLOTS[newStartIndex].label;
    const newOraFine =
      newEndIndex < TIME_SLOTS.length
        ? TIME_SLOTS[newEndIndex].label
        : '18:00';

    const hasConflict = appointments.some(apt => {
      if (apt.id === appointment.id) return false;
      if (apt.persona_id !== personaId || apt.sede_id !== appointment.sede_id)
        return false;
      if (apt.data !== date) return false;
      const aptStart = apt.ora_inizio.substring(0, 5);
      const aptEnd = apt.ora_fine.substring(0, 5);
      const hasOverlap = newOraInizio < aptEnd && newOraFine > aptStart;
      return hasOverlap;
    });

    if (hasConflict) {
      alert(
        "Impossibile spostare l'appuntamento: fascia oraria già occupata per questa persona",
      );
      setDraggedAppointment(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('appuntamenti')
        .update({
          data: date,
          persona_id: personaId,
          ora_inizio: newOraInizio,
          ora_fine: newOraFine,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (error) {
        alert('Errore durante lo spostamento: ' + error.message);
      } else {
        await loadData();
      }
    } catch (err) {
      alert('Errore imprevisto: ' + String(err));
    }

    setDraggedAppointment(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleResizeStart = (appointment: Appuntamento) => {
    setResizingAppointment(appointment);
  };

  const selectedSede = sedi.find(s => s.id === selectedSedeId);
  const sedePersone = persone.filter(persona =>
    personaSede.some(ps => ps.persona_id === persona.id && ps.sede_id === selectedSedeId),
  );

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
                    Agenda 730
                  </h1>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Gestione appuntamenti
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200"
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
                <button
                  onClick={() => {
                    setSelectedDate(new Date());
                    setTimeout(scrollToSelectedDate, 100);
                  }}
                  className="px-4 py-2 text-sm bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] hover:shadow-lg transition-all duration-200 font-medium"
                >
                  Oggi
                </button>

                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Building2 className="w-5 h-5 text-[#005CA9]" />
                  <div className="relative">
                    <select
                      value={selectedSedeId}
                      onChange={e => {
                        setSelectedSedeId(e.target.value);
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

          {selectedSede && (
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
                    {sedePersone.map(persona => (
                      <th
                        key={persona.id}
                        className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[150px]"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-6 h-6 bg-[#005CA9] rounded-full flex items-center justify-center">
                            <User size={14} className="text-white" />
                          </div>
                          <span className="text-[#005CA9]">
                            {persona.nome}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDays.map(day => {
                    const dateStr = formatDate(day);
                    const isToday = formatDate(new Date()) === dateStr;

                    return (
                      <React.Fragment key={dateStr}>
                        <tr data-date={dateStr}>
                          <td
                            colSpan={sedePersone.length + 1}
                            className={`p-2 text-center font-bold text-sm sticky left-0 z-10 ${
                              isToday
                                ? 'bg-[#005CA9] text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {format(day, 'EEEE dd MMMM yyyy', { locale: it })}
                          </td>
                        </tr>

                        {TIME_SLOTS.map(slot => {
                          return (
                            <tr key={`${dateStr}-${slot.label}`}>
                              <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                                <div className="px-1 py-2 text-xs font-semibold text-gray-700">
                                  {slot.label}
                                </div>
                              </td>
                              {sedePersone.map(persona => {
                                const appointmentsInSlot = getAppointmentsForSlot(
                                  dateStr,
                                  slot.label,
                                  persona.id,
                                );

                                const allDayAppointments = appointments.filter(
                                  apt =>
                                    apt.data === dateStr &&
                                    apt.sede_id === selectedSedeId &&
                                    apt.persona_id === persona.id,
                                );

                                const hasAppointment =
                                  appointmentsInSlot.length > 0;

                                return (
                                  <td
                                    key={`${persona.id}-${slot.label}`}
                                    className={`relative p-0 border-r border-gray-100 ${
                                      !hasAppointment
                                        ? 'border-b border-gray-100'
                                        : ''
                                    }`}
                                    style={{ height: '45px' }}
                                  >
                                    <TimeSlot
                                      time={slot.label}
                                      appointments={appointmentsInSlot}
                                      allDayAppointments={allDayAppointments}
                                      onClick={appointment =>
                                        handleSlotClick(
                                          dateStr,
                                          slot.label,
                                          persona.id,
                                          appointment,
                                        )
                                      }
                                      onDragStart={handleDragStart}
                                      onDrop={time =>
                                        handleDrop(dateStr, time, persona.id)
                                      }
                                      onDragOver={handleDragOver}
                                      onResizeStart={handleResizeStart}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {isLoadingMore && (
                    <tr>
                      <td
                        colSpan={sedePersone.length + 1}
                        className="p-4 text-center text-gray-500"
                      >
                        Caricamento...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
                onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
                const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: startDate, end: endDate });

                return days.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, selectedDate);
                  const isSelected =
                    format(day, 'yyyy-MM-dd') ===
                    format(selectedDate, 'yyyy-MM-dd');
                  const isToday =
                    format(day, 'yyyy-MM-dd') ===
                    format(new Date(), 'yyyy-MM-dd');

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setSelectedDate(day);
                        setShowDatePicker(false);
                      }}
                      className={`
                        aspect-square rounded-lg text-sm font-medium transition-all
                        ${
                          isSelected
                            ? 'bg-[#005CA9] text-white shadow-md scale-105'
                            : isToday
                            ? 'bg-[#E6F2FF] text-[#005CA9] font-bold'
                            : isCurrentMonth
                            ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105'
                            : 'bg-transparent text-gray-300'
                        }
                        cursor-pointer
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

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAppointment(null);
        }}
        onSave={handleCreateAppointment}
        onUpdate={handleUpdateAppointment}
        onDelete={handleDeleteAppointment}
        existingAppointment={selectedAppointment}
        persone={persone}
        sedi={sedi}
        personaSede={personaSede}
        selectedDate={selectedSlot.date}
        selectedTime={selectedSlot.time}
        selectedSedeId={selectedSedeId}
        defaultPersonaId={selectedSlot.personaId}
      />
    </div>
  );
}
