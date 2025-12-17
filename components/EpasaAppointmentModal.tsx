'use client';

import { useState, useEffect } from 'react';
import { X, User, MapPin, Clock, FileText, Trash2 } from 'lucide-react';

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
    note: ''
  });

  useEffect(() => {
    if (existingAppointment) {
      setFormData({
        sede_id: existingAppointment.sede_id,
        operatore_id: existingAppointment.operatore_id,
        data: existingAppointment.data,
        ora: existingAppointment.ora,
        cliente: existingAppointment.cliente,
        note: existingAppointment.note || ''
      });
    } else {
      setFormData({
        sede_id: selectedSedeId,
        operatore_id: defaultOperatoreId || operatori[0]?.id || '',
        data: selectedDate,
        ora: selectedTime,
        cliente: '',
        note: ''
      });
    }
  }, [existingAppointment, selectedSedeId, selectedDate, selectedTime, defaultOperatoreId, operatori]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cliente.trim()) {
      alert('Il nome del cliente è obbligatorio');
      return;
    }

    // Calcola il mese dal campo data
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

  const selectedSede = sedi.find(s => s.id === formData.sede_id);
  const selectedOperatore = operatori.find(o => o.id === formData.operatore_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-[#005CA9]">
              {existingAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              EPASA - {selectedSede?.nome}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Cliente */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <User size={16} className="text-[#005CA9]" />
              Cliente *
            </label>
            <input
              type="text"
              value={formData.cliente}
              onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors"
              placeholder="Nome cliente"
              required
            />
          </div>

          {/* Sede */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <MapPin size={16} className="text-[#005CA9]" />
              Sede
            </label>
            <select
              value={formData.sede_id}
              onChange={(e) => setFormData({ ...formData, sede_id: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors"
            >
              {sedi.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Operatore */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <User size={16} className="text-[#005CA9]" />
              Operatore
            </label>
            <select
              value={formData.operatore_id}
              onChange={(e) => setFormData({ ...formData, operatore_id: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors"
            >
              {operatori.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Data e Ora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock size={16} className="text-[#005CA9]" />
                Data
              </label>
              <input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                min="2026-01-01"
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Clock size={16} className="text-[#005CA9]" />
                Ora
              </label>
              <input
                type="time"
                value={formData.ora}
                onChange={(e) => setFormData({ ...formData, ora: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <FileText size={16} className="text-[#005CA9]" />
              Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-[#005CA9] focus:outline-none transition-colors resize-none"
              rows={3}
              placeholder="Note aggiuntive (opzionale)"
            />
          </div>

          {/* Riepilogo */}
          <div className="bg-blue-50 border-l-4 border-[#005CA9] p-4 rounded-lg">
            <p className="text-xs font-semibold text-gray-700 mb-2">Riepilogo:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p>
                <span className="font-semibold" style={{ color: selectedOperatore?.colore }}>
                  {selectedOperatore?.nome}
                </span>
                {' '}• {selectedSede?.nome}
              </p>
              <p>
                {new Date(formData.data).toLocaleDateString('it-IT', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })} alle {formData.ora}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            {existingAppointment && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
              >
                <Trash2 size={16} />
                Elimina
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] transition-colors font-semibold"
            >
              {existingAppointment ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}