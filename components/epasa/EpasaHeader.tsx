'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  X,
  User,
  ChevronRight,
  Eye,
  List,
  LayoutGrid,
  Lock,
  Unlock,
  ChevronLeft,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Sede, ViewMode, MIN_DATE, Appointment, dateStrToLocal } from './types';

interface EpasaHeaderProps {
  selectedSede: Sede;
  sedi: Sede[];
  onSelectSede: (sede: Sede) => void;
  realtimeFlash?: boolean;
  onOpenSearch?: () => void;
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
  allAppointments?: Appointment[];
  onSelectSearchResult?: (apt: Appointment) => void;
}

export default function EpasaHeader({
  selectedSede,
  sedi,
  onSelectSede,
  realtimeFlash: _realtimeFlash,
  onOpenSearch: _onOpenSearch,
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
  allAppointments = [],
  onSelectSearchResult,
}: EpasaHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Chiusura dropdown se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scorciatoia globale Ctrl+K per dare focus alla barra di ricerca
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        if (searchQuery.trim()) {
          setIsDropdownOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchQuery]);

  // Risultati ricerca
  const searchResults = useMemo(() => {
    if (!allAppointments || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = allAppointments.filter(
      a =>
        a.cliente.trim().toUpperCase() !== 'UFF CHIUSO' &&
        (a.cliente.toLowerCase().includes(q) ||
          (a.note?.toLowerCase().includes(q)) ||
          a.operatore_id.toLowerCase().includes(q) ||
          a.data.includes(q) ||
          a.sede_id.toLowerCase().includes(q))
    );
    results.sort((a, b) => b.data.localeCompare(a.data));
    return results.slice(0, 30);
  }, [searchQuery, allAppointments]);

  const handleSelectAppointment = (apt: Appointment) => {
    if (onSelectSearchResult) {
      onSelectSearchResult(apt);
    }
    setIsDropdownOpen(false);
    setSearchQuery('');
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      searchInputRef.current?.blur();
    } else if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        e.preventDefault();
        handleSelectAppointment(searchResults[0]);
      }
    }
  };

  return (
    <div className="flex-shrink-0 bg-white border-b-2 border-[#005CA9]/20 px-4 py-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* ── TITOLO SEDE & ORARI (SINISTRA) ── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg flex-shrink-0">
            <CalendarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#005CA9] whitespace-nowrap leading-none">
              EPASA - {selectedSede.nome}
            </h1>
            <p className="text-xs text-gray-600 mt-1">{sedeOrariLabel}</p>
          </div>
        </div>

        {/* ── BARRA ORIZZONTALE DI RICERCA (CENTRATA & ALLINEATA VERTICALMENTE) ── */}
        <div
          ref={searchContainerRef}
          className="relative w-full md:w-auto md:flex-1 max-w-sm lg:max-w-md mx-2 lg:mx-6 flex items-center"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-300 hover:border-gray-400 focus-within:border-[#005CA9] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#005CA9]/20 transition-all w-full h-[38px] shadow-sm">
            <Search size={16} className="text-[#005CA9] flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsDropdownOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Cerca cliente, note, operatore..."
              className="w-full text-xs bg-transparent outline-none text-gray-800 placeholder-gray-400 font-medium"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                title="Cancella ricerca"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block text-[10px] text-gray-400 bg-gray-200/70 px-1.5 py-0.5 rounded font-mono pointer-events-none select-none">
                Ctrl+K
              </kbd>
            )}
          </div>

          {/* Dropdown Floating dei Risultati */}
          {isDropdownOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Search size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Nessun risultato trovato</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Nessun appuntamento corrisponde a &quot;{searchQuery}&quot;
                    </p>
                  </div>
                ) : (
                  searchResults.map(apt => {
                    const sede = sedi.find(s => s.id === apt.sede_id);
                    const isMilece = apt.operatore_id.toUpperCase() === 'MILECE';
                    return (
                      <div
                        key={apt.id}
                        onClick={() => handleSelectAppointment(apt)}
                        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#E6F2FF] cursor-pointer transition-colors group text-left"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-sm ${
                            isMilece ? 'bg-emerald-600' : 'bg-[#005CA9]'
                          }`}
                        >
                          <User size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#005CA9]">
                              {apt.cliente}
                            </p>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                                isMilece
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-100 text-[#005CA9] border border-blue-200'
                              }`}
                            >
                              {apt.operatore_id}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-700">{sede?.nome || apt.sede_id}</span>
                            <span>&middot;</span>
                            <span>
                              {format(dateStrToLocal(apt.data), 'EEE dd/MM/yyyy', { locale: it })}
                            </span>
                            <span>&middot;</span>
                            <span className="font-bold text-gray-800">{apt.ora}</span>
                          </p>
                          {apt.note && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5 italic">
                              {apt.note}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-[#005CA9] flex-shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="px-3.5 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {searchResults.length} risultat{searchResults.length === 1 ? 'o' : 'i'} &mdash; premi <kbd className="font-mono font-bold bg-white px-1 py-0.5 rounded border text-[10px]">Invio</kbd> per il primo
                  </span>
                  <kbd className="text-[10px] font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">ESC</kbd>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CONTROLLI & NAVIGAZIONE (DESTRA) ── */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
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
