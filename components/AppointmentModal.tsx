'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, MapPin, FileText, UserCircle, CalendarDays, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, isValid, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';
import { TIME_SLOTS } from '@/utils/dateUtils';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onUpdate?: (id: string, data: any) => void;
  onDelete?: (id: string) => void;
  existingAppointment?: Appuntamento | null;
  persone: Persona[];
  sedi: Sede[];
  personaSede: PersonaSede[];
  selectedDate: string;
  selectedTime: string;
  selectedSedeId?: string;
  defaultPersonaId?: string | null;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  existingAppointment,
  persone,
  sedi,
  personaSede,
  selectedDate,
  selectedTime,
  selectedSedeId,
  defaultPersonaId,
}: AppointmentModalProps) {
  const getValidDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : new Date();
  };

  const [formData, setFormData] = useState({
    persona_id: '',
    sede_id: '',
    ora_inizio: '09:00',
    ora_fine: '09:30',
    cliente: '',
    note: '',
  });

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [minTime, setMinTime] = useState<string>('09:00');

  useEffect(() => {
    if (isOpen) {
      if (existingAppointment) {
        setFormData({
          persona_id: existingAppointment.persona_id,
          sede_id: existingAppointment.sede_id,
          ora_inizio: existingAppointment.ora_inizio.substring(0, 5),
          ora_fine: existingAppointment.ora_fine.substring(0, 5),
          cliente: existingAppointment.cliente || '',
          note: existingAppointment.note || '',
        });
        setSelectedDates([existingAppointment.data]);
        setMinTime(existingAppointment.ora_inizio.substring(0, 5));
      } else {
        const newValidDate = getValidDate(selectedDate);
        const newValidDateString = format(newValidDate, 'yyyy-MM-dd');
        const timeToUse = selectedTime || '09:00';
        
        const currentIndex = TIME_SLOTS.findIndex((slot) => slot.label === timeToUse);
        const nextSlotTime = currentIndex >= 0 && currentIndex < TIME_SLOTS.length - 1
          ? TIME_SLOTS[currentIndex + 1].label
          : timeToUse;
        
        setFormData({
          persona_id: defaultPersonaId || '',
          sede_id: selectedSedeId || '',
          ora_inizio: timeToUse,
          ora_fine: nextSlotTime,
          cliente: '',
          note: '',
        });
        
        setMinTime(timeToUse);
        setSelectedDates([newValidDateString]);
      }
      
      setShowCalendar(false);
    }
  }, [isOpen, existingAppointment, selectedDate, selectedTime, selectedSedeId, defaultPersonaId]);

  useEffect(() => {
    if (selectedSedeId && isOpen && !existingAppointment) {
      setFormData((prev) => ({ ...prev, sede_id: selectedSedeId }));
    }
  }, [selectedSedeId, isOpen, existingAppointment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (existingAppointment) {
      if (onUpdate) {
        onUpdate(existingAppointment.id, {
          persona_id: formData.persona_id,
          sede_id: formData.sede_id,
          ora_inizio: formData.ora_inizio,
          ora_fine: formData.ora_fine,
          cliente: formData.cliente,
          note: formData.note,
        });
      }
    } else {
      const appointments = selectedDates.map((date) => ({
        persona_id: formData.persona_id,
        sede_id: formData.sede_id,
        data: date,
        ora_inizio: formData.ora_inizio,
        ora_fine: formData.ora_fine,
        cliente: formData.cliente,
        note: formData.note,
      }));

      appointments.forEach((apt) => onSave(apt));
    }

    onClose();
  };

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date)
        ? prev.filter((d) => d !== date)
        : [...prev, date]
    );
  };

  const removeDate = (dateValue: string) => {
    if (selectedDates.length > 1) {
      setSelectedDates(selectedDates.filter((d) => d !== dateValue));
    }
  };

  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  const calendarDays = generateCalendarDays();

  const personeFiltered = persone.filter((persona) =>
    !formData.sede_id ||
    personaSede.some((ps) => ps.persona_id === persona.id && ps.sede_id === formData.sede_id)
  );

  const getAvailableSlots = (isStartTime: boolean) => {
    return TIME_SLOTS.filter((slot) => {
      if (isStartTime) {
        return slot.label >= minTime;
      } else {
        return slot.label > formData.ora_inizio;
      }
    });
  };

  const handleOraInizioChange = (newOraInizio: string) => {
    setFormData((prev) => {
      const newFormData = { ...prev, ora_inizio: newOraInizio };
      if (prev.ora_fine <= newOraInizio) {
        const currentIndex = TIME_SLOTS.findIndex((slot) => slot.label === newOraInizio);
        if (currentIndex >= 0 && currentIndex < TIME_SLOTS.length - 1) {
          newFormData.ora_fine = TIME_SLOTS[currentIndex + 1].label;
        }
      }
      return newFormData;
    });
  };

  if (!isOpen) return null;

  const selectedSede = sedi.find((s) => s.id === formData.sede_id);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-xl p-4 w-full max-w-xl shadow-2xl animate-slide-in border-t-4 border-[#005CA9] max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#005CA9] p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#005CA9]">
                  {existingAppointment ? 'Visualizza Appuntamento' : 'Nuovo Appuntamento'}
                </h2>
                {selectedSede && (
                  <p className="text-xs text-gray-600 mt-0.5">Sede: {selectedSede.nome}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#005CA9]" />
                Sede
              </label>
              <select
                required
                value={formData.sede_id}
                onChange={(e) => setFormData({ ...formData, sede_id: e.target.value, persona_id: '' })}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors bg-gray-50"
                disabled={!!selectedSedeId || !!existingAppointment}
              >
                <option value="">Seleziona sede...</option>
                {sedi.map((sede) => (
                  <option key={sede.id} value={sede.id}>
                    {sede.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <User className="w-3.5 h-3.5 text-[#005CA9]" />
                Operatore
              </label>
              <select
                required
                value={formData.persona_id}
                onChange={(e) => setFormData({ ...formData, persona_id: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors"
                disabled={!formData.sede_id}
              >
                <option value="">Seleziona operatore...</option>
                {personeFiltered.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                  <Clock className="w-3.5 h-3.5 text-[#005CA9]" />
                  Ora Inizio
                </label>
                <select
                  required
                  value={formData.ora_inizio}
                  onChange={(e) => handleOraInizioChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors bg-gray-50"
                  disabled={!existingAppointment}
                >
                  {getAvailableSlots(true).map((slot) => (
                    <option key={slot.label} value={slot.label}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                  <Clock className="w-3.5 h-3.5 text-[#005CA9]" />
                  Ora Fine
                </label>
                <select
                  required
                  value={formData.ora_fine}
                  onChange={(e) => setFormData({ ...formData, ora_fine: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors"
                >
                  {getAvailableSlots(false).map((slot) => (
                    <option key={slot.label} value={slot.label}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!existingAppointment && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                  <CalendarDays className="w-3.5 h-3.5 text-[#005CA9]" />
                  Giorni selezionati ({selectedDates.length})
                </label>
                
                <div className="space-y-1.5 mb-2">
                  {selectedDates.map((date) => {
                    const dateObj = parseISO(date);
                    const dateLabel = format(dateObj, 'EEEE dd MMMM yyyy', { locale: it });
                    return (
                      <div
                        key={date}
                        className="flex items-center justify-between bg-[#E6F2FF] border border-[#005CA9]/20 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-xs font-medium text-[#005CA9]">{dateLabel}</span>
                        {selectedDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDate(date)}
                            className="text-red-600 hover:text-red-800 p-0.5"
                          >
                            <Minus size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowCalendar(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-[#005CA9] text-[#005CA9] rounded-lg px-3 py-1.5 text-sm hover:bg-[#E6F2FF] transition-colors font-medium"
                >
                  <Plus size={16} />
                  Aggiungi un altro giorno
                </button>
              </div>
            )}

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <UserCircle className="w-3.5 h-3.5 text-[#005CA9]" />
                Cliente / Descrizione
              </label>
              <input
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors"
                placeholder="Es: Formazione, Riunione, Nome Cliente..."
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <FileText className="w-3.5 h-3.5 text-[#005CA9]" />
                Note
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors resize-none"
                rows={2}
                placeholder="Note aggiuntive..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              {existingAppointment && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(existingAppointment.id);
                    onClose();
                  }}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-lg transition-all duration-200 font-semibold"
                >
                  Elimina
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] hover:shadow-lg transition-all duration-200 font-semibold"
              >
                {existingAppointment 
                  ? 'Aggiorna'
                  : selectedDates.length === 1 
                    ? 'Salva' 
                    : `Salva ${selectedDates.length}`}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showCalendar && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#005CA9]">
                Seleziona Giorni
              </h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-[#005CA9]" />
              </button>
              <h4 className="text-lg font-bold text-gray-800 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: it })}
              </h4>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
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
              {calendarDays.map((day, index) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isSelected = selectedDates.includes(dateStr);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      if (!isPast) {
                        toggleDate(dateStr);
                      }
                    }}
                    disabled={isPast}
                    className={`
                      aspect-square rounded-lg text-sm font-medium transition-all
                      ${isSelected 
                        ? 'bg-[#005CA9] text-white shadow-md scale-105' 
                        : isCurrentMonth 
                          ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105' 
                          : 'bg-transparent text-gray-300'
                      }
                      ${isPast ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-4 text-center">
                {selectedDates.length} {selectedDates.length === 1 ? 'giorno selezionato' : 'giorni selezionati'}
              </p>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold"
              >
                Conferma Selezione
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
