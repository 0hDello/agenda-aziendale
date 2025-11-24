'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2, User } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import { getWeekDays, formatDate, TIME_SLOTS } from '@/utils/dateUtils';
import TimeSlot from './TimeSlot';
import AppointmentModal from './AppointmentModal';

interface CalendarProps {
  agendaId?: string;
}
export default function Calendar({ agendaId = '730' }: CalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  // Mantieni tutte le altre variabili di stato necessarie qui
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [personaSede, setPersonaSede] = useState<PersonaSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ date: '', time: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<Appuntamento | null>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<{
    appointment: Appuntamento;
    originalTime: string;
  } | null>(null);
  const [resizingAppointment, setResizingAppointment] = useState<Appuntamento | null>(null);

  const weekDays = getWeekDays(currentWeek);
<<<<<<< HEAD

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

  // Hover sincronizzato per appuntamenti multipli
  useEffect(() => {
    const handleMouseEnter = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      
      const cell = target.closest('[data-appointment-id]');
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) {
          document.querySelectorAll(`[data-appointment-id="${id}"]`).forEach((el) => {
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
          document.querySelectorAll(`[data-appointment-id="${id}"]`).forEach((el) => {
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
      document.querySelectorAll('.appointment-hover').forEach((el) => {
        el.classList.remove('appointment-hover');
      });
    };
  }, []);

// Gestione Resize
useEffect(() => {
  if (!resizingAppointment) {
    // Cleanup completo quando non stiamo ridimensionando
    document.querySelectorAll('.resize-preview').forEach((el) => {
      el.classList.remove('resize-preview');
    });
    document.querySelectorAll('.resize-shrink').forEach((el) => {
      el.classList.remove('resize-shrink');
    });
    document.querySelectorAll('[data-appointment-id]').forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.opacity = '';
      }
    });
    return;
  }

  const handleMouseMove = (e: MouseEvent) => {
    const table = document.querySelector('table tbody');
    if (!table) return;

    const rect = table.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    const rowHeight = 60;
    const slotIndex = Math.floor(relativeY / rowHeight);
    
    if (slotIndex >= 0 && slotIndex < TIME_SLOTS.length) {
      // Rimuovi tutte le ombre precedenti
      document.querySelectorAll('.resize-preview').forEach((el) => {
        el.classList.remove('resize-preview');
      });
      document.querySelectorAll('.resize-shrink').forEach((el) => {
        el.classList.remove('resize-shrink');
      });
      
      // Reset opacità per tutti gli appuntamenti
      document.querySelectorAll('[data-appointment-id]').forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.opacity = '';
        }
      });
      
      // Trova l'indice dello slot di inizio e fine
      const startTime = resizingAppointment.ora_inizio.substring(0, 5);
      const endTime = resizingAppointment.ora_fine.substring(0, 5);
      const startIndex = TIME_SLOTS.findIndex(slot => slot.label === startTime);
      const endIndex = TIME_SLOTS.findIndex(slot => slot.label === endTime);
      
      // Trova la data dell'appuntamento
      const appointmentDate = resizingAppointment.data;
      
      const allRows = table.querySelectorAll('tr');
      
      // CASO 1: Estensione (slotIndex > endIndex - 1)
      if (slotIndex >= endIndex - 1) {
        // Aggiungi opacità alle celle esistenti dell'appuntamento
        const appointmentCells = document.querySelectorAll(`[data-appointment-id="${resizingAppointment.id}"]`);
        appointmentCells.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.opacity = '0.7';
          }
        });
        
        // Aggiungi ombra verde/blu per estensione
        for (let i = endIndex; i <= slotIndex; i++) {
          if (i < allRows.length) {
            const row = allRows[i];
            const cells = row.querySelectorAll('td');
            
            weekDays.forEach((day, dayIndex) => {
              const dateStr = formatDate(day);
              
              if (dateStr === appointmentDate) {
                const targetCell = cells[dayIndex + 1];
                
                if (targetCell) {
                  const hasAppointment = targetCell.querySelector(`[data-appointment-id]`);
                  if (!hasAppointment) {
                    targetCell.classList.add('resize-preview');
                  }
                }
              }
            });
          }
        }
      } 
      // CASO 2: Riduzione (slotIndex < endIndex - 1)
      else if (slotIndex < endIndex - 1 && slotIndex >= startIndex) {
        // Aggiungi ombra rossa/scura per le celle che verranno rimosse
        for (let i = slotIndex + 1; i < endIndex; i++) {
          if (i < allRows.length) {
            const row = allRows[i];
            const cells = row.querySelectorAll('td');
            
            weekDays.forEach((day, dayIndex) => {
              const dateStr = formatDate(day);
              
              if (dateStr === appointmentDate) {
                const targetCell = cells[dayIndex + 1];
                
                if (targetCell) {
                  // Aggiungi classe speciale per riduzione
                  const appointmentInCell = targetCell.querySelector(`[data-appointment-id="${resizingAppointment.id}"]`);
                  if (appointmentInCell) {
                    appointmentInCell.classList.add('resize-shrink');
                  }
                }
              }
            });
          }
        }
      }
    }
  };

  const cleanupResizeEffects = () => {
    // Rimuovi tutte le ombre
    document.querySelectorAll('.resize-preview').forEach((el) => {
      el.classList.remove('resize-preview');
    });
    document.querySelectorAll('.resize-shrink').forEach((el) => {
      el.classList.remove('resize-shrink');
    });
    
    // Reset opacità per tutti gli appuntamenti
    document.querySelectorAll('[data-appointment-id]').forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.opacity = '';
      }
    });
  };

  const handleMouseUp = async (e: MouseEvent) => {
    if (!resizingAppointment) return;

    cleanupResizeEffects();

    const table = document.querySelector('table tbody');
    if (!table) {
      setResizingAppointment(null);
      return;
    }

    const rect = table.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    
    const rowHeight = 60;
    const slotIndex = Math.floor(relativeY / rowHeight);
    
    if (slotIndex >= 0 && slotIndex < TIME_SLOTS.length) {
      const nextSlotIndex = slotIndex + 1;
      if (nextSlotIndex < TIME_SLOTS.length) {
        const newEndTime = TIME_SLOTS[nextSlotIndex].label;
        const startTime = resizingAppointment.ora_inizio.substring(0, 5);
        
        if (newEndTime > startTime) {
          // Controlla conflitti
          const hasConflict = appointments.some((apt) => {
            if (apt.id === resizingAppointment.id) return false;
            if (apt.persona_id !== resizingAppointment.persona_id) return false;
            if (apt.sede_id !== resizingAppointment.sede_id) return false;
            if (apt.data !== resizingAppointment.data) return false;
            
            const aptStart = apt.ora_inizio.substring(0, 5);
            const aptEnd = apt.ora_fine.substring(0, 5);
            
            return startTime < aptEnd && newEndTime > aptStart;
          });
          
          if (hasConflict) {
            alert('Impossibile ridimensionare: fascia oraria già occupata');
            setResizingAppointment(null);
            return;
          } else {
            // Aggiorna l'appuntamento
            try {
              const { error } = await supabase
                .from('appuntamenti')
                .update({
                  ora_fine: newEndTime,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', resizingAppointment.id);
              
              if (error) {
                console.error('❌ Errore resize:', error);
                alert('Errore durante il ridimensionamento: ' + error.message);
              } else {
                console.log('✅ Appuntamento ridimensionato!');
                // Cleanup prima di ricaricare
                cleanupResizeEffects();
                await loadData();
              }
            } catch (err) {
              console.error('❌ Errore:', err);
            }
          }
        }
      }
    }
    
    setResizingAppointment(null);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    cleanupResizeEffects();
  };
}, [resizingAppointment, appointments, weekDays]);





  const loadData = async () => {
    console.log('🔄 Caricamento dati...');
    
    const { data: sediData } = await supabase.from('sedi').select('*');
    if (sediData) {
      setSedi(sediData);
      console.log('✅ Sedi caricate:', sediData.length);
    }

    const { data: personeData } = await supabase.from('persone').select('*');
    if (personeData) {
      setPersone(personeData);
      console.log('✅ Persone caricate:', personeData.length);
    }

    const { data: personaSedeData } = await supabase.from('persona_sede').select('*');
    if (personaSedeData) {
      setPersonaSede(personaSedeData);
      console.log('✅ Collegamenti persona-sede:', personaSedeData.length);
    }

    const { data: appointmentsData } = await supabase
      .from('appuntamenti')
      .select('*, persona:persone(*), sede:sedi(*)');
    
    if (appointmentsData) {
      setAppointments(appointmentsData);
      console.log('✅ Appuntamenti caricati:', appointmentsData.length);
    }
  };

  const subscribeToChanges = () => {
    console.log('🔔 Attivazione real-time subscription...');
    
    const channel = supabase
      .channel('appointments_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appuntamenti' },
        (payload) => {
          console.log('📡 Real-time update ricevuto:', payload);
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time status:', status);
      });

    return () => {
      console.log('🔕 Disattivazione real-time');
      supabase.removeChannel(channel);
    };
  };

  const handleCreateAppointment = async (data: any) => {
    try {
      console.log('📝 Tentativo di salvataggio appuntamento:', data);
      
      if (!data.persona_id || !data.sede_id || !data.data || !data.ora_inizio || !data.ora_fine) {
        console.error('❌ Dati incompleti:', data);
        alert('Compila tutti i campi obbligatori');
        return;
      }
      
      const { error } = await supabase
        .from('appuntamenti')
        .insert([{
          persona_id: data.persona_id,
          sede_id: data.sede_id,
          data: data.data,
          ora_inizio: data.ora_inizio,
          ora_fine: data.ora_fine,
          cliente: data.cliente || null,
          note: data.note || null,
        }]);
      
      if (error) {
        console.error('❌ Errore Supabase:', error);
        alert('Errore durante il salvataggio:\n' + error.message);
        return;
      }
      
      console.log('✅ Appuntamento salvato con successo!');
      
      setTimeout(async () => {
        await loadData();
      }, 300);
      
    } catch (err) {
      console.error('❌ Errore imprevisto:', err);
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    try {
      console.log('📝 Aggiornamento appuntamento:', id, data);
      
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
        console.error('❌ Errore aggiornamento:', error);
        alert('Errore durante l\'aggiornamento: ' + error.message);
        return;
      }
      
      console.log('✅ Appuntamento aggiornato!');
      
      setTimeout(async () => {
        await loadData();
      }, 300);
      
    } catch (err) {
      console.error('❌ Errore:', err);
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      return;
    }
    
    try {
      console.log('🗑️ Eliminazione appuntamento:', id);
      
      const { error } = await supabase
        .from('appuntamenti')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('❌ Errore eliminazione:', error);
        alert('Errore durante l\'eliminazione: ' + error.message);
        return;
      }
      
      console.log('✅ Appuntamento eliminato!');
      
      setTimeout(async () => {
        await loadData();
      }, 300);
      
    } catch (err) {
      console.error('❌ Errore:', err);
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleSlotClick = (date: string, time: string, existingAppointment?: Appuntamento) => {
    console.log('🖱️ Click su slot:', { date, time, hasAppointment: !!existingAppointment });
    
    if (existingAppointment) {
      setSelectedAppointment(existingAppointment);
    } else {
      setSelectedAppointment(null);
      setSelectedSlot({ date, time });
    }
    
    setIsModalOpen(true);
  };

  const getAppointmentsForSlot = (date: string, time: string) => {
    const found = appointments.filter((apt) => {
      const aptOraInizio = apt.ora_inizio ? apt.ora_inizio.substring(0, 5) : '';
      const aptOraFine = apt.ora_fine ? apt.ora_fine.substring(0, 5) : '';
      
      const dataMatch = apt.data === date;
      const sedeMatch = apt.sede_id === selectedSedeId;
      const slotIsInRange = time >= aptOraInizio && time < aptOraFine;
      
      const personaMatch = selectedPersonaId === null || apt.persona_id === selectedPersonaId;
      
      return dataMatch && sedeMatch && slotIsInRange && personaMatch;
    });
    
    return found;
  };

  // Gestione Drag and Drop
  const handleDragStart = (appointment: Appuntamento, time: string) => {
    setDraggedAppointment({ appointment, originalTime: time });
  };

  const handleDrop = async (date: string, newTime: string) => {
    if (!draggedAppointment) return;

    const { appointment, originalTime } = draggedAppointment;
    
    // Calcola la differenza di tempo
    const originalIndex = TIME_SLOTS.findIndex((slot) => slot.label === originalTime);
    const newIndex = TIME_SLOTS.findIndex((slot) => slot.label === newTime);
    
    if (originalIndex === -1 || newIndex === -1) {
      setDraggedAppointment(null);
      return;
    }

    const timeDiff = newIndex - originalIndex;
    
    // Calcola nuovo ora_inizio e ora_fine
    const startIndex = TIME_SLOTS.findIndex((slot) => slot.label === appointment.ora_inizio.substring(0, 5));
    const endIndex = TIME_SLOTS.findIndex((slot) => slot.label === appointment.ora_fine.substring(0, 5));
    
    const newStartIndex = startIndex + timeDiff;
    const newEndIndex = endIndex + timeDiff;
    
    // Verifica che gli indici siano validi
    if (newStartIndex < 0 || newEndIndex >= TIME_SLOTS.length) {
      alert('Impossibile spostare l\'appuntamento in questo orario');
      setDraggedAppointment(null);
      return;
    }
    
    const newOraInizio = TIME_SLOTS[newStartIndex].label;
    const newOraFine = TIME_SLOTS[newEndIndex].label;
    
    // Controlla se la fascia oraria è già occupata dalla stessa persona
    const hasConflict = appointments.some((apt) => {
      // Ignora l'appuntamento che stiamo spostando
      if (apt.id === appointment.id) return false;
      
      // Controlla solo appuntamenti della stessa persona e sede
      if (apt.persona_id !== appointment.persona_id || apt.sede_id !== appointment.sede_id) return false;
      
      // Controlla solo appuntamenti nella stessa data di destinazione
      if (apt.data !== date) return false;
      
      const aptStart = apt.ora_inizio.substring(0, 5);
      const aptEnd = apt.ora_fine.substring(0, 5);
      
      // Controlla se c'è sovrapposizione
      const hasOverlap = newOraInizio < aptEnd && newOraFine > aptStart;
      
      return hasOverlap;
    });
    
    if (hasConflict) {
      alert('Impossibile spostare l\'appuntamento: fascia oraria già occupata per questa persona');
      setDraggedAppointment(null);
      return;
    }
    
    // Aggiorna l'appuntamento
    try {
      console.log('🔄 Spostamento appuntamento:', { date, newOraInizio, newOraFine });
      
      const { error } = await supabase
        .from('appuntamenti')
        .update({
          data: date,
          ora_inizio: newOraInizio,
          ora_fine: newOraFine,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);
      
      if (error) {
        console.error('❌ Errore spostamento:', error);
        alert('Errore durante lo spostamento: ' + error.message);
      } else {
        console.log('✅ Appuntamento spostato!');
        await loadData();
      }
    } catch (err) {
      console.error('❌ Errore:', err);
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

=======
>>>>>>> feature/settings-management
  const selectedSede = sedi.find((s) => s.id === selectedSedeId);

  // ... resto del componente invariato ...

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        {/* ... codice header invariato ... */}
        {/* Griglia sede selezionata */}
        {selectedSede && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-in border-l-4 border-[#005CA9]">
            <div className="bg-[#005CA9] text-white p-5">
              {/* ... codice sede, operatore, pulsanti ... */}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr className="border-b-2 border-[#005CA9]/20">
                    {/* ... colonna orario e giorni settimana ... */}
                  </tr>
                </thead>
                <tbody>
<<<<<<< HEAD
                  {TIME_SLOTS.map((slot, slotIndex) => {
                    return (
                      <tr key={slot.label}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100">
=======
                  {TIME_SLOTS.map((slot) => {
                    const isSlotEmpty = weekDays.every(day => {
                      const dateStr = formatDate(day);
                      const appointmentsInSlot = getAppointmentsForSlot(dateStr, slot.label);
                      return appointmentsInSlot.length === 0;
                    });
                    return (
                      <tr key={slot.label} className={isSlotEmpty ? "border-b border-gray-100" : ""}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200">
>>>>>>> feature/settings-management
                          <div className="px-4 py-3 text-sm font-semibold text-gray-700">
                            {slot.label}
                          </div>
                        </td>
                        {weekDays.map((day) => {
                          const dateStr = formatDate(day);
                          const appointmentsInSlot = getAppointmentsForSlot(dateStr, slot.label);
<<<<<<< HEAD
                          
                          const hasAppointment = appointmentsInSlot.length > 0;

                          return (
                            <td
                              key={`${dateStr}-${slot.label}`}
                              className={`relative p-0 ${hasAppointment ? '' : 'border-t border-b border-gray-100'} border-r border-gray-100`}
                              style={{ height: '60px' }}
                            >
=======
                          return (
                            <td key={`${dateStr}-${slot.label}`} className="p-0 border-r border-black-100">
>>>>>>> feature/settings-management
                              <TimeSlot
                                time={slot.label}
                                appointments={appointmentsInSlot}
                                onClick={(appointment) => handleSlotClick(dateStr, slot.label, appointment)}
<<<<<<< HEAD
                                onDragStart={handleDragStart}
                                onDrop={(time) => handleDrop(dateStr, time)}
                                onDragOver={handleDragOver}
                                onResizeStart={handleResizeStart}
=======
>>>>>>> feature/settings-management
                              />
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
        )}
      </div>
      {/* ... AppointmentModal invariato ... */}
    </div>
  );
}
