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
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import { formatDate, TIME_SLOTS } from '@/utils/dateUtils';
import TimeSlot from './TimeSlot';
import AppointmentModal from './AppointmentModal';
import React from 'react';

interface CalendarProps {
  agendaId?: string;
}

const DAYS_PAST = 3;
const DAYS_FUTURE = 4;
const MAX_VISIBLE_DAYS = 7;
const DAYS_TO_LOAD = 1;
const MIN_DATE = new Date(2020, 0, 1);
const SCROLL_THRESHOLD = 400;

type ViewMode = 'daily' | 'monthly';
type DayAvailability = 'free' | 'partial' | 'full';

export default function Calendar({ agendaId = '730' }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [visibleDays, setVisibleDays] = useState<Date[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [personaSede, setPersonaSede] = useState<PersonaSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ date: '', time: '', personaId: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<Appuntamento | null>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<{ appointment: Appuntamento; originalTime: string } | null>(null);
  const [resizingAppointment, setResizingAppointment] = useState<Appuntamento | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const scrollListenerAttachedRef = useRef(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref per passare scrollHeight alla requestAnimationFrame FUORI da setVisibleDays
  const scrollSnapshotRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

  const scrollToDate = (date: Date) => {
    const el = document.querySelector<HTMLElement>(`[data-date="${formatDate(date)}"]`);
    if (el && scrollContainerRef.current) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navigateToDate = useCallback((date: Date) => {
    setSelectedDate(date);
    const alreadyVisible = visibleDays.some(d => isSameDay(d, date));
    if (alreadyVisible) {
      setTimeout(() => scrollToDate(date), 50);
    } else {
      const days: Date[] = [];
      for (let i = DAYS_PAST; i > 0; i--) {
        const d = subDays(date, i);
        if (startOfDay(d) >= startOfDay(MIN_DATE)) days.push(d);
      }
      days.push(date);
      for (let i = 1; i <= DAYS_FUTURE; i++) days.push(addDays(date, i));
      setVisibleDays(days);
      setTimeout(() => scrollToDate(date), 200);
    }
  }, [visibleDays]);

  // 🔽 Carica giorni futuri (scroll verso il basso)
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
    setTimeout(() => { isLoadingRef.current = false; }, 300);
  };

  // 🔼 Carica giorni passati (scroll verso l'alto)
  // CHIAVE: leggiamo scrollTop e scrollHeight PRIMA di chiamare setVisibleDays,
  // poi applichiamo la compensazione nella requestAnimationFrame successiva.
  const loadMoreDaysBackward = () => {
    if (isLoadingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    // Leggi i valori SINCRONI prima di qualsiasi setState
    const firstDayCheck = visibleDaysRef.current[0];
    if (!firstDayCheck || startOfDay(firstDayCheck) <= startOfDay(MIN_DATE)) return;

    const newDays: Date[] = [];
    for (let i = DAYS_TO_LOAD; i > 0; i--) {
      const d = subDays(firstDayCheck, i);
      if (startOfDay(d) >= startOfDay(MIN_DATE)) newDays.push(d);
    }
    if (newDays.length === 0) return;

    isLoadingRef.current = true;

    // Salva snapshot SINCRONO qui, fuori da setVisibleDays
    scrollSnapshotRef.current = {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    };

    setVisibleDays(prev => {
      let updated = [...newDays, ...prev];
      if (updated.length > MAX_VISIBLE_DAYS) updated = updated.slice(0, MAX_VISIBLE_DAYS);
      return updated;
    });

    // Dopo che React ha aggiornato il DOM, applica la compensazione
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (container && scrollSnapshotRef.current) {
          const { scrollTop: snapTop, scrollHeight: snapHeight } = scrollSnapshotRef.current;
          const heightDiff = container.scrollHeight - snapHeight;
          if (heightDiff > 0) {
            container.scrollTop = snapTop + heightDiff;
          }
          scrollSnapshotRef.current = null;
        }
        setTimeout(() => {
          isLoadingRef.current = false;
          // Se siamo ancora vicini alla cima, triggera di nuovo
          if (container && container.scrollTop < SCROLL_THRESHOLD) {
            loadMoreDaysBackward();
          }
        }, 350);
      });
    });
  };

  // Ref speculare a visibleDays per leggere il valore corrente in modo sincrono
  const visibleDaysRef = useRef<Date[]>([]);
  useEffect(() => {
    visibleDaysRef.current = visibleDays;
  }, [visibleDays]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingRef.current) return;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollDirection = scrollTop > lastScrollTopRef.current ? 'down' : 'up';
    lastScrollTopRef.current = scrollTop;

    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const distanceFromTop = scrollTop;

    loadTimeoutRef.current = setTimeout(() => {
      if (scrollDirection === 'down' && distanceFromBottom < SCROLL_THRESHOLD) {
        loadMoreDaysForward();
      } else if (scrollDirection === 'up' && distanceFromTop < SCROLL_THRESHOLD) {
        loadMoreDaysBackward();
      }
    }, 100);
  };

  // Inizializzazione: 3 giorni passati + oggi + 4 futuri
  useEffect(() => {
    if (!isInitialized) {
      const today = selectedDate;
      const days: Date[] = [];
      for (let i = DAYS_PAST; i > 0; i--) {
        const d = subDays(today, i);
        if (startOfDay(d) >= startOfDay(MIN_DATE)) days.push(d);
      }
      days.push(today);
      for (let i = 1; i <= DAYS_FUTURE; i++) days.push(addDays(today, i));
      setVisibleDays(days);
      setIsInitialized(true);
      setTimeout(() => {
        scrollToDate(today);
        attachScrollListener();
      }, 200);
    }
  }, []);

  const attachScrollListener = () => {
    const container = scrollContainerRef.current;
    if (!container || scrollListenerAttachedRef.current) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    scrollListenerAttachedRef.current = true;
  };

  useEffect(() => {
    if (scrollContainerRef.current && !scrollListenerAttachedRef.current && isInitialized) {
      attachScrollListener();
    }
    return () => {
      const container = scrollContainerRef.current;
      if (container && scrollListenerAttachedRef.current) {
        container.removeEventListener('scroll', handleScroll);
        scrollListenerAttachedRef.current = false;
      }
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [isInitialized]);

  useEffect(() => {
    if (viewMode === 'monthly' && scrollListenerAttachedRef.current) {
      const container = scrollContainerRef.current;
      if (container) { container.removeEventListener('scroll', handleScroll); scrollListenerAttachedRef.current = false; }
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    }
    if (viewMode === 'daily' && !scrollListenerAttachedRef.current && isInitialized) {
      setTimeout(() => attachScrollListener(), 100);
    }
  }, [viewMode]);

  useEffect(() => {
    loadData();
    const intervalId = setInterval(() => { loadData(); }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (sedi.length > 0 && !selectedSedeId) {
      const imolaSede = sedi.find(s => s.nome.toLowerCase().includes('imola'));
      setSelectedSedeId(imolaSede ? imolaSede.id : sedi[0].id);
    }
  }, [sedi, selectedSedeId]);

  useEffect(() => {
    const handleMouseEnter = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const cell = target.closest('[data-appointment-id]');
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) document.querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`).forEach(el => el.classList.add('appointment-hover'));
      }
    };
    const handleMouseLeave = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const cell = target.closest('[data-appointment-id]');
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) document.querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`).forEach(el => el.classList.remove('appointment-hover'));
      }
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
    if (!resizingAppointment) {
      document.querySelectorAll('.resize-overlay').forEach(el => el.remove());
      document.querySelectorAll<HTMLElement>('[data-appointment-id]').forEach(el => { el.style.opacity = ''; });
      return;
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) setIsResizing(true);
      const table = document.querySelector('table tbody');
      if (!table) return;
      const rect = table.getBoundingClientRect();
      const rowHeight = 45;
      const targetSlotIndex = Math.floor((e.clientY - rect.top) / rowHeight);
      if (targetSlotIndex >= 0 && targetSlotIndex < TIME_SLOTS.length) {
        const startTime = resizingAppointment.ora_inizio.substring(0, 5);
        const startIndex = TIME_SLOTS.findIndex(slot => slot.label === startTime);
        const appointmentElement = document.querySelector<HTMLElement>(`[data-appointment-id="${resizingAppointment.id}"]`);
        if (appointmentElement) {
          appointmentElement.querySelector<HTMLElement>('.resize-overlay')?.remove();
          const currentEndTime = resizingAppointment.ora_fine.substring(0, 5);
          let currentEndIndex = TIME_SLOTS.findIndex(slot => slot.label === currentEndTime);
          if (currentEndIndex === -1 && currentEndTime === '18:00') currentEndIndex = TIME_SLOTS.length;
          if (targetSlotIndex > currentEndIndex) {
            const overlay = document.createElement('div');
            overlay.className = 'resize-overlay';
            Object.assign(overlay.style, { position:'absolute', top:'0', left:'0', right:'0', height:`${(targetSlotIndex - startIndex) * rowHeight}px`, backgroundColor:'rgba(34,197,94,0.2)', border:'2px dashed rgb(34,197,94)', pointerEvents:'none', zIndex:'20' });
            appointmentElement.appendChild(overlay); appointmentElement.style.opacity = '0.7';
          } else if (targetSlotIndex < currentEndIndex && targetSlotIndex > startIndex) {
            const overlay = document.createElement('div');
            overlay.className = 'resize-overlay';
            Object.assign(overlay.style, { position:'absolute', top:`${(targetSlotIndex - startIndex) * rowHeight}px`, left:'0', right:'0', bottom:'0', backgroundColor:'rgba(239,68,68,0.3)', border:'2px dashed rgb(239,68,68)', pointerEvents:'none', zIndex:'20' });
            appointmentElement.appendChild(overlay); appointmentElement.style.opacity = '0.8';
          }
        }
      }
    };
    const cleanupResizeEffects = () => {
      document.querySelectorAll('.resize-overlay').forEach(el => el.remove());
      document.querySelectorAll<HTMLElement>('[data-appointment-id]').forEach(el => { el.style.opacity = ''; });
    };
    const handleMouseUp = async (e: MouseEvent) => {
      if (!resizingAppointment) return;
      cleanupResizeEffects();
      const table = document.querySelector('table tbody');
      if (!table) { setResizingAppointment(null); setTimeout(() => setIsResizing(false), 100); return; }
      const rect = table.getBoundingClientRect();
      const targetSlotIndex = Math.floor((e.clientY - rect.top) / 45);
      if (targetSlotIndex >= 0 && targetSlotIndex < TIME_SLOTS.length) {
        const newEndTime = targetSlotIndex < TIME_SLOTS.length ? TIME_SLOTS[targetSlotIndex].label : '18:00';
        const startTime = resizingAppointment.ora_inizio.substring(0, 5);
        const startIndex = TIME_SLOTS.findIndex(slot => slot.label === startTime);
        if (targetSlotIndex <= startIndex) {
          alert("La durata minima dell'appuntamento è 30 minuti");
          setResizingAppointment(null); setTimeout(() => setIsResizing(false), 100); return;
        }
        if (newEndTime > startTime) {
          const hasConflict = appointments.some(apt => {
            if (apt.id === resizingAppointment.id || apt.persona_id !== resizingAppointment.persona_id || apt.sede_id !== resizingAppointment.sede_id || apt.data !== resizingAppointment.data) return false;
            return startTime < apt.ora_fine.substring(0,5) && newEndTime > apt.ora_inizio.substring(0,5);
          });
          if (hasConflict) { alert('Impossibile ridimensionare: fascia oraria già occupata'); }
          else {
            try {
              const res = await fetch(`/api/appuntamenti/${resizingAppointment.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona_id: resizingAppointment.persona_id, sede_id: resizingAppointment.sede_id, ora_inizio: startTime, ora_fine: newEndTime, cliente: resizingAppointment.cliente, note: resizingAppointment.note }),
              });
              if (!res.ok) throw new Error();
              await loadData();
            } catch { alert('Errore durante il ridimensionamento'); }
          }
        }
      }
      setResizingAppointment(null);
      setTimeout(() => setIsResizing(false), 100);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      cleanupResizeEffects();
    };
  }, [resizingAppointment, appointments, isResizing]);

  const loadData = async () => {
    try {
      const [sediRes, personeRes, psRes, appRes] = await Promise.all([
        fetch('/api/sedi'), fetch('/api/persone'), fetch('/api/persona-sede'), fetch('/api/appuntamenti')
      ]);
      const [sediData, personeData, psData, appData] = await Promise.all([
        sediRes.json(), personeRes.json(), psRes.json(), appRes.json()
      ]);
      if (sediData) setSedi(sediData);
      if (personeData) setPersone(personeData);
      if (psData) setPersonaSede(psData);
      if (appData) setAppointments(appData);
    } catch (error) { console.error('Errore caricamento dati:', error); }
  };

  const handleCreateAppointment = async (data: any) => {
    try {
      if (!data.persona_id || !data.sede_id || !data.data || !data.ora_inizio || !data.ora_fine) { alert('Compila tutti i campi obbligatori'); return; }
      const res = await fetch('/api/appuntamenti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      setTimeout(async () => { await loadData(); }, 300);
    } catch (err) { alert('Errore imprevisto: ' + String(err)); }
  };

  const handleUpdateAppointment = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      setTimeout(async () => { await loadData(); }, 300);
    } catch (err) { alert('Errore imprevisto: ' + String(err)); }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTimeout(async () => { await loadData(); }, 300);
    } catch (err) { alert('Errore imprevisto: ' + String(err)); }
  };

  const handleSlotClick = (date: string, time: string, personaId: string, existingAppointment?: Appuntamento) => {
    if (isResizing) return;
    if (existingAppointment) { setSelectedAppointment(existingAppointment); }
    else { setSelectedAppointment(null); setSelectedSlot({ date, time, personaId }); }
    setIsModalOpen(true);
  };

  const getAppointmentsForSlot = (date: string, time: string, personaId: string) =>
    appointments.filter(apt => {
      const s = apt.ora_inizio ? apt.ora_inizio.substring(0, 5) : '';
      const e = apt.ora_fine ? apt.ora_fine.substring(0, 5) : '';
      return apt.data === date && apt.sede_id === selectedSedeId && time >= s && time < e && apt.persona_id === personaId;
    });

  const handleDragStart = (appointment: Appuntamento, time: string) => setDraggedAppointment({ appointment, originalTime: time });

  const handleDrop = async (date: string, newTime: string, personaId: string) => {
    if (!draggedAppointment) return;
    const { appointment, originalTime } = draggedAppointment;
    const origIdx = TIME_SLOTS.findIndex(s => s.label === originalTime);
    const newIdx = TIME_SLOTS.findIndex(s => s.label === newTime);
    if (origIdx === -1 || newIdx === -1) { setDraggedAppointment(null); return; }
    const diff = newIdx - origIdx;
    const startIdx = TIME_SLOTS.findIndex(s => s.label === appointment.ora_inizio.substring(0, 5));
    let endIdx = TIME_SLOTS.findIndex(s => s.label === appointment.ora_fine.substring(0, 5));
    if (endIdx === -1 && appointment.ora_fine.substring(0, 5) === '18:00') endIdx = TIME_SLOTS.length;
    const ns = startIdx + diff; const ne = endIdx + diff;
    if (ns < 0 || ne > TIME_SLOTS.length) { alert("Impossibile spostare l'appuntamento in questo orario"); setDraggedAppointment(null); return; }
    const newStart = TIME_SLOTS[ns].label;
    const newEnd = ne < TIME_SLOTS.length ? TIME_SLOTS[ne].label : '18:00';
    const hasConflict = appointments.some(apt => {
      if (apt.id === appointment.id || apt.persona_id !== personaId || apt.sede_id !== appointment.sede_id || apt.data !== date) return false;
      return newStart < apt.ora_fine.substring(0,5) && newEnd > apt.ora_inizio.substring(0,5);
    });
    if (hasConflict) { alert("Impossibile spostare: fascia già occupata"); setDraggedAppointment(null); return; }
    try {
      const res = await fetch(`/api/appuntamenti/${appointment.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, sede_id: appointment.sede_id, ora_inizio: newStart, ora_fine: newEnd, cliente: appointment.cliente, note: appointment.note }),
      });
      if (!res.ok) throw new Error();
      await loadData();
    } catch { alert('Errore imprevisto'); }
    setDraggedAppointment(null);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleResizeStart = (appointment: Appuntamento) => setResizingAppointment(appointment);

  // ─── VISTA MENSILE ──────────────────────────────────────────────────────────

  const getDayAvailability = (dateStr: string, personaId: string): DayAvailability => {
    const n = appointments.filter(apt => apt.sede_id === selectedSedeId && apt.data === dateStr && apt.persona_id === personaId).length;
    if (n === 0) return 'free';
    if (n >= TIME_SLOTS.length * 0.8) return 'full';
    return 'partial';
  };

  const getFirstAvailableDay = (personaId: string): string | null => {
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = addDays(today, i);
      if (isWeekend(d)) continue;
      const s = format(d, 'yyyy-MM-dd');
      const a = getDayAvailability(s, personaId);
      if (a === 'free' || a === 'partial') return s;
    }
    return null;
  };

  const renderMonthlyView = () => {
    const days = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500"></div><span className="text-xs font-medium text-gray-700">Libero</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-yellow-500"></div><span className="text-xs font-medium text-gray-700">Parzialmente occupato</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500"></div><span className="text-xs font-medium text-gray-700">Pieno</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-300"></div><span className="text-xs font-medium text-gray-700">Weekend (chiuso)</span></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-700 border-b border-r">Giorno</th>
                {sedePersone.map(persona => {
                  const fa = getFirstAvailableDay(persona.id);
                  return (
                    <th key={persona.id} className="p-3 text-center text-sm font-semibold border-b">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#005CA9] flex items-center justify-center"><User size={14} className="text-white" /></div>
                          <span className="text-[#005CA9]">{persona.nome}</span>
                        </div>
                        {fa && <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Primo libero: {format(new Date(fa), 'dd/MM')}</div>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const dateStr = formatDate(day);
                const isToday = formatDate(new Date()) === dateStr;
                const isWe = isWeekend(day);
                return (
                  <tr key={dateStr} className="border-b hover:bg-gray-50 transition-colors">
                    <td className={`p-3 font-medium border-r ${isToday ? 'bg-[#005CA9] text-white' : isWe ? 'bg-gray-200 text-gray-400' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{format(day, 'd')}</span>
                        <span className="text-xs capitalize">{format(day, 'EEE', { locale: it })}</span>
                      </div>
                    </td>
                    {sedePersone.map(persona => {
                      if (isWe) return <td key={`${dateStr}-${persona.id}`} className="p-2 text-center bg-gray-200 opacity-50"><span className="text-xs text-gray-500">-</span></td>;
                      const av = getDayAvailability(dateStr, persona.id);
                      const bg = av === 'free' ? 'bg-green-100' : av === 'partial' ? 'bg-yellow-100' : 'bg-red-100';
                      const bd = av === 'free' ? 'border-green-500' : av === 'partial' ? 'border-yellow-500' : 'border-red-500';
                      const n = appointments.filter(apt => apt.sede_id === selectedSedeId && apt.data === dateStr && apt.persona_id === persona.id).length;
                      return (
                        <td key={`${dateStr}-${persona.id}`} className={`p-2 text-center cursor-pointer ${bg} border-l-4 ${bd} hover:opacity-80`}
                          onClick={() => { setSelectedDate(day); setViewMode('daily'); }}
                          title={`${persona.nome} - ${format(day, 'dd/MM/yyyy')}\n${n} appuntamenti`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-gray-700">{n}</span>
                            <span className="text-xs text-gray-600">{av === 'free' ? 'Vuoto' : av === 'partial' ? 'App.' : 'Pieno'}</span>
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

  // ─── VISTA GIORNALIERA ──────────────────────────────────────────────────────

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
            const dateStr = formatDate(day);
            const isToday = formatDate(new Date()) === dateStr;
            return (
              <React.Fragment key={dateStr}>
                <tr data-date={dateStr}>
                  <td colSpan={sedePersone.length + 1} className={`p-2 text-center font-bold text-sm sticky left-0 z-10 ${isToday ? 'bg-[#005CA9] text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {format(day, 'EEEE dd MMMM yyyy', { locale: it })}
                  </td>
                </tr>
                {TIME_SLOTS.map(slot => (
                  <tr key={`${dateStr}-${slot.label}`}>
                    <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-100 w-[60px]">
                      <div className="px-1 py-2 text-xs font-semibold text-gray-700">{slot.label}</div>
                    </td>
                    {sedePersone.map(persona => {
                      const slotApts = getAppointmentsForSlot(dateStr, slot.label, persona.id);
                      const dayApts = appointments.filter(apt => apt.data === dateStr && apt.sede_id === selectedSedeId && apt.persona_id === persona.id);
                      return (
                        <td key={`${persona.id}-${slot.label}`} className={`relative p-0 border-r border-gray-100 ${!slotApts.length ? 'border-b border-gray-100' : ''}`} style={{ height: '45px' }}>
                          <TimeSlot
                            time={slot.label}
                            appointments={slotApts}
                            allDayAppointments={dayApts}
                            onClick={apt => handleSlotClick(dateStr, slot.label, persona.id, apt)}
                            onDragStart={handleDragStart}
                            onDrop={t => handleDrop(dateStr, t, persona.id)}
                            onDragOver={handleDragOver}
                            onResizeStart={handleResizeStart}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const sedePersone = persone.filter(p => personaSede.some(ps => ps.persona_id === p.id && ps.sede_id === selectedSedeId));

  return (
    <div className="min-h-screen p-1 md:p-2 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in border-t-4 border-[#005CA9]">
          <div className="bg-white border-b-2 border-[#005CA9]/20 p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#005CA9] p-2 rounded-lg shadow-lg"><CalendarIcon className="w-6 h-6 text-white" /></div>
                <div>
                  <h1 className="text-2xl font-bold text-[#005CA9]">Agenda 730</h1>
                  <p className="text-xs text-gray-600 mt-0.5">Gestione appuntamenti</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-300">
                  <button onClick={() => setViewMode('daily')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'daily' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
                    <List className="w-4 h-4 inline mr-1" />Giornaliera
                  </button>
                  <button onClick={() => setViewMode('monthly')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'monthly' ? 'bg-[#005CA9] text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
                    <LayoutGrid className="w-4 h-4 inline mr-1" />Mensile
                  </button>
                </div>

                {viewMode === 'daily' && (
                  <button onClick={() => navigateToDate(subDays(selectedDate, 1))} className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {viewMode === 'monthly' && (
                  <button onClick={() => setSelectedDate(subMonths(selectedDate, 1))} disabled={selectedDate <= MIN_DATE} className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                <button onClick={() => setShowDatePicker(!showDatePicker)} className="bg-[#E6F2FF] px-4 py-2 rounded-lg border border-[#005CA9]/20 hover:bg-[#D1E7FF] transition-colors cursor-pointer">
                  <span className="text-sm font-semibold text-[#005CA9] whitespace-nowrap">
                    {viewMode === 'daily' ? format(selectedDate, 'EEEE dd MMMM yyyy', { locale: it }) : format(selectedDate, 'MMMM yyyy', { locale: it })}
                  </span>
                </button>

                {viewMode === 'daily' && (
                  <>
                    <button onClick={() => navigateToDate(addDays(selectedDate, 1))} className="p-2 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:shadow-md border border-gray-200">
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                    <button onClick={() => navigateToDate(new Date())} className="px-4 py-2 text-sm bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] hover:shadow-lg transition-all duration-200 font-medium">
                      Oggi
                    </button>
                  </>
                )}
                {viewMode === 'monthly' && (
                  <button onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="p-2 hover:bg-blue-50 rounded-lg border border-gray-200">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                )}

                <div className="flex items-center gap-2 ml-2 border-l border-gray-300 pl-2">
                  <Building2 className="w-5 h-5 text-[#005CA9]" />
                  <div className="relative">
                    <select value={selectedSedeId} onChange={e => setSelectedSedeId(e.target.value)}
                      className="px-3 py-2 pr-8 text-sm bg-[#E6F2FF] text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#005CA9]/50 transition-all cursor-pointer hover:bg-[#D1E7FF] appearance-none">
                      {sedi.map(sede => <option key={sede.id} value={sede.id} className="text-gray-800 bg-white">{sede.nome}</option>)}
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
              {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => <div key={d} className="text-center text-xs font-semibold text-gray-600 py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {(() => {
                const ms = startOfMonth(selectedDate), me = endOfMonth(selectedDate);
                const days = eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(me, { weekStartsOn: 1 }) });
                return days.map((day, i) => {
                  const isCurr = isSameMonth(day, selectedDate);
                  const isSel = format(day,'yyyy-MM-dd') === format(selectedDate,'yyyy-MM-dd');
                  const isTod = format(day,'yyyy-MM-dd') === format(new Date(),'yyyy-MM-dd');
                  return (
                    <button key={i} type="button" onClick={() => { navigateToDate(day); setShowDatePicker(false); }}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all cursor-pointer ${isSel ? 'bg-[#005CA9] text-white shadow-md scale-105' : isTod ? 'bg-[#E6F2FF] text-[#005CA9] font-bold' : isCurr ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105' : 'bg-transparent text-gray-300'}`}>
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
        persone={persone}
        sedi={sedi}
        personaSede={personaSede}
        selectedDate={selectedSlot.date}
        selectedTime={selectedSlot.time}
        selectedSedeId={selectedSedeId}
        defaultPersonaId={selectedSlot.personaId}
      />
    </div>
  );
}
