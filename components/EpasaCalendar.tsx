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
} from 'date-fns';
import { it } from 'date-fns/locale';
import React from 'react';
import EpasaAppointmentModal from './EpasaAppointmentModal';

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

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
];

const MILECE_WORKING_DAYS = [2, 3, 5];
/** MILECE inizia alle 08:30 — lo slot 08:00 è sempre chiuso per lei */
const MILECE_START_TIME   = '08:30';

type ViewMode = 'daily' | 'monthly';
type DayAvailability = 'free' | 'partial' | 'full' | 'closed';

const MAX_VISIBLE_DAYS         = 14;
const DAYS_PAST                = 3;
const DAYS_FUTURE              = 10;
const DAYS_TO_LOAD             = 3;
const MIN_DATE                 = new Date(2026, 0, 1);
const SCROLL_THRESHOLD         = 400;
const POST_COMPENSATE_COOLDOWN = 400;

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

  const scrollContainerRef        = useRef<HTMLDivElement>(null);
  const isLoadingRef              = useRef(false);
  const scrollListenerAttachedRef = useRef(false);
  const loadTimeoutRef            = useRef<NodeJS.Timeout | null>(null);
  const visibleDaysRef            = useRef<Date[]>([]);
  const scrollSnapshotRef         = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const userScrollDirectionRef    = useRef<'up' | 'down' | null>(null);
  const lastUserScrollTopRef      = useRef(0);
  const isCompensatingRef         = useRef(false);
  const backwardCooldownRef       = useRef(false);
  const cooldownTimerRef          = useRef<NodeJS.Timeout | null>(null);
  const handleScrollRef           = useRef<() => void>(() => {});

  useEffect(() => { visibleDaysRef.current = visibleDays; }, [visibleDays]);

  // ─── helpers ────────────────────────────────────────────────────────────────

  const isWorkingDay       = (date: Date) => { const d = getDay(date); return d !== 0 && d !== 6; };
  const formatDate         = (date: Date) => format(date, 'yyyy-MM-dd');
  const isMileceWorkingDay = (date: Date) => MILECE_WORKING_DAYS.includes(getDay(date));

  /**
   * Restituisce true se lo slot è bloccato per via dell'orario di inizio di MILECE.
   * MILECE inizia alle 08:30 → lo slot 08:00 è sempre chiuso per lei nei suoi giorni lavorativi.
   * Questi slot NON concorrono al calcolo della disponibilità (sono strutturalmente esclusi).
   */
  const isMileceTimeBlocked = (operator: string, day: Date, time: string): boolean => {
    if (operator !== 'MILECE') return false;
    if (!isMileceWorkingDay(day)) return false;
    return TIME_SLOTS.indexOf(time) < TIME_SLOTS.indexOf(MILECE_START_TIME);
  };

  const isGiornoChiuso = (dateStr: string, operatoreId: string): boolean =>
    giorniChiusi.some(g => g.data === dateStr && (g.operatore_id === null || g.operatore_id === operatoreId));

  const getUffChiusoApts = (dateStr: string, time: string, operatoreId: string): Appointment[] => {
    if (!selectedSede) return [];
    return allAppointments.filter(
      apt => apt.sede_id === selectedSede.id && apt.data === dateStr &&
             apt.ora === time && apt.operatore_id === operatoreId &&
             apt.cliente.trim().toUpperCase() === 'UFF CHIUSO'
    );
  };

  const isUffChiusoSlot = (dateStr: string, time: string, operatoreId: string): boolean => {
    if (!selectedSede) return false;
    const slotApts = allAppointments.filter(
      apt => apt.sede_id === selectedSede.id && apt.data === dateStr &&
             apt.ora === time && apt.operatore_id === operatoreId
    );
    return slotApts.length > 0 && slotApts.every(a => a.cliente.trim().toUpperCase() === 'UFF CHIUSO');
  };

  /** Conta solo gli appuntamenti reali (esclude UFF CHIUSO) */
  const getRealAppointmentsCount = (dateStr: string, operatoreId: string): number => {
    if (!selectedSede) return 0;
    return allAppointments.filter(
      apt => apt.sede_id === selectedSede.id && apt.data === dateStr &&
             apt.operatore_id === operatoreId &&
             apt.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
    ).length;
  };

  /**
   * Conta gli slot UFF CHIUSO per giorno/operatore.
   * Un "TIME_SLOT" è bloccato se ha almeno un appuntamento UFF CHIUSO su quell'orario.
   */
  const getUffChiusoSlotsCount = (dateStr: string, operatoreId: string): number => {
    if (!selectedSede) return 0;
    return TIME_SLOTS.filter(time => isUffChiusoSlot(dateStr, time, operatoreId)).length;
  };

  const scrollToDate = (date: Date) => {
    const el = document.querySelector<HTMLElement>(`[data-epasa-date="${formatDate(date)}"]`);
    if (el && scrollContainerRef.current) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (visibleDays.some(d => isSameDay(d, date))) {
      setTimeout(() => scrollToDate(date), 50);
    } else {
      setVisibleDays(buildWindowAround(date));
      setTimeout(() => scrollToDate(date), 200);
    }
  }, [visibleDays]);

  // ─── scroll ──────────────────────────────────────────────────────────────────

  const loadMoreDaysForward = () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setVisibleDays(prev => {
      const lastDay = prev[prev.length - 1];
      const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => addDays(lastDay, i + 1));
      let updated = [...prev, ...newDays];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(updated.length - MAX_VISIBLE_DAYS);
      return updated;
    });
    requestAnimationFrame(() => { requestAnimationFrame(() => { isLoadingRef.current = false; }); });
  };

  const loadMoreDaysBackward = () => {
    if (isLoadingRef.current) return;
    if (backwardCooldownRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const firstDay = visibleDaysRef.current[0];
    if (!firstDay || startOfDay(firstDay) <= startOfDay(MIN_DATE)) return;
    const newDays: Date[] = [];
    for (let i = DAYS_TO_LOAD; i > 0; i--) {
      const d = subDays(firstDay, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) newDays.push(d);
    }
    if (newDays.length === 0) return;
    isLoadingRef.current = true;
    scrollSnapshotRef.current = { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight };
    setVisibleDays(prev => {
      let updated = [...newDays, ...prev];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(0, MAX_VISIBLE_DAYS);
      return updated;
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (container && scrollSnapshotRef.current) {
          const { scrollTop: snapTop, scrollHeight: snapHeight } = scrollSnapshotRef.current;
          const heightDiff = container.scrollHeight - snapHeight;
          if (heightDiff > 0) { isCompensatingRef.current = true; container.scrollTop = snapTop + heightDiff; }
          scrollSnapshotRef.current = null;
        }
        isLoadingRef.current = false;
        backwardCooldownRef.current = true;
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => { backwardCooldownRef.current = false; }, POST_COMPENSATE_COOLDOWN);
      });
    });
  };

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const currentScrollTop = container.scrollTop;
    if (isCompensatingRef.current) { isCompensatingRef.current = false; lastUserScrollTopRef.current = currentScrollTop; return; }
    if (backwardCooldownRef.current) { lastUserScrollTopRef.current = currentScrollTop; }
    if (isLoadingRef.current) return;
    const direction: 'up' | 'down' = currentScrollTop < lastUserScrollTopRef.current ? 'up' : 'down';
    lastUserScrollTopRef.current = currentScrollTop;
    userScrollDirectionRef.current = direction;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (!container || isLoadingRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromTop    = scrollTop;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const dir = userScrollDirectionRef.current;
      if (dir === 'down' && distanceFromBottom < SCROLL_THRESHOLD) loadMoreDaysForward();
      else if (dir === 'up' && distanceFromTop < SCROLL_THRESHOLD) loadMoreDaysBackward();
    }, 80);
  }, []);

  useEffect(() => { handleScrollRef.current = handleScroll; }, [handleScroll]);

  useEffect(() => {
    if (!isInitialized) {
      setVisibleDays(buildWindowAround(selectedDate));
      setIsInitialized(true);
      setTimeout(() => { scrollToDate(selectedDate); attachScrollListener(); }, 200);
    }
  }, []);

  const attachScrollListener = () => {
    const container = scrollContainerRef.current;
    if (!container || scrollListenerAttachedRef.current) return;
    const stableHandler = () => handleScrollRef.current();
    container.addEventListener('scroll', stableHandler, { passive: true });
    scrollListenerAttachedRef.current = true;
    (container as any).__scrollHandler = stableHandler;
  };

  const detachScrollListener = () => {
    const container = scrollContainerRef.current;
    if (!container || !scrollListenerAttachedRef.current) return;
    const handler = (container as any).__scrollHandler;
    if (handler) container.removeEventListener('scroll', handler);
    scrollListenerAttachedRef.current = false;
    delete (container as any).__scrollHandler;
  };

  useEffect(() => {
    if (scrollContainerRef.current && !scrollListenerAttachedRef.current && isInitialized) attachScrollListener();
    return () => {
      detachScrollListener();
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [isInitialized]);

  useEffect(() => {
    if (viewMode === 'monthly') { detachScrollListener(); if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current); }
    if (viewMode === 'daily' && !scrollListenerAttachedRef.current && isInitialized) setTimeout(() => attachScrollListener(), 100);
  }, [viewMode]);

  // ─── dati ───────────────────────────────────────────────────────────────────

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSede) {
      const imola = sedi.find(s => s.id === 'imola');
      setSelectedSede(imola || sedi[0]);
    }
  }, [sedi, selectedSede]);

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
      if (sediData)  setSedi(sediData);
      if (opData)    setOperatori(opData);
      if (appData)   setAllAppointments(appData);
      if (gcData && Array.isArray(gcData)) setGiorniChiusi(gcData);
      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
      setLoading(false);
    }
  };

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
      setAllAppointments(prev => prev.map(a => (a.id === id ? updated : a)));
    } catch { alert("Errore durante l'aggiornamento dell'appuntamento"); }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      const res = await fetch(`/api/epasa/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAllAppointments(prev => prev.filter(a => a.id !== id));
    } catch { alert("Errore durante l'eliminazione dell'appuntamento"); }
  };

  // ─── modalità modifica: blocca/sblocca slot ──────────────────────────────────

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
      const existingApts = allAppointments.filter(
        apt => apt.sede_id === selectedSede.id && apt.data === dateStr &&
               apt.ora === time && apt.operatore_id === operator
      );
      const deletedIds: string[] = [];
      for (const apt of existingApts) {
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
            sede_id: selectedSede.id,
            operatore_id: operator,
            data: dateStr,
            ora: time,
            cliente: 'UFF CHIUSO',
            mese: dateStr.substring(0, 7),
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
    return allAppointments.filter(apt =>
      apt.sede_id === selectedSede.id && apt.data === date &&
      apt.ora === time && apt.operatore_id === operator
    );
  };

  /**
   * Calcola la disponibilità giornaliera.
   * Gli slot bloccati per orario (es. 08:00 di MILECE) sono esclusi dal conteggio:
   * sono "strutturalmente chiusi" come un weekend, non indicano affollamento.
   * totalSlots = solo gli slot effettivamente prenotabili dall'operatore.
   */
  const getDayAvailability = (date: string, operator: string): DayAvailability => {
    if (!selectedSede) return 'free';
    const dateObj = new Date(date + 'T12:00:00');
    if (operator === 'MILECE' && !isMileceWorkingDay(dateObj)) return 'closed';
    if (isGiornoChiuso(date, operator)) return 'closed';

    // Slot strutturalmente bloccati per orario (esclusi dalla disponibilità)
    const timeBlockedCount = TIME_SLOTS.filter(t => isMileceTimeBlocked(operator, dateObj, t)).length;
    // Slot effettivamente disponibili per questo operatore
    const totalSlots    = TIME_SLOTS.length - timeBlockedCount;

    const realCount  = getRealAppointmentsCount(date, operator);
    const uffCount   = getUffChiusoSlotsCount(date, operator);
    const occupiedSlots = realCount + uffCount;

    if (occupiedSlots === 0) return 'free';
    if (occupiedSlots >= totalSlots * 0.8) return 'full';
    return 'partial';
  };

  const getFirstAvailableDay = (operator: string): string | null => {
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = addDays(today, i);
      if (!isWorkingDay(d)) continue;
      if (operator === 'MILECE' && !isMileceWorkingDay(d)) continue;
      const s = format(d, 'yyyy-MM-dd');
      if (isGiornoChiuso(s, operator)) continue;
      const av = getDayAvailability(s, operator);
      if (av === 'free' || av === 'partial') return s;
    }
    return null;
  };

  const getOperatorsForSede = () => operatori.map(op => op.id).sort();
  const operatorsInSede = getOperatorsForSede();

  const handlePreviousDay = () => {
    const d = subDays(selectedDate, 1);
    if (d >= MIN_DATE) navigateToDate(d);
  };

  const handlePreviousMonth = () => {
    const d = subMonths(selectedDate, 1);
    if (d >= MIN_DATE) setSelectedDate(d);
  };

  // ─── VISTA MENSILE ───────────────────────────────────────────────────────────

  const renderMonthlyView = () => {
    const days = eachDayOfInterval({
      start: startOfMonth(selectedDate),
      end:   endOfMonth(selectedDate),
    });
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-200 flex-wrap">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500" /><span className="text-xs font-medium text-gray-700">Libero</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-yellow-500" /><span className="text-xs font-medium text-gray-700">Parzialmente occupato</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500" /><span className="text-xs font-medium text-gray-700">Pieno</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-400" /><span className="text-xs font-medium text-gray-700">Chiuso / Non disponibile</span></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-b border-r">Giorno</th>
                {operatorsInSede.map(operator => {
                  const color = operator === 'MILECE' ? '#DC2626' : '#16A34A';
                  const fa = getFirstAvailableDay(operator);
                  return (
                    <th key={operator} className="p-3 text-center text-sm font-semibold border-b">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                            <User size={14} className="text-white" />
                          </div>
                          <span style={{ color }} className="font-bold">{operator}</span>
                        </div>
                        {fa && (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            Primo libero: {format(new Date(fa), 'dd/MM')}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const dateStr  = formatDate(day);
                const isToday  = formatDate(new Date()) === dateStr;
                const isWe     = isWeekend(day);
                const isBefore = day < MIN_DATE;
                return (
                  <tr key={dateStr} className="border-b hover:bg-gray-50 transition-colors">
                    <td className={`p-3 font-medium border-r ${
                      isToday ? 'bg-[#005CA9] text-white' :
                      isWe    ? 'bg-gray-200 text-gray-400' : 'text-gray-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{format(day, 'd')}</span>
                        <span className="text-xs capitalize">{format(day, 'EEE', { locale: it })}</span>
                      </div>
                    </td>
                    {operatorsInSede.map(operator => {
                      const av = getDayAvailability(dateStr, operator);
                      const isClosed = isWe || av === 'closed';
                      if (isClosed) return (
                        <td key={`${dateStr}-${operator}`} className="p-2 text-center bg-gray-200 opacity-60 select-none">
                          <span className="text-xs text-gray-500">—</span>
                        </td>
                      );
                      const bg = av === 'free' ? 'bg-green-100' : av === 'partial' ? 'bg-yellow-100' : 'bg-red-100';
                      const bd = av === 'free' ? 'border-green-500' : av === 'partial' ? 'border-yellow-500' : 'border-red-500';
                      const n    = getRealAppointmentsCount(dateStr, operator);
                      const uffN = getUffChiusoSlotsCount(dateStr, operator);
                      return (
                        <td
                          key={`${dateStr}-${operator}`}
                          className={`p-2 text-center cursor-pointer ${bg} border-l-4 ${bd} ${
                            isBefore ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'
                          }`}
                          onClick={() => { if (!isBefore) { navigateToDate(day); setViewMode('daily'); } }}
                          title={`${operator} - ${format(day, 'dd/MM/yyyy')}\n${n} appuntamenti reali, ${uffN} slot bloccati`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-gray-700">{n}</span>
                            <span className="text-xs text-gray-600">
                              {av === 'free' ? 'Vuoto' : av === 'partial' ? 'App.' : 'Pieno'}
                            </span>
                            {uffN > 0 && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Lock size={8} />{uffN}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── VISTA GIORNALIERA ───────────────────────────────────────────────────────

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
          <button
            onClick={() => setEditMode(false)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
          >
            <X size={12} /> Esci
          </button>
        </div>
      )}
      <div ref={scrollContainerRef} className="overflow-y-auto" style={{ maxHeight: editMode ? 'calc(100vh - 145px)' : 'calc(100vh - 107px)' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2 border-[#005CA9]/20">
              <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 w-[60px] border-r border-gray-200">
                <span className="text-[#005CA9]">Orario</span>
              </th>
              {operatorsInSede.length > 0 ? (
                operatorsInSede.map(operator => {
                  const color = operator === 'MILECE' ? '#DC2626' : '#16A34A';
                  return (
                    <th key={operator} className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[200px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                          <User size={14} className="text-white" />
                        </div>
                        <span style={{ color }} className="font-bold">{operator}</span>
                      </div>
                    </th>
                  );
                })
              ) : (
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
                  {!isWe && TIME_SLOTS.map(time => (
                    <tr key={`${dateStr}-${time}`}>
                      <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                        <div className="px-1 py-2 text-xs font-semibold text-gray-700">{time}</div>
                      </td>
                      {operatorsInSede.length > 0 ? (
                        operatorsInSede.map(operator => {
                          const slotApts           = getAppointmentsForSlot(dateStr, time, operator);
                          const isMileceClosed     = operator === 'MILECE' && !isMileceWorkingDay(day);
                          const isManuallyClose    = isGiornoChiuso(dateStr, operator);
                          const isMileceTimeClosed = isMileceTimeBlocked(operator, day, time);
                          const isDayClosed        = isMileceClosed || isManuallyClose;
                          const isUffChiuso        = isUffChiusoSlot(dateStr, time, operator);

                          if (isDayClosed) {
                            return (
                              <td
                                key={`${operator}-${time}`}
                                className="relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 select-none"
                                style={{ height: '45px' }}
                                title={isMileceClosed ? 'MILECE non lavora questo giorno' : 'Ufficio chiuso'}
                              >
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                    <Lock size={9} /> chiuso
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          if (isMileceTimeClosed) {
                            return (
                              <td
                                key={`${operator}-${time}`}
                                className="relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 select-none"
                                style={{ height: '45px' }}
                                title="MILECE inizia alle 08:30"
                              >
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                    <Lock size={9} /> chiuso
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          if (isUffChiuso) {
                            return (
                              <td
                                key={`${operator}-${time}`}
                                className={`relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 ${
                                  editMode ? 'cursor-pointer hover:bg-gray-200' : 'select-none'
                                }`}
                                style={{ height: '45px' }}
                                title={editMode ? 'Clicca per sbloccare' : 'Ufficio chiuso'}
                                onClick={() => editMode && handleEditModeSlotClick(dateStr, time, operator)}
                              >
                                <div className="w-full h-full flex items-center justify-center gap-1">
                                  <Lock size={9} className="text-gray-400" />
                                  <span className="text-[10px] text-gray-400 font-medium">uff. chiuso</span>
                                  {editMode && <Unlock size={9} className="text-amber-400 ml-1" />}
                                </div>
                              </td>
                            );
                          }

                          if (slotApts.length > 0) {
                            const colors = operator === 'MILECE'
                              ? { bg: 'bg-red-50',   border: 'border-l-4 border-red-500',   text: 'text-red-700',   hover: 'hover:bg-red-100' }
                              : { bg: 'bg-green-50', border: 'border-l-4 border-green-500', text: 'text-green-700', hover: 'hover:bg-green-100' };
                            return (
                              <td
                                key={`${operator}-${time}`}
                                className="relative p-0 border-r border-gray-100 border-b border-gray-100 group"
                                style={{ height: '45px' }}
                              >
                                <div
                                  onClick={() => {
                                    if (editMode) {
                                      handleEditModeSlotClick(dateStr, time, operator);
                                    } else {
                                      openModalForEditAppointment(slotApts[0]);
                                    }
                                  }}
                                  className={`w-full h-full px-2 py-1 ${
                                    editMode
                                      ? 'bg-gray-50 border-l-4 border-amber-400 hover:bg-amber-50 cursor-pointer'
                                      : `${colors.bg} ${colors.border} ${colors.hover} cursor-pointer`
                                  } transition-all flex items-center`}
                                  title={editMode ? 'Clicca per bloccare questo slot' : undefined}
                                >
                                  <div className="w-full">
                                    {editMode ? (
                                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                        <Lock size={9} /> blocca
                                      </span>
                                    ) : (
                                      slotApts.map((apt, idx) => (
                                        <div key={apt.id} className={`flex items-center gap-1.5 ${idx > 0 ? 'mt-1' : ''}`}>
                                          <User size={10} className={`${colors.text} flex-shrink-0`} />
                                          <span className={`text-[10px] font-medium truncate ${colors.text}`}>{apt.cliente}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={`${operator}-${time}`}
                              className="relative p-0 border-r border-gray-100 border-b border-gray-100 group"
                              style={{ height: '45px' }}
                            >
                              <div
                                onClick={() => {
                                  if (editMode) {
                                    handleEditModeSlotClick(dateStr, time, operator);
                                  } else {
                                    openModalForNewAppointment(dateStr, time, operator);
                                  }
                                }}
                                className={`w-full h-full transition-colors cursor-pointer flex items-center justify-center ${
                                  editMode
                                    ? 'hover:bg-amber-50 group-hover:bg-amber-50'
                                    : 'hover:bg-blue-50/30 group-hover:bg-blue-50'
                                }`}
                                title={editMode ? 'Clicca per bloccare questo slot' : undefined}
                              >
                                {editMode ? (
                                  <Lock size={12} className="text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                  <Plus size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </td>
                          );
                        })
                      ) : (
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Caricamento agenda EPASA...</p>
        </div>
      </div>
    );
  }

  if (!selectedSede) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Nessuna sede disponibile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg">
                  <CalendarIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#005CA9]">EPASA - {selectedSede.nome}</h1>
                  <p className="text-xs text-gray-600 mt-0.5">Agenda 2026 (Lun-Ven 8:00-12:00)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Toggle vista */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
                  <button onClick={() => setViewMode('daily')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'daily' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
                  }`}>
                    <List className="w-4 h-4 inline mr-1" />Giornaliera
                  </button>
                  <button onClick={() => setViewMode('monthly')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'monthly' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
                  }`}>
                    <LayoutGrid className="w-4 h-4 inline mr-1" />Mensile
                  </button>
                </div>

                {/* Tasto lock circolare — modalità modifica */}
                <div className="relative group">
                  <button
                    onClick={() => setEditMode(e => !e)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-all border-2 ${
                      editMode
                        ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 shadow-lg scale-110'
                        : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
                    }`}
                    title={editMode ? 'Disattiva modalità modifica' : 'Attiva modalità modifica (blocca/sblocca slot)'}
                  >
                    {editMode ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30">
                    {editMode ? 'Esci dalla modifica' : 'Modifica slot'}
                  </div>
                </div>

                {/* Navigazione */}
                {viewMode === 'daily' && (
                  <button onClick={handlePreviousDay} disabled={selectedDate <= MIN_DATE} className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {viewMode === 'monthly' && (
                  <button onClick={handlePreviousMonth} disabled={selectedDate <= MIN_DATE} className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                <button onClick={() => setShowDatePicker(!showDatePicker)} className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] transition-colors cursor-pointer">
                  <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                    {viewMode === 'daily'
                      ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it })
                      : format(selectedDate, 'MMMM yyyy', { locale: it })}
                  </span>
                </button>

                {viewMode === 'daily' && (
                  <button onClick={() => navigateToDate(addDays(selectedDate, 1))} className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {viewMode === 'monthly' && (
                  <button onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                {/* Sede */}
                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Building2 className="w-5 h-5 text-[#005CA9]" />
                  <div className="relative">
                    <select
                      value={selectedSede.id}
                      onChange={e => { const s = sedi.find(x => x.id === e.target.value); if (s) setSelectedSede(s); }}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none"
                    >
                      {sedi.map(s => (
                        <option key={s.id} value={s.id} className="text-gray-800 bg-white">{s.nome}</option>
                      ))}
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

      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#005CA9]">Seleziona Data</h3>
              <button onClick={() => setShowDatePicker(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={handlePreviousMonth} disabled={selectedDate <= MIN_DATE} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft size={20} className="text-[#005CA9]" />
              </button>
              <h4 className="text-lg font-bold text-gray-800 capitalize">{format(selectedDate, 'MMMM yyyy', { locale: it })}</h4>
              <button type="button" onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
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
                const ms   = startOfMonth(selectedDate);
                const me   = endOfMonth(selectedDate);
                const days = eachDayOfInterval({ start: ms, end: me });
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
                        <button
                          key={i} type="button"
                          onClick={() => { if (!isBef) { navigateToDate(day); setShowDatePicker(false); } }}
                          disabled={isBef}
                          className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                            isBef ? 'bg-transparent text-gray-300 cursor-not-allowed' :
                            isSel ? 'bg-[#005CA9] text-white shadow-md scale-105' :
                            isTod ? 'bg-[#E6F2FF] text-[#005CA9] font-bold' :
                            isWe  ? 'bg-gray-200 text-gray-400' :
                                    'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105'
                          } ${!isBef ? 'cursor-pointer' : ''}`}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <button
              type="button"
              onClick={() => { navigateToDate(new Date()); setShowDatePicker(false); }}
              className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold"
            >
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
