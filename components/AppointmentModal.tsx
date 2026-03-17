'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  X, User, FileText, Palette, Trash2,
  ChevronLeft, ChevronRight, Plus, Minus, CalendarDays,
} from 'lucide-react';
import {
  format, parseISO, isValid,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, addMonths, subMonths,
  startOfWeek, endOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';
import { TIME_SLOTS, END_TIME_SLOTS } from '@/utils/dateUtils';

// ── Palette colori ──────────────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { id: '',       label: 'Nessuna', preview: '#ffffff', border: 'border-gray-300' },
  { id: 'yellow', label: 'Giallo',  preview: '#fde047', border: 'border-yellow-400' },
  { id: 'orange', label: 'Arancio', preview: '#fb923c', border: 'border-orange-400' },
  { id: 'red',    label: 'Rosso',   preview: '#fca5a5', border: 'border-red-400' },
  { id: 'green',  label: 'Verde',   preview: '#86efac', border: 'border-green-400' },
  { id: 'blue',   label: 'Blu',     preview: '#bfdbfe', border: 'border-blue-400' },
  { id: 'purple', label: 'Viola',   preview: '#d8b4fe', border: 'border-purple-400' },
  { id: 'pink',   label: 'Rosa',    preview: '#f9a8d4', border: 'border-pink-400' },
];

export const HIGHLIGHT_STYLE: Record<string, { cell: string; border: string; text: string }> = {
  '':      { cell: 'bg-blue-50',    border: 'border-blue-500',   text: 'text-blue-700'   },
  yellow:  { cell: 'bg-yellow-200', border: 'border-yellow-500', text: 'text-yellow-900' },
  orange:  { cell: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-900' },
  red:     { cell: 'bg-red-200',    border: 'border-red-500',    text: 'text-red-900'    },
  green:   { cell: 'bg-green-200',  border: 'border-green-500',  text: 'text-green-900'  },
  blue:    { cell: 'bg-blue-100',   border: 'border-blue-500',   text: 'text-blue-900'   },
  purple:  { cell: 'bg-purple-200', border: 'border-purple-500', text: 'text-purple-900' },
  pink:    { cell: 'bg-pink-200',   border: 'border-pink-500',   text: 'text-pink-900'   },
};

interface SlotItem { label: string; hour?: number; minute?: number; }

export interface AppointmentModalHandle {
  open: (params: {
    date: string;
    time: string;
    personaId: string;
    existingAppointment?: Appuntamento | null;
    sedeId?: string;
    daySlots?: SlotItem[];
    dayEndSlots?: SlotItem[];
  }) => void;
}

interface AppointmentModalProps {
  onSave: (data: any) => void;
  onUpdate?: (id: string, data: any) => void;
  onDelete?: (id: string) => void;
  persone: Persona[];
  sedi: Sede[];
  personaSede: PersonaSede[];
}

const AppointmentModal = forwardRef<AppointmentModalHandle, AppointmentModalProps>(
  function AppointmentModal({ onSave, onUpdate, onDelete, sedi }, ref) {

  const [isOpen, setIsOpen] = useState(false);
  const [existingAppointment, setExistingAppointment] = useState<Appuntamento | null>(null);

  const [formData, setFormData] = useState({
    persona_id: '',
    sede_id: '',
    ora_inizio: '09:00',
    ora_fine: '09:30',
    cliente: '',
    note: '',
    highlight: '' as string,
  });

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const clienteRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => { autoResize(clienteRef.current); }, [formData.cliente]);

  useEffect(() => {
    if (isOpen) clienteRef.current?.focus();
  }, [isOpen]);

  useImperativeHandle(ref, () => ({
    open({ date, time, personaId, existingAppointment: apt, sedeId, daySlots, dayEndSlots }) {
      const sl = (daySlots    && daySlots.length    > 0) ? daySlots    : TIME_SLOTS;
      const el = (dayEndSlots && dayEndSlots.length > 0) ? dayEndSlots : END_TIME_SLOTS;
      setExistingAppointment(apt ?? null);

      if (apt) {
        setFormData({
          persona_id: apt.persona_id,
          sede_id:    apt.sede_id,
          ora_inizio: apt.ora_inizio.substring(0, 5),
          ora_fine:   apt.ora_fine.substring(0, 5),
          cliente:    apt.cliente || '',
          note:       apt.note || '',
          highlight:  apt.highlight || '',
        });
        setSelectedDates([apt.data]);
      } else {
        const parsed        = date ? parseISO(date) : new Date();
        const validDate     = isValid(parsed) ? parsed : new Date();
        const validDateStr  = format(validDate, 'yyyy-MM-dd');
        const timeToUse     = time || '09:00';
        const idx           = sl.findIndex(s => s.label === timeToUse);
        const nextSlot      = idx >= 0 && idx < sl.length - 1
          ? sl[idx + 1].label
          : el[el.length - 1].label;
        setFormData({
          persona_id: personaId || '',
          sede_id:    sedeId    || '',
          ora_inizio: timeToUse,
          ora_fine:   nextSlot,
          cliente:    '',
          note:       '',
          highlight:  '',
        });
        setSelectedDates([validDateStr]);
      }
      setShowCalendar(false);
      setIsOpen(true);
    },
  }));

  const close = () => setIsOpen(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente.trim()) { alert('Il nome del cliente è obbligatorio'); return; }

    if (existingAppointment) {
      onUpdate?.(existingAppointment.id, {
        persona_id: formData.persona_id,
        sede_id:    formData.sede_id,
        ora_inizio: formData.ora_inizio,
        ora_fine:   formData.ora_fine,
        cliente:    formData.cliente.trim(),
        note:       formData.note,
        highlight:  formData.highlight,
      });
    } else {
      selectedDates.forEach(date => onSave({
        persona_id: formData.persona_id,
        sede_id:    formData.sede_id,
        data:       date,
        ora_inizio: formData.ora_inizio,
        ora_fine:   formData.ora_fine,
        cliente:    formData.cliente.trim(),
        note:       formData.note,
        highlight:  formData.highlight,
      }));
    }
    close();
  };

  const handleDelete = () => {
    if (!existingAppointment || !onDelete) return;
    if (confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      onDelete(existingAppointment.id);
      close();
    }
  };

  const toggleDate = (date: string) =>
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );

  const removeDate = (date: string) => {
    if (selectedDates.length > 1) setSelectedDates(prev => prev.filter(d => d !== date));
  };

  const generateCalendarDays = () => {
    const ms = startOfMonth(currentMonth);
    const me = endOfMonth(currentMonth);
    return eachDayOfInterval({
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end:   endOfWeek(me,   { weekStartsOn: 1 }),
    });
  };

  const sedeName    = sedi.find(s => s.id === formData.sede_id)?.nome ?? '';
  const displayDate = selectedDates[0]
    ? selectedDates[0].split('-').reverse().join('/')
    : '';
  const displayTime = `${formData.ora_inizio}–${formData.ora_fine}`;

  // Non renderizzare nulla finché non è stato aperto almeno una volta
  if (!isOpen && !existingAppointment && !formData.cliente && selectedDates.length === 0) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ display: isOpen ? undefined : 'none' }}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border-t-4 border-[#005CA9]">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-[#005CA9]">
                {existingAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {sedeName}{sedeName && ' · '}{displayDate}{displayDate && ' · '}{displayTime}
              </p>
            </div>
            <button onClick={close} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">

            {/* Cliente */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                <User size={14} className="text-[#005CA9]" /> Cliente *
              </label>
              <textarea
                ref={clienteRef}
                value={formData.cliente}
                onChange={e => { setFormData({ ...formData, cliente: e.target.value }); autoResize(e.target); }}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm resize-none overflow-hidden"
                placeholder="Nome cliente"
                rows={2}
                required
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.closest('form') as HTMLFormElement)?.requestSubmit();
                  }
                }}
              />
            </div>

            {/* Note */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                <FileText size={14} className="text-[#005CA9]" /> Note
              </label>
              <textarea
                value={formData.note}
                onChange={e => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors resize-none text-sm"
                rows={2}
                placeholder="Note aggiuntive"
              />
            </div>

            {/* Evidenziazione */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Palette size={14} className="text-[#005CA9]" /> Evidenziazione cella
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {HIGHLIGHT_COLORS.map(hc => (
                  <button
                    key={hc.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, highlight: hc.id })}
                    title={hc.label}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      formData.highlight === hc.id
                        ? 'scale-125 shadow-md border-gray-700'
                        : 'border-gray-300 hover:scale-110'
                    }`}
                    style={{ backgroundColor: hc.preview }}
                  />
                ))}
              </div>
            </div>

            {/* Multi-data (solo nuovo appuntamento) */}
            {!existingAppointment && (
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                  <CalendarDays size={14} className="text-[#005CA9]" />
                  Giorni selezionati ({selectedDates.length})
                </label>
                <div className="space-y-1.5 mb-2">
                  {selectedDates.map(date => (
                    <div key={date} className="flex items-center justify-between bg-[#E6F2FF] border border-[#005CA9]/20 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-medium text-[#005CA9]">
                        {format(parseISO(date), 'EEEE dd MMMM yyyy', { locale: it })}
                      </span>
                      {selectedDates.length > 1 && (
                        <button type="button" onClick={() => removeDate(date)} className="text-red-500 hover:text-red-700 p-0.5">
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendar(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-[#005CA9] text-[#005CA9] rounded-lg px-3 py-1.5 text-sm hover:bg-[#E6F2FF] transition-colors font-medium"
                >
                  <Plus size={16} /> Aggiungi un altro giorno
                </button>
              </div>
            )}

            {/* Pulsanti */}
            <div className="flex gap-2 pt-1">
              {existingAppointment && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold text-sm"
                >
                  <Trash2 size={14} /> Elimina
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 px-3 py-2 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold text-sm"
              >
                {existingAppointment ? 'Salva' : selectedDates.length > 1 ? `Crea ${selectedDates.length}` : 'Crea'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Calendario multi-data ── */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#005CA9]">Seleziona Giorni</h3>
              <button onClick={() => setShowCalendar(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} className="text-[#005CA9]" />
              </button>
              <h4 className="text-lg font-bold text-gray-800 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: it })}
              </h4>
              <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={20} className="text-[#005CA9]" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-600 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {generateCalendarDays().map((day, i) => {
                const dateStr    = format(day, 'yyyy-MM-dd');
                const isSelected = selectedDates.includes(dateStr);
                const isCurr     = isSameMonth(day, currentMonth);
                const isPast     = day < new Date(new Date().setHours(0,0,0,0));
                return (
                  <button
                    key={i} type="button"
                    onClick={() => { if (!isPast) toggleDate(dateStr); }}
                    disabled={isPast}
                    className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                      isSelected ? 'bg-[#005CA9] text-white shadow-md scale-105' :
                      isCurr     ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105' :
                                   'bg-transparent text-gray-300'
                    } ${isPast ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
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
});

export default AppointmentModal;
