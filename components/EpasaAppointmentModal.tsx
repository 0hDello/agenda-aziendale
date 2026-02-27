'use client';

import { useState, useEffect } from 'react';
import { X, User, MapPin, Clock, FileText, Trash2, Palette } from 'lucide-react';

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
    sede_id: selectedSedeId,
    operatore_id: defaultOperatoreId || '',
    data: selectedDate,
    ora: selectedTime,
    cliente: '',
    note: '',
    highlight: '' as string,
  });

  useEffect(() => {
    if (existingAppointment) {
      setFormData({
        sede_id: existingAppointment.sede_id,
        operatore_id: existingAppointment.operatore_id,
        data: existingAppointment.data,
        ora: existingAppointment.ora,
        cliente: existingAppointment.cliente,
        note: existingAppointment.note || '',
        highlight: existingAppointment.highlight || '',
      });
    } else {
      setFormData({
        sede_id: selectedSedeId,
        operatore_id: defaultOperatoreId || operatori[0]?.id || '',
        data: selectedDate,
        ora: selectedTime,
        cliente: '',
        note: '',
        highlight: '',
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

    const dataToSave = {
      ...formData,
      mese,
      cliente: formData.cliente.trim()
    };

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

  const selectedSede      = sedi.find(s => s.id === formData.sede_id);
  const selectedOperatore = operatori.find(o => o.id === formData.operatore_id);
  const currentHL         = HIGHLIGHT_STYLE[formData.highlight] ?? HIGHLIGHT_STYLE[''];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-[#005CA9]">
              {existingAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">EPASA - {selectedSede?.nome}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Cliente */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <User size={14} className="text-[#005CA9]" /> Cliente *
            </label>
            <input
              type="text"
              value={formData.cliente}
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm"
              placeholder="Nome cliente"
              required
              autoFocus
            />
          </div>

          {/* Sede */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <MapPin size={14} className="text-[#005CA9]" /> Sede
            </label>
            <select
              value={formData.sede_id}
              onChange={(e) => setFormData({ ...formData, sede_id: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm bg-gray-50"
              disabled={!!existingAppointment}
            >
              {sedi.map((sede) => (<option key={sede.id} value={sede.id}>{sede.nome}</option>))}
            </select>
          </div>

          {/* Operatore */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <User size={14} className="text-[#005CA9]" /> Operatore
            </label>
            <select
              value={formData.operatore_id}
              onChange={(e) => setFormData({ ...formData, operatore_id: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm"
            >
              {operatori.map((op) => (<option key={op.id} value={op.id}>{op.nome}</option>))}
            </select>
          </div>

          {/* Data e Ora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                <Clock size={14} className="text-[#005CA9]" /> Data
              </label>
              <input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                min="2026-01-01"
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
                <Clock size={14} className="text-[#005CA9]" /> Ora
              </label>
              <input
                type="time"
                value={formData.ora}
                onChange={(e) => setFormData({ ...formData, ora: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors text-sm"
                required
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1.5">
              <FileText size={14} className="text-[#005CA9]" /> Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors resize-none text-sm"
              rows={2}
              placeholder="Note aggiuntive (appaiono come tooltip sulla cella)"
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
              {/* Anteprima */}
              {formData.cliente && (
                <div className={`ml-2 flex-1 px-2 py-1 rounded border-l-4 ${currentHL.cell} ${currentHL.border} text-[11px] font-semibold ${currentHL.text} truncate`}>
                  {formData.cliente}
                </div>
              )}
            </div>
          </div>

          {/* Riepilogo */}
          {formData.cliente && (
            <div className="bg-blue-50 border-l-4 border-[#005CA9] p-2.5 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 mb-1">Riepilogo:</p>
              <div className="space-y-0.5 text-xs text-gray-600">
                <p>
                  <span className="font-semibold text-gray-800">{formData.cliente}</span>
                  {' '}con{' '}
                  <span className="font-semibold" style={{ color: selectedOperatore?.colore || '#16A34A' }}>
                    {selectedOperatore?.nome}
                  </span>
                </p>
                <p>
                  {selectedSede?.nome} •{' '}
                  {new Date(formData.data).toLocaleDateString('it-IT', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </p>
                <p className="font-semibold text-[#005CA9]">Ore {formData.ora}</p>
                {formData.note && <p className="italic text-gray-500 truncate">📝 {formData.note}</p>}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
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
