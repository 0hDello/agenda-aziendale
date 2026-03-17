'use client';

import { useState, useEffect, useRef } from 'react';
import { X, User, FileText, Trash2, Palette } from 'lucide-react';

interface EpasaAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  existingAppointment?: any;
  sedi: any[];
  operatori: any[];
  selectedDate: string;
  selectedTime: string;
  selectedSedeId: string;
  defaultOperatoreId?: string;
}

// Palette colori evidenziazione
const HIGHLIGHT_COLORS = [
  { id: '',         label: 'Nessuna',  bg: 'bg-white',       preview: '#ffffff', border: 'border-gray-300' },
  { id: 'yellow',   label: 'Giallo',   bg: 'bg-yellow-300',  preview: '#fde047', border: 'border-yellow-400' },
  { id: 'orange',   label: 'Arancio',  bg: 'bg-orange-300',  preview: '#fb923c', border: 'border-orange-400' },
  { id: 'red',      label: 'Rosso',    bg: 'bg-red-300',     preview: '#fca5a5', border: 'border-red-400' },
  { id: 'green',    label: 'Verde',    bg: 'bg-green-300',   preview: '#86efac', border: 'border-green-400' },
  { id: 'blue',     label: 'Blu',      bg: 'bg-blue-200',    preview: '#bfdbfe', border: 'border-blue-400' },
  { id: 'purple',   label: 'Viola',    bg: 'bg-purple-300',  preview: '#d8b4fe', border: 'border-purple-400' },
  { id: 'pink',     label: 'Rosa',     bg: 'bg-pink-300',    preview: '#f9a8d4', border: 'border-pink-400' },
];

export const HIGHLIGHT_STYLE: Record<string, { cell: string; border: string; text: string }> = {
  '':       { cell: 'bg-blue-50',     border: 'border-blue-500',   text: 'text-blue-700'   },
  yellow:   { cell: 'bg-yellow-200',  border: 'border-yellow-500', text: 'text-yellow-900' },
  orange:   { cell: 'bg-orange-200',  border: 'border-orange-500', text: 'text-orange-900' },
  red:      { cell: 'bg-red-200',     border: 'border-red-500',    text: 'text-red-900'    },
  green:    { cell: 'bg-green-200',   border: 'border-green-500',  text: 'text-green-900'  },
  blue:     { cell: 'bg-blue-100',    border: 'border-blue-500',   text: 'text-blue-900'   },
  purple:   { cell: 'bg-purple-200',  border: 'border-purple-500', text: 'text-purple-900' },
  pink:     { cell: 'bg-pink-200',    border: 'border-pink-500',   text: 'text-pink-900'   },
};

export default function EpasaAppointmentModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  existingAppointment,
  sedi,
  operatori,
  selectedDate,
  selectedTime,
  selectedSedeId,
  defaultOperatoreId
}: EpasaAppointmentModalProps) {
  const [formData, setFormData] = useState({
    sede_id:      selectedSedeId,
    operatore_id: defaultOperatoreId || '',
    data:         selectedDate,
    ora:          selectedTime,
    cliente:      '',
    note:         '',
    highlight:    '' as string,
  });

  const clienteRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea cliente
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize(clienteRef.current);
  }, [formData.cliente]);

  useEffect(() => {
    if (existingAppointment) {
      setFormData({
        sede_id:      existingAppointment.sede_id,
        operatore_id: existingAppointment.operatore_id,
        data:         existingAppointment.data,
        ora:          existingAppointment.ora,
        cliente:      existingAppointment.cliente,
        note:         existingAppointment.note || '',
        highlight:    existingAppointment.highlight || '',
      });
    } else {
      setFormData({
        sede_id:      selectedSedeId,
        operatore_id: defaultOperatoreId || operatori[0]?.id || '',
        data:         selectedDate,
        ora:          selectedTime,
        cliente:      '',
        note:         '',
        highlight:    '',
      });
    }
  }, [existingAppointment, selectedSedeId, selectedDate, selectedTime, defaultOperatoreId, operatori]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cliente.trim()) {
      alert('Il nome del cliente è obbligatorio');
      return;
    }

    const date = new Date(formData.data);
    const monthNames = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    const mese = monthNames[date.getMonth()];

    const dataToSave = { ...formData, mese, cliente: formData.cliente.trim() };

    if (existingAppointment) {
      onUpdate(existingAppointment.id, dataToSave);
    } else {
      onSave(dataToSave);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!existingAppointment) return;
    if (confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      onDelete(existingAppointment.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Info di contesto (sola lettura, mostrate nell'header)
  const sedeName = sedi.find(s => s.id === formData.sede_id)?.nome ?? formData.sede_id;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border-t-4 border-[#005CA9]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#005CA9]">
              {existingAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {sedeName} &middot; {formData.data.split('-').reverse().join('/')} &middot; {formData.ora}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">

          {/* Cliente */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <User size={14} className="text-[#005CA9]" /> Cliente *
            </label>
            <textarea
              ref={clienteRef}
              value={formData.cliente}
              onChange={e => {
                setFormData({ ...formData, cliente: e.target.value });
                autoResize(e.target);
              }}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm resize-none overflow-hidden"
              placeholder="Nome cliente"
              rows={1}
              required
              autoFocus
              onKeyDown={e => {
                // Invio non va a capo, submit del form
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

          {/* ── Pulsanti ── */}
          <div className="flex gap-2 pt-1">
            {existingAppointment && (
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
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] transition-colors font-semibold text-sm"
            >
              {existingAppointment ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
