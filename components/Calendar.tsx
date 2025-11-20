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

export default function Calendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [personaSede, setPersonaSede] = useState<PersonaSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ date: '', time: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<Appuntamento | null>(null);

  const weekDays = getWeekDays(currentWeek);

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
      // Cleanup: rimuovi tutte le classi hover
      document.querySelectorAll('.appointment-hover').forEach((el) => {
        el.classList.remove('appointment-hover');
      });
    };
  }, []);

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
          created_by: data.created_by || null,
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

  const selectedSede = sedi.find((s) => s.id === selectedSedeId);
  const sedePersone = persone.filter((persona) =>
    personaSede.some((ps) => ps.persona_id === persona.id && ps.sede_id === selectedSedeId)
  );

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 animate-slide-in border-t-4 border-[#005CA9]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-[#005CA9] p-3 rounded-xl shadow-lg">
                <CalendarIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#005CA9]">
                  Agenda CNA
                </h1>
                <p className="text-sm text-gray-600 mt-1">Gestione appuntamenti condivisa</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#005CA9]" />
                <select
                  value={selectedSedeId}
                  onChange={(e) => {
                    setSelectedSedeId(e.target.value);
                    setSelectedPersonaId(null);
                  }}
                  className="px-4 py-2.5 bg-white border-2 border-[#005CA9] text-[#005CA9] rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all shadow-sm hover:shadow-md cursor-pointer"
                >
                  {sedi.map((sede) => (
                    <option key={sede.id} value={sede.id}>
                      {sede.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                className="p-2.5 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="bg-[#E6F2FF] px-6 py-2.5 rounded-xl border border-[#005CA9]/20">
                <span className="text-base font-semibold text-[#005CA9] whitespace-nowrap">
                  {format(weekDays[0], 'dd MMM', { locale: it })} -{' '}
                  {format(weekDays[6], 'dd MMM yyyy', { locale: it })}
                </span>
              </div>
              <button
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                className="p-2.5 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => setCurrentWeek(new Date())}
                className="px-5 py-2.5 bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] hover:shadow-lg transition-all duration-200 font-medium"
              >
                Oggi
              </button>
            </div>
          </div>
        </div>

        {/* Griglia sede selezionata */}
        {selectedSede && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-in border-l-4 border-[#005CA9]">
            <div className="bg-[#005CA9] text-white p-5">
              <h2 className="text-2xl font-bold tracking-wide mb-4">{selectedSede.nome}</h2>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSelectedPersonaId(null)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                    selectedPersonaId === null
                      ? 'bg-white text-[#005CA9] shadow-lg scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <User size={18} />
                  <span>Tutti ({sedePersone.length})</span>
                </button>

                {sedePersone.map((persona) => {
                  const personaAppointments = appointments.filter(
                    (apt) => apt.persona_id === persona.id && apt.sede_id === selectedSedeId
                  );
                  
                  return (
                    <button
                      key={persona.id}
                      onClick={() => setSelectedPersonaId(persona.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                        selectedPersonaId === persona.id
                          ? 'bg-white text-[#005CA9] shadow-lg scale-105'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                        <User size={16} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm leading-tight">{persona.nome}</div>
                        <div className="text-xs opacity-80 leading-tight">
                          {personaAppointments.length} app.
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#005CA9]/20">
                    <th className="p-4 text-left font-semibold bg-[#F5F8FA] sticky left-0 z-10 min-w-[100px] border-r border-gray-200">
                      <span className="text-[#005CA9]">Orario</span>
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.toISOString()}
                        className="p-4 text-center font-semibold bg-[#F5F8FA] min-w-[150px]"
                      >
                        <div className="text-sm text-gray-500 uppercase tracking-wide">
                          {format(day, 'EEE', { locale: it })}
                        </div>
                        <div className="text-lg font-bold text-[#005CA9] mt-1">
                          {format(day, 'dd/MM', { locale: it })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot) => (
                    <tr key={slot.label} className="border-b border-gray-100">
                      <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200">
                        <div className="px-4 py-3 text-sm font-semibold text-gray-700">
                          {slot.label}
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dateStr = formatDate(day);
                        const appointmentsInSlot = getAppointmentsForSlot(dateStr, slot.label);

                        return (
                          <td key={`${dateStr}-${slot.label}`} className="p-0 border-r border-black-100">

                            <TimeSlot
                              time={slot.label}
                              appointments={appointmentsInSlot}
                              onClick={(appointment) => handleSlotClick(dateStr, slot.label, appointment)}
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
        )}
      </div>

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
      />
    </div>
  );
}
