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
  LayoutGrid,
  List,
  Lock,
  Unlock,
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
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import { formatDate, getTimeSlotsForSede, getEndTimeSlotsForSede, isSedeWorkingDay, TIME_SLOTS } from '@/utils/dateUtils';
import TimeSlot from './TimeSlot';
import AppointmentModal from './AppointmentModal';
import React from 'react';

interface CalendarProps {
  agendaId?: string;
}

const DAYS_PAST        = 3;
const DAYS_FUTURE      = 10;
const MAX_VISIBLE_DAYS = 14;
const DAYS_TO_LOAD     = 3;
const MIN_DATE         = new Date(2020, 0, 1);
const SCROLL_THRESHOLD = 400;
const SSE_RELOAD_DEBOUNCE = 800;

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
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [selectedSlot, setSelectedSlot]     = useState({ date: '', time: '', personaId: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<Appuntamento | null>(null);
  const [draggedAppointment, setDraggedAppointment]   = useState<{ appointment: Appuntamento; originalTime: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMonthlyPersona, setSelectedMonthlyPersona] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [realtimeFlash, setRealtimeFlash] = useState(false);

  const scrollContainerRef        = useRef<HTMLDivElement>(null);
  const scrollListenerAttachedRef = useRef(false);
  const loadTimeoutRef            = useRef<NodeJS.Timeout | null>(null);
  const visibleDaysRef            = useRef<Date[]>([]);
  const handleScrollRef           = useRef<() => void>(() => {});
  const sseReloadTimerRef         = useRef<NodeJS.Timeout | null>(null);

  // isLoadingDaysRef: usato SOLO dentro loadMoreDays* per evitare doppi caricamenti.
  // NON blocca handleScroll: la direzione deve sempre essere aggiornata.
  const isLoadingDaysRef  = useRef(false);
  const lastScrollTopRef  = useRef(0);
  const lastDirectionRef  = useRef<'up' | 'down'>('down');

  useEffect(() => { visibleDaysRef.current = visibleDays; }, [visibleDays]);

  const selectedSede     = sedi.find(s => s.id === selectedSedeId) ?? null;
  const selectedSedeNome = selectedSede?.nome ?? '';
  const isBorgoSede      = selectedSedeNome.toLowerCase().includes('borgo');

  const getTimeSlotsForDay    = (day: Date) => getTimeSlotsForSede(selectedSedeNome, day);
  const getEndTimeSlotsForDay = (day: Date) => getEndTimeSlotsForSede(selectedSedeNome, day);

  const isDayClosedForSede = (day: Date): boolean => {
    if (isWeekend(day)) return true;
    return !isSedeWorkingDay(selectedSedeNome, day);
  };

  // ─── Helpers lucchetto ───────────────────────────────────────────────────────
  const getUffChiusoApts = (dateStr: string, slotLabel: string, personaId: string): Appuntamento[] =>
    appointments.filter(a =>
      a.data === dateStr && a.sede_id === selectedSedeId && a.persona_id === personaId &&
      a.ora_inizio.substring(0, 5) === slotLabel &&
      (a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO'
    );

  const isUffChiusoSlot = (dateStr: string, slotLabel: string, personaId: string): boolean => {
    const s = appointments.filter(a =>
      a.data === dateStr && a.sede_id === selectedSedeId && a.persona_id === personaId &&
      a.ora_inizio.substring(0, 5) === slotLabel
    );
    return s.length > 0 && s.every(a => (a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO');
  };

  const handleEditModeSlotClick = async (dateStr: string, slotLabel: string, personaId: string, day: Date) => {
    const realApts = appointments.filter(a =>
      a.data === dateStr && a.sede_id === selectedSedeId && a.persona_id === personaId &&
      a.ora_inizio.substring(0, 5) === slotLabel &&
      (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
    );
    if (realApts.length > 0) return;
    const uffApts = getUffChiusoApts(dateStr, slotLabel, personaId);
    if (uffApts.length > 0) {
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
        } catch { alert('Errore durante lo sblocco'); return; }
      }
      await loadData();
    } else {
      const slots = getTimeSlotsForDay(day);
      const endSlots = getEndTimeSlotsForDay(day);
      const idx = slots.findIndex(s => s.label === slotLabel);
      const oraFine = idx !== -1 && idx + 1 < endSlots.length ? endSlots[idx + 1].label : endSlots[endSlots.length - 1].label;
      try {
        const res = await fetch('/api/appuntamenti', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona_id: personaId, sede_id: selectedSedeId, data: dateStr, ora_inizio: slotLabel, ora_fine: oraFine, cliente: 'UFF CHIUSO', note: '' }),
        });
        if (!res.ok) throw new Error();
        await loadData();
      } catch { alert('Errore durante il blocco'); }
    }
  };

  const scrollToDate = (date: Date) => {
    const container = scrollContainerRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-date="${formatDate(date)}"]`);
    if (container && el) {
      const thead = container.querySelector<HTMLElement>('thead');
      const theadHeight = thead?.offsetHeight ?? 0;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      container.scrollTop += (elRect.top - containerRect.top) - theadHeight;
      lastScrollTopRef.current = container.scrollTop;
    }
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

  const loadMoreDaysForward = () => {
    if (isLoadingDaysRef.current) return;
    isLoadingDaysRef.current = true;
    setVisibleDays(prev => {
      const lastDay = prev[prev.length - 1];
      const newDays = Array.from({ length: DAYS_TO_LOAD }, (_, i) => addDays(lastDay, i + 1));
      let updated = [...prev, ...newDays];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(updated.length - MAX_VISIBLE_DAYS);
      return updated;
    });
    requestAnimationFrame(() => { isLoadingDaysRef.current = false; });
  };

  const loadMoreDaysBackward = () => {
    if (isLoadingDaysRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const firstDay = visibleDaysRef.current[0];
    if (!firstDay || startOfDay(firstDay) <= startOfDay(MIN_DATE)) return;
    const newDays: Date[] = [];
    for (let i = DAYS_TO_LOAD; i > 0; i--) {
      const d = subDays(firstDay, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) newDays.push(d);
    }
    if (!newDays.length) return;

    isLoadingDaysRef.current = true;
    const scrollHeightBefore = container.scrollHeight;
    const scrollTopBefore    = container.scrollTop;

    setVisibleDays(prev => {
      let updated = [...newDays, ...prev];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(0, MAX_VISIBLE_DAYS);
      return updated;
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!container) { isLoadingDaysRef.current = false; return; }
        const addedHeight = container.scrollHeight - scrollHeightBefore;
        if (addedHeight > 0) {
          container.scrollTop = scrollTopBefore + addedHeight;
          // Sincronizza lastScrollTopRef con la nuova posizione compensata
          // così il prossimo evento scroll user non vede un falso salto
          lastScrollTopRef.current = container.scrollTop;
        }
        isLoadingDaysRef.current = false;
      });
    });
  };

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;

    // Aggiorna SEMPRE direzione e lastScrollTop, anche durante il caricamento.
    // Così non si perde mai il contesto di dove l'utente sta andando.
    if (currentScrollTop !== lastScrollTopRef.current) {
      lastDirectionRef.current = currentScrollTop < lastScrollTopRef.current ? 'up' : 'down';
      lastScrollTopRef.current = currentScrollTop;
    }

    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      if (!container || isLoadingDaysRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const dir = lastDirectionRef.current;
      if (dir === 'down' && distanceFromBottom < SCROLL_THRESHOLD) loadMoreDaysForward();
      else if (dir === 'up' && scrollTop < SCROLL_THRESHOLD)       loadMoreDaysBackward();
    }, 80);
  }, []);

  useEffect(() => { handleScrollRef.current = handleScroll; }, [handleScroll]);

  useEffect(() => {
    if (!isInitialized) {
      setVisibleDays(buildWindowAround(selectedDate));
      setIsInitialized(true);
      setTimeout(() => {
        const container = scrollContainerRef.current;
        const dateStr = formatDate(selectedDate);
        const el = container?.querySelector<HTMLElement>(`[data-date="${dateStr}"]`);
        if (container && el) {
          const thead = container.querySelector<HTMLElement>('thead');
          const theadHeight = thead?.offsetHeight ?? 0;
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          container.scrollTop += (elRect.top - containerRect.top) - theadHeight;
          lastScrollTopRef.current = container.scrollTop;
        }
        attachScrollListener();
      }, 300);
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
    };
  }, [isInitialized]);

  useEffect(() => {
    if (viewMode === 'monthly') {
      detachScrollListener();
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    }
    if (viewMode === 'daily' && !scrollListenerAttachedRef.current && isInitialized)
      setTimeout(() => attachScrollListener(), 100);
  }, [viewMode]);

  useEffect(() => { loadData(); }, []);

  // ─── SSE ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/appuntamenti/events');
    es.addEventListener('update', () => {
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
      sseReloadTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/appuntamenti');
          const data = await res.json();
          if (data) setAppointments(data);
          setRealtimeFlash(true);
          setTimeout(() => setRealtimeFlash(false), 1500);
        } catch { /* silenzioso */ }
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

  const handleCreateAppointment = async (data: any) => {
    try {
      if (!data.persona_id || !data.sede_id || !data.data || !data.ora_inizio || !data.ora_fine) { alert('Compila tutti i campi obbligatori'); return; }
      const res = await fetch('/api/appuntamenti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
    } catch (err) { alert('Errore imprevisto: ' + String(err)); }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
    } catch (err) { alert('Errore imprevisto: ' + String(err)); }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch (err) { alert('Errore imprevisto: ' + String(err)); }
  };

  const handleSlotClick = (date: string, time: string, personaId: string, existingAppointment?: Appuntamento) => {
    if (existingAppointment) { setSelectedAppointment(existingAppointment); }
    else { setSelectedAppointment(null); setSelectedSlot({ date, time, personaId }); }
    setIsModalOpen(true);
  };

  const getAppointmentsForSlot = (date: string, time: string, personaId: string) =>
    appointments.filter(apt => {
      const s = apt.ora_inizio ? apt.ora_inizio.substring(0, 5) : '';
      const e = apt.ora_fine   ? apt.ora_fine.substring(0, 5)   : '';
      return apt.data === date && apt.sede_id === selectedSedeId && time >= s && time < e && apt.persona_id === personaId;
    });

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
      return newStart < apt.ora_fine.substring(0,5) && newEnd > apt.ora_inizio.substring(0,5);
    });
    if (hasConflict) { alert('Impossibile spostare: fascia già occupata'); setDraggedAppointment(null); return; }
    try {
      const res = await fetch(`/api/appuntamenti/${appointment.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, sede_id: appointment.sede_id, ora_inizio: newStart, ora_fine: newEnd, cliente: appointment.cliente, note: appointment.note, highlight: appointment.highlight }),
      });
      if (!res.ok) throw new Error();
    } catch { alert('Errore imprevisto'); }
    setDraggedAppointment(null);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // ─── helpers mensile ─────────────────────────────────────────────────────────
  const getDayAvailability = (dateStr: string, personaId: string, day: Date): DayAvailability => {
    if (isDayClosedForSede(day)) return 'closed';
    const slots = getTimeSlotsForDay(day);
    const n = appointments.filter(apt => apt.sede_id === selectedSedeId && apt.data === dateStr && apt.persona_id === personaId).length;
    if (n === 0) return 'free';
    if (n >= slots.length * 0.8) return 'full';
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

  // ─── VISTA MENSILE ───────────────────────────────────────────────────────────
  const renderMonthlyView = () => {
    const activePersona = (selectedMonthlyPersona && sedePersone.some(p => p.id === selectedMonthlyPersona)) ? selectedMonthlyPersona : sedePersone[0]?.id ?? null;
    if (!activePersona) return null;
    const fa = getFirstAvailableDay(activePersona);
    const monthStart = startOfMonth(selectedDate);
    const monthEnd   = endOfMonth(selectedDate);
    const allCalDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
    const weeks: Date[][] = [];
    for (let i = 0; i < allCalDays.length; i += 7) weeks.push(allCalDays.slice(i, i + 7));
    const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const personaNome = sedePersone.find(p => p.id === activePersona)?.nome ?? '';
    return (
      <div className="p-3 md:p-4">
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

  // ─── VISTA GIORNALIERA ───────────────────────────────────────────────────────
  const renderDailyView = () => (
    <div ref={scrollContainerRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 107px)' }}>
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
          </tr>
        </thead>
        <tbody>
          {visibleDays.map(day => {
            const dateStr      = formatDate(day);
            const isToday      = formatDate(new Date()) === dateStr;
            const isClosed     = isDayClosedForSede(day);
            const dayTimeSlots = getTimeSlotsForDay(day);
            return (
              <React.Fragment key={dateStr}>
                <tr data-date={dateStr}>
                  <td colSpan={sedePersone.length + 1}
                    className={`p-2 text-center font-bold text-sm sticky left-0 z-10 ${ isToday ? 'bg-[#005CA9] text-white' : isClosed ? 'bg-gray-300 text-gray-500' : 'bg-gray-100 text-gray-700' }`}>
                    {format(day, 'EEEE dd MMMM yyyy', { locale: it })}
                    {isClosed && <span className="ml-2 text-xs font-normal">(CHIUSO)</span>}
                  </td>
                </tr>
                {isClosed ? (
                  <tr>
                    <td colSpan={sedePersone.length + 1} className="p-4 text-center bg-gray-50 border-b border-gray-200" style={{ height: '60px' }}>
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        <Lock size={14} />
                        <span className="text-xs font-medium">{isBorgoSede ? 'Borgo è aperto solo il mercoledì' : 'Sede chiusa'}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dayTimeSlots.map(slot => (
                    <tr key={`${dateStr}-${slot.label}`}>
                      <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                        <div className="px-1 py-2 text-xs font-semibold text-gray-700">{slot.label}</div>
                      </td>
                      {sedePersone.map(persona => {
                        const slotApts = getAppointmentsForSlot(dateStr, slot.label, persona.id);
                        const dayApts  = appointments.filter(apt => apt.data === dateStr && apt.sede_id === selectedSedeId && apt.persona_id === persona.id);
                        const isUffC   = isUffChiusoSlot(dateStr, slot.label, persona.id);
                        if (isUffC) return (
                          <td key={`${persona.id}-${slot.label}`}
                            className={`relative p-0 border-r border-gray-100 border-b border-gray-100 bg-gray-100 ${ editMode ? 'cursor-pointer hover:bg-gray-200' : 'select-none' }`}
                            style={{ height: '45px' }}
                            title={editMode ? 'Clicca per sbloccare' : 'Ufficio chiuso'}
                            onClick={() => editMode && handleEditModeSlotClick(dateStr, slot.label, persona.id, day)}>
                            <div className="w-full h-full flex items-center justify-center gap-1">
                              <Lock size={9} className="text-gray-400" />
                              <span className="text-[10px] text-gray-400 font-medium">uff. chiuso</span>
                              {editMode && <Unlock size={9} className="text-gray-400 ml-1" />}
                            </div>
                          </td>
                        );
                        return (
                          <td key={`${persona.id}-${slot.label}`}
                            className={`relative p-0 border-r border-gray-100 ${ !slotApts.length ? 'border-b border-gray-100' : '' }`}
                            style={{ height: '45px' }}>
                            {editMode && slotApts.length === 0 ? (
                              <div onClick={() => handleEditModeSlotClick(dateStr, slot.label, persona.id, day)}
                                className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-gray-100 group transition-colors"
                                title="Clicca per bloccare questo slot">
                                <Lock size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            ) : (
                              <TimeSlot
                                time={slot.label} appointments={slotApts} allDayAppointments={dayApts}
                                onClick={apt => !editMode && handleSlotClick(dateStr, slot.label, persona.id, apt)}
                                onDragStart={handleDragStart}
                                onDrop={t => handleDrop(dateStr, t, persona.id, day)}
                                onDragOver={handleDragOver}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const sedePersone = persone.filter(p => personaSede.some(ps => ps.persona_id === p.id && ps.sede_id === selectedSedeId));
  const dateLabel = viewMode === 'daily' ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it }) : format(selectedDate, 'MMMM yyyy', { locale: it });

  const handlePrev = () => { if (viewMode === 'daily') navigateToDate(subDays(selectedDate, 1)); else if (selectedDate > MIN_DATE) setSelectedDate(subMonths(selectedDate, 1)); };
  const handleNext = () => { if (viewMode === 'daily') navigateToDate(addDays(selectedDate, 1)); else setSelectedDate(addMonths(selectedDate, 1)); };

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
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
          {viewMode === 'daily' ? renderDailyView() : renderMonthlyView()}
        </div>
      </div>

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
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedAppointment(null); }}
        onSave={handleCreateAppointment}
        onUpdate={handleUpdateAppointment}
        onDelete={handleDeleteAppointment}
        existingAppointment={selectedAppointment}
        persone={persone} sedi={sedi} personaSede={personaSede}
        selectedDate={selectedSlot.date} selectedTime={selectedSlot.time}
        selectedSedeId={selectedSedeId} defaultPersonaId={selectedSlot.personaId}
      />
    </div>
  );
}
