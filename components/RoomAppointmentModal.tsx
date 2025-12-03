'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, FileText, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface RoomAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { date: string; time: string; title: string }) => void;
  onDelete?: () => void;
  selectedDate: string;
  selectedTime: string;
  existingAppointment?: string | null;
  roomName: string;
}

const APPOINTMENT_OPTIONS = [
  'VISITE PATENTI',
  'CORSO CQC',
  'RIUNIONE',
  'FORMAZIONE',
  'COLLOQUIO',
];

export default function RoomAppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  selectedTime,
  existingAppointment,
  roomName,
}: RoomAppointmentModalProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [useCustom, setUseCustom] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (existingAppointment) {
        // Verifica se è una delle opzioni predefinite
        if (APPOINTMENT_OPTIONS.includes(existingAppointment)) {
          setSelectedOption(existingAppointment);
          setUseCustom(false);
          setCustomTitle('');
        } else {
          setSelectedOption('');
          setCustomTitle(existingAppointment);
          setUseCustom(true);
        }
      } else {
        setSelectedOption('');
        setCustomTitle('');
        setUseCustom(false);
      }
    }
  }, [isOpen, existingAppointment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const title = useCustom ? customTitle : selectedOption;
    if (!title.trim()) return;

    onSave({
      date: selectedDate,
      time: selectedTime,
      title: title.trim(),
    });

    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  if (!isOpen) return null;

  const dateObj = parseISO(selectedDate);
  const formattedDate = format(dateObj, "EEEE dd MMMM yyyy", { locale: it });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#005CA9] p-2 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#005CA9]">
                {existingAppointment ? 'Modifica Prenotazione' : 'Nuova Prenotazione'}
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">{roomName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-[#E6F2FF] rounded-lg border border-[#005CA9]/20">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="w-4 h-4 text-[#005CA9]" />
            <span className="font-medium capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700 mt-1">
            <Clock className="w-4 h-4 text-[#005CA9]" />
            <span className="font-medium">{selectedTime}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-[#005CA9]" />
              Tipo di Prenotazione
            </label>
            
            {!useCustom ? (
              <div className="space-y-2">
                {APPOINTMENT_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedOption === option
                        ? 'border-[#005CA9] bg-[#E6F2FF]'
                        : 'border-gray-200 hover:border-[#005CA9]/50 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="appointmentType"
                      value={option}
                      checked={selectedOption === option}
                      onChange={(e) => setSelectedOption(e.target.value)}
                      className="w-4 h-4 text-[#005CA9] focus:ring-[#005CA9]"
                    />
                    <span className="font-medium text-gray-800">{option}</span>
                  </label>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    setUseCustom(true);
                    setSelectedOption('');
                  }}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#005CA9] hover:text-[#005CA9] transition-colors font-medium text-sm"
                >
                  + Inserisci titolo personalizzato
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Inserisci il titolo..."
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-[#005CA9] focus:outline-none transition-colors"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustom(false);
                    setCustomTitle('');
                  }}
                  className="text-sm text-[#005CA9] hover:underline font-medium"
                >
                  ← Torna alle opzioni predefinite
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {existingAppointment && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-lg transition-all duration-200 font-semibold flex items-center gap-2"
              >
                <Trash2 size={16} />
                Elimina
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!useCustom && !selectedOption || useCustom && !customTitle.trim()}
              className="flex-1 px-4 py-2.5 text-sm bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] hover:shadow-lg transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {existingAppointment ? 'Aggiorna' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}