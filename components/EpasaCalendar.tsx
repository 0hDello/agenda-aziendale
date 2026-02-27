'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Building2,
  User,
  ChevronDown,
  X,
  Plus,
  LayoutGrid,
  List,
  Lock,
  Unlock,
  Trash2,
  Eye,
  Search,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
  getDay,
  startOfDay,
  getDate,
  getMonth,
  getYear,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import React from 'react';
import EpasaAppointmentModal from './EpasaAppointmentModal';
import LoredanaView from './LoredanaView';

interface EpasaCalendarProps {
  agendaId: string;
}

interface Sede {
  id: string;
  nome: string;
  colore: string;
}

interface Operatore {
  id: string;
  nome: string;
  colore: string;
}

interface Appointment {
  id: string;
  sede_id: string;
  operatore_id: string;
  data: string;
  ora: string;
  cliente: string;
  mese: string;
  note?: string;
}

interface GiornoChiuso {
  id: number;
  data: string;
  operatore_id: string | null;
  motivo: string | null;
}

// ─── Slot per sede ────────────────────────────────────────────────────────────
const TIME_SLOTS_IMOLA: string[] = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00',
];
const TIME_SLOTS_CSPT: string[] = [
  '14:00','14:30','15:00','15:30','16:00','16:30',
];
const TIME_SLOTS_BORGO: string[] = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
];
const IMOLA_SPECIAL_SLOTS: string[] = ['08:00'];

const getTimeSlotsForSede = (sedeId: string): string[] => {
  if (sedeId === 'cspt')  return TIME_SLOTS_CSPT;
  if (sedeId === 'borgo') return TIME_SLOTS_BORGO;
  return TIME_SLOTS_IMOLA;
};

const getOperatorsForSedeId = (sedeId: string, allOperators: string[]): string[] => {
  if (sedeId === 'cspt' || sedeId === 'borgo')
    return allOperators.filter(op => op.toUpperCase() === 'LOREDANA');
  return allOperators;
};

// ─── Regole MILECE ────────────────────────────────────────────────────────────
const MILECE_WORKING_DAYS = [2, 3, 5];
const MILECE_START_TIME   = '08:30';

// ─── Helpers data ─────────────────────────────────────────────────────────────
const dateStrToLocal = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const getWeekOfMonthFromFirstMonday = (date: Date): number => {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  const mondayD = d - (dow + 6) % 7;
  const dowFirst = new Date(y, m, 1, 12).getDay();
  const offsetMonFirst = (dowFirst + 6) % 7;
  const firstMondayD = offsetMonFirst === 0 ? 1 : 8 - offsetMonFirst;
  const diffDays = mondayD - firstMondayD;
  if (diffDays < 0) return 0;
  return Math.round(diffDays / 7) + 1;
};

const BORGO_EXCEPTIONS: Record<string, number[]> = {
  '2026-9':  [8, 15],
  '2026-10': [6, 20],
  '2026-12': [15],
};

const isBorgoWorkingDay = (date: Date): boolean => {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  if (dow !== 2) return false;
  const exKey = `${y}-${m + 1}`;
  if (BORGO_EXCEPTIONS[exKey] !== undefined) return BORGO_EXCEPTIONS[exKey].includes(d);
  const week = getWeekOfMonthFromFirstMonday(date);
  return week === 2 || week === 3;
};

type ViewMode = 'daily' | 'monthly';
type DayAvailability = 'free' | 'partial' | 'full' | 'closed';

// ─── Costanti scroll ──────────────────────────────────────────────────────────
const MAX_VISIBLE_DAYS    = 30;
const DAYS_PAST           = 3;
const DAYS_FUTURE         = 10;
const DAYS_TO_LOAD        = 5;
const MIN_DATE            = new Date(2026, 0, 1);
const SCROLL_THRESHOLD_FW = 400;
const SCROLL_THRESHOLD_BK = 200;
const SSE_RELOAD_DEBOUNCE = 800;

// ─── Colore unico operatori ───────────────────────────────────────────────────
const OPERATOR_COLOR = '#005CA9';

export default function EpasaCalendar({ agendaId }: EpasaCalendarProps) {
  const [selectedDate, setSelectedDate]       = useState(new Date());
  const [sedi, setSedi]                       = useState<Sede[]>([]);
  const [operatori, setOperatori]             = useState<Operatore[]>([]);
  const [selectedSede, setSelectedSede]       = useState<Sede | null>(null);
  const [visibleDays, setVisibleDays]         = useState<Date[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [giorniChiusi, setGiorniChiusi]       = useState<GiornoChiuso[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [showDatePicker, setShowDatePicker]   = useState(false);
  const [showModal, setShowModal]             = useState(false);
  const [selectedSlot, setSelectedSlot]       = useState<{ date: string; time: string; operator?: string } | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewMode, setViewMode]               = useState<ViewMode>('daily');
  const [isInitialized, setIsInitialized]     = useState(false);
  const [editMode, setEditMode]               = useState(false);
  const [selectedMonthlyOperator, setSelectedMonthlyOperator] = useState<string | null>(null);
  const [realtimeFlash, setRealtimeFlash]     = useState(false);
  const [showLoredanaView, setShowLoredanaView] = useState(false);

  // ─── Search state ─────────────────────────────────────────────────────────
  const [showSearch, setShowSearch]           = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResults, setSearchResults]     = useState<Appointment[]>([]);

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleDaysRef     = useRef<Date[]>([]);
  const loadingDirRef      = useRef<'idle' | 'fw' | 'bk'>('idle');
  const anchorDateStrRef   = useRef<string | null>(null);
  const sseReloadTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const viewModeRef        = useRef<ViewMode>('daily');
  const searchInputRef     = useRef<HTMLInputElement>(null);

  useEffect(() => { visibleDaysRef.current = visibleDays; }, [visibleDays]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  const formatDate         = (d: Date) => format(d, 'yyyy-MM-dd');
  const isMileceWorkingDay = (d: Date) => MILECE_WORKING_DAYS.includes(getDay(d));
  const currentTimeSlots   = selectedSede ? getTimeSlotsForSede(selectedSede.id) : TIME_SLOTS_IMOLA;

  // ─── Shortcut Ctrl+K per aprire la ricerca ────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape' && showSearch) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // ─── Funzione ricerca ─────────────────────────────────────────────────────
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.toLowerCase().trim();
    const results = allAppointments.filter(a =>
      a.cliente.trim().toUpperCase() !== 'UFF CHIUSO' && (
        a.cliente.toLowerCase().includes(q) ||
        (a.note?.toLowerCase().includes(q)) ||
        a.operatore_id.toLowerCase().includes(q) ||
        a.data.includes(q) ||
        a.sede_id.toLowerCase().includes(q)
      )
    );
    results.sort((a, b) => b.data.localeCompare(a.data));
    setSearchResults(results.slice(0, 50));
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ─── Business logic ───────────────────────────────────────────────────────
  const isMileceTimeBlocked = (operator: string, day: Date, time: string) => {
    if (operator !== 'MILECE') return false;
    if (!isMileceWorkingDay(day)) return false;
    return TIME_SLOTS_IMOLA.indexOf(time) < TIME_SLOTS_IMOLA.indexOf(MILECE_START_TIME);
  };

  const isSedeOperatorDayClosed = (sedeId: string, operator: string, day: Date) => {
    if (isWeekend(day)) return true;
    if (sedeId === 'cspt')  return getDay(day) !== 1;
    if (sedeId === 'borgo') return !isBorgoWorkingDay(day);
    if (sedeId === 'imola' && operator === 'MILECE') return !isMileceWorkingDay(day);
    return false;
  };

  const isGiornoChiuso = (dateStr: string, operatoreId: string) =>
    giorniChiusi.some(g => g.data === dateStr && (g.operatore_id === null || g.operatore_id === operatoreId));

  const getUffChiusoApts = (dateStr: string, time: string, operatoreId: string): Appointment[] => {
    if (!selectedSede) return [];
    return allAppointments.filter(
      a => a.sede_id === selectedSede.id && a.data === dateStr &&
           a.ora === time && a.operatore_id === operatoreId &&
           a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
    );
  };

  const isUffChiusoSlot = (dateStr: string, time: string, operatoreId: string): boolean => {
    if (!selectedSede) return false;
    const s = allAppointments.filter(
      a => a.sede_id === selectedSede.id && a.data === dateStr &&
           a.ora === time && a.operatore_id === operatoreId
    );
    return s.length > 0 && s.every(a => a.cliente.trim().toUpperCase() === 'UFF CHIUSO');
  };

  const getRealAppointmentsCount = (dateStr: string, operatoreId: string) => {
    if (!selectedSede) return 0;
    return allAppointments.filter(
      a => a.sede_id === selectedSede.id && a.data === dateStr &&
           a.operatore_id === operatoreId &&
           a.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
    ).length;
  };

  const getUffChiusoSlotsCount = (dateStr: string, operatoreId: string) => {
    if (!selectedSede) return 0;
    return getTimeSlotsForSede(selectedSede.id)
      .filter(t => isUffChiusoSlot(dateStr, t, operatoreId)).length;
  };

  // ─── Scroll helpers ───────────────────────────────────────────────────────
  const scrollToDate = (date: Date, behavior: ScrollBehavior = 'smooth') => {
    const el = document.querySelector<HTMLElement>(`[data-epasa-date="${formatDate(date)}"]`);
    if (el) el.scrollIntoView({ behavior, block: 'start' });
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

  // ─── Load forward ─────────────────────────────────────────────────────────
  const loadMoreDaysForward = useCallback(() => {
    if (loadingDirRef.current !== 'idle') return;
    loadingDirRef.current = 'fw';
    setVisibleDays(prev => {
      const last = prev[prev.length - 1];
      const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => addDays(last, i + 1));
      let updated = [...prev, ...newDays];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(updated.length - MAX_VISIBLE_DAYS);
      return updated;
    });
  }, []);

  // ─── Load backward ────────────────────────────────────────────────────────
  const loadMoreDaysBackward = useCallback(() => {
    if (loadingDirRef.current !== 'idle') return;
    const days = visibleDaysRef.current;
    const firstDay = days[0];
    if (!firstDay || startOfDay(firstDay) <= startOfDay(MIN_DATE)) return;

    const container = scrollContainerRef.current;
    let anchorDate = firstDay;
    if (container) {
      const containerTop = container.getBoundingClientRect().top;
      const rows = container.querySelectorAll<HTMLElement>('[data-epasa-date]');
      for (const row of Array.from(rows)) {
        if (row.getBoundingClientRect().top >= containerTop - 5) {
          const ds = row.getAttribute('data-epasa-date');
          if (ds) { anchorDate = dateStrToLocal(ds); break; }
        }
      }
    }
    anchorDateStrRef.current = formatDate(anchorDate);
    loadingDirRef.current = 'bk';

    const newDays: Date[] = [];
    for (let i = DAYS_TO_LOAD; i > 0; i--) {
      const d = subDays(firstDay, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) newDays.push(d);
    }
    if (newDays.length === 0) { loadingDirRef.current = 'idle'; return; }

    setVisibleDays(prev => {
      let updated = [...newDays, ...prev];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(0, MAX_VISIBLE_DAYS);
      return updated;
    });
  }, []);

  // ─── Effect su visibleDays ────────────────────────────────────────────────
  useEffect(() => {
    const dir = loadingDirRef.current;
    if (dir === 'idle') return;

    if (dir === 'bk') {
      const anchor = anchorDateStrRef.current;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (anchor) {
          const el = document.querySelector<HTMLElement>(`[data-epasa-date="${anchor}"]`);
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        anchorDateStrRef.current = null;
        loadingDirRef.current = 'idle';
      }));
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        loadingDirRef.current = 'idle';
      }));
    }
  }, [visibleDays]);

  // ─── Listener scroll ──────────────────────────────────────────────────────
  const onScroll = useCallback(() => {
    if (viewModeRef.current !== 'daily') return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_FW) {
      loadMoreDaysForward();
    }
    if (scrollTop < SCROLL_THRESHOLD_BK) {
      loadMoreDaysBackward();
    }
  }, [loadMoreDaysForward, loadMoreDaysBackward]);

  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.removeEventListener('scroll', onScroll);
    }
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
    }
  }, [onScroll]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) {
      setVisibleDays(buildWindowAround(selectedDate));
      setIsInitialized(true);
      setTimeout(() => scrollToDate(selectedDate, 'instant'), 200);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSede) {
      const imola = sedi.find(s => s.id === 'imola');
      setSelectedSede(imola || sedi[0]);
    }
  }, [sedi, selectedSede]);

  // ─── SSE realtime ─────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/epasa/events');
    es.addEventListener('update', () => {
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
      sseReloadTimerRef.current = setTimeout(async () => {
        try {
          const [appRes, gcRes] = await Promise.all([
            fetch('/api/epasa/appuntamenti'),
            fetch('/api/epasa/giorni-chiusi'),
          ]);
          const [appData, gcData] = await Promise.all([appRes.json(), gcRes.json()]);
          if (appData) setAllAppointments(appData);
          if (gcData && Array.isArray(gcData)) setGiorniChiusi(gcData);
          setRealtimeFlash(true);
          setTimeout(() => setRealtimeFlash(false), 1500);
        } catch { /* silenzioso */ }
      }, SSE_RELOAD_DEBOUNCE);
    });
    es.onerror = () => {};
    return () => {
      es.close();
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
    };
  }, []);

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [sediRes, opRes, appRes, gcRes] = await Promise.all([
        fetch('/api/epasa/sedi'),
        fetch('/api/epasa/operatori'),
        fetch('/api/epasa/appuntamenti'),
        fetch('/api/epasa/giorni-chiusi'),
      ]);
      const [sediData, opData, appData, gcData] = await Promise.all([
        sediRes.json(), opRes.json(), appRes.json(), gcRes.json(),
      ]);
      if (sediData) setSedi(sediData);
      if (opData)   setOperatori(opData);
      if (appData)  setAllAppointments(appData);
      if (gcData && Array.isArray(gcData)) setGiorniChiusi(gcData);
    } catch (e) {
      console.error('Errore caricamento dati:', e);
    } finally {
      setLoading(false);
    }
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const handleCreateAppointment = async (data: any) => {
    try {
      const res = await fetch('/api/epasa/appuntamenti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const newApt = await res.json();
      setAllAppointments(prev => [...prev, newApt]);
    } catch { alert("Errore durante la creazione dell'appuntamento"); }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/epasa/appuntamenti/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAllAppointments(prev => prev.map(a => a.id === id ? updated : a));
    } catch { alert("Errore durante l'aggiornamento dell'appuntamento"); }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      const res = await fetch(`/api/epasa/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAllAppointments(prev => prev.filter(a => a.id !== id));
    } catch { alert("Errore durante l'eliminazione dell'appuntamento"); }
  };

  const handleEditModeSlotClick = async (dateStr: string, time: string, operator: string) => {
    if (!selectedSede) return;
    const uffApts = getUffChiusoApts(dateStr, time, operator);
    if (uffApts.length > 0) {
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
        } catch { alert('Errore durante lo sblocco'); return; }
      }
      setAllAppointments(prev => prev.filter(a => !uffApts.some(u => u.id === a.id)));
    } else {
      const existing = allAppointments.filter(
        a => a.sede_id === selectedSede.id && a.data === dateStr &&
             a.ora === time && a.operatore_id === operator
      );
      const deletedIds: string[] = [];
      for (const apt of existing) {
        try {
          const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
          deletedIds.push(apt.id);
        } catch { alert('Errore durante il blocco'); return; }
      }
      setAllAppointments(prev => prev.filter(a => !deletedIds.includes(a.id)));
      try {
        const res = await fetch('/api/epasa/appuntamenti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sede_id: selectedSede.id, operatore_id: operator,
            data: dateStr, ora: time,
            cliente: 'UFF CHIUSO', mese: dateStr.substring(0, 7),
          }),
        });
        if (!res.ok) throw new Error();
        const newApt = await res.json();
        setAllAppointments(prev => [...prev, newApt]);
      } catch { alert('Errore durante il blocco'); }
    }
  };

  const openModalForNewAppointment = (date: string, time: string, operator: string) => {
    setSelectedSlot({ date, time, operator });
    setEditingAppointment(null);
    setShowModal(true);
  };

  const openModalForEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedSlot({ date: appointment.data, time: appointment.ora, operator: appointment.operatore_id });
    setShowModal(true);
  };

  const getAppointmentsForSlot = (date: string, time: string, operator: string) => {
    if (!selectedSede) return [];
    return allAppointments.filter(
      a => a.sede_id === selectedSede.id && a.data === date &&
           a.ora === time && a.operatore_id === operator
    );
  };

  const getDayAvailability = (date: string, operator: string): DayAvailability => {
    if (!selectedSede) return 'free';
    const dateObj = dateStrToLocal(date);
    if (isSedeOperatorDayClosed(selectedSede.id, operator, dateObj)) return 'closed';
    if (isGiornoChiuso(date, operator)) return 'closed';
    const slots = getTimeSlotsForSede(selectedSede.id);
    const timeBlockedCount = slots.filter(t => isMileceTimeBlocked(operator, dateObj, t)).length;
    const specialSlotCount = (selectedSede.id === 'imola' && operator !== 'MILECE')
      ? slots.filter(t => IMOLA_SPECIAL_SLOTS.includes(t)).length : 0;
    const totalSlots    = slots.length - timeBlockedCount - specialSlotCount;
    const occupiedSlots = getRealAppointmentsCount(date, operator) + getUffChiusoSlotsCount(date, operator);
    if (occupiedSlots === 0)         return 'free';
    if (occupiedSlots >= totalSlots) return 'full';
    return 'partial';
  };

  const getFirstAvailableDay = (operator: string): string | null => {
    if (!selectedSede) return null;
    const today = new Date();
    for (let i = 0; i < 180; i++) {
      const d = addDays(today, i);
      if (isWeekend(d)) continue;
      if (isSedeOperatorDayClosed(selectedSede.id, operator, d)) continue;
      const s = format(d, 'yyyy-MM-dd');
      if (isGiornoChiuso(s, operator)) continue;
      const av = getDayAvailability(s, operator);
      if (av === 'free' || av === 'partial') return s;
    }
    return null;
  };

  const getOperatorsForSede = () => {
    if (!selectedSede) return [];
    return getOperatorsForSedeId(selectedSede.id, operatori.map(op => op.id).sort());
  };
  const operatorsInSede = getOperatorsForSede();

  const activeMonthlyOperator = selectedMonthlyOperator && operatorsInSede.includes(selectedMonthlyOperator)
    ? selectedMonthlyOperator
    : operatorsInSede[0] ?? null;

  const getSedeOrariLabel = () => {
    if (!selectedSede) return '';
    if (selectedSede.id === 'cspt')  return 'Lunedì 14:00-16:30';
    if (selectedSede.id === 'borgo') return 'Martedì (sett. 2 e 3) 9:00-11:30';
    return 'Lun-Ven 8:00-12:00';
  };

  const handlePreviousDay = () => {
    const d = subDays(selectedDate, 1);
    if (d >= MIN_DATE) navigateToDate(d);
  };
  const handlePreviousMonth = () => {
    const d = subMonths(selectedDate, 1);
    if (d >= MIN_DATE) setSelectedDate(d);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  VISTA MENSILE
  // ═══════════════════════════════════════════════════════════════════════════
  const renderMonthlyView = () => {
    if (!activeMonthlyOperator) return null;
    const operator = activeMonthlyOperator;
    const operatorColor = OPERATOR_COLOR;
    const fa = getFirstAvailableDay(operator);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd   = endOfMonth(selectedDate);
    const allCalDays = eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end:   endOfWeek(monthEnd,   { weekStartsOn: 1 }),
    });
    const weeks: Date[][] = [];
    for (let i = 0; i < allCalDays.length; i += 7) weeks.push(allCalDays.slice(i, i + 7));
    const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    return (
      <div className="p-3 md:p-4">
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {operatorsInSede.length > 1 && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
              <User size={16} className="text-gray-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Operatore</span>
              <div className="flex items-center gap-1">
                {operatorsInSede.map(op => {
                  const isActive = op === activeMonthlyOperator;
                  return (
                    <button key={op} onClick={() => setSelectedMonthlyOperator(op)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        isActive ? 'text-white shadow-md scale-105' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                      }`}
                      style={isActive ? { backgroundColor: OPERATOR_COLOR } : {}}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : OPERATOR_COLOR }}>
                        <User size={11} className="text-white" />
                      </div>
                      {op}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {operatorsInSede.length === 1 && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: operatorColor }}>
                <User size={14} className="text-white" />
              </div>
              <span className="font-bold text-sm" style={{ color: operatorColor }}>{operator}</span>
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            {fa && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                <CalendarIcon size={12} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">
                  Primo libero: {format(dateStrToLocal(fa), 'dd/MM', { locale: it })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
              {[['bg-green-500','Libero'],['bg-yellow-400','Parziale'],['bg-red-500','Pieno'],['bg-gray-300','Chiuso']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded ${c}`}/><span className="text-[11px] text-gray-600">{l}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAY_NAMES.map((name, idx) => (
              <div key={name} className={`py-2 text-center text-xs font-bold uppercase tracking-wider ${
                idx >= 5 ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-600'
              }`}>{name}</div>
            ))}
          </div>
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: '80px' }}>
              {week.map((day, dIdx) => {
                const dateStr = formatDate(day);
                const isThisMonth = getMonth(day) === getMonth(selectedDate);
                if (!isThisMonth) return (
                  <div key={dateStr} className={`p-1.5 border-r border-gray-100 last:border-r-0 ${
                    dIdx >= 5 ? 'bg-gray-100' : 'bg-gray-50'
                  }`} />
                );
                const isToday  = formatDate(new Date()) === dateStr;
                const isWe     = isWeekend(day);
                const isBefore = day < MIN_DATE;
                const av       = getDayAvailability(dateStr, operator);
                const isClosed = isWe || av === 'closed';
                let freeSlots  = 0;
                if (!isClosed && selectedSede) {
                  const slots   = getTimeSlotsForSede(selectedSede.id);
                  const dateObj = dateStrToLocal(dateStr);
                  const tbc = slots.filter(t => isMileceTimeBlocked(operator, dateObj, t)).length;
                  const ssc = (selectedSede.id === 'imola' && operator !== 'MILECE')
                    ? slots.filter(t => IMOLA_SPECIAL_SLOTS.includes(t)).length : 0;
                  freeSlots = Math.max(0,
                    slots.length - tbc - ssc -
                    getRealAppointmentsCount(dateStr, operator) -
                    getUffChiusoSlotsCount(dateStr, operator)
                  );
                }
                const avBg     = isClosed ? (isWe ? 'bg-gray-100' : 'bg-gray-50') :
                  av === 'free' ? 'bg-green-50' : av === 'partial' ? 'bg-yellow-50' : 'bg-red-50';
                const avBorder = isClosed ? '' :
                  av === 'free' ? 'border-t-2 border-green-400' :
                  av === 'partial' ? 'border-t-2 border-yellow-400' : 'border-t-2 border-red-500';
                const avDot    = av === 'free' ? 'bg-green-500' : av === 'partial' ? 'bg-yellow-400' :
                  av === 'full' ? 'bg-red-500' : 'bg-gray-300';
                return (
                  <div key={dateStr}
                    onClick={() => { if (!isClosed && !isBefore) { navigateToDate(day); setViewMode('daily'); } }}
                    className={`relative p-1.5 border-r border-gray-100 last:border-r-0 transition-all ${avBg} ${avBorder} ${
                      !isClosed && !isBefore ? 'cursor-pointer hover:brightness-95' : ''
                    } ${isBefore && !isClosed ? 'opacity-40' : ''}`}
                    title={isClosed ? 'Chiuso' : freeSlots > 0
                      ? `${operator} - ${format(day,'dd/MM/yyyy')} - ${freeSlots} slot liber${freeSlots===1?'o':'i'}`
                      : `${operator} - ${format(day,'dd/MM/yyyy')} - Pieno`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-[#005CA9] text-white' : isWe ? 'text-gray-400' : 'text-gray-700'
                      }`}>{format(day, 'd')}</span>
                      {!isClosed && <div className={`w-2 h-2 rounded-full mt-1 ${avDot}`} />}
                    </div>
                    {!isClosed && freeSlots > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-green-700">
                          {freeSlots} liber{freeSlots === 1 ? 'o' : 'i'}
                        </span>
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  VISTA GIORNALIERA
  // ═══════════════════════════════════════════════════════════════════════════
  const renderDailyView = () => (
    <div>
      {editMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b-2 border-amber-400">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">
              Modalità modifica attiva — clicca uno slot per bloccarlo o sbloccarlo
            </span>
          </div>
          <button onClick={() => setEditMode(false)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full transition-colors flex items-center gap-1">
            <X size={12} /> Esci
          </button>
        </div>
      )}
      <div
        ref={setScrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: editMode ? 'calc(100vh - 145px)' : 'calc(100vh - 107px)' }}
      >
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2 border-[#005CA9]/20">
              <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200" style={{ width: '60px' }}>
                <span className="text-[#005CA9]">Orario</span>
              </th>
              {operatorsInSede.length > 0 ? operatorsInSede.map(operator => (
                <th key={operator} className="p-2 text-center text-xs font-semibold bg-[#F5F8FA]">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: OPERATOR_COLOR }}>
                      <User size={14} className="text-white" />
                    </div>
                    <span style={{ color: OPERATOR_COLOR }} className="font-bold">{operator}</span>
                  </div>
                </th>
              )) : (
                <th className="p-2 text-center text-xs text-gray-500">Nessun operatore per questa sede</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(day => {
              const dateStr = formatDate(day);
              const isToday = formatDate(new Date()) === dateStr;
              const isWe    = isWeekend(day);
              return (
                <React.Fragment key={dateStr}>
                  <tr data-epasa-date={dateStr}>
                    <td
                      colSpan={Math.max(operatorsInSede.length + 1, 2)}
                      className={`p-2 text-center font-bold text-sm sticky left-0 z-10 ${
                        isToday ? 'bg-[#005CA9] text-white' :
                        isWe    ? 'bg-gray-300 text-gray-600' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {format(day, 'EEEE dd MMMM yyyy', { locale: it })}
                      {isWe && <span className="ml-2 text-xs">(CHIUSO)</span>}
                    </td>
                  </tr>
                  {!isWe && currentTimeSlots.map(time => (
                    <tr key={`${dateStr}-${time}`}>
                      <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100"
                        style={{ width: '60px', height: '45px' }}>
                        <div className="px-1 py-2 text-xs font-semibold text-gray-700">{time}</div>
                      </td>
                      {operatorsInSede.length > 0 ? operatorsInSede.map(operator => {
                        const slotApts    = getAppointmentsForSlot(dateStr, time, operator);
                        const dayLocal    = dateStrToLocal(dateStr);
                        const isDayClosed = isSedeOperatorDayClosed(selectedSede!.id, operator, dayLocal);
                        const isManually  = isGiornoChiuso(dateStr, operator);
                        const isMTC       = isMileceTimeBlocked(operator, dayLocal, time);
                        const isUffC      = isUffChiusoSlot(dateStr, time, operator);

                        if (isDayClosed || isManually) {
                          const title = isDayClosed
                            ? (selectedSede!.id === 'cspt' ? 'CSPT: aperto solo il lunedì pomeriggio'
                              : selectedSede!.id === 'borgo' ? 'Borgo: martedì della 2ª e 3ª settimana'
                              : operator === 'MILECE' ? 'MILECE non lavora questo giorno' : 'Ufficio chiuso')
                            : 'Ufficio chiuso';
                          return (
                            <td key={`${operator}-${time}`}
                              className="relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 select-none"
                              style={{ height: '45px' }} title={title}>
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                  <Lock size={9} /> chiuso
                                </span>
                              </div>
                            </td>
                          );
                        }
                        if (isMTC) return (
                          <td key={`${operator}-${time}`}
                            className="relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 select-none"
                            style={{ height: '45px' }} title="MILECE inizia alle 08:30">
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                <Lock size={9} /> chiuso
                              </span>
                            </div>
                          </td>
                        );
                        if (isUffC) return (
                          <td key={`${operator}-${time}`}
                            className={`relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 ${
                              editMode ? 'cursor-pointer hover:bg-gray-200' : 'select-none'
                            }`}
                            style={{ height: '45px' }}
                            title={editMode ? 'Clicca per sbloccare' : 'Ufficio chiuso'}
                            onClick={() => editMode && handleEditModeSlotClick(dateStr, time, operator)}>
                            <div className="w-full h-full flex items-center justify-center gap-1">
                              <Lock size={9} className="text-gray-400" />
                              <span className="text-[10px] text-gray-400 font-medium">uff. chiuso</span>
                              {editMode && <Unlock size={9} className="text-amber-400 ml-1" />}
                            </div>
                          </td>
                        );
                        if (slotApts.length > 0) {
                          const colors = { bg:'bg-blue-50', border:'border-l-4 border-blue-500', text:'text-blue-700', hover:'hover:bg-blue-100' };
                          return (
                            <td key={`${operator}-${time}`}
                              className="relative p-0 border-r border-gray-100 border-b border-gray-100 group"
                              style={{ height: '45px' }}>
                              <div
                                onClick={() => editMode
                                  ? handleEditModeSlotClick(dateStr, time, operator)
                                  : openModalForEditAppointment(slotApts[0])}
                                className={`w-full h-full px-2 py-1 ${
                                  editMode
                                    ? 'bg-gray-50 border-l-4 border-amber-400 hover:bg-amber-50 cursor-pointer'
                                    : `${colors.bg} ${colors.border} ${colors.hover} cursor-pointer`
                                } transition-all flex items-center`}
                                title={editMode ? 'Clicca per bloccare questo slot' : undefined}>
                                <div className="w-full">
                                  {editMode ? (
                                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                      <Lock size={9} /> blocca
                                    </span>
                                  ) : slotApts.map((apt, idx) => (
                                    <div key={apt.id} className={`flex items-center gap-1.5 ${idx > 0 ? 'mt-1' : ''}`}>
                                      <User size={10} className={`${colors.text} flex-shrink-0`} />
                                      <span className={`text-[10px] font-medium truncate ${colors.text}`}>{apt.cliente}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={`${operator}-${time}`}
                            className="relative p-0 border-r border-gray-100 border-b border-gray-100 group"
                            style={{ height: '45px' }}>
                            <div
                              onClick={() => editMode
                                ? handleEditModeSlotClick(dateStr, time, operator)
                                : openModalForNewAppointment(dateStr, time, operator)}
                              className={`w-full h-full transition-colors cursor-pointer flex items-center justify-center ${
                                editMode
                                  ? 'hover:bg-amber-50 group-hover:bg-amber-50'
                                  : 'hover:bg-blue-50/30 group-hover:bg-blue-50'
                              }`}
                              title={editMode ? 'Clicca per bloccare questo slot' : undefined}>
                              {editMode
                                ? <Lock size={12} className="text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                : <Plus size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </td>
                        );
                      }) : (
                        <td className="p-2 text-center text-xs text-gray-400">-</td>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto" />
        <p className="mt-4 text-gray-600 font-medium">Caricamento agenda EPASA...</p>
      </div>
    </div>
  );

  if (!selectedSede) return (
    <div className="flex items-center justify-center h-96">
      <p className="text-gray-600">Nessuna sede disponibile</p>
    </div>
  );

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">

          {/* ── HEADER ── */}
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
                  <CalendarIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-[#005CA9]">EPASA - {selectedSede.nome}</h1>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-500 ${
                      realtimeFlash
                        ? 'bg-green-100 text-green-700 border border-green-300 scale-105'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        realtimeFlash ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                      {realtimeFlash ? 'Aggiornato' : 'Live'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{getSedeOrariLabel()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* ── Pulsante Ricerca ── */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all bg-white border-2 border-gray-200 text-gray-600 hover:border-[#005CA9] hover:text-[#005CA9]"
                  title="Cerca appuntamenti (Ctrl+K)"
                >
                  <Search size={15} /> Cerca
                </button>

                <button onClick={() => setShowLoredanaView(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all bg-blue-50 border-2 border-[#005CA9] text-[#005CA9] hover:bg-blue-100 hover:border-[#004080] hover:shadow-md"
                  title="Apri la vista mensile di Loredana">
                  <Eye size={15} /> Vista Loredana
                </button>

                <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
                  <button onClick={() => setViewMode('daily')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'daily' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
                  }`}><List className="w-4 h-4 inline mr-1" />Giornaliera</button>
                  <button onClick={() => setViewMode('monthly')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'monthly' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
                  }`}><LayoutGrid className="w-4 h-4 inline mr-1" />Mensile</button>
                </div>

                <div className="relative group">
                  <button onClick={() => setEditMode(e => !e)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-all border-2 ${
                      editMode
                        ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 shadow-lg scale-110'
                        : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
                    }`}
                    title={editMode ? 'Disattiva modalità modifica' : 'Attiva modalità modifica'}>
                    {editMode ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30">
                    {editMode ? 'Esci dalla modifica' : 'Modifica slot'}
                  </div>
                </div>

                <button onClick={viewMode === 'daily' ? handlePreviousDay : handlePreviousMonth}
                  disabled={selectedDate <= MIN_DATE}
                  className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>

                <button onClick={() => setShowDatePicker(!showDatePicker)}
                  className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] transition-colors cursor-pointer min-w-[220px] text-center">
                  <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                    {viewMode === 'daily'
                      ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it })
                      : format(selectedDate, 'MMMM yyyy', { locale: it })}
                  </span>
                </button>

                <button onClick={() => viewMode === 'daily'
                  ? navigateToDate(addDays(selectedDate, 1))
                  : setSelectedDate(addMonths(selectedDate, 1))}
                  className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200">
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Building2 className="w-5 h-5 text-[#005CA9]" />
                  <div className="relative">
                    <select value={selectedSede.id}
                      onChange={e => { const s = sedi.find(x => x.id === e.target.value); if (s) setSelectedSede(s); }}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none">
                      {sedi.map(s => <option key={s.id} value={s.id} className="text-gray-800 bg-white">{s.nome}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#005CA9] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'daily' ? renderDailyView() : renderMonthlyView()}
        </div>
      </div>

      {/* ── SEARCH OVERLAY ── */}
      {showSearch && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16"
          onClick={(e) => { if (e.target === e.currentTarget) closeSearch(); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border-t-4 border-[#005CA9]">

            {/* Header ricerca */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <Search size={18} className="text-[#005CA9] flex-shrink-0" />
              <input
                ref={searchInputRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Cerca cliente, operatore, data (es. 2026-03)..."
                className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); searchInputRef.current?.focus(); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={closeSearch}
                className="text-gray-400 hover:text-gray-700 transition-colors ml-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Risultati */}
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
                  <p className="text-sm text-gray-400">Nessun risultato per <strong>"{searchQuery}"</strong></p>
                </div>
              )}
              {searchResults.map(apt => {
                const sede = sedi.find(s => s.id === apt.sede_id);
                return (
                  <div
                    key={apt.id}
                    onClick={() => {
                      navigateToDate(dateStrToLocal(apt.data));
                      setViewMode('daily');
                      closeSearch();
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#E6F2FF] cursor-pointer border-b border-gray-100 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <User size={15} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{apt.cliente}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-[#005CA9]">{apt.operatore_id}</span>
                        {' · '}{sede?.nome || apt.sede_id}
                        {' · '}{format(dateStrToLocal(apt.data), 'dd/MM/yyyy', { locale: it })}
                        {' · '}{apt.ora}
                      </p>
                      {apt.note && (
                        <p className="text-xs text-gray-400 truncate mt-0.5 italic">{apt.note}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-[#005CA9] transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>

            {/* Footer */}
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
      )}

      {showLoredanaView && (
        <LoredanaView
          onClose={() => setShowLoredanaView(false)}
          allAppointments={allAppointments}
          giorniChiusi={giorniChiusi}
          sedi={sedi}
          operatori={operatori}
          onSave={handleCreateAppointment}
          onUpdate={handleUpdateAppointment}
          onDelete={handleDeleteAppointment}
        />
      )}

      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#005CA9]">Seleziona Data</h3>
              <button onClick={() => setShowDatePicker(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={handlePreviousMonth} disabled={selectedDate <= MIN_DATE}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft size={20} className="text-[#005CA9]" />
              </button>
              <h4 className="text-lg font-bold text-gray-800 capitalize">
                {format(selectedDate, 'MMMM yyyy', { locale: it })}
              </h4>
              <button type="button" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight size={20} className="text-[#005CA9]" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-600 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {(() => {
                const ms = startOfMonth(selectedDate);
                const days = eachDayOfInterval({ start: ms, end: endOfMonth(selectedDate) });
                const firstDow = (getDay(ms) + 6) % 7;
                return (
                  <>
                    {Array(firstDow).fill(null).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
                    {days.map((day, i) => {
                      const isSel = formatDate(day) === formatDate(selectedDate);
                      const isTod = formatDate(day) === formatDate(new Date());
                      const isBef = day < MIN_DATE;
                      const isWe  = isWeekend(day);
                      return (
                        <button key={i} type="button"
                          onClick={() => { if (!isBef) { navigateToDate(day); setShowDatePicker(false); } }}
                          disabled={isBef}
                          className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                            isBef ? 'bg-transparent text-gray-300 cursor-not-allowed' :
                            isSel ? 'bg-[#005CA9] text-white shadow-md scale-105' :
                            isTod ? 'bg-[#E6F2FF] text-[#005CA9] font-bold' :
                            isWe  ? 'bg-gray-200 text-gray-400' :
                                    'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105'
                          } ${!isBef ? 'cursor-pointer' : ''}`}>
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <button type="button"
              onClick={() => { navigateToDate(new Date()); setShowDatePicker(false); }}
              className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold">
              Vai a Oggi
            </button>
          </div>
        </div>
      )}

      {showModal && selectedSlot && (
        <EpasaAppointmentModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingAppointment(null); setSelectedSlot(null); }}
          onSave={handleCreateAppointment}
          onUpdate={handleUpdateAppointment}
          onDelete={handleDeleteAppointment}
          existingAppointment={editingAppointment}
          sedi={sedi}
          operatori={operatori}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          selectedSedeId={selectedSede.id}
          defaultOperatoreId={selectedSlot.operator}
        />
      )}
    </div>
  );
}
