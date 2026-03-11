'use client';

import { useState, useEffect } from 'react';
import { X, BarChart2, User, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

interface MeseStats {
  mese: string;
  capacita: number;
  prenotati: number;
}

interface PersonaStats {
  id: number;
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
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/statistiche/730')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getPerc = (p: number, c: number) => (c === 0 ? 0 : Math.round((p / c) * 100));
  const getColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 60 ? 'bg-yellow-400' : p >= 30 ? 'bg-blue-500' : 'bg-green-500';

  const meseCorrente = new Date().toISOString().substring(0, 7);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-t-4 border-[#005CA9]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-center text-gray-400 py-12">Nessun dato disponibile.</p>
          ) : (
            data.map(persona => {
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
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-800 text-sm">{persona.nome}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="hidden sm:block">{persona.sedi.join(', ')}</span>
                          <span className="font-semibold text-gray-700">
                            {persona.totalePrenotati} / {persona.totaleCapacita} slot anno
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-white text-[11px] ${
                            perc >= 90 ? 'bg-red-500' : perc >= 60 ? 'bg-yellow-500' : perc >= 30 ? 'bg-blue-500' : 'bg-green-500'
                          }`}>{perc}%</span>
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
