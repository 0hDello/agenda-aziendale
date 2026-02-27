'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, History, RefreshCw, Building2, Calendar,
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Search, X, TrendingUp,
} from 'lucide-react';

interface LogEntry {
  id: number;
  source: 'EPASA' | 'SALA_RIUNIONI';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  descrizione: string;
  dettagli: object | null;
  created_at: string;
}

const ACTION_CONFIG = {
  CREATE: { label: 'Aggiunta', icon: Plus,   bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', dot: 'bg-emerald-500', line: 'bg-emerald-200' },
  UPDATE: { label: 'Modifica', icon: Pencil,  bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-400',    dot: 'bg-blue-500',    line: 'bg-blue-200'    },
  DELETE: { label: 'Elimina',  icon: Trash2,  bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-400',     dot: 'bg-red-500',     line: 'bg-red-200'     },
};

const SOURCE_CONFIG = {
  EPASA:         { label: 'Agenda EPASA',  bg: 'bg-[#E6F2FF]', text: 'text-[#005CA9]', icon: Calendar  },
  SALA_RIUNIONI: { label: 'Sale Riunioni', bg: 'bg-purple-50',  text: 'text-purple-700', icon: Building2 },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatDateGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isToday     = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday)     return 'Oggi';
  if (isYesterday) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(logs: LogEntry[]): { dateLabel: string; entries: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = new Date(log.created_at).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return Array.from(map.entries()).map(([key, entries]) => ({
    dateLabel: formatDateGroup(entries[0].created_at),
    entries,
  }));
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide min-w-[80px] pt-0.5">{label}</span>
      <span className="text-xs text-gray-700 font-medium break-all">{value}</span>
    </div>
  );
}

export default function CronologiaPage() {
  const router = useRouter();
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<'ALL' | 'EPASA' | 'SALA_RIUNIONI'>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded]       = useState<Set<number>>(new Set());

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cronologia');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { /* silenzioso */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = logs.filter(l => {
    if (filter !== 'ALL' && l.source !== filter) return false;
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!l.descrizione.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const grouped = groupByDate(filtered);

  // Stats
  const totalCreate = logs.filter(l => l.action === 'CREATE').length;
  const totalUpdate = logs.filter(l => l.action === 'UPDATE').length;
  const totalDelete = logs.filter(l => l.action === 'DELETE').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA]">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 bg-white hover:bg-gray-50 rounded-xl shadow-sm border border-gray-200 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-[#005CA9] p-2.5 rounded-xl shadow-lg">
                <History className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#005CA9]">Cronologia</h1>
                <p className="text-sm text-gray-500">Storico di tutte le modifiche</p>
              </div>
            </div>
          </div>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm border border-gray-200 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Aggiorna</span>
          </button>
        </div>

        {/* ── Stats ── */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Aggiunte',  value: totalCreate, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
              { label: 'Modifiche', value: totalUpdate, color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
              { label: 'Eliminazioni', value: totalDelete, color: 'text-red-600', bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500'     },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4 flex items-center gap-3`}>
                <div className={`w-2.5 h-2.5 rounded-full ${s.dot} flex-shrink-0`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Barra filtri + ricerca ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-6 flex flex-col gap-3">
          {/* Ricerca */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca nella cronologia..."
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtri */}
          <div className="flex flex-wrap gap-2">
            {/* Sorgente */}
            {(['ALL', 'EPASA', 'SALA_RIUNIONI'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  filter === s
                    ? 'bg-[#005CA9] text-white border-[#005CA9]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                }`}
              >
                {s === 'ALL' ? 'Tutte le agende' : SOURCE_CONFIG[s].label}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-0.5" />
            {/* Azione */}
            {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map(a => (
              <button
                key={a}
                onClick={() => setActionFilter(a)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  actionFilter === a
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-500'
                }`}
              >
                {a === 'ALL' ? 'Tutte le azioni' : ACTION_CONFIG[a].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Counter ── */}
        <p className="text-xs text-gray-400 mb-4 px-1">
          <span className="font-semibold text-gray-600">{filtered.length}</span> eventi trovati
          {(filter !== 'ALL' || actionFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => { setFilter('ALL'); setActionFilter('ALL'); setSearchQuery(''); }}
              className="ml-2 text-[#005CA9] hover:underline font-medium"
            >
              Rimuovi filtri
            </button>
          )}
        </p>

        {/* ── Timeline ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]" />
            <p className="text-sm text-gray-400 font-medium">Caricamento cronologia...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100">
            <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nessun evento trovato</p>
            {(filter !== 'ALL' || actionFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => { setFilter('ALL'); setActionFilter('ALL'); setSearchQuery(''); }}
                className="mt-3 text-sm text-[#005CA9] hover:underline"
              >
                Rimuovi i filtri
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ dateLabel, entries }) => (
              <div key={dateLabel}>
                {/* Separatore data */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-transparent px-2 whitespace-nowrap capitalize">
                    {dateLabel}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Entrate del giorno: timeline verticale */}
                <div className="relative pl-8">
                  {/* Linea verticale */}
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

                  <div className="space-y-3">
                    {entries.map((log, idx) => {
                      const ac = ACTION_CONFIG[log.action];
                      const sc = SOURCE_CONFIG[log.source];
                      const ActionIcon = ac.icon;
                      const SourceIcon = sc.icon;
                      const isExp = expanded.has(log.id);
                      const hasDetails = log.dettagli && Object.keys(log.dettagli).length > 0;

                      return (
                        <div key={log.id} className="relative">
                          {/* Dot sulla timeline */}
                          <div
                            className={`absolute -left-5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm ${ac.dot}`}
                          />

                          {/* Card */}
                          <div
                            className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${ac.border} overflow-hidden transition-shadow hover:shadow-md`}
                          >
                            {/* Riga principale */}
                            <div
                              className={`flex items-start gap-3 p-4 ${hasDetails ? 'cursor-pointer' : ''}`}
                              onClick={() => hasDetails && toggleExpand(log.id)}
                            >
                              {/* Icona azione */}
                              <div className={`p-2 rounded-xl ${ac.bg} flex-shrink-0`}>
                                <ActionIcon className={`w-4 h-4 ${ac.text}`} />
                              </div>

                              {/* Testo */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ac.bg} ${ac.text} uppercase tracking-wide`}>
                                    {ac.label}
                                  </span>
                                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                                    <SourceIcon className="w-3 h-3" />
                                    {sc.label}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-800 font-medium leading-snug">{log.descrizione}</p>
                              </div>

                              {/* Destra: ora + expand */}
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-xs text-gray-400 font-medium">{formatTime(log.created_at)}</span>
                                {hasDetails && (
                                  <div className={`p-1 rounded-lg transition-colors ${isExp ? 'bg-gray-100 text-gray-600' : 'text-gray-300 hover:text-gray-500'}`}>
                                    {isExp
                                      ? <ChevronUp className="w-3.5 h-3.5" />
                                      : <ChevronDown className="w-3.5 h-3.5" />}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dettagli espandibili */}
                            {isExp && hasDetails && (
                              <div className="px-4 pb-4 pt-0">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1.5">
                                  {Object.entries(log.dettagli as Record<string, unknown>).map(([k, v]) => (
                                    <DetailRow
                                      key={k}
                                      label={k}
                                      value={v !== null && v !== undefined ? String(v) : '—'}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
