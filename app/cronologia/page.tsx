'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, History, RefreshCw, Building2, Calendar,
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Search, X, CalendarDays, Clock,
} from 'lucide-react';

interface LogEntry {
  id: number;
  source: 'EPASA' | 'SALA_RIUNIONI' | 'AGENDA_730';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  descrizione: string;
  dettagli: Record<string, unknown> | null;
  created_at: string;
}

type SourceFilter = 'ALL' | 'EPASA' | 'SALA_RIUNIONI' | 'AGENDA_730' | 'SCREENING';
type ActionFilter = 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE';

const ACTION_CONFIG = {
  CREATE: { label: 'Aggiunta',  icon: Plus,   bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-l-emerald-400', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
  UPDATE: { label: 'Modifica',  icon: Pencil, bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-l-blue-400',    dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700'    },
  DELETE: { label: 'Elimina',   icon: Trash2, bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-l-red-400',     dot: 'bg-red-500',     pill: 'bg-red-100 text-red-700'      },
} as const;

const SOURCE_CONFIG = {
  EPASA:         { label: 'Agenda EPASA',  bg: 'bg-[#E6F2FF]', text: 'text-[#005CA9]',  icon: Calendar    },
  SALA_RIUNIONI: { label: 'Sale Riunioni', bg: 'bg-purple-50', text: 'text-purple-700', icon: Building2   },
  AGENDA_730:    { label: 'Agenda 730',    bg: 'bg-amber-50',  text: 'text-amber-700',  icon: CalendarDays },
  SCREENING:     { label: 'Screening',     bg: 'bg-teal-50',   text: 'text-teal-700',   icon: Search       },
} as const;

// Traduzione chiavi dettaglio → etichette italiane
const DETAIL_LABELS: Record<string, string> = {
  cliente:    'Cliente',
  data:       'Data',
  ora_inizio: 'Ora inizio',
  ora_fine:   'Ora fine',
  persona:    'Operatore',
  persona_id: 'ID Operatore',
  sede:       'Sede',
  sede_id:    'ID Sede',
  sala:       'Sala',
  sala_id:    'ID Sala',
  titolo:     'Titolo',
  mese:       'Mese',
  id:         'ID',
  note:       'Note',
  source:     'Agenda',
  action:     'Azione',
  nome:       'Nome',
  cognome:    'Cognome',
};

function detailLabel(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Formatta valori data nel pannello dettagli
function detailValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value);
  // date ISO → formato italiano
  if ((key === 'data' || key.includes('date')) && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
    if (!isNaN(d.getTime()))
      return d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
  return s;
}

function formatDateGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const items: Array<number | '…'> = [];
  const left  = clamp(currentPage - 1, 2, totalPages - 1);
  const right = clamp(currentPage + 1, 2, totalPages - 1);
  items.push(1);
  if (left > 2) items.push('…');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < totalPages - 1) items.push('…');
  items.push(totalPages);
  return items;
}

// ─── Componente interno ───────────────────────────────────────────────────────
function CronologiaInner() {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const LIMIT = 50;

  const pageParam   = Number(searchParams.get('page') || '1');
  const page        = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1;
  const sourceParam = (searchParams.get('source') || 'ALL') as SourceFilter;
  const actionParam = (searchParams.get('action') || 'ALL') as ActionFilter;
  const qParam      = searchParams.get('q') || '';

  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());
  const [error, setError]         = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(qParam);

  const abortRef   = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizza searchInput se il parametro URL cambia dall'esterno
  useEffect(() => { setSearchInput(qParam); }, [qParam]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParam({ q: value, page: '1' });
    }, 400);
  }, []);

  const createURL = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    return `${pathname}?${params.toString()}`;
  };

  const setParam = (patch: Record<string, string | null>) => router.replace(createURL(patch));

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
      setLogs([]); setTotal(0); setTotalPages(1);
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

  const grouped         = useMemo(() => groupByDate(logs), [logs]);
  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const hasFilters      = sourceParam !== 'ALL' || actionParam !== 'ALL' || !!qParam;

  // Conteggi azioni nella pagina corrente
  const actionCounts = useMemo(() => ({
    CREATE: logs.filter(l => l.action === 'CREATE').length,
    UPDATE: logs.filter(l => l.action === 'UPDATE').length,
    DELETE: logs.filter(l => l.action === 'DELETE').length,
  }), [logs]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F5F8FA]">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ── HEADER ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-[#005CA9] p-2 rounded-xl">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#005CA9] leading-tight">Cronologia</h1>
                <p className="text-xs text-gray-400">Storico di tutte le modifiche</p>
              </div>
            </div>
          </div>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition-colors text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
        </div>

        {/* ── BARRA FILTRI ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-3">

          {/* Ricerca */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Cerca nella cronologia..."
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setParam({ q: null, page: '1' }); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtri sorgente */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-center mr-1">Agenda</span>
            {(['ALL', 'EPASA', 'SALA_RIUNIONI', 'AGENDA_730', 'SCREENING'] as const).map(s => {
              const active = s === 'ALL' ? sourceParam === 'ALL' : sourceParam === s;
              const sc = s !== 'ALL' ? SOURCE_CONFIG[s] : null;
              const Icon = sc?.icon;
              return (
                <button
                  key={s}
                  onClick={() => setParam({ source: s === 'ALL' ? null : s, page: '1' })}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-[#005CA9] text-white border-[#005CA9]'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {s === 'ALL' ? 'Tutte' : SOURCE_CONFIG[s].label}
                </button>
              );
            })}
          </div>

          {/* Filtri azione */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide self-center mr-1">Azione</span>
            {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map(a => {
              const active = a === 'ALL' ? actionParam === 'ALL' : actionParam === a;
              const ac = a !== 'ALL' ? ACTION_CONFIG[a] : null;
              const Icon = ac?.icon;
              return (
                <button
                  key={a}
                  onClick={() => setParam({ action: a === 'ALL' ? null : a, page: '1' })}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-500'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {a === 'ALL' ? 'Tutte' : ACTION_CONFIG[a].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIEPILOGO PAGINA ── */}
        {!loading && !error && logs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gray-500">
              <span className="font-bold text-gray-800">{total.toLocaleString('it')}</span> eventi totali
              {hasFilters && (
                <button
                  onClick={() => setParam({ source: null, action: null, q: null, page: '1' })}
                  className="ml-2 text-[#005CA9] hover:underline font-medium text-xs"
                >
                  Rimuovi filtri
                </button>
              )}
            </p>
            <div className="flex items-center gap-3">
              {actionCounts.CREATE > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Plus className="w-3.5 h-3.5" />{actionCounts.CREATE} aggiunte
                </span>
              )}
              {actionCounts.UPDATE > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-blue-700">
                  <Pencil className="w-3.5 h-3.5" />{actionCounts.UPDATE} modifiche
                </span>
              )}
              {actionCounts.DELETE > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />{actionCounts.DELETE} eliminazioni
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 text-center mb-4">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              onClick={loadLogs}
              className="mt-3 px-4 py-2 bg-[#005CA9] text-white rounded-xl text-sm font-semibold"
            >
              Riprova
            </button>
          </div>
        )}

        {/* ── TIMELINE ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]" />
            <p className="text-sm text-gray-400 font-medium">Caricamento cronologia...</p>
          </div>
        ) : !error && logs.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100">
            <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nessun evento trovato</p>
            {hasFilters && (
              <button
                onClick={() => setParam({ source: null, action: null, q: null, page: '1' })}
                className="mt-3 text-sm text-[#005CA9] hover:underline font-medium"
              >
                Rimuovi i filtri
              </button>
            )}
          </div>
        ) : !error ? (
          <>
            <div className="space-y-6">
              {grouped.map(({ dateLabel, entries }) => (
                <div key={dateLabel}>

                  {/* Separatore gruppo data */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-gray-200 shadow-sm">
                      <CalendarDays className="w-3 h-3 text-[#005CA9]" />
                      <span className="text-xs font-bold text-gray-600 capitalize whitespace-nowrap">{dateLabel}</span>
                      <span className="text-[10px] text-gray-400 font-medium">· {entries.length} eventi</span>
                    </div>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {/* Righe con timeline verticale */}
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
                    <div className="space-y-2">
                      {entries.map((log) => {
                        const ac = ACTION_CONFIG[log.action];
                        const sc = SOURCE_CONFIG[log.source] ?? {
                          label: log.source, bg: 'bg-gray-50', text: 'text-gray-600', icon: CalendarDays,
                        };
                        const ActionIcon = ac.icon;
                        const SourceIcon = sc.icon;
                        const isExp = expanded.has(log.id);
                        const hasDetails = !!(log.dettagli && Object.keys(log.dettagli).length > 0);

                        return (
                          <div key={log.id} className="relative">
                            {/* Dot sulla timeline */}
                            <div className={`absolute -left-4 top-4 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${ac.dot}`} />

                            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${ac.border} overflow-hidden`}>

                              {/* Riga principale */}
                              <div
                                className={`flex items-start gap-3 px-4 py-3 ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                onClick={() => hasDetails && toggleExpand(log.id)}
                              >
                                {/* Icona azione */}
                                <div className={`mt-0.5 p-1.5 rounded-lg ${ac.bg} flex-shrink-0`}>
                                  <ActionIcon className={`w-3.5 h-3.5 ${ac.text}`} />
                                </div>

                                {/* Contenuto principale */}
                                <div className="flex-1 min-w-0">
                                  {/* Descrizione — elemento principale */}
                                  <p className="text-sm font-semibold text-gray-800 leading-snug mb-1.5">
                                    {log.descrizione}
                                  </p>
                                  {/* Badge secondari */}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${ac.pill}`}>
                                      {ac.label}
                                    </span>
                                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                                      <SourceIcon className="w-3 h-3" />
                                      {sc.label}
                                    </span>
                                  </div>
                                </div>

                                {/* Ora + espandi */}
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                                  <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    {formatTime(log.created_at)}
                                  </span>
                                  {hasDetails && (
                                    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isExp ? 'text-[#005CA9]' : 'text-gray-400'}`}>
                                      {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      {isExp ? 'Chiudi' : 'Dettagli'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Pannello dettagli espanso */}
                              {isExp && hasDetails && (
                                <div className="px-4 pb-3 pt-0">
                                  <div className="bg-gray-50 rounded-lg border border-gray-100 divide-y divide-gray-100">
                                    {Object.entries(log.dettagli as Record<string, unknown>).map(([k, v]) => (
                                      <div key={k} className="flex items-start gap-3 px-3 py-2">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide min-w-[90px] pt-0.5 flex-shrink-0">
                                          {detailLabel(k)}
                                        </span>
                                        <span className="text-xs text-gray-700 font-medium break-all">
                                          {detailValue(k, v)}
                                        </span>
                                      </div>
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

            {/* ── PAGINAZIONE ── */}
            {totalPages > 1 && (
              <div className="mt-6 pb-6">
                <div className="flex items-center justify-center gap-1.5 flex-wrap mb-2">
                  <button
                    onClick={() => setParam({ page: String(Math.max(1, page - 1)) })}
                    disabled={page <= 1}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border ${
                      page <= 1
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                    }`}
                  >
                    ← Precedente
                  </button>

                  {paginationItems.map((it, idx) =>
                    it === '…' ? (
                      <span key={`e-${idx}`} className="px-2 text-gray-400 select-none">…</span>
                    ) : (
                      <button
                        key={it}
                        onClick={() => setParam({ page: String(it) })}
                        className={`w-10 h-10 rounded-xl text-sm font-bold border ${
                          it === page
                            ? 'bg-[#005CA9] text-white border-[#005CA9]'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                        }`}
                      >
                        {it}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setParam({ page: String(Math.min(totalPages, page + 1)) })}
                    disabled={page >= totalPages}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border ${
                      page >= totalPages
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9]'
                    }`}
                  >
                    Successiva →
                  </button>
                </div>
                <p className="text-center text-xs text-gray-400 font-medium">
                  Pagina {page} di {totalPages} · {total.toLocaleString('it')} eventi totali
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Export con Suspense ──────────────────────────────────────────────────────
export default function CronologiaPage() {
  return (
    <Suspense fallback={
      <div className="h-full w-full bg-[#F5F8FA] flex items-center justify-center">
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
