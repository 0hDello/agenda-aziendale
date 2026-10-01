'use client';

import React from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Eye,
  List,
  LayoutGrid,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Sede, ViewMode, MIN_DATE } from './types';

interface EpasaHeaderProps {
  selectedSede: Sede;
  sedi: Sede[];
  onSelectSede: (sede: Sede) => void;
  realtimeFlash: boolean;
  onOpenSearch: () => void;
  sedeOrariLabel: string;
  onOpenLoredanaView: () => void;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  onPrev: () => void;
  onNext: () => void;
  selectedDate: Date;
  onToggleDatePicker: () => void;
}

export default function EpasaHeader({
  selectedSede,
  sedi,
  onSelectSede,
  realtimeFlash,
  onOpenSearch,
  sedeOrariLabel,
  onOpenLoredanaView,
  viewMode,
  onToggleViewMode,
  editMode,
  onToggleEditMode,
  onPrev,
  onNext,
  selectedDate,
  onToggleDatePicker,
}: EpasaHeaderProps) {
  return (
    <div className="flex-shrink-0 bg-white border-b-2 border-[#005CA9]/20 px-4 py-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
            <CalendarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#005CA9]">EPASA - {selectedSede.nome}</h1>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                realtimeFlash
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  realtimeFlash ? 'bg-green-500' : 'bg-gray-300'
                }`} />
                {realtimeFlash ? 'Aggiornato' : 'Live'}
              </div>
              <button
                onClick={onOpenSearch}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9] hover:bg-[#E6F2FF]"
                title="Cerca appuntamenti (Ctrl+K)"
              >
                <Search size={11} /> Cerca
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">{sedeOrariLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenLoredanaView}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-50 border-2 border-[#005CA9] text-[#005CA9] hover:bg-blue-100 hover:border-[#004080]"
            title="Apri la vista mensile di Loredana"
          >
            <Eye size={15} /> Vista Loredana
          </button>
          <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
            <button
              onClick={() => onToggleViewMode('daily')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                viewMode === 'daily' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <List className="w-4 h-4 inline mr-1" />Giornaliera
            </button>
            <button
              onClick={() => onToggleViewMode('monthly')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                viewMode === 'monthly' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4 inline mr-1" />Mensile
            </button>
          </div>
          <div className="relative group">
            <button
              onClick={onToggleEditMode}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow border-2 ${
                editMode
                  ? 'bg-amber-500 border-amber-600 text-white'
                  : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
              }`}
              title={editMode ? 'Disattiva modalità modifica' : 'Attiva modalità modifica'}
            >
              {editMode ? <Unlock size={16} /> : <Lock size={16} />}
            </button>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-30">
              {editMode ? 'Esci dalla modifica' : 'Modifica slot'}
            </div>
          </div>
          <button
            onClick={onPrev}
            disabled={selectedDate <= MIN_DATE}
            className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onToggleDatePicker}
            className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] cursor-pointer min-w-[220px] text-center"
          >
            <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
              {viewMode === 'daily'
                ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it })
                : format(selectedDate, 'MMMM yyyy', { locale: it })}
            </span>
          </button>
          <button
            onClick={onNext}
            className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
            <Building2 className="w-5 h-5 text-[#005CA9]" />
            <div className="relative">
              <select
                value={selectedSede.id}
                onChange={e => {
                  const s = sedi.find(x => x.id === e.target.value);
                  if (s) onSelectSede(s);
                }}
                className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 cursor-pointer hover:bg-[#D1E7FF] appearance-none"
              >
                {sedi.map(s => (
                  <option key={s.id} value={s.id} className="text-gray-800 bg-white">
                    {s.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#005CA9] pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
