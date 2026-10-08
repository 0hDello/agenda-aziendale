'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart2,
  User,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Building2,
  Sparkles,
  HeartHandshake,
  Clock,
  FileText,
} from 'lucide-react';

interface MeseDettaglio {
  mese: string;
  meseNumero: number;
  capacita: number;
  prenotati: number;
}

interface PraticaStats {
  id: string;
  label: string;
  description: string;
  colore: string;
  badgeBg: string;
  badgeText: string;
  count: number;
  percentuale: number;
  perMese: Record<number, number>;
  perSede: Record<string, number>;
}

interface OperatoreStats {
  id: string;
  nome: string;
  sedi: string[];
  totaleCapacita: number;
  totalePrenotati: number;
  occupazionePerc: number;
  perMese: Record<string, MeseDettaglio>;
  perSedePerMese: Record<string, Record<string, MeseDettaglio>>;
  pratiche: PraticaStats[];
}

interface StatsApiResponse {
  anno: number;
  sedi: Array<{ id: string; nome: string }>;
  operatori: Array<{ id: string; nome: string }>;
  operatoriStats: OperatoreStats[];
  totaleGlobale: {
    totaleCapacita: number;
    totalePrenotati: number;
    occupazionePerc: number;
    perSede: Record<string, { capacita: number; prenotati: number; occupazionePerc: number }>;
    praticheTotali: Array<{
      id: string;
      label: string;
      colore: string;
      badgeBg: string;
      badgeText: string;
      count: number;
      percentuale: number;
    }>;
  };
}

export default function StatisticheEpasaPage() {
  const router = useRouter();

  const [anno, setAnno] = useState<number>(2026);
  const [data, setData] = useState<StatsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtri attivi
  const [activeTab, setActiveTab] = useState<'LOREDANA' | 'MILECE'>('LOREDANA');
  const [selectedSede, setSelectedSede] = useState<string | null>(null); // null = Tutte

  // Caricamento dati da API
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/statistiche/epasa?anno=${anno}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, [anno]);

  // Operatori estratti
  const loredanaStats = useMemo(
    () => data?.operatoriStats.find(o => o.id === 'LOREDANA') || null,
    [data]
  );
  const mileceStats = useMemo(
    () => data?.operatoriStats.find(o => o.id === 'MILECE') || null,
    [data]
  );

  // Calcolo colori badge occupazione
  const getBadgeColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 65 ? 'bg-amber-500' : p >= 35 ? 'bg-blue-600' : 'bg-emerald-600';
  const getTextColor = (p: number) =>
    p >= 90 ? 'text-red-600' : p >= 65 ? 'text-amber-600' : p >= 35 ? 'text-[#005CA9]' : 'text-emerald-600';
  const getBarColor = (p: number) =>
    p >= 90 ? 'bg-red-500' : p >= 65 ? 'bg-amber-500' : p >= 35 ? 'bg-[#005CA9]' : 'bg-emerald-500';

  // Sedi uniche con filtri
  const sediList = data?.sedi || [];

  // Mesi ordinati
  const mesiList = useMemo(() => {
    if (!data) return [];
    const keys = [
      '01', '02', '03', '04', '05', '06',
      '07', '08', '09', '10', '11', '12',
    ];
    const labels = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
    ];
    return keys.map((k, idx) => ({
      key: `${anno}-${k}`,
      label: labels[idx],
      num: idx + 1,
    }));
  }, [data, anno]);

  // Helper per calcolare capacità e prenotati per un operatore considerando la sede selezionata
  const getOperatoreStatsPerSede = (opStats: OperatoreStats) => {
    if (!selectedSede) {
      return {
        capacita: opStats.totaleCapacita,
        prenotati: opStats.totalePrenotati,
        occupazione: opStats.occupazionePerc,
      };
    }
    const perMeseSede = opStats.perSedePerMese[selectedSede];
    if (!perMeseSede) {
      return { capacita: 0, prenotati: 0, occupazione: 0 };
    }
    const vals = Object.values(perMeseSede);
    const cap = vals.reduce((a, v) => a + v.capacita, 0);
    const pre = vals.reduce((a, v) => a + v.prenotati, 0);
    const occ = cap > 0 ? Math.round((pre / cap) * 100) : 0;
    return { capacita: cap, prenotati: pre, occupazione: occ };
  };

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-[#E6F2FF]/60 via-[#F5F8FA] to-white flex flex-col">
      {/* ── HEADER ── */}
      <header className="bg-white border-b-4 border-[#005CA9] px-6 py-4 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#005CA9] hover:bg-[#E6F2FF] transition-colors font-medium text-sm border border-[#005CA9]/20"
              title="Torna alla Home Agende"
            >
              <ArrowLeft size={16} />
              Home Agende
            </button>
            <div className="h-6 w-px bg-gray-300 hidden md:block" />
            <div className="flex items-center gap-3">
              <div className="bg-[#005CA9] p-2.5 rounded-xl shadow-md">
                <BarChart2 size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[#005CA9]">Statistiche EPASA & Patronato</h1>
                  <span className="bg-blue-100 text-[#005CA9] text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                    Smart Insights
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Volumi, saturazione slot e ripartizione tipologia pratiche per operatore &mdash; Anno {anno}
                  {activeTab === 'MILECE' ? (
                    <span className="ml-2 text-emerald-700 font-semibold">· Sede Imola</span>
                  ) : selectedSede ? (
                    <span className="ml-2 text-[#005CA9] font-semibold">· {selectedSede}</span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          {/* Anno Selector & KPI compatti */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Selettore Anno */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-300 shadow-inner">
              {[2026, 2027].map(y => (
                <button
                  key={y}
                  onClick={() => setAnno(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    anno === y
                      ? 'bg-[#005CA9] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Global Quick Badge */}
            {!loading && !error && data && (
              <div className="flex items-center gap-4 bg-[#F5F8FA] border border-gray-200 rounded-xl px-4 py-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Prenotati</p>
                  <p className="text-lg font-bold text-gray-800">
                    {data.totaleGlobale.totalePrenotati.toLocaleString('it')}
                  </p>
                </div>
                <div className="h-6 w-px bg-gray-300" />
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Slot Totali</p>
                  <p className="text-lg font-bold text-[#005CA9]">
                    {data.totaleGlobale.totaleCapacita.toLocaleString('it')}
                  </p>
                </div>
                <div className="h-6 w-px bg-gray-300" />
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Occupazione</p>
                  <p className={`text-lg font-bold ${getTextColor(data.totaleGlobale.occupazionePerc)}`}>
                    {data.totaleGlobale.occupazionePerc}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── BARRA TAB OPERATORI & SEDI ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs Operatori */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('LOREDANA')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                activeTab === 'LOREDANA'
                  ? 'bg-[#005CA9] text-white border-[#005CA9] shadow'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
              }`}
            >
              <User size={16} />
              Loredana
              <span className="text-[11px] opacity-80 font-normal hidden lg:inline">(Patronato)</span>
              {loredanaStats && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'LOREDANA' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {loredanaStats.totalePrenotati}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('MILECE');
                setSelectedSede(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                activeTab === 'MILECE'
                  ? 'bg-[#005CA9] text-white border-[#005CA9] shadow'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
              }`}
            >
              <User size={16} />
              Milece
              <span className="text-[11px] opacity-80 font-normal hidden lg:inline">(ISEE & Badanti)</span>
              {mileceStats && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'MILECE' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {mileceStats.totalePrenotati}
                </span>
              )}
            </button>
          </div>

          {/* Sedi Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeTab === 'MILECE' ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-white border border-gray-800 shadow-sm">
                <Building2 size={12} />
                Imola
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white/30 text-white">
                  {mileceStats?.totalePrenotati ?? 0}
                </span>
              </span>
            ) : (
              <>
                <button
                  onClick={() => setSelectedSede(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedSede === null
                      ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Tutte le sedi
                  {loredanaStats && (
                    <span className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      selectedSede === null ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {loredanaStats.totalePrenotati}
                    </span>
                  )}
                </button>
                {sediList.map(s => {
                  const isActive = selectedSede === s.nome || selectedSede === s.id;
                  const countSede = loredanaStats
                    ? Object.values(loredanaStats.perSedePerMese[s.nome] || {}).reduce(
                        (acc, m) => acc + m.prenotati,
                        0
                      )
                    : 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSede(s.nome)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isActive
                          ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <Building2 size={12} />
                      {s.nome}
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isActive ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {countSede}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENUTO PRINCIPALE ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-80 gap-4">
              <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-[#005CA9]" />
              <p className="text-gray-500 font-semibold">Elaborazione statistiche intelligenti EPASA...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto">
              <AlertCircle size={44} className="text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-800 mb-1">Errore nel caricamento</h3>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#005CA9] text-white rounded-lg text-sm font-semibold hover:bg-[#004080]"
              >
                Riprova
              </button>
            </div>
          ) : data ? (
            <>
              {/* ═══════════════════════════════════════════════════════════════════════ */}
              {/* VISTA: LOREDANA                                                         */}
              {/* ═══════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'LOREDANA' && loredanaStats && (() => {
                const s = getOperatoreStatsPerSede(loredanaStats);
                return (
                  <div className="space-y-6">
                    {/* Riepilogo Operatore */}
                    <div className="bg-gradient-to-r from-blue-900 to-[#005CA9] text-white rounded-2xl p-6 shadow-md">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-bold">Loredana &mdash; Patronato EPASA</h2>
                            <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                              Multiservizio
                            </span>
                          </div>
                          <p className="text-xs text-blue-100 max-w-2xl">
                            Specializzata in pensioni (vecchiaia, anticipata, reversibilità, APE sociale), dichiarazioni RED, invalidità civile, Legge 104, disoccupazione NASpI, maternità e congedi parentali.
                          </p>
                        </div>

                        <div className="flex items-center gap-6 bg-white/10 rounded-xl px-5 py-3 border border-white/20">
                          <div>
                            <p className="text-[10px] text-blue-200 uppercase font-semibold">Totale Pratiche</p>
                            <p className="text-2xl font-black">{s.prenotati}</p>
                          </div>
                          <div className="h-8 w-px bg-white/20" />
                          <div>
                            <p className="text-[10px] text-blue-200 uppercase font-semibold">Slot Disponibili</p>
                            <p className="text-2xl font-black">{s.capacita}</p>
                          </div>
                          <div className="h-8 w-px bg-white/20" />
                          <div>
                            <p className="text-[10px] text-blue-200 uppercase font-semibold">Occupazione</p>
                            <p className="text-2xl font-black">{s.occupazione}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sezione Tipologie di Pratiche */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <Sparkles size={18} className="text-[#005CA9]" />
                          Tipologie di Pratiche &ndash; Ripartizione Attività Loredana
                        </h3>
                        <p className="text-xs text-gray-500">
                          Volumi e percentuali calcolate in automatico dal testo degli appuntamenti
                        </p>
                      </div>

                      {/* Griglia Categorie Loredana */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {loredanaStats.pratiche.map(pr => (
                          <div
                            key={pr.id}
                            className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-white hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: pr.colore }}
                                />
                                <span className="font-bold text-sm text-gray-900">{pr.label}</span>
                              </div>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full ${pr.badgeBg} ${pr.badgeText}`}
                              >
                                {pr.count} ({pr.percentuale}%)
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-500 line-clamp-2 mb-3">
                              {pr.description}
                            </p>

                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pr.percentuale}%`,
                                  backgroundColor: pr.colore,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Andamento Mensile Loredana */}
                    {/* Carico Mensile & Saturation Rate Loredana */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
                        <Clock size={18} className="text-[#005CA9]" />
                        Carico Mensile & Saturation Rate Loredana &mdash; {anno}
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Monitoraggio dei volumi mensili e tasso di occupazione degli slot
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {mesiList.map(m => {
                          const mData = selectedSede && loredanaStats.perSedePerMese[selectedSede]
                            ? loredanaStats.perSedePerMese[selectedSede][m.key]
                            : loredanaStats.perMese[m.key];
                          const cap = mData?.capacita || 0;
                          const pre = mData?.prenotati || 0;
                          const perc = cap > 0 ? Math.round((pre / cap) * 100) : 0;
                          const isHigh = perc >= 75;

                          return (
                            <div
                              key={m.key}
                              className={`p-3 rounded-xl border transition-all ${
                                isHigh
                                  ? 'bg-amber-50/70 border-amber-300'
                                  : pre > 0
                                  ? 'bg-blue-50/40 border-blue-200'
                                  : 'bg-gray-50/50 border-gray-200 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-gray-800">{m.label.substring(0, 3)}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  isHigh ? 'bg-amber-200 text-amber-900' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {perc}%
                                </span>
                              </div>
                              <p className="text-sm font-extrabold text-gray-900">
                                {pre} <span className="text-[10px] font-normal text-gray-500">/ {cap}</span>
                              </p>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getBarColor(perc)}`}
                                  style={{ width: `${Math.min(perc, 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ═══════════════════════════════════════════════════════════════════════ */}
              {/* VISTA 3: DETTAGLIO MILECE                                               */}
              {/* ═══════════════════════════════════════════════════════════════════════ */}
              {activeTab === 'MILECE' && mileceStats && (() => {
                const s = getOperatoreStatsPerSede(mileceStats);
                return (
                  <div className="space-y-6">
                    {/* Header Milece */}
                    <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white rounded-2xl p-6 shadow-md">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-bold">Milece &mdash; ISEE & Lavoro Domestico</h2>
                            <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                              Specializzazione Esclusiva
                            </span>
                          </div>
                          <p className="text-xs text-emerald-100 max-w-2xl">
                            Gestisce esclusivamente le pratiche ISEE (Dichiarazione Sostitutiva Unica per prestazioni agevolate) e l'amministrazione di contratti per Badanti, Colf e lavoro domestico.
                          </p>
                        </div>

                        <div className="flex items-center gap-6 bg-white/10 rounded-xl px-5 py-3 border border-white/20">
                          <div>
                            <p className="text-[10px] text-emerald-200 uppercase font-semibold">Totale Pratiche</p>
                            <p className="text-2xl font-black">{s.prenotati}</p>
                          </div>
                          <div className="h-8 w-px bg-white/20" />
                          <div>
                            <p className="text-[10px] text-emerald-200 uppercase font-semibold">Slot Disponibili</p>
                            <p className="text-2xl font-black">{s.capacita}</p>
                          </div>
                          <div className="h-8 w-px bg-white/20" />
                          <div>
                            <p className="text-[10px] text-emerald-200 uppercase font-semibold">Occupazione</p>
                            <p className="text-2xl font-black">{s.occupazione}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sezione Tipologie di Pratiche */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <Sparkles size={18} className="text-[#005CA9]" />
                          Tipologie di Pratiche &ndash; Ripartizione Attività Milece
                        </h3>
                        <p className="text-xs text-gray-500">
                          Volumi e percentuali calcolate in automatico dal testo degli appuntamenti
                        </p>
                      </div>

                      {/* Griglia Categorie Milece */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {mileceStats.pratiche.map(pr => (
                          <div
                            key={pr.id}
                            className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-white hover:shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: pr.colore }}
                                />
                                <span className="font-bold text-sm text-gray-900">{pr.label}</span>
                              </div>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full ${pr.badgeBg} ${pr.badgeText}`}
                              >
                                {pr.count} ({pr.percentuale}%)
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-500 line-clamp-2 mb-3">
                              {pr.description}
                            </p>

                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pr.percentuale}%`,
                                  backgroundColor: pr.colore,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Andamento Mensile di Milece (evidenzia picco ISEE) */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
                        <Clock size={18} className="text-[#005CA9]" />
                        Carico Mensile & Saturation Rate Milece &mdash; {anno}
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Monitoraggio dei volumi mensili con evidenza del periodo di punta per la campagna ISEE
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {mesiList.map(m => {
                          const mDettaglio = selectedSede && mileceStats.perSedePerMese[selectedSede]
                            ? mileceStats.perSedePerMese[selectedSede][m.key]
                            : mileceStats.perMese[m.key];
                          const cap = mDettaglio?.capacita || 0;
                          const pre = mDettaglio?.prenotati || 0;
                          const perc = cap > 0 ? Math.round((pre / cap) * 100) : 0;
                          const isHigh = perc >= 75;

                          return (
                            <div
                              key={m.key}
                              className={`p-3 rounded-xl border transition-all ${
                                isHigh
                                  ? 'bg-amber-50/70 border-amber-300'
                                  : pre > 0
                                  ? 'bg-blue-50/40 border-blue-200'
                                  : 'bg-gray-50/50 border-gray-200 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-gray-800">{m.label.substring(0, 3)}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  isHigh ? 'bg-amber-200 text-amber-900' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {perc}%
                                </span>
                              </div>
                              <p className="text-sm font-extrabold text-gray-900">
                                {pre} <span className="text-[10px] font-normal text-gray-500">/ {cap}</span>
                              </p>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getBarColor(perc)}`}
                                  style={{ width: `${Math.min(perc, 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
