'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Appointment, Sede, dateStrToLocal } from './types';

interface EpasaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAppointments: Appointment[];
  sedi: Sede[];
  onSelectResult: (apt: Appointment) => void;
}

export default function EpasaSearchModal({
  isOpen,
  onClose,
  allAppointments,
  sedi,
  onSelectResult,
}: EpasaSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
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
    return results.slice(0, 50);
  }, [searchQuery, allAppointments]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-16"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border-t-4 border-[#005CA9]">
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <Search size={18} className="text-[#005CA9] flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca cliente, operatore, data (es. 2026-03)..."
            className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-1">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!searchQuery && (
            <div className="px-4 py-8 text-center">
              <Search size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Inizia a digitare per cercare</p>
              <p className="text-xs text-gray-300 mt-1">Cerca per nome cliente, operatore o data</p>
            </div>
          )}
          {searchQuery && searchResults.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">
                Nessun risultato per <strong>&quot;{searchQuery}&quot;</strong>
              </p>
            </div>
          )}
          {searchResults.map(apt => {
            const sede = sedi.find(s => s.id === apt.sede_id);
            return (
              <div
                key={apt.id}
                onClick={() => onSelectResult(apt)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#E6F2FF] cursor-pointer border-b border-gray-100 group"
              >
                <div className="w-9 h-9 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User size={15} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{apt.cliente}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-[#005CA9]">{apt.operatore_id}</span>
                    {' · '}{sede?.nome || apt.sede_id}{' · '}
                    {format(dateStrToLocal(apt.data), 'dd/MM/yyyy', { locale: it })}
                    {' · '}{apt.ora}
                  </p>
                  {apt.note && <p className="text-xs text-gray-400 truncate mt-0.5 italic">{apt.note}</p>}
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-[#005CA9] flex-shrink-0" />
              </div>
            );
          })}
        </div>

        {searchResults.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {searchResults.length}{searchResults.length === 50 ? '+' : ''} risultat{searchResults.length === 1 ? 'o' : 'i'} — clicca per navigare
            </p>
            <kbd className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
          </div>
        )}
      </div>
    </div>
  );
}
