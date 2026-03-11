'use client';

import { useState, useEffect } from 'react';
import { X, BarChart2, User, ChevronDown, ChevronUp, TrendingUp, AlertCircle, Building2 } from 'lucide-react';

interface MeseStats {
  mese: string;
  capacita: number;
  prenotati: number;
}

interface PersonaStats {
  id: string;
  nome: string;
  sedi: string[];
  perMese: Record<string, MeseStats>;
  totaleCapacita: number;
  totalePrenotati: number;
}

interface Props {
  onClose: () => void;
}

export default function StatisticheModal({ onClose }: Props) {
  const [data, setData] = useState<PersonaStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Sede selezionata per il tab; null = tutte
  const [selectedSede, setSelectedSede] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/statistiche/730')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setData(d);
        } else {
          setError(d?.error ?? 'Errore sconosciuto');
        }
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const getPerc = (p: number, c: number) => (c === 0 ? 0 : Math.round((p / c) * 100));
  const getColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 60 ? 'bg-yellow-400' : p >= 30 ? 'bg-blue-500' : 'bg-green-500';
  const getTextColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 60 ? 'bg-yellow-500' : p >= 30 ? 'bg-blue-500' : 'bg-green-500';

  const meseCorrente = new Date().toISOString().substring(0, 7);

  // Ricava tutte le sedi distinte dall'array dati
  const tuttiSedi: string[] = Array.from(
    new Set(data.flatMap(p => p.sedi))
  ).sort();

  // Filtra le persone in base alla sede selezionata
  const personeFiltrate = selectedSede
    ? data.filter(p => p.sedi.includes(selectedSede))
    : data;

  // Totali aggregati per la sede/tab corrente
  const totaleAggregato = personeFiltrate.reduce(
    (acc, p) => ({ cap: acc.cap + p.totaleCapacita, pre: acc.pre + p.totalePrenotati }),
    { cap: 0, pre: 0 }
  );
  const percTotale = getPerc(totaleAggregato.pre, totaleAggregato.cap);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl border-t-4 border-[#005CA9]" style={{ maxHeight: '90vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#005CA9] p-2 rounded-lg">
              <BarChart2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#005CA9]">Statistiche Agenda 730</h2>
              <p className="text-xs text-gray-500">Capacità e appuntamenti per operatore – {new Date().getFullYear()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* ── Tab sedi ── */}
        {!loading && !error && tuttiSedi.length > 0 && (
          <div className="flex-shrink-0 px-6 pt-3 pb-0 border-b border-gray-200">
            <div className="flex items-center gap-1 flex-wrap pb-3">
              {/* Tab "Tutte" */}
              <button
                onClick={() => { setSelectedSede(null); setExpanded(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedSede === null
                    ? 'bg-[#005CA9] text-white border-[#005CA9] shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#005CA9] hover:text-[#005CA9]'
                }`}
              >
                <BarChart2 size={12} />
                Tutte le sedi
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedSede === null ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{data.length}</span>
              </button>

              {/* Tab per ogni sede */}
              {tuttiSedi.map(sede => {
                const count = data.filter(p => p.sedi.includes(sede)).length;
                const isActive = selectedSede === sede;
                return (
                  <button
                    key={sede}
                    onClick={() => { setSelectedSede(sede); setExpanded(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-[#005CA9] text-white border-[#005CA9] shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#005CA9] hover:text-[#005CA9]'
                    }`}
                  >
                    <Building2 size={12} />
                    {sede}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Riepilogo sede corrente ── */}
        {!loading && !error && personeFiltrate.length > 0 && (
          <div className="flex-shrink-0 px-6 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              {selectedSede ? (
                <span className="flex items-center gap-1">
                  <Building2 size={12} className="text-[#005CA9]" />
                  <span className="text-[#005CA9] font-semibold">{selectedSede}</span>
                  <span className="text-gray-400 mx-1">·</span>
                  {personeFiltrate.length} operator{personeFiltrate.length === 1 ? 'e' : 'i'}
                </span>
              ) : (
                <span>{data.length} operatori totali · {tuttiSedi.length} sed{tuttiSedi.length === 1 ? 'e' : 'i'}</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">
                {totaleAggregato.pre} / {totaleAggregato.cap} slot
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full text-white ${getTextColor(percTotale)}`}>
                {percTotale}%
              </span>
            </div>
          </div>
        )}

        {/* ── Body scrollabile ── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-sm text-red-500 font-medium text-center">Errore nel caricamento delle statistiche</p>
              <p className="text-xs text-gray-400 text-center max-w-sm">{error}</p>
            </div>
          ) : personeFiltrate.length === 0 ? (
            <p className="text-center text-gray-400 py-12">Nessun dato disponibile.</p>
          ) : (
            personeFiltrate.map(persona => {
              const perc = getPerc(persona.totalePrenotati, persona.totaleCapacita);
              const barColor = getColor(perc);
              const isOpen = expanded === persona.id;
              const meseData = persona.perMese[meseCorrente];
              const percMese = meseData ? getPerc(meseData.prenotati, meseData.capacita) : 0;

              return (
                <div key={persona.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  {/* Riga principale */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : persona.id)}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">{persona.nome}</span>
                          {/* Badge sedi dell'operatore */}
                          {persona.sedi.map(s => (
                            <span key={s} className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F2FF] text-[#005CA9] border border-[#005CA9]/20">
                              <Building2 size={9} />{s}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">
                            {persona.totalePrenotati} / {persona.totaleCapacita} slot anno
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-white text-[11px] ${getTextColor(perc)}`}>
                            {perc}%
                          </span>
                        </div>
                      </div>
                      {/* Barra anno */}
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(perc, 100)}%` }}
                        />
                      </div>
                      {/* Mese corrente */}
                      {meseData && (
                        <div className="mt-2 flex items-center gap-2">
                          <TrendingUp size={12} className="text-[#005CA9] flex-shrink-0" />
                          <span className="text-[11px] text-gray-500">
                            Mese corrente: <strong className="text-gray-700">{meseData.prenotati}</strong> prenotati
                            su <strong className="text-gray-700">{meseData.capacita}</strong> slot disponibili
                            <span className={`ml-1 font-bold ${
                              percMese >= 90 ? 'text-red-500' : percMese >= 60 ? 'text-yellow-500' : 'text-blue-600'
                            }`}>({percMese}%)</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 flex-shrink-0">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Dettaglio mesi */}
                  {isOpen && (
                    <div className="border-t border-gray-200 px-5 py-4 bg-white">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dettaglio per mese</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Object.entries(persona.perMese)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([key, m]) => {
                            const p = getPerc(m.prenotati, m.capacita);
                            const isCurrentMonth = key === meseCorrente;
                            return (
                              <div key={key} className={`rounded-lg p-2.5 border ${
                                isCurrentMonth ? 'border-[#005CA9] bg-[#E6F2FF]' : 'border-gray-100 bg-gray-50'
                              }`}>
                                <p className={`text-[10px] font-semibold capitalize mb-1 ${
                                  isCurrentMonth ? 'text-[#005CA9]' : 'text-gray-500'
                                }`}>
                                  {m.mese.split(' ')[0]}
                                  {isCurrentMonth && ' ●'}
                                </p>
                                <p className="text-xs font-bold text-gray-800">{m.prenotati} / {m.capacita}</p>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                  <div
                                    className={`h-1.5 rounded-full ${getColor(p)}`}
                                    style={{ width: `${Math.min(p, 100)}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5">{p}%</p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
