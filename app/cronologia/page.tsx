'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, History, RefreshCw, Building2, Calendar,
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Search, X, CalendarDays,
} from 'lucide-react';

interface LogEntry {
  id: number;
  source: 'EPASA' | 'SALA_RIUNIONI' | 'AGENDA_730';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  descrizione: string;
  dettagli: Record<string, unknown> | null;
  created_at: string;
}

type SourceFilter = 'ALL' | 'EPASA' | 'SALA_RIUNIONI' | 'AGENDA_730';
type ActionFilter = 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE';

const ACTION_CONFIG = {
  CREATE: { label: 'Aggiunta', icon: Plus, bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400', dot: 'bg-emerald-500' },
  UPDATE: { label: 'Modifica', icon: Pencil, bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-500' },
  DELETE: { label: 'Elimina', icon: Trash2, bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400', dot: 'bg-red-500' },
} as const;

const SOURCE_CONFIG = {
  EPASA:       { label: 'Agenda EPASA',  bg: 'bg-[#E6F2FF]',  text: 'text-[#005CA9]',  icon: Calendar },
  SALA_RIUNIONI: { label: 'Sale Riunioni', bg: 'bg-purple-50', text: 'text-purple-700', icon: Building2 },
  AGENDA_730:  { label: 'Agenda 730',    bg: 'bg-amber-50',   text: 'text-amber-700',  icon: CalendarDays },
} as const;

function formatDateGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Oggi';
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
  return Array.from(map.entries()).map(([_, entries]) => ({
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: Array<number | '…'> = [];
  const left = clamp(currentPage - 1, 2, totalPages - 1);
  const right = clamp(currentPage + 1, 2, totalPages - 1);
  items.push(1);
  if (left > 2) items.push('…');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < totalPages - 1) items.push('…');
  items.push(totalPages);
  return items;
}

// ─── Componente interno che usa useSearchParams ───────────────────────────────
function CronologiaInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const LIMIT = 50;

  const pageParam = Number(searchParams.get('page') || '1');
  const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1;

  const sourceParam = (searchParams.get('source') || 'ALL') as SourceFilter;
  const actionParam = (searchParams.get('action') || 'ALL') as ActionFilter;
  const qParam = searchParams.get('q') || '';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const createURL = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    return `${pathname}?${params.toString()}`;
  };

  const setParam = (patch: Record<string, string | null>) => {
    router.replace(createURL(patch));
  };

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      if (sourceParam !== 'ALL') params.set('source', sourceParam);
      if (actionParam !== 'ALL') params.set('action', actionParam);
      if (qParam.trim()) params.set('q', qParam.trim());
      const res = await fetch(`/api/cronologia?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Errore API: ${res.status}`);
      const json = await res.json();
      setLogs(Array.isArray(json?.data) ? json.data : []);
      setTotal(Number.isFinite(json?.total) ? json.total : 0);
      setTotalPages(Number.isFinite(json?.totalPages) && json.totalPages > 0 ? json.totalPages : 1);
      setExpanded(new Set());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      setError('Impossibile caricare la cronologia.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sourceParam, actionParam, qParam]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const grouped = useMemo(() => groupByDate(logs), [logs]);
  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const hasFilters = sourceParam !== 'ALL' || actionParam !== 'ALL' || !!qParam;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA]">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
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

        {/* Barra filtri + ricerca */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={qParam}
              onChange={e => setParam({ q: e.target.value, page: '1' })}
              placeholder="Cerca nella cronologia..."
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {qParam && (
              <button onClick={() => setParam({ q: null, page: '1' })} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'EPASA', 'SALA_RIUNIONI', 'AGENDA_730'] as const).map(s => (
              <button
                key={s}
                onClick={() => setParam({ source: s === 'ALL' ? null : s, page: '1' })}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  (s === 'ALL' ? sourceParam === 'ALL' : sourceParam === s)
                    ? 'bg-[#005CA9] text-white border-[#005CA9]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                }`}
              >
                {s === 'ALL' ? 'Tutte le agende' : SOURCE_CONFIG[s].label}
              </button>
            ))}

            <div className="w-px bg-gray-200 mx-0.5" />

            {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map(a => (
              <button
                key={a}
                onClick={() => setParam({ action: a === 'ALL' ? null : a, page: '1' })}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  (a === 'ALL' ? actionParam === 'ALL' : actionParam === a)
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-500'
                }`}
              >
                {a === 'ALL' ? 'Tutte le azioni' : ACTION_CONFIG[a].label}
              </button>
            ))}
          </div>
        </div>

        {/* Counter */}
        <p className="text-xs text-gray-400 mb-4 px-1">
          <span className="font-semibold text-gray-600">{total}</span> eventi trovati
          {hasFilters && (
            <button
              onClick={() => setParam({ source: null, action: null, q: null, page: '1' })}
              className="ml-2 text-[#005CA9] hover:underline font-medium"
            >
              Rimuovi filtri
            </button>
          )}
        </p>

        {/* Error */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 text-center mb-6">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              onClick={loadLogs}
              className="mt-3 px-4 py-2 bg-[#005CA9] text-white rounded-xl text-sm font-semibold"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]" />
            <p className="text-sm text-gray-400 font-medium">Caricamento cronologia...</p>
          </div>
        ) : !error && logs.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100">
            <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nessun evento trovato</p>
          </div>
        ) : !error ? (
          <>
            <div className="space-y-8">
              {grouped.map(({ dateLabel, entries }) => (
                <div key={dateLabel}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-transparent px-2 whitespace-nowrap capitalize">
                      {dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  <div className="relative pl-8">
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
                    <div className="space-y-3">
                      {entries.map((log) => {
                        const ac = ACTION_CONFIG[log.action];
                        const sc = SOURCE_CONFIG[log.source] ?? {
                          label: log.source,
                          bg: 'bg-gray-50',
                          text: 'text-gray-600',
                          icon: CalendarDays,
                        };
                        const ActionIcon = ac.icon;
                        const SourceIcon = sc.icon;
                        const isExp = expanded.has(log.id);
                        const hasDetails = !!(log.dettagli && Object.keys(log.dettagli).length > 0);
                        return (
                          <div key={log.id} className="relative">
                            <div className={`absolute -left-5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm ${ac.dot}`} />
                            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${ac.border} overflow-hidden transition-shadow hover:shadow-md`}>
                              <div
                                className={`flex items-start gap-3 p-4 ${hasDetails ? 'cursor-pointer' : ''}`}
                                onClick={() => hasDetails && toggleExpand(log.id)}
                              >
                                <div className={`p-2 rounded-xl ${ac.bg} flex-shrink-0`}>
                                  <ActionIcon className={`w-4 h-4 ${ac.text}`} />
                                </div>
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
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className="text-xs text-gray-400 font-medium">{formatTime(log.created_at)}</span>
                                  {hasDetails && (
                                    <div className={`p-1 rounded-lg transition-colors ${isExp ? 'bg-gray-100 text-gray-600' : 'text-gray-300 hover:text-gray-500'}`}>
                                      {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </div>
                                  )}
                                </div>
                              </div>
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

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => setParam({ page: String(Math.max(1, page - 1)) })}
                disabled={page <= 1}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                  page <= 1 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                }`}
              >
                Prev
              </button>
              {paginationItems.map((it, idx) =>
                it === '…' ? (
                  <span key={`e-${idx}`} className="px-2 text-gray-400 select-none">…</span>
                ) : (
                  <button
                    key={it}
                    onClick={() => setParam({ page: String(it) })}
                    className={`w-10 h-10 rounded-xl text-sm font-bold border ${
                      it === page ? 'bg-[#005CA9] text-white border-[#005CA9]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                    }`}
                  >
                    {it}
                  </button>
                )
              )}
              <button
                onClick={() => setParam({ page: String(Math.min(totalPages, page + 1)) })}
                disabled={page >= totalPages}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                  page >= totalPages ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                }`}
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Export default: avvolge tutto in Suspense ────────────────────────────────
export default function CronologiaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]" />
          <p className="text-sm text-gray-400 font-medium">Caricamento...</p>
        </div>
      </div>
    }>
      <CronologiaInner />
    </Suspense>
  );
}
