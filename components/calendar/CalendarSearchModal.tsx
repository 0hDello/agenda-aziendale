'use client';

import React, { useState, useMemo, useRef, useDeferredValue, useEffect } from 'react';
import { Search, X, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Appuntamento, Persona, Sede } from '@/lib/types';

interface CalendarSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appuntamento[];
  personeMap: Map<string, Persona>;
  sedi: Sede[];
  onSelectResult: (apt: Appuntamento) => void;
}

export default function CalendarSearchModal({
  isOpen,
  onClose,
  appointments,
  personeMap,
  sedi,
  onSelectResult,
}: CalendarSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
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
    const q = deferredQuery.toLowerCase().trim();
    if (!q) return [];
    const seen = new Set<string>();
    const out: Appuntamento[] = [];

    for (const a of appointments) {
      if ((a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO') continue;
      const personaNome = personeMap.get(a.persona_id)?.nome.toLowerCase() ?? '';
      const match =
        (a.cliente ?? '').toLowerCase().includes(q) ||
        (a.note?.toLowerCase().includes(q)) ||
        a.persona_id.toLowerCase().includes(q) ||
        personaNome.includes(q) ||
        a.data.includes(q) ||
        a.sede_id.toLowerCase().includes(q);

      if (match && !seen.has(a.id)) {
        seen.add(a.id);
        out.push(a);
      }
    }

    out.sort((a, b) => b.data.localeCompare(a.data));
    return out.slice(0, 50);
  }, [deferredQuery, appointments, personeMap]);

  const isSearchPending = searchQuery !== deferredQuery;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16"
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
            placeholder="Cerca cliente, persona, data (es. 2026-03)..."
            className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400"
          />
          {isSearchPending && (
            <div className="w-3.5 h-3.5 border-2 border-[#005CA9]/30 border-t-[#005CA9] rounded-full animate-spin flex-shrink-0" />
          )}
          {searchQuery && !isSearchPending && (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors ml-1">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!searchQuery && (
            <div className="px-4 py-8 text-center">
              <Search size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Inizia a digitare per cercare</p>
              <p className="text-xs text-gray-300 mt-1">Cerca per nome cliente, persona o data</p>
            </div>
          )}
          {searchQuery && !isSearchPending && searchResults.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">
                Nessun risultato per <strong>&quot;{searchQuery}&quot;</strong>
              </p>
            </div>
          )}
          {searchResults.map(apt => {
            const sede    = sedi.find(s => s.id === apt.sede_id);
            const persona = personeMap.get(apt.persona_id);
            return (
              <div
                key={apt.id}
                onClick={() => onSelectResult(apt)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#E6F2FF] cursor-pointer border-b border-gray-100 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <User size={15} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{apt.cliente}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-[#005CA9]">{persona?.nome ?? apt.persona_id}</span>
                    {' · '}{sede?.nome ?? apt.sede_id}{' · '}
                    {(() => {
                      try {
                        const [y, m, d] = apt.data.split('-').map(Number);
                        return format(new Date(y, m - 1, d, 12), 'dd/MM/yyyy', { locale: it });
                      } catch {
                        return apt.data;
                      }
                    })()}
                    {' · '}{apt.ora_inizio?.substring(0, 5)}
                  </p>
                  {apt.note && <p className="text-xs text-gray-400 truncate mt-0.5 italic">{apt.note}</p>}
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-[#005CA9] transition-colors flex-shrink-0" />
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
