'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, User, ChevronDown, ChevronUp, TrendingUp, AlertCircle, ArrowLeft, Calendar, Building2 } from 'lucide-react';

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
  perSedePerMese: Record<string, Record<string, MeseStats>>;
  totaleCapacita: number;
  totalePrenotati: number;
}

export default function StatistichePage() {
  const router = useRouter();
  const [data, setData] = useState<PersonaStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedSede, setSelectedSede] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/statistiche/730')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setData(d);
        else setError(d?.error ?? 'Errore sconosciuto');
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const getPerc = (p: number, c: number) => (c === 0 ? 0 : Math.round((p / c) * 100));
  const getBarColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 60 ? 'bg-yellow-400' : p >= 30 ? 'bg-blue-500' : 'bg-green-500';
  const getBadgeColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 60 ? 'bg-yellow-500' : p >= 30 ? 'bg-blue-500' : 'bg-green-500';
  const getTextColor = (p: number) =>
    p >= 90 ? 'text-red-500' : p >= 60 ? 'text-yellow-500' : 'text-blue-600';

  const meseCorrente = new Date().toISOString().substring(0, 7);
  const annoCorrente = new Date().getFullYear();

  const tuttiSedi: string[] = Array.from(new Set(data.flatMap(p => p.sedi))).sort();
  const personeFiltrate = selectedSede ? data.filter(p => p.sedi.includes(selectedSede)) : data;

  // Helper: ritorna perMese filtrato per la sede selezionata (o totale)
  const getPerMese = (persona: PersonaStats): Record<string, MeseStats> => {
    if (selectedSede && persona.perSedePerMese?.[selectedSede]) {
      return persona.perSedePerMese[selectedSede];
    }
    return persona.perMese;
  };

  // Totali header in base alla sede selezionata
  const totCapacita  = personeFiltrate.reduce((s, p) => {
    const pm = getPerMese(p);
    return s + Object.values(pm).reduce((a, m) => a + m.capacita, 0);
  }, 0);
  const totPrenotati = personeFiltrate.reduce((s, p) => {
    const pm = getPerMese(p);
    return s + Object.values(pm).reduce((a, m) => a + m.prenotati, 0);
  }, 0);
  const totPerc = getPerc(totPrenotati, totCapacita);

  return (
    // FIX SCROLL: h-screen + overflow-y-auto sulla root, flex col
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] flex flex-col">

      {/* ── HEADER ── */}
      <div className="bg-white border-b-4 border-[#005CA9] px-6 py-4 shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#005CA9] hover:bg-[#E6F2FF] transition-colors font-medium text-sm border border-[#005CA9]/20"
            >
              <ArrowLeft size={16} />
              Torna alle Agende
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <div className="flex items-center gap-3">
              <div className="bg-[#005CA9] p-2 rounded-lg">
                <BarChart2 size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#005CA9]">Statistiche Agenda 730</h1>
                <p className="text-xs text-gray-500">
                  Capacità e prenotazioni per operatore &mdash; Anno {annoCorrente}
                  {selectedSede && (
                    <span className="ml-2 text-[#005CA9] font-semibold">· {selectedSede}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
          {!loading && !error && data.length > 0 && (
            <div className="hidden md:flex items-center gap-6 bg-[#F5F8FA] border border-gray-200 rounded-xl px-5 py-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 font-medium">Slot totali anno</p>
                <p className="text-2xl font-bold text-[#005CA9]">{totCapacita.toLocaleString('it')}</p>
              </div>
              <div className="h-8 w-px bg-gray-300" />
              <div className="text-center">
                <p className="text-xs text-gray-500 font-medium">Prenotati</p>
                <p className="text-2xl font-bold text-gray-800">{totPrenotati.toLocaleString('it')}</p>
              </div>
              <div className="h-8 w-px bg-gray-300" />
              <div className="text-center">
                <p className="text-xs text-gray-500 font-medium">Occupazione</p>
                <p className={`text-2xl font-bold ${getTextColor(totPerc)}`}>{totPerc}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TAB SEDI ── */}
      {!loading && !error && tuttiSedi.length > 0 && (
        <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedSede(null); setExpanded(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                selectedSede === null
                  ? 'bg-[#005CA9] text-white border-[#005CA9] shadow'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#005CA9] hover:text-[#005CA9]'
              }`}
            >
              <BarChart2 size={14} />
              Tutte le sedi
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                selectedSede === null ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{data.length}</span>
            </button>

            {tuttiSedi.map(sede => {
              const count = data.filter(p => p.sedi.includes(sede)).length;
              const isActive = selectedSede === sede;
              const sedePers = data.filter(p => p.sedi.includes(sede));
              const sedeCap = sedePers.reduce((s, p) => {
                const pm = p.perSedePerMese?.[sede] ?? p.perMese;
                return s + Object.values(pm).reduce((a, m) => a + m.capacita, 0);
              }, 0);
              const sedePre = sedePers.reduce((s, p) => {
                const pm = p.perSedePerMese?.[sede] ?? p.perMese;
                return s + Object.values(pm).reduce((a, m) => a + m.prenotati, 0);
              }, 0);
              const sedePerc = getPerc(sedePre, sedeCap);
              return (
                <button
                  key={sede}
                  onClick={() => { setSelectedSede(sede); setExpanded(null); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                    isActive
                      ? 'bg-[#005CA9] text-white border-[#005CA9] shadow'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#005CA9] hover:text-[#005CA9]'
                  }`}
                >
                  <Building2 size={14} />
                  {sede}
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{count}</span>
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold text-white ${getBadgeColor(sedePerc)}`}>
                    {sedePerc}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BODY (occupa il resto, scorrevole internamente) ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-[#005CA9]" />
              <p className="text-gray-500 font-medium">Calcolo statistiche in corso...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <AlertCircle size={48} className="text-red-400" />
              <p className="text-lg font-semibold text-red-500">Errore nel caricamento</p>
              <p className="text-sm text-gray-400 text-center max-w-md">{error}</p>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#005CA9] text-white rounded-lg text-sm font-medium hover:bg-[#004080] transition-colors">
                Riprova
              </button>
            </div>
          ) : personeFiltrate.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Calendar size={48} className="text-gray-300" />
              <p className="text-gray-400 font-medium">Nessun dato disponibile.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {personeFiltrate.map(persona => {
                const perMese  = getPerMese(persona);
                const totCap   = Object.values(perMese).reduce((s, m) => s + m.capacita, 0);
                const totPre   = Object.values(perMese).reduce((s, m) => s + m.prenotati, 0);
                const perc     = getPerc(totPre, totCap);
                const isOpen   = expanded === persona.id;
                const meseData = perMese[meseCorrente];
                const percMese = meseData ? getPerc(meseData.prenotati, meseData.capacita) : 0;

                return (
                  <div key={persona.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
                    <div
                      className="flex items-center gap-5 px-6 py-5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpanded(isOpen ? null : persona.id)}
                    >
                      <div className="w-12 h-12 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0 shadow">
                        <User size={22} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-800 text-base">{persona.nome}</span>
                            {persona.sedi.map(s => (
                              <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                selectedSede === s
                                  ? 'bg-[#005CA9] text-white border-[#005CA9]'
                                  : 'bg-[#E6F2FF] text-[#005CA9] border-[#005CA9]/20'
                              }`}>
                                <Building2 size={10} />{s}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-semibold text-gray-600">
                              {totPre.toLocaleString('it')}
                              <span className="text-gray-400 font-normal"> / {totCap.toLocaleString('it')} slot</span>
                            </span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${getBadgeColor(perc)}`}>
                              {perc}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-700 ${getBarColor(perc)}`}
                            style={{ width: `${Math.min(perc, 100)}%` }}
                          />
                        </div>
                        {meseData && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <TrendingUp size={13} className="text-[#005CA9] flex-shrink-0" />
                            <span className="text-xs text-gray-500">
                              <span className="font-semibold text-[#005CA9] capitalize">{meseData.mese.split(' ')[0]}</span>:
                              {' '}<strong className="text-gray-700">{meseData.prenotati}</strong> prenotati
                              {' '}su{' '}<strong className="text-gray-700">{meseData.capacita}</strong> slot disponibili
                              <span className={`ml-1.5 font-bold ${getTextColor(percMese)}`}>({percMese}%)</span>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-gray-300 flex-shrink-0 ml-2">
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                          Dettaglio mensile {annoCorrente}
                          {selectedSede && <span className="ml-2 text-[#005CA9] normal-case font-semibold">— {selectedSede}</span>}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {Object.entries(perMese)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([key, m]) => {
                              const p = getPerc(m.prenotati, m.capacita);
                              const isCurrent = key === meseCorrente;
                              return (
                                <div key={key} className={`rounded-xl p-3 border-2 transition-all ${
                                  isCurrent
                                    ? 'border-[#005CA9] bg-[#E6F2FF] shadow-md'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}>
                                  <p className={`text-[11px] font-bold capitalize mb-2 ${
                                    isCurrent ? 'text-[#005CA9]' : 'text-gray-500'
                                  }`}>
                                    {m.mese.split(' ')[0]}{isCurrent && ' ●'}
                                  </p>
                                  <p className="text-sm font-bold text-gray-800">
                                    {m.prenotati}
                                    <span className="text-xs font-normal text-gray-400"> / {m.capacita}</span>
                                  </p>
                                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                    <div
                                      className={`h-2 rounded-full ${getBarColor(p)}`}
                                      style={{ width: `${Math.min(p, 100)}%` }}
                                    />
                                  </div>
                                  <p className={`text-[11px] font-semibold mt-1 ${
                                    isCurrent ? getTextColor(p) : 'text-gray-400'
                                  }`}>{p}%</p>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
