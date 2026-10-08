'use client';

import React from 'react';
import { X, Settings, Check, Sliders, Palette, Layout, Sparkles } from 'lucide-react';
import { EpasaSettings, MileceEmptyStyle, Sede } from './types';

interface EpasaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EpasaSettings;
  onSaveSettings: (newSettings: EpasaSettings) => void;
  sedi: Sede[];
}

export default function EpasaSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  sedi,
}: EpasaSettingsModalProps) {
  const [localSettings, setLocalSettings] = React.useState<EpasaSettings>(settings);

  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleReset = () => {
    const defaults: EpasaSettings = {
      mileceEmptyStyle: 'diagonal',
      defaultViewMode: 'daily',
      defaultSedeId: 'imola',
      rowHeight: 'normal',
      showNoteTooltips: true,
    };
    setLocalSettings(defaults);
    onSaveSettings(defaults);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#005CA9] to-[#004080] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Settings size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Personalizzazione Agenda EPASA</h2>
              <p className="text-[11px] text-blue-100">
                Impostazioni personali salvate su questo computer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* 1. Stile slot non lavorativi di MILECE */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Palette size={14} className="text-[#005CA9]" />
              Stile slot pomeridiani di MILECE (non lavorativi)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Scegli come visualizzare l&apos;area pomeridiana di MILECE nei giorni in cui non riceve:
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Opzione 1: Strisce diagonali */}
              <button
                type="button"
                onClick={() => setLocalSettings(s => ({ ...s, mileceEmptyStyle: 'diagonal' }))}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                  localSettings.mileceEmptyStyle === 'diagonal'
                    ? 'border-[#005CA9] bg-blue-50/50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className="w-full h-8 rounded-md mb-2 border border-gray-300"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg,#f9fafb,#f9fafb 8px,#f1f5f9 8px,#f1f5f9 16px)',
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 leading-tight">
                    Strisce diagonali
                  </span>
                  {localSettings.mileceEmptyStyle === 'diagonal' && (
                    <Check size={14} className="text-[#005CA9]" />
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5">Sede chiusa</span>
              </button>

              {/* Opzione 2: Bianco totale */}
              <button
                type="button"
                onClick={() => setLocalSettings(s => ({ ...s, mileceEmptyStyle: 'white' }))}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                  localSettings.mileceEmptyStyle === 'white'
                    ? 'border-[#005CA9] bg-blue-50/50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="w-full h-8 rounded-md mb-2 border border-gray-200 bg-white" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 leading-tight">
                    Bianco totale
                  </span>
                  {localSettings.mileceEmptyStyle === 'white' && (
                    <Check size={14} className="text-[#005CA9]" />
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5">Senza righe</span>
              </button>

              {/* Opzione 3: Blocco con lucchetto */}
              <button
                type="button"
                onClick={() => setLocalSettings(s => ({ ...s, mileceEmptyStyle: 'locked' }))}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                  localSettings.mileceEmptyStyle === 'locked'
                    ? 'border-[#005CA9] bg-blue-50/50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="w-full h-8 rounded-md mb-2 bg-slate-600 border border-slate-700 flex items-center justify-center text-[10px] text-slate-200 font-medium">
                  chiuso
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 leading-tight">
                    Lucchetto scuro
                  </span>
                  {localSettings.mileceEmptyStyle === 'locked' && (
                    <Check size={14} className="text-[#005CA9]" />
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5">Uff. chiuso</span>
              </button>
            </div>
          </div>

          {/* 2. Sede preferita all'apertura */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Layout size={14} className="text-[#005CA9]" />
              Sede preferita di avvio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {sedi.map(s => {
                const isSel = (localSettings.defaultSedeId || 'imola') === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setLocalSettings(st => ({ ...st, defaultSedeId: s.id }))}
                    className={`px-3 py-2.5 rounded-lg border text-center transition-all text-xs font-semibold ${
                      isSel
                        ? 'border-[#005CA9] bg-[#E6F2FF] text-[#005CA9] shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    {s.nome}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Altezza righe tabella */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Sliders size={14} className="text-[#005CA9]" />
              Densità righe orari
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'compact', label: 'Compatta', sub: '38px' },
                { id: 'normal', label: 'Normale', sub: '45px' },
                { id: 'spacious', label: 'Spaziosa', sub: '52px' },
              ].map(opt => {
                const isSel = (localSettings.rowHeight || 'normal') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setLocalSettings(s => ({
                        ...s,
                        rowHeight: opt.id as 'compact' | 'normal' | 'spacious',
                      }))
                    }
                    className={`px-3 py-2 rounded-lg border text-center transition-all ${
                      isSel
                        ? 'border-[#005CA9] bg-[#E6F2FF] text-[#005CA9] shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold block">{opt.label}</span>
                    <span className="text-[10px] text-gray-400 block">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Opzione note */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div>
              <span className="text-xs font-bold text-gray-800 block">
                Mostra anteprima note al passaggio del mouse
              </span>
              <span className="text-[11px] text-gray-500 block">
                Visualizza un box con il testo delle note passando col cursore sugli appuntamenti
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
              <input
                type="checkbox"
                checked={localSettings.showNoteTooltips ?? true}
                onChange={e =>
                  setLocalSettings(s => ({ ...s, showNoteTooltips: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#005CA9]"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-gray-800 font-semibold underline"
          >
            Ripristina predefiniti
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-[#005CA9] text-white text-xs font-bold shadow hover:bg-[#004080] transition-colors"
            >
              Salva preferenze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
