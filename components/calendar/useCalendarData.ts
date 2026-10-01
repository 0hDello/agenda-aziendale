'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { format, addDays, isWeekend } from 'date-fns';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import {
  getTimeSlotsForSede,
  getEndTimeSlotsForSede,
  isSedeWorkingDay,
  SABATI_730_ECCEZIONE,
} from '@/utils/dateUtils';
import {
  DayAvailability,
  SSE_RELOAD_DEBOUNCE,
  LOCAL_MUTATION_WINDOW,
} from './types';

export function useCalendarData(agendaId: string = '730') {
  const [appointments, setAppointments]     = useState<Appuntamento[]>([]);
  const [persone, setPersone]               = useState<Persona[]>([]);
  const [sedi, setSedi]                     = useState<Sede[]>([]);
  const [personaSede, setPersonaSede]       = useState<PersonaSede[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [realtimeFlash, setRealtimeFlash]   = useState(false);

  const sediRef            = useRef<Sede[]>([]);
  const sseReloadTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const localMutationAtRef = useRef<number>(0);

  useEffect(() => { sediRef.current = sedi; }, [sedi]);

  const markLocalMutation = useCallback(() => {
    localMutationAtRef.current = Date.now();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [sediRes, personeRes, psRes, appRes] = await Promise.all([
        fetch('/api/sedi'),
        fetch('/api/persone'),
        fetch('/api/persona-sede'),
        fetch('/api/appuntamenti'),
      ]);
      const [sediData, personeData, psData, appData] = await Promise.all([
        sediRes.json(),
        personeRes.json(),
        psRes.json(),
        appRes.json(),
      ]);
      if (sediData)    setSedi(sediData);
      if (personeData) setPersone(personeData);
      if (psData)      setPersonaSede(psData);
      if (appData)     setAppointments(appData);
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time SSE
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
    return () => {
      es.close();
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
    };
  }, []);

  // Auto-select initial sede (Imola by default if present)
  useEffect(() => {
    if (sedi.length > 0 && !selectedSedeId) {
      const imola = sedi.find(s => s.nome.toLowerCase().includes('imola'));
      setSelectedSedeId(imola ? imola.id : sedi[0].id);
    }
  }, [sedi, selectedSedeId]);

  const selectedSede     = useMemo(() => sedi.find(s => s.id === selectedSedeId) ?? null, [sedi, selectedSedeId]);
  const selectedSedeNome = selectedSede?.nome ?? '';
  const isBorgoSede      = selectedSedeNome.toLowerCase().includes('borgo');

  const getTimeSlotsForDay    = useCallback((day: Date) => getTimeSlotsForSede(selectedSedeNome, day, agendaId), [selectedSedeNome, agendaId]);
  const getEndTimeSlotsForDay = useCallback((day: Date) => getEndTimeSlotsForSede(selectedSedeNome, day, agendaId), [selectedSedeNome, agendaId]);

  const isDayClosedForSede = useCallback((day: Date): boolean => {
    if (agendaId === '730' && isWeekend(day) && day.getDay() === 6) {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (SABATI_730_ECCEZIONE.includes(dateStr)) {
        return false; // Aperto per tutti gli operatori di Imola
      }
    }
    if (isWeekend(day)) return true;
    return !isSedeWorkingDay(selectedSedeNome, day);
  }, [agendaId, selectedSedeNome]);

  const isPersonaDisabledForDay = useCallback((_day: Date, _persona: Persona): boolean => {
    return false;
  }, []);

  const isDayFullyClosedForAllPersone = useCallback((day: Date, _personeInSede: Persona[]): boolean => {
    return isDayClosedForSede(day);
  }, [isDayClosedForSede]);

  const personeMap = useMemo(() => {
    const m = new Map<string, Persona>();
    for (const p of persone) m.set(p.id, p);
    return m;
  }, [persone]);

  // Pre-index appointments by "${data}|${persona_id}" for selected sede
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

  const sedePersone = useMemo(() => {
    return persone.filter(p => personaSede.some(ps => ps.persona_id === p.id && ps.sede_id === selectedSedeId));
  }, [persone, personaSede, selectedSedeId]);

  const getAppointmentsForSlot = useCallback((date: string, time: string, personaId: string) => {
    const dayApts = appointmentsByDayPerson.get(`${date}|${personaId}`) ?? [];
    return dayApts.filter(apt => {
      const s = apt.ora_inizio ? apt.ora_inizio.substring(0, 5) : '';
      const e = apt.ora_fine   ? apt.ora_fine.substring(0, 5)   : '';
      return time >= s && time < e;
    });
  }, [appointmentsByDayPerson]);

  const getUffChiusoApts = useCallback((dateStr: string, slotLabel: string, personaId: string): Appuntamento[] => {
    const dayApts = appointmentsByDayPerson.get(`${dateStr}|${personaId}`) ?? [];
    return dayApts.filter(a =>
      slotLabel >= a.ora_inizio.substring(0, 5) &&
      slotLabel < a.ora_fine.substring(0, 5) &&
      (a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO'
    );
  }, [appointmentsByDayPerson]);

  const isUffChiusoSlot = useCallback((dateStr: string, slotLabel: string, personaId: string): boolean => {
    const dayApts = appointmentsByDayPerson.get(`${dateStr}|${personaId}`) ?? [];
    const covering = dayApts.filter(a => slotLabel >= a.ora_inizio.substring(0, 5) && slotLabel < a.ora_fine.substring(0, 5));
    return covering.length > 0 && covering.every(a => (a.cliente ?? '').trim().toUpperCase() === 'UFF CHIUSO');
  }, [appointmentsByDayPerson]);

  const getDayAvailability = useCallback((dateStr: string, personaId: string, day: Date): DayAvailability => {
    if (isDayClosedForSede(day)) return 'closed';
    const slots = getTimeSlotsForDay(day);
    const n = (appointmentsByDayPerson.get(`${dateStr}|${personaId}`) ?? []).length;
    if (n === 0) return 'free';
    if (n >= slots.length) return 'full';
    return 'partial';
  }, [isDayClosedForSede, getTimeSlotsForDay, appointmentsByDayPerson]);

  const getFreeSlots = useCallback((dateStr: string, personaId: string, day: Date): number => {
    const occupied = appointments.filter(apt => apt.sede_id === selectedSedeId && apt.data === dateStr && apt.persona_id === personaId).length;
    return Math.max(0, getTimeSlotsForDay(day).length - occupied);
  }, [appointments, selectedSedeId, getTimeSlotsForDay]);

  const getFirstAvailableDay = useCallback((personaId: string): string | null => {
    const today = new Date();
    for (let i = 0; i < 90; i++) {
      const d = addDays(today, i);
      if (isDayClosedForSede(d)) continue;
      const s = format(d, 'yyyy-MM-dd');
      const a = getDayAvailability(s, personaId, d);
      if (a === 'free' || a === 'partial') return s;
    }
    return null;
  }, [isDayClosedForSede, getDayAvailability]);

  // Mutations
  const handleCreateAppointment = useCallback(async (data: any) => {
    if (!data.persona_id || !data.sede_id || !data.data || !data.ora_inizio || !data.ora_fine) {
      alert('Compila tutti i campi obbligatori');
      return;
    }
    const tempId = `__optimistic_${Date.now()}`;
    markLocalMutation();
    setAppointments(prev => [...prev, { ...data, id: tempId }]);
    try {
      const res = await fetch('/api/appuntamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const created: Appuntamento = await res.json();
      setAppointments(prev => prev.map(a => a.id === tempId ? created : a));
    } catch (err) {
      setAppointments(prev => prev.filter(a => a.id !== tempId));
      alert('Errore imprevisto: ' + String(err));
    }
  }, [markLocalMutation]);

  const handleUpdateAppointment = useCallback(async (id: string, data: any) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    markLocalMutation();
    try {
      const res = await fetch(`/api/appuntamenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated: Appuntamento = await res.json();
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err) {
      try {
        const res = await fetch('/api/appuntamenti');
        const d = await res.json();
        if (d) setAppointments(d);
      } catch { }
      alert('Errore imprevisto: ' + String(err));
    }
  }, [markLocalMutation]);

  const handleDeleteAppointment = useCallback(async (id: string) => {
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
  }, [appointments, markLocalMutation]);

  const handleEditModeSlotClick = useCallback(async (dateStr: string, slotLabel: string, personaId: string, day: Date) => {
    if (!selectedSedeId) return;
    const realApts = appointments.filter(a =>
      a.data === dateStr &&
      a.sede_id === selectedSedeId &&
      a.persona_id === personaId &&
      slotLabel >= a.ora_inizio.substring(0, 5) &&
      slotLabel < a.ora_fine.substring(0, 5) &&
      (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
    );
    if (realApts.length > 0) return;

    const uffApts = getUffChiusoApts(dateStr, slotLabel, personaId);
    if (uffApts.length > 0) {
      const removedIds = uffApts.map(a => a.id);
      markLocalMutation();
      setAppointments(prev => prev.filter(a => !removedIds.includes(a.id)));
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
        } catch {
          await loadData();
          alert('Errore durante lo sblocco');
          return;
        }
      }
    } else {
      const motivo   = window.prompt('Motivo chiusura (es. Ferie, Formazione, ...):') ?? '';
      const slots    = getTimeSlotsForDay(day);
      const endSlots = getEndTimeSlotsForDay(day);
      const idx      = slots.findIndex(s => s.label === slotLabel);
      const oraFine  = idx !== -1 && idx + 1 < endSlots.length ? endSlots[idx + 1].label : endSlots[endSlots.length - 1].label;
      const tempId   = `__optimistic_${Date.now()}`;
      markLocalMutation();
      setAppointments(prev => [
        ...prev,
        {
          id: tempId,
          persona_id: personaId,
          sede_id: selectedSedeId,
          data: dateStr,
          ora_inizio: slotLabel,
          ora_fine: oraFine,
          cliente: 'UFF CHIUSO',
          note: motivo,
        } as Appuntamento,
      ]);
      try {
        const res = await fetch('/api/appuntamenti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persona_id: personaId,
            sede_id: selectedSedeId,
            data: dateStr,
            ora_inizio: slotLabel,
            ora_fine: oraFine,
            cliente: 'UFF CHIUSO',
            note: motivo,
          }),
        });
        if (!res.ok) throw new Error();
        const created: Appuntamento = await res.json();
        setAppointments(prev => prev.map(a => a.id === tempId ? created : a));
      } catch {
        setAppointments(prev => prev.filter(a => a.id !== tempId));
        alert('Errore durante il blocco');
      }
    }
  }, [selectedSedeId, appointments, getUffChiusoApts, markLocalMutation, getTimeSlotsForDay, getEndTimeSlotsForDay, loadData]);

  const handleDrop = useCallback(async (
    date: string,
    newTime: string,
    personaId: string,
    day: Date,
    draggedAppointment: { appointment: Appuntamento; originalTime: string } | null,
    onFinishDrag: () => void
  ) => {
    if (!draggedAppointment) return;
    const { appointment, originalTime } = draggedAppointment;
    const slots    = getTimeSlotsForDay(day);
    const endSlots = getEndTimeSlotsForDay(day);
    const origIdx  = slots.findIndex(s => s.label === originalTime);
    const newIdx   = slots.findIndex(s => s.label === newTime);
    if (origIdx === -1 || newIdx === -1) { onFinishDrag(); return; }

    const diff = newIdx - origIdx;
    const startIdx = slots.findIndex(s => s.label === appointment.ora_inizio.substring(0, 5));
    let endIdx = slots.findIndex(s => s.label === appointment.ora_fine.substring(0, 5));
    if (endIdx === -1) endIdx = slots.length;
    const ns = startIdx + diff;
    const ne = endIdx + diff;
    if (ns < 0 || ne > slots.length) {
      alert("Impossibile spostare l'appuntamento in questo orario");
      onFinishDrag();
      return;
    }
    const newStart = slots[ns].label;
    const newEnd   = ne < slots.length ? slots[ne].label : endSlots[endSlots.length - 1].label;

    const hasConflict = appointments.some(apt => {
      if (apt.id === appointment.id || apt.persona_id !== personaId || apt.sede_id !== appointment.sede_id || apt.data !== date) return false;
      return newStart < apt.ora_fine.substring(0, 5) && newEnd > apt.ora_inizio.substring(0, 5);
    });
    if (hasConflict) {
      alert('Impossibile spostare: fascia già occupata');
      onFinishDrag();
      return;
    }

    const snapshot = { ...appointment };
    const updatedData = {
      persona_id: personaId,
      sede_id: appointment.sede_id,
      ora_inizio: newStart,
      ora_fine: newEnd,
      cliente: appointment.cliente,
      note: appointment.note,
      highlight: appointment.highlight,
    };
    markLocalMutation();
    setAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, ...updatedData, data: date } : a));
    onFinishDrag();

    try {
      const res = await fetch(`/api/appuntamenti/${appointment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error();
      const updated: Appuntamento = await res.json();
      setAppointments(prev => prev.map(a => a.id === appointment.id ? updated : a));
    } catch {
      setAppointments(prev => prev.map(a => a.id === snapshot.id ? snapshot : a));
      alert('Errore imprevisto');
    }
  }, [getTimeSlotsForDay, getEndTimeSlotsForDay, appointments, markLocalMutation]);

  return {
    appointments,
    setAppointments,
    persone,
    sedi,
    personaSede,
    selectedSedeId,
    setSelectedSedeId,
    selectedSede,
    selectedSedeNome,
    isBorgoSede,
    sedePersone,
    personeMap,
    appointmentsByDayPerson,
    realtimeFlash,
    sediRef,
    markLocalMutation,
    getTimeSlotsForDay,
    getEndTimeSlotsForDay,
    isDayClosedForSede,
    isPersonaDisabledForDay,
    isDayFullyClosedForAllPersone,
    getAppointmentsForSlot,
    getUffChiusoApts,
    isUffChiusoSlot,
    getDayAvailability,
    getFreeSlots,
    getFirstAvailableDay,
    handleCreateAppointment,
    handleUpdateAppointment,
    handleDeleteAppointment,
    handleEditModeSlotClick,
    handleDrop,
  };
}
