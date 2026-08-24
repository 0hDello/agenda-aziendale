'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useDeferredValue, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Building2,
  User,
  ChevronDown,
  X,
  LayoutGrid,
  List,
  Lock,
  Unlock,
  Search,
  Printer,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWeekend,
  isSameDay,
  startOfDay,
  getMonth,
  parseISO,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import { formatDate, getTimeSlotsForSede, getEndTimeSlotsForSede, isSedeWorkingDay, TIME_SLOTS, SABATI_730_ECCEZIONE } from '@/utils/dateUtils';
import TimeSlot from './TimeSlot';
import AppointmentModal, { AppointmentModalHandle } from './AppointmentModal';
import React from 'react';

interface CalendarProps {
  agendaId?: string;
}

const DAYS_PAST             = 3;
const DAYS_FUTURE           = 10;
const MAX_VISIBLE_DAYS      = 60;
const DAYS_TO_LOAD          = 5;
const MIN_DATE              = new Date(2020, 0, 1);
const SCROLL_THRESHOLD_FW   = 400;
const SCROLL_THRESHOLD_BK   = 200;
const STICKY_HEADER_HEIGHT  = 41;
const SSE_RELOAD_DEBOUNCE   = 800;
const LOCAL_MUTATION_WINDOW = 3000;

type ViewMode = 'daily' | 'monthly';
type DayAvailability = 'free' | 'partial' | 'full' | 'closed';

export default function Calendar({ agendaId = '730' }: CalendarProps) {
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [viewMode, setViewMode]             = useState<ViewMode>('daily');
  const [visibleDays, setVisibleDays]       = useState<Date[]>([]);
  const [isInitialized, setIsInitialized]   = useState(false);
  const [appointments, setAppointments]     = useState<Appuntamento[]>([]);
  const [persone, setPersone]               = useState<Persona[]>([]);
  const [sedi, setSedi]                     = useState<Sede[]>([]);
  const [personaSede, setPersonaSede]       = useState<PersonaSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const appointmentModalRef = useRef<AppointmentModalHandle>(null);
  const [draggedAppointment, setDraggedAppointment]   = useState<{ appointment: Appuntamento; originalTime: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonthlyPersona, setSelectedMonthlyPersona] = useState<string | null>(null);
  const [editMode, setEditMode]             = useState(false);
  const deferredEditMode                    = useDeferredValue(editMode);
  const [realtimeFlash, setRealtimeFlash]   = useState(false);

  const [showSearch, setShowSearch]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  // ── PRINT STATE ──────────────────────────────────────────────────────────
  const [showPrintModal, setShowPrintModal]             = useState(false);
  const [printDateFrom, setPrintDateFrom]               = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [printDateTo, setPrintDateTo]                   = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [printSelectedPersone, setPrintSelectedPersone] = useState<string[]>(['__all__']);

  const scrollContainerRef    = useRef<HTMLDivElement>(null);
  const sseReloadTimerRef     = useRef<NodeJS.Timeout | null>(null);
  const visibleDaysRef        = useRef<Date[]>([]);
  const viewModeRef           = useRef<ViewMode>('daily');
  const loadingDirRef         = useRef<'idle' | 'fw' | 'bk'>('idle');
  const anchorDateStrRef      = useRef<string | null>(null);
  const anchorScrollTopRef    = useRef<number | null>(null);
  const anchorOffsetTopRef    = useRef<number | null>(null);
  const searchInputRef        = useRef<HTMLInputElement>(null);
  const sediRef               = useRef<Sede[]>([]);
  const localMutationAtRef    = useRef<number>(0);

  useEffect(() => { visibleDaysRef.current = visibleDays; }, [visibleDays]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { sediRef.current = sedi; }, [sedi]);

  const selectedSede     = sedi.find(s => s.id === selectedSedeId) ?? null;
  const selectedSedeNome = selectedSede?.nome ?? '';
  const isBorgoSede      = selectedSedeNome.toLowerCase().includes('borgo');

  const getTimeSlotsForDay    = (day: Date) => getTimeSlotsForSede(selectedSedeNome, day, agendaId);
  const getEndTimeSlotsForDay = (day: Date) => getEndTimeSlotsForSede(selectedSedeNome, day, agendaId);

  // I sabati eccezione 730 sono aperti per tutti gli operatori di Imola
  const isDayClosedForSede = (day: Date): boolean => {
    if (agendaId === '730' && isWeekend(day) && day.getDay() === 6) {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (SABATI_730_ECCEZIONE.includes(dateStr)) {
        return false; // Aperto per tutti gli operatori di Imola
      }
    }
    if (isWeekend(day)) return true;
    return !isSedeWorkingDay(selectedSedeNome, day);
  };

  const isPersonaDisabledForDay = (_day: Date, _persona: Persona): boolean => {
    return false;
  };

  // Restituisce true solo se il giorno è chiuso per TUTTE le persone della sede.
  const isDayFullyClosedForAllPersone = (day: Date, _personeInSede: Persona[]): boolean => {
    return isDayClosedForSede(day);
  };

  const scrollToDate = (date: Date, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    const el = document.querySelector<HTMLElement>(`[data-date="${formatDate(date)}"]`);
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollOffset = elRect.top - containerRect.top + container.scrollTop - STICKY_HEADER_HEIGHT;
    container.scrollTo({ top: scrollOffset, behavior });
  };

  const buildWindowAround = (center: Date): Date[] => {
    const days: Date[] = [];
    for (let i = DAYS_PAST; i > 0; i--) {
      const d = subDays(center, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) days.push(d);
    }
    days.push(center);
    for (let i = 1; i <= DAYS_FUTURE; i++) days.push(addDays(center, i));
    return days;
  };

  const navigateToDate = useCallback((date: Date) => {
    setSelectedDate(date);
    if (visibleDaysRef.current.some(d => isSameDay(d, date))) {
      setTimeout(() => scrollToDate(date, 'smooth'), 50);
    } else {
      setVisibleDays(buildWindowAround(date));
      setTimeout(() => scrollToDate(date, 'instant'), 200);
    }
  }, []);

  const loadMoreDaysForward = useCallback(() => {
    if (loadingDirRef.current !== 'idle') return;
    const days = visibleDaysRef.current;
    if (days.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const willTrimFromTop = days.length + DAYS_TO_LOAD > MAX_VISIBLE_DAYS;
    const anchorIndex = willTrimFromTop ? DAYS_TO_LOAD : 0;
    const anchorDay = days[anchorIndex];
    if (anchorDay) {
      const anchorDateStr = format(anchorDay, 'yyyy-MM-dd');
      const el = container.querySelector<HTMLElement>(`[data-date="${anchorDateStr}"]`);
      if (el) {
        anchorDateStrRef.current   = anchorDateStr;
        anchorOffsetTopRef.current = el.offsetTop;
        anchorScrollTopRef.current = container.scrollTop;
      }
    }

    loadingDirRef.current = 'fw';
    setVisibleDays(prev => {
      const last = prev[prev.length - 1];
      const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => addDays(last, i + 1));
      let updated = [...prev, ...newDays];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(updated.length - MAX_VISIBLE_DAYS);
      return updated;
    });
  }, []);

  const loadMoreDaysBackward = useCallback(() => {
    if (loadingDirRef.current !== 'idle') return;
    const days = visibleDaysRef.current;
    const firstDay = days[0];
    if (!firstDay || startOfDay(firstDay) <= startOfDay(MIN_DATE)) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const anchorDateStr = format(firstDay, 'yyyy-MM-dd');
    const el = container.querySelector<HTMLElement>(`[data-date="${anchorDateStr}"]`);
    const anchorOffsetTop = el ? el.offsetTop : 0;

    anchorDateStrRef.current   = anchorDateStr;
    anchorOffsetTopRef.current = anchorOffsetTop;
    anchorScrollTopRef.current = container.scrollTop;
    loadingDirRef.current = 'bk';

    const newDays: Date[] = [];
    for (let i = DAYS_TO_LOAD; i > 0; i--) {
      const d = subDays(firstDay, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) newDays.push(d);
    }
    if (newDays.length === 0) {
      loadingDirRef.current = 'idle';
      return;
    }

    setVisibleDays(prev => {
      let updated = [...newDays, ...prev];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(0, MAX_VISIBLE_DAYS);
      return updated;
    });
  }, []);

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const dir = loadingDirRef.current;
    if (dir === 'idle') return;
    const container = scrollContainerRef.current;
    const anchorDate = anchorDateStrRef.current;
    if (container && anchorDate) {
      const el = container.querySelector<HTMLElement>(`[data-date="${anchorDate}"]`);
      if (el) {
        const prevOffsetTop = anchorOffsetTopRef.current ?? 0;
        const prevScrollTop = anchorScrollTopRef.current ?? 0;
        const newOffsetTop = el.offsetTop;
        const delta = newOffsetTop - prevOffsetTop;
        container.scrollTop = prevScrollTop + delta;
      }
    }
    anchorDateStrRef.current   = null;
    anchorOffsetTopRef.current = null;
    anchorScrollTopRef.current = null;
    loadingDirRef.current      = 'idle';
  }, [visibleDays]);

  const onScroll = useCallback(() => {
    if (viewModeRef.current !== 'daily') return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_FW) loadMoreDaysForward();
    if (scrollTop < SCROLL_THRESHOLD_BK) loadMoreDaysBackward();
  }, [loadMoreDaysForward, loadMoreDaysBackward]);

  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (scrollContainerRef.current) scrollContainerRef.current.removeEventListener('scroll', onScroll);
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) el.addEventListener('scroll', onScroll, { passive: true });
  }, [onScroll]);

  useEffect(() => {
    if (!isInitialized) {
      setVisibleDays(buildWindowAround(selectedDate));
      setIsInitialized(true);
      setTimeout(() => scrollToDate(selectedDate, 'instant'), 200);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const es = new EventSource('/api/appuntamenti/events');
    es.addEventListener('update', () => {
      if (Date.now() - localMutationAtRef.current < LOCAL_MUTATION_WINDOW) return;
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
      sseReloadTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/appuntamenti');
          const data = await res.json();
          if (data) setAppointments(data);
          setRealtimeFlash(true);
          setTimeout(() => setRealtimeFlash(false), 1500);
        } catch { }
      }, SSE_RELOAD_DEBOUNCE);
    });
    es.onerror = () => {};
    return () => { es.close(); if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current); };
  }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSedeId) {
      const imola = sedi.find(s => s.nome.toLowerCase().includes('imola'));
      setSelectedSedeId(imola ? imola.id : sedi[0].id);
    }
  }, [sedi, selectedSedeId]);

  useEffect(() => {
    const getCell = (e: Event) => e.target instanceof Element ? e.target.closest('[data-appointment-id]') : null;
    const handleMouseEnter = (e: Event) => {
      const cell = getCell(e);
      if (cell) { const id = cell.getAttribute('data-appointment-id'); if (id) document.querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`).forEach(el => el.classList.add('appointment-hover')); }
    };
    const handleMouseLeave = (e: Event) => {
      const cell = getCell(e);
      if (cell) { const id = cell.getAttribute('data-appointment-id'); if (id) document.querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`).forEach(el => el.classList.remove('appointment-hover')); }
    };
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      document.querySelectorAll<HTMLElement>('.appointment-hover').forEach(el => el.classList.remove('appointment-hover'));
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); }
      if (e.key === 'Escape' && showSearch) closeSearch();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const personeMap = useMemo(() => {
    const m = new Map<string, Persona>();
    for (const p of persone) m.set(p.id, p);
    return m;
  }, [persone]);

  // Pre-index appointments by "${data}|${persona_id}" for the selected sede.
  const appointmentsByDayPerson = useMemo(() => {
    const map = new Map<string, Appuntamento[]>();
    for (const apt of appointments) {
      if (apt.sede_id !== selectedSedeId) continue;
      const key = `${apt.data}|${apt.persona_id}`;
      const arr = map.get(key);
      if (arr) arr.push(apt);
      else map.set(key, [apt]);
    }
    return map;
  }, [appointments, selectedSedeId]);

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
      if (match && !seen.has(a.id)) { seen.add(a.id); out.push(a); }
    }
    out.sort((a, b) => b.data.localeCompare(a.data));
    return out.slice(0, 50);
  }, [deferredQuery, appointments, personeMap]);

  const isSearchPending = searchQuery !== deferredQuery;

  const closeSearch = () => { setShowSearch(false); setSearchQuery(''); };

  const navigateToSearchResult = (apt: Appuntamento) => {
    const targetSede = sediRef.current.find(s => s.id === apt.sede_id);
    if (targetSede) setSelectedSedeId(targetSede.id);
    try {
      const [y, m, d] = apt.data.split('-').map(Number);
      setTimeout(() => navigateToDate(new Date(y, m - 1, d, 12, 0, 0)), 50);
    } catch { }
    setViewMode('daily');
    closeSearch();
  };

  const markLocalMutation = () => { localMutationAtRef.current = Date.now(); };

  const loadData = async () => {
    try {
      const [sediRes, personeRes, psRes, appRes] = await Promise.all([fetch('/api/sedi'), fetch('/api/persone'), fetch('/api/persona-sede'), fetch('/api/appuntamenti')]);
      const [sediData, personeData, psData, appData] = await Promise.all([sediRes.json(), personeRes.json(), psRes.json(), appRes.json()]);
      if (sediData)    setSedi(sediData);
      if (personeData) setPersone(personeData);
      if (psData)      setPersonaSede(psData);
      if (appData)     setAppointments(appData);
    } catch (error) { console.error('Errore caricamento dati:', error); }
  };

  // ── PRINT LOGIC ──────────────────────────────────────────────────────────

  const openPrintModal = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setPrintDateFrom(dateStr);
    setPrintDateTo(dateStr);
    setPrintSelectedPersone(['__all__']);
    setShowPrintModal(true);
  };

  const togglePrintPersona = (personaId: string) => {
    setPrintSelectedPersone(prev => {
      if (personaId === '__all__') return ['__all__'];
      const withoutAll = prev.filter(id => id !== '__all__');
      const exists = withoutAll.includes(personaId);
      if (exists) {
        const next = withoutAll.filter(id => id !== personaId);
        return next.length ? next : ['__all__'];
      }
      return [...withoutAll, personaId];
    });
  };

  const getPrintDatesInRange = (from: string, to: string): Date[] => {
    if (!from || !to) return [];
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const start = new Date(fy, fm - 1, fd, 12);
    const end = new Date(ty, tm - 1, td, 12);
    const dates: Date[] = [];
    let current = start;
    while (current <= end) {
      dates.push(current);
      current = addDays(current, 1);
    }
    return dates;
  };

  // Costruisce le righe stampabili per una persona in un giorno,
  // includendo SIA gli appuntamenti SIA gli slot vuoti.
  const buildPrintableRowsForPersonaDay = (dateStr: string, personaId: string, day: Date) => {
    const slots = getTimeSlotsForSede(selectedSedeNome, day, agendaId);

    const dayApts = appointments
      .filter(a =>
        a.data === dateStr &&
        a.persona_id === personaId &&
        a.sede_id === selectedSedeId &&
        (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
      )
      .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));

    return slots.map(slot => {
      const startingAppointment = dayApts.find(a => a.ora_inizio.substring(0, 5) === slot.label);
      if (startingAppointment) {
        return {
          time: `${startingAppointment.ora_inizio.substring(0, 5)}\u2013${startingAppointment.ora_fine.substring(0, 5)}`,
          cliente: startingAppointment.cliente ?? '',
          note: startingAppointment.note ?? '',
          empty: false,
        };
      }

      const coveredByLongAppointment = dayApts.some(a =>
        slot.label > a.ora_inizio.substring(0, 5) &&
        slot.label < a.ora_fine.substring(0, 5)
      );
      if (coveredByLongAppointment) return null;

      return {
        time: slot.label,
        cliente: '',
        note: '',
        empty: true,
      };
    }).filter(Boolean) as { time: string; cliente: string; note: string; empty: boolean }[];
  };

  const handlePrint = () => {
    if (!printDateFrom || !printDateTo) return;

    const sede = sedi.find(s => s.id === selectedSedeId);
    const isAll = printSelectedPersone.includes('__all__');
    const selectedPeople = isAll
      ? sedePersone
      : sedePersone.filter(p => printSelectedPersone.includes(p.id));

    if (selectedPeople.length === 0) {
      alert('Seleziona almeno un operatore');
      return;
    }

    const allDays = getPrintDatesInRange(printDateFrom, printDateTo);
    const printableDays = allDays.filter(day => !isDayClosedForSede(day));

    if (printableDays.length === 0) {
      alert('Nessun giorno lavorativo da stampare nel periodo selezionato');
      return;
    }

    const pagesHtml = printableDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'EEEE dd MMMM yyyy', { locale: it });

      const blocksHtml = selectedPeople.map(persona => {
        const rowsData = buildPrintableRowsForPersonaDay(dateStr, persona.id, day);

        const rows = rowsData.map(row => {
          if (row.empty) {
            return `<tr class="empty-row"><td class="ora">${row.time}</td><td class="cliente empty-cell">\u2014</td><td class="note empty-cell">slot vuoto</td></tr>`;
          }
          return `<tr><td class="ora">${row.time}</td><td class="cliente">${row.cliente}</td><td class="note">${row.note}</td></tr>`;
        }).join('');

        const realAppointmentsCount = appointments.filter(a =>
          a.data === dateStr &&
          a.persona_id === persona.id &&
          a.sede_id === selectedSedeId &&
          (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
        ).length;

        return `<div class="block"><div class="block-header"><div class="avatar">${persona.nome.substring(0,1)}</div><span class="nome">${persona.nome}</span><span class="cnt">${realAppointmentsCount} appt.</span></div><table><thead><tr><th>Orario</th><th>Cliente</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }).join('');

      return `<section class="print-page"><header><div><h1>Agenda 730</h1><div class="sub">Sede: ${sede?.nome ?? ''} &mdash; ${isAll ? 'Tutti gli operatori' : selectedPeople.map(p => p.nome).join(', ')}</div></div><div class="meta"><strong>${dayLabel}</strong></div></header><div class="grid">${blocksHtml}</div></section>`;
    }).join('');

    const rangeLabel = printDateFrom === printDateTo ? printDateFrom : `${printDateFrom} - ${printDateTo}`;

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><title>Agenda 730 \u2013 ${rangeLabel}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:8mm 10mm}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #005CA9;padding-bottom:6px;margin-bottom:10px}header h1{font-size:15px;color:#005CA9;font-weight:800}.sub{font-size:9px;color:#555;margin-top:2px}.meta{text-align:right;font-size:9px;color:#555}.meta strong{display:block;font-size:12px;color:#222;text-transform:capitalize}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.block{break-inside:avoid;border:1px solid #d0dce8;border-radius:4px;overflow:hidden}.block-header{display:flex;align-items:center;gap:5px;background:#005CA9;color:#fff;padding:5px 7px}.avatar{width:20px;height:20px;background:rgba(255,255,255,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0}.nome{font-weight:700;font-size:10px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cnt{font-size:9px;opacity:0.8;white-space:nowrap}table{width:100%;border-collapse:collapse}thead tr{background:#E6F0F9}thead th{padding:3px 5px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;color:#005CA9;border-bottom:2px solid #005CA9}tbody tr{border-bottom:1px solid #e8e8e8}tbody tr:nth-child(even){background:#F8FAFB}tbody td{padding:6px 5px;vertical-align:top;font-size:9px}td.ora{white-space:nowrap;font-weight:700;color:#005CA9;width:65px}td.cliente{font-weight:600;word-break:break-word;white-space:normal}td.note{color:#666;font-style:italic;word-break:break-word;white-space:normal}.empty-row td{color:#9aa4af}.empty-cell{font-style:italic}.print-page{page-break-after:always;margin-bottom:10mm}.print-page:last-child{page-break-after:auto}footer{margin-top:10px;font-size:8px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;padding-top:6px}@media print{body{padding:8mm 10mm}@page{size:A4 portrait;margin:8mm}}</style></head><body>${pagesHtml}<footer>Stampato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })} &mdash; Agenda Aziendale</footer><script>window.onload=()=>{window.print()}<\/script></body></html>`;

    const win = window.open('', '_blank', 'width=900,height=750');
    if (win) { win.document.write(html); win.document.close(); }
    setShowPrintModal(false);
  };

  const handleCreateAppointment = async (data: any) => {
    if (!data.persona_id || !data.sede_id || !data.data || !data.ora_inizio || !data.ora_fine) { alert('Compila tutti i campi obbligatori'); return; }
    const tempId = `__optimistic_${Date.now()}`;
    markLocalMutation();
    setAppointments(prev => [...prev, { ...data, id: tempId }]);
    try {
      const res = await fetch('/api/appuntamenti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      const created: Appuntamento = await res.json();
      setAppointments(prev => prev.map(a => a.id === tempId ? created : a));
    } catch (err) {
      setAppointments(prev => prev.filter(a => a.id !== tempId));
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    markLocalMutation();
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      const updated: Appuntamento = await res.json();
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err) {
      try { const res = await fetch('/api/appuntamenti'); const d = await res.json(); if (d) setAppointments(d); } catch { }
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
    const snapshot = appointments.find(a => a.id === id);
    markLocalMutation();
    setAppointments(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch (err) {
      if (snapshot) setAppointments(prev => [...prev, snapshot]);
      alert('Errore imprevisto: ' + String(err));
    }
  };

  const getUffChiusoApts = (dateStr: string, slotLabel: string, personaId: string): Appuntamento[] => {
    const dayApts = appointmentsByDayPerson.get(`${dateStr}|${personaId}`) ?? [];
    return dayApts.filter(a => slotLabel >= a.ora_inizio.substring(0, 5) && slotLabel < a.ora_fine.substring(0, 5) && (a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO');
  };

  const isUffChiusoSlot = (dateStr: string, slotLabel: string, personaId: string): boolean => {
    const dayApts = appointmentsByDayPerson.get(`${dateStr}|${personaId}`) ?? [];
    const covering = dayApts.filter(a => slotLabel >= a.ora_inizio.substring(0, 5) && slotLabel < a.ora_fine.substring(0, 5));
    return covering.length > 0 && covering.every(a => (a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO');
  };

  const handleEditModeSlotClick = async (dateStr: string, slotLabel: string, personaId: string, day: Date) => {
    if (!selectedSedeId) return;
    const realApts = appointments.filter(a => a.data === dateStr && a.sede_id === selectedSedeId && a.persona_id === personaId && slotLabel >= a.ora_inizio.substring(0, 5) && slotLabel < a.ora_fine.substring(0, 5) && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO');
    if (realApts.length > 0) return;
    const uffApts = getUffChiusoApts(dateStr, slotLabel, personaId);
    if (uffApts.length > 0) {
      const removedIds = uffApts.map(a => a.id);
      markLocalMutation();
      setAppointments(prev => prev.filter(a => !removedIds.includes(a.id)));
      for (const apt of uffApts) {
        try { const res = await fetch(`/api/appuntamenti/${apt.id}`, { method: 'DELETE' }); if (!res.ok) throw new Error(); }
        catch { await loadData(); alert('Errore durante lo sblocco'); return; }
      }
    } else {
      const motivo   = window.prompt('Motivo chiusura (es. Ferie, Formazione, ...):') ?? '';
      const slots    = getTimeSlotsForDay(day);
      const endSlots = getEndTimeSlotsForDay(day);
      const idx      = slots.findIndex(s => s.label === slotLabel);
      const oraFine  = idx !== -1 && idx + 1 < endSlots.length ? endSlots[idx + 1].label : endSlots[endSlots.length - 1].label;
      const tempId   = `__optimistic_${Date.now()}`;
      markLocalMutation();
      setAppointments(prev => [...prev, { id: tempId, persona_id: personaId, sede_id: selectedSedeId, data: dateStr, ora_inizio: slotLabel, ora_fine: oraFine, cliente: 'UFF CHIUSO', note: motivo } as Appuntamento]);
      try {
        const res = await fetch('/api/appuntamenti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: personaId, sede_id: selectedSedeId, data: dateStr, ora_inizio: slotLabel, ora_fine: oraFine, cliente: 'UFF CHIUSO', note: motivo }) });
        if (!res.ok) throw new Error();
        const created: Appuntamento = await res.json();
        setAppointments(prev => prev.map(a => a.id === tempId ? created : a));
      } catch { setAppointments(prev => prev.filter(a => a.id !== tempId)); alert('Errore durante il blocco'); }
    }
  };

  const handleSlotClick = (date: string, time: string, personaId: string, existingAppointment?: Appuntamento) => {
    const day      = parseISO(date);
    const daySlots    = getTimeSlotsForSede(selectedSedeNome, day, agendaId);
    const dayEndSlots = getEndTimeSlotsForSede(selectedSedeNome, day, agendaId);
    appointmentModalRef.current?.open({
      date, time, personaId,
      existingAppointment,
      sedeId: selectedSedeId,
      daySlots,
      dayEndSlots,
    });
  };

  const getAppointmentsForSlot = (date: string, time: string, personaId: string) => {
    const dayApts = appointmentsByDayPerson.get(`${date}|${personaId}`) ?? [];
    return dayApts.filter(apt => {
      const s = apt.ora_inizio ? apt.ora_inizio.substring(0, 5) : '';
      const e = apt.ora_fine   ? apt.ora_fine.substring(0, 5)   : '';
      return time >= s && time < e;
    });
  };

  const handleDragStart = (appointment: Appuntamento, time: string) => setDraggedAppointment({ appointment, originalTime: time });

  const handleDrop = async (date: string, newTime: string, personaId: string, day: Date) => {
    if (!draggedAppointment) return;
    const { appointment, originalTime } = draggedAppointment;
    const slots    = getTimeSlotsForDay(day);
    const endSlots = getEndTimeSlotsForDay(day);
    const origIdx  = slots.findIndex(s => s.label === originalTime);
    const newIdx   = slots.findIndex(s => s.label === newTime);
    if (origIdx === -1 || newIdx === -1) { setDraggedAppointment(null); return; }
    const diff = newIdx - origIdx;
    const startIdx = slots.findIndex(s => s.label === appointment.ora_inizio.substring(0, 5));
    let endIdx = slots.findIndex(s => s.label === appointment.ora_fine.substring(0, 5));
    if (endIdx === -1) endIdx = slots.length;
    const ns = startIdx + diff; const ne = endIdx + diff;
    if (ns < 0 || ne > slots.length) { alert("Impossibile spostare l'appuntamento in questo orario"); setDraggedAppointment(null); return; }
    const newStart = slots[ns].label;
    const newEnd   = ne < slots.length ? slots[ne].label : endSlots[endSlots.length - 1].label;
    const hasConflict = appointments.some(apt => {
      if (apt.id === appointment.id || apt.persona_id !== personaId || apt.sede_id !== appointment.sede_id || apt.data !== date) return false;
      return newStart < apt.ora_fine.substring(0, 5) && newEnd > apt.ora_inizio.substring(0, 5);
    });
    if (hasConflict) { alert('Impossibile spostare: fascia già occupata'); setDraggedAppointment(null); return; }
    const snapshot = { ...appointment };
    const updatedData = { persona_id: personaId, sede_id: appointment.sede_id, ora_inizio: newStart, ora_fine: newEnd, cliente: appointment.cliente, note: appointment.note, highlight: appointment.highlight };
    markLocalMutation();
    setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, ...updatedData, data: date } : a));
    setDraggedAppointment(null);
    try {
      const res = await fetch(`/api/appuntamenti/${appointment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
      if (!res.ok) throw new Error();
      const updated: Appuntamento = await res.json();
      setAppointments(prev => prev.map(a => a.id === appointment.id ? updated : a));
    } catch { setAppointments(prev => prev.map(a => a.id === snapshot.id ? snapshot : a)); alert('Errore imprevisto'); }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const getDayAvailability = (dateStr: string, personaId: string, day: Date): DayAvailability => {
    if (isDayClosedForSede(day)) return 'closed';
    const slots = getTimeSlotsForDay(day);
    const n = (appointmentsByDayPerson.get(`${dateStr}|${personaId}`) ?? []).length;
    if (n === 0) return 'free';
    if (n >= slots.length) return 'full';
    return 'partial';
  };

  const getFreeSlots = (dateStr: string, personaId: string, day: Date): number => {
    const occupied = appointments.filter(apt => apt.sede_id === selectedSedeId && apt.data === dateStr && apt.persona_id === personaId).length;
    return Math.max(0, getTimeSlotsForDay(day).length - occupied);
  };

  const getFirstAvailableDay = (personaId: string): string | null => {
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = addDays(today, i);
      if (isDayClosedForSede(d)) continue;
      const s = format(d, 'yyyy-MM-dd');
      const a = getDayAvailability(s, personaId, d);
      if (a === 'free' || a === 'partial') return s;
    }
    return null;
  };

  // ─── VISTA MENSILE ────────────────────────────────────────────────────────
  const renderMonthlyView = () => {
    const activePersona = (selectedMonthlyPersona && sedePersone.some(p => p.id === selectedMonthlyPersona)) ? selectedMonthlyPersona : sedePersone[0]?.id ?? null;
    if (!activePersona) return null;
    const personaNome = sedePersone.find(p => p.id === activePersona)?.nome ?? '';
    const fa = getFirstAvailableDay(activePersona);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd   = endOfMonth(selectedDate);
    const allCalDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
    const weeks: Date[][] = [];
    for (let i = 0; i < allCalDays.length; i += 7) weeks.push(allCalDays.slice(i, i + 7));
    const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    return (
      <div className="p-3 md:p-4 h-full overflow-y-auto">
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {sedePersone.length > 1 ? (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <User size={16} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Persona</span>
              <div className="flex items-center gap-1">
                {sedePersone.map(p => {
                  const isActive = p.id === activePersona;
                  return (
                    <button key={p.id} onClick={() => setSelectedMonthlyPersona(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${ isActive ? 'text-white shadow-md scale-105' : 'text-gray-600 bg-gray-100 hover:bg-gray-200' }`}
                      style={isActive ? { backgroundColor: '#005CA9' } : {}}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : '#005CA9' }}>
                        <User size={11} className="text-white" />
                      </div>
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#005CA9]"><User size={14} className="text-white" /></div>
              <span className="font-bold text-sm text-[#005CA9]">{personaNome}</span>
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {fa && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                <CalendarIcon size={12} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Primo libero: {format(new Date(fa), 'dd/MM', { locale: it })}</span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
              {[['bg-green-500','Libero'],['bg-yellow-400','Parziale'],['bg-red-500','Pieno'],['bg-gray-300','Chiuso']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded ${c}`} /><span className="text-[11px] text-gray-600">{l}</span></div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAY_NAMES.map((name, idx) => (<div key={name} className={`py-2 text-center text-xs font-bold uppercase tracking-wider ${ idx >= 5 ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-600' }`}>{name}</div>))}
          </div>
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: '80px' }}>
              {week.map((day, dIdx) => {
                const dateStr    = format(day, 'yyyy-MM-dd');
                const isThisMonth = getMonth(day) === getMonth(selectedDate);
                if (!isThisMonth) return (<div key={dateStr} className={`p-1.5 border-r border-gray-100 last:border-r-0 ${ dIdx >= 5 ? 'bg-gray-100' : 'bg-gray-50' }`} />);
                const isToday  = format(new Date(), 'yyyy-MM-dd') === dateStr;
                const isClosed = isDayClosedForSede(day);
                const isBefore = day < MIN_DATE;
                const av       = getDayAvailability(dateStr, activePersona, day);
                const freeSlots = (!isClosed && av !== 'full') ? getFreeSlots(dateStr, activePersona, day) : 0;
                const avBg     = isClosed ? 'bg-gray-100' : av === 'free' ? 'bg-green-50' : av === 'partial' ? 'bg-yellow-50' : 'bg-red-50';
                const avBorder = isClosed ? '' : av === 'free' ? 'border-t-2 border-green-400' : av === 'partial' ? 'border-t-2 border-yellow-400' : 'border-t-2 border-red-500';
                const avDot    = isClosed ? 'bg-gray-300' : av === 'free' ? 'bg-green-500' : av === 'partial' ? 'bg-yellow-400' : 'bg-red-500';
                return (
                  <div key={dateStr}
                    onClick={() => { if (!isClosed && !isBefore) { navigateToDate(day); setViewMode('daily'); } }}
                    className={`relative p-1.5 border-r border-gray-100 last:border-r-0 transition-all ${avBg} ${avBorder} ${ !isClosed && !isBefore ? 'cursor-pointer hover:brightness-95' : '' } ${isBefore && !isClosed ? 'opacity-40' : ''}`}
                    title={isClosed ? 'Chiuso' : freeSlots > 0 ? `${personaNome} - ${format(day,'dd/MM/yyyy')} - ${freeSlots} slot liber${freeSlots===1?'o':'i'}` : `${personaNome} - ${format(day,'dd/MM/yyyy')} - Pieno`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${ isToday ? 'bg-[#005CA9] text-white' : isClosed ? 'text-gray-400' : 'text-gray-700' }`}>{format(day, 'd')}</span>
                      {!isClosed && <div className={`w-2 h-2 rounded-full mt-1 ${avDot}`} />}
                    </div>
                    {!isClosed && freeSlots > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-green-700">{freeSlots} liber{freeSlots === 1 ? 'o' : 'i'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── VISTA GIORNALIERA ────────────────────────────────────────────────────
  const renderDailyView = () => (
    <div className="h-full flex flex-col">
      <div ref={setScrollRef} className="flex-1 overflow-y-auto" style={{ overflowAnchor: 'none' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2 border-[#005CA9]/20">
              <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 w-[60px] border-r border-gray-200">
                <span className="text-[#005CA9]">Orario</span>
              </th>
              {sedePersone.map(persona => (
                <th key={persona.id} className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[150px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-6 h-6 bg-[#005CA9] rounded-full flex items-center justify-center"><User size={14} className="text-white" /></div>
                    <span className="text-[#005CA9]">{persona.nome}</span>
                  </div>
                </th>
              ))}
              <th className="p-2 text-right text-xs font-semibold bg-[#F5F8FA] sticky right-0 z-10 w-[60px] border-l border-gray-200">
                <span className="text-[#005CA9]">Orario</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(day => {
              const dateStr      = formatDate(day);
              const isToday      = formatDate(new Date()) === dateStr;
              const isClosed     = isDayFullyClosedForAllPersone(day, sedePersone);
              const dayTimeSlots = getTimeSlotsForDay(day);
              return (
                <React.Fragment key={dateStr}>
                  <tr data-date={dateStr}>
                    <td colSpan={sedePersone.length + 2}
                      className={`p-0 sticky left-0 z-10 ${isToday ? 'bg-[#005CA9]' : isClosed ? 'bg-gray-200' : 'bg-[#EEF4FB]'}`}>
                      <div className={`flex items-center justify-between px-4 py-2 border-b-2 ${isToday ? 'border-white/20' : isClosed ? 'border-gray-300' : 'border-[#005CA9]/15'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm ${isToday ? 'bg-white/20 text-white' : isClosed ? 'bg-gray-300 text-gray-500' : 'bg-[#005CA9] text-white'}`}>
                            {format(day, 'd')}
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 ${isToday ? 'text-blue-200' : isClosed ? 'text-gray-400' : 'text-[#005CA9]/50'}`}>
                              {format(day, 'EEEE', { locale: it })}
                            </p>
                            <p className={`text-sm font-bold leading-tight ${isToday ? 'text-white' : isClosed ? 'text-gray-500' : 'text-[#005CA9]'}`}>
                              {format(day, 'dd MMMM yyyy', { locale: it })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isToday && <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-widest">Oggi</span>}
                          {isClosed && <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-300/60 text-gray-500 text-[10px] font-bold rounded-full uppercase tracking-wide"><Lock size={8} /> Chiuso</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {isClosed ? (
                    <tr>
                      <td colSpan={sedePersone.length + 2} className="p-5 text-center border-b-2 border-gray-300" style={{ height: '64px', background: 'repeating-linear-gradient(45deg,#f9fafb,#f9fafb 8px,#f1f5f9 8px,#f1f5f9 16px)' }}>
                        <div className="flex items-center justify-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <Lock size={13} className="text-gray-400" />
                          </div>
                          <span className="text-sm font-semibold text-gray-400">{isBorgoSede ? 'Borgo è aperto solo il mercoledì' : 'Sede chiusa'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dayTimeSlots.map((slot) => {
                      return (
                      <tr key={`${dateStr}-${slot.label}`}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-300 w-[60px]">
                          <div className="px-1 py-2 text-xs font-semibold text-gray-700">{slot.label}</div>
                        </td>
                        {sedePersone.map(persona => {
                          if (isPersonaDisabledForDay(day, persona)) {
                            return (<td key={`${persona.id}-${slot.label}`} className="relative p-0 border-r border-gray-300 border-b border-gray-300 bg-gray-400 select-none" style={{ height: '45px' }} />);
                          }
                          const slotApts = getAppointmentsForSlot(dateStr, slot.label, persona.id);
                          const dayApts  = appointmentsByDayPerson.get(`${dateStr}|${persona.id}`) ?? [];
                          const isUffC   = isUffChiusoSlot(dateStr, slot.label, persona.id);
                          if (isUffC) {
                            const uffNote = getUffChiusoApts(dateStr, slot.label, persona.id)[0]?.note?.trim() || '';
                            return (
                            <td key={`${persona.id}-${slot.label}`}
                              className={`relative p-0 border-r border-slate-500 border-b border-slate-500 bg-slate-600 ${ deferredEditMode ? 'cursor-pointer hover:bg-slate-700' : 'select-none' }`}
                              style={{ height: '45px' }}
                              title={deferredEditMode ? 'Clicca per sbloccare' : (uffNote ? `Ufficio chiuso – ${uffNote}` : 'Ufficio chiuso')}
                              onClick={() => deferredEditMode && handleEditModeSlotClick(dateStr, slot.label, persona.id, day)}>
                              <div className="w-full h-full flex items-center px-2 gap-1.5">
                                <Lock size={9} className="text-slate-300 flex-shrink-0" />
                                <span className="text-[10px] text-slate-200 font-semibold italic truncate flex-1">{uffNote || 'uff. chiuso'}</span>
                                {deferredEditMode && <Unlock size={9} className="text-amber-300 flex-shrink-0" />}
                              </div>
                            </td>
                          );}
                          return (
                            <td key={`${persona.id}-${slot.label}`}
                              className={`relative p-0 border-r border-gray-300 ${ !slotApts.length ? 'border-b border-gray-300' : '' }`}
                              style={{ height: '45px' }}>
                              {deferredEditMode && slotApts.length === 0 ? (
                                <div onClick={() => handleEditModeSlotClick(dateStr, slot.label, persona.id, day)}
                                  className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-amber-50 group"
                                  title="Clicca per bloccare questo slot">
                                  <Lock size={12} className="text-gray-300 opacity-30 group-hover:opacity-100 group-hover:text-amber-500" />
                                </div>
                              ) : (
                                <TimeSlot
                                  time={slot.label} appointments={slotApts} allDayAppointments={dayApts}
                                  daySlots={dayTimeSlots}
                                  onClick={apt => !deferredEditMode && handleSlotClick(dateStr, slot.label, persona.id, apt)}
                                  onDragStart={handleDragStart}
                                  onDrop={t => handleDrop(dateStr, t, persona.id, day)}
                                  onDragOver={handleDragOver}
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="p-0 bg-[#F5F8FA] sticky right-0 z-10 border-l border-gray-200 border-b border-gray-300 w-[60px]">
                          <div className="px-1 py-2 text-xs font-semibold text-gray-700 text-right">{slot.label}</div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const sedePersone = persone.filter(p => personaSede.some(ps => ps.persona_id === p.id && ps.sede_id === selectedSedeId));
  const dateLabel = viewMode === 'daily' ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it }) : format(selectedDate, 'MMMM yyyy', { locale: it });

  const handlePrev = () => { if (viewMode === 'daily') navigateToDate(subDays(selectedDate, 1)); else if (selectedDate > MIN_DATE) setSelectedDate(subMonths(selectedDate, 1)); };
  const handleNext = () => { if (viewMode === 'daily') navigateToDate(addDays(selectedDate, 1)); else setSelectedDate(addMonths(selectedDate, 1)); };

  // Conteggio appuntamenti per il preview del modal di stampa
  const printPreviewCount = useMemo(() => {
    if (!printDateFrom || !printDateTo) return 0;
    return appointments.filter(a => {
      const inRange = a.data >= printDateFrom && a.data <= printDateTo;
      const inSede = a.sede_id === selectedSedeId;
      const notClosed = (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO';
      const validPersona = printSelectedPersone.includes('__all__') ? true : printSelectedPersone.includes(a.persona_id);
      return inRange && inSede && notClosed && validPersona;
    }).length;
  }, [printDateFrom, printDateTo, printSelectedPersone, appointments, selectedSedeId]);

  const printPreviewDaysCount = useMemo(() => getPrintDatesInRange(printDateFrom, printDateTo).length, [printDateFrom, printDateTo]);

  const printPreviewPeopleCount = printSelectedPersone.includes('__all__') ? sedePersone.length : printSelectedPersone.length;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white border-t-4 border-[#005CA9]">

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 bg-white border-b-2 border-[#005CA9]/20 px-4 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg"><CalendarIcon className="w-6 h-6 text-white" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#005CA9]">Agenda 730</h1>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-500 ${ realtimeFlash ? 'bg-green-100 text-green-700 border border-green-300 scale-105' : 'bg-gray-50 text-gray-400 border border-gray-200' }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ realtimeFlash ? 'bg-green-500 animate-pulse' : 'bg-gray-300' }`} />
                  {realtimeFlash ? 'Aggiornato' : 'Live'}
                </div>
                <button onClick={() => setShowSearch(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9] hover:bg-[#E6F2FF] transition-all"
                  title="Cerca appuntamenti (Ctrl+K)">
                  <Search size={11} /> Cerca
                </button>
                <button onClick={openPrintModal}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 hover:border-[#005CA9] hover:text-[#005CA9] hover:bg-[#E6F2FF] transition-all"
                  title="Stampa appuntamenti">
                  <Printer size={11} /> Stampa
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
              <button onClick={() => setViewMode('daily')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${ viewMode === 'daily' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200' }`}>
                <List className="w-4 h-4 inline mr-1" />Giornaliera
              </button>
              <button onClick={() => setViewMode('monthly')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${ viewMode === 'monthly' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200' }`}>
                <LayoutGrid className="w-4 h-4 inline mr-1" />Mensile
              </button>
            </div>
            <div className="relative group">
              <button onClick={() => setEditMode(e => !e)}
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-all border-2 ${ editMode ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 shadow-lg scale-110' : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500' }`}
                title={editMode ? 'Disattiva modalità modifica' : 'Attiva modalità modifica'}>
                {editMode ? <Unlock size={16} /> : <Lock size={16} />}
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30">
                {editMode ? 'Esci dalla modifica' : 'Modifica slot'}
              </div>
            </div>
            <button onClick={handlePrev} disabled={selectedDate <= MIN_DATE} className="p-2 hover:bg-blue-50 rounded-lg transition-all border border-gray-200 disabled:opacity-50">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={() => setShowDatePicker(!showDatePicker)}
              className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] transition-colors cursor-pointer"
              style={{ minWidth: '240px', textAlign: 'center' }}>
              <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">{dateLabel}</span>
            </button>
            <button onClick={handleNext} className="p-2 hover:bg-blue-50 rounded-lg transition-all border border-gray-200">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
              <Building2 className="w-5 h-5 text-[#005CA9]" />
              <div className="relative">
                <select value={selectedSedeId} onChange={e => setSelectedSedeId(e.target.value)}
                  className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none">
                  {sedi.map(sede => (<option key={sede.id} value={sede.id} className="text-gray-800 bg-white">{sede.nome}</option>))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#005CA9] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'daily' ? renderDailyView() : renderMonthlyView()}
      </div>

      {/* ── PRINT MODAL ── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-10"
          onClick={e => { if (e.target === e.currentTarget) setShowPrintModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-[#005CA9]" />
                <span className="font-bold text-[#005CA9] text-sm">Stampa appuntamenti</span>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Dal giorno</label>
                  <input type="date" value={printDateFrom} onChange={e => {
                    setPrintDateFrom(e.target.value);
                    if (e.target.value > printDateTo) setPrintDateTo(e.target.value);
                  }}
                    className="w-full px-3 py-2.5 text-sm bg-[#F5F8FA] border-2 border-gray-200 rounded-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005CA9]/40 focus:border-[#005CA9] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Al giorno</label>
                  <input type="date" value={printDateTo} min={printDateFrom} onChange={e => setPrintDateTo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#F5F8FA] border-2 border-gray-200 rounded-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005CA9]/40 focus:border-[#005CA9] transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Operatori</label>
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                  <label className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    printSelectedPersone.includes('__all__') ? 'border-[#005CA9] bg-[#E6F2FF]' : 'border-gray-200 bg-[#F5F8FA] hover:border-gray-300'
                  }`}>
                    <input type="checkbox" checked={printSelectedPersone.includes('__all__')} onChange={() => togglePrintPersona('__all__')} className="w-4 h-4 accent-[#005CA9]" />
                    <span className={`text-sm font-semibold ${ printSelectedPersone.includes('__all__') ? 'text-[#005CA9]' : 'text-gray-700' }`}>Tutti gli operatori</span>
                  </label>
                  {sedePersone.map(p => (
                    <label key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                      printSelectedPersone.includes(p.id) ? 'border-[#005CA9] bg-[#E6F2FF]' : 'border-gray-200 bg-[#F5F8FA] hover:border-gray-300'
                    }`}>
                      <input type="checkbox" checked={printSelectedPersone.includes(p.id)} onChange={() => togglePrintPersona(p.id)} className="w-4 h-4 accent-[#005CA9]" />
                      <div className="w-6 h-6 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[10px] font-bold">{p.nome.substring(0,1)}</span>
                      </div>
                      <span className={`text-sm font-medium ${ printSelectedPersone.includes(p.id) ? 'text-[#005CA9] font-semibold' : 'text-gray-700' }`}>{p.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              {printDateFrom && printDateTo && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 border bg-indigo-50 border-indigo-200">
                  <CalendarIcon size={14} className="flex-shrink-0 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">
                    {printPreviewCount === 0
                      ? 'Nessun appuntamento nel periodo selezionato'
                      : `${printPreviewCount} appuntament${printPreviewCount === 1 ? 'o' : 'i'} · ${printPreviewDaysCount} giorn${printPreviewDaysCount === 1 ? 'o' : 'i'} · ${printPreviewPeopleCount} operator${printPreviewPeopleCount === 1 ? 'e' : 'i'}`
                    }
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowPrintModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Annulla</button>
              <button onClick={handlePrint} disabled={!printDateFrom || !printDateTo}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#005CA9] text-white text-sm font-semibold hover:bg-[#004080] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Printer size={14} /> Stampa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH OVERLAY ── */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16"
          onClick={(e) => { if (e.target === e.currentTarget) closeSearch(); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border-t-4 border-[#005CA9]">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <Search size={18} className="text-[#005CA9] flex-shrink-0" />
              <input ref={searchInputRef} autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca cliente, persona, data (es. 2026-03)..."
                className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400" />
              {isSearchPending && <div className="w-3.5 h-3.5 border-2 border-[#005CA9]/30 border-t-[#005CA9] rounded-full animate-spin flex-shrink-0" />}
              {searchQuery && !isSearchPending && (
                <button onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
              )}
              <button onClick={closeSearch} className="text-gray-400 hover:text-gray-700 transition-colors ml-1"><X size={20} /></button>
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
                  <p className="text-sm text-gray-400">Nessun risultato per <strong>&quot;{searchQuery}&quot;</strong></p>
                </div>
              )}
              {searchResults.map(apt => {
                const sede    = sedi.find(s => s.id === apt.sede_id);
                const persona = personeMap.get(apt.persona_id);
                return (
                  <div key={apt.id} onClick={() => navigateToSearchResult(apt)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#E6F2FF] cursor-pointer border-b border-gray-100 transition-colors group">
                    <div className="w-9 h-9 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0 shadow-sm"><User size={15} className="text-white" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{apt.cliente}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-[#005CA9]">{persona?.nome ?? apt.persona_id}</span>
                        {' · '}{sede?.nome ?? apt.sede_id}{' · '}
                        {(() => { try { const [y,m,d] = apt.data.split('-').map(Number); return format(new Date(y,m-1,d,12), 'dd/MM/yyyy', { locale: it }); } catch { return apt.data; } })()}
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
                <p className="text-xs text-gray-400">{searchResults.length}{searchResults.length === 50 ? '+' : ''} risultat{searchResults.length === 1 ? 'o' : 'i'} — clicca per navigare</p>
                <kbd className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
              </div>  
            )}
          </div>
        </div>
      )}

      {/* ── DATE PICKER ── */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#005CA9]">Seleziona Data</h3>
              <button onClick={() => setShowDatePicker(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={() => setSelectedDate(subMonths(selectedDate, 1))} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} className="text-[#005CA9]" /></button>
              <h4 className="text-lg font-bold text-gray-800 capitalize">{format(selectedDate, 'MMMM yyyy', { locale: it })}</h4>
              <button type="button" onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} className="text-[#005CA9]" /></button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (<div key={d} className="text-center text-xs font-semibold text-gray-600 py-2">{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {(() => {
                const ms   = startOfMonth(selectedDate);
                const me   = endOfMonth(selectedDate);
                const days = eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(me, { weekStartsOn: 1 }) });
                return days.map((day, i) => {
                  const isCurr   = isSameMonth(day, selectedDate);
                  const isSel    = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const isTod    = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  const isClosed = isDayClosedForSede(day);
                  return (
                    <button key={i} type="button" onClick={() => { navigateToDate(day); setShowDatePicker(false); }}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all cursor-pointer ${ isSel ? 'bg-[#005CA9] text-white shadow-md scale-105' : isTod ? 'bg-[#E6F2FF] text-[#005CA9] font-bold' : isClosed && isCurr ? 'bg-gray-200 text-gray-400' : isCurr ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105' : 'bg-transparent text-gray-300' }`}>
                      {format(day, 'd')}
                    </button>
                  );
                });
              })()}
            </div>
            <button type="button" onClick={() => { navigateToDate(new Date()); setShowDatePicker(false); }}
              className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold">Vai a Oggi</button>
          </div>
        </div>
      )}

      <AppointmentModal
        ref={appointmentModalRef}
        onSave={handleCreateAppointment}
        onUpdate={handleUpdateAppointment}
        onDelete={handleDeleteAppointment}
        persone={persone} sedi={sedi} personaSede={personaSede}
      />
    </div>
  );
}
