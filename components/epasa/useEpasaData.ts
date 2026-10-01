'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, isWeekend, addDays, getDay } from 'date-fns';
import {
  Sede,
  Operatore,
  Appointment,
  GiornoChiuso,
  DayAvailability,
  TIME_SLOTS_IMOLA,
  IMOLA_SPECIAL_SLOTS,
  MILECE_START_TIME,
  getTimeSlotsForSede,
  getOperatorsForSedeId,
  dateStrToLocal,
  isBorgoWorkingDay,
  isMileceWorkingDay,
  isDateIn2027OrLater,
  isMileceAfternoonWorkingDay,
  isLoredanaAfternoonBlocked,
  isLoredanaAfternoonEmpty,
  SSE_RELOAD_DEBOUNCE,
  LOCAL_MUTATION_WINDOW,
} from './types';

export function useEpasaData() {
  const [sedi, setSedi]                       = useState<Sede[]>([]);
  const [operatori, setOperatori]             = useState<Operatore[]>([]);
  const [selectedSede, setSelectedSede]       = useState<Sede | null>(null);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [giorniChiusi, setGiorniChiusi]       = useState<GiornoChiuso[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [realtimeFlash, setRealtimeFlash]     = useState(false);

  const sediRef            = useRef<Sede[]>([]);
  const sseReloadTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const localMutationAtRef = useRef<number>(0);

  useEffect(() => { sediRef.current = sedi; }, [sedi]);

  const markLocalMutation = useCallback(() => {
    localMutationAtRef.current = Date.now();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sediRes, opRes, appRes, gcRes] = await Promise.all([
        fetch('/api/epasa/sedi'),
        fetch('/api/epasa/operatori'),
        fetch('/api/epasa/appuntamenti'),
        fetch('/api/epasa/giorni-chiusi'),
      ]);
      const [sediData, opData, appData, gcData] = await Promise.all([
        sediRes.json(),
        opRes.json(),
        appRes.json(),
        gcRes.json(),
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Default to Imola sede
  useEffect(() => {
    if (sedi.length > 0 && !selectedSede) {
      const imola = sedi.find(s => s.id === 'imola');
      setSelectedSede(imola || sedi[0]);
    }
  }, [sedi, selectedSede]);

  // Realtime SSE
  useEffect(() => {
    const es = new EventSource('/api/epasa/events');
    es.addEventListener('update', () => {
      if (Date.now() - localMutationAtRef.current < LOCAL_MUTATION_WINDOW) return;
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
        } catch { }
      }, SSE_RELOAD_DEBOUNCE);
    });
    es.onerror = () => {};
    return () => {
      es.close();
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
    };
  }, []);

  const currentTimeSlots = useMemo(() => {
    return selectedSede ? getTimeSlotsForSede(selectedSede.id) : TIME_SLOTS_IMOLA;
  }, [selectedSede]);

  const getTimeSlotsForDay = useCallback((day: Date | string) => {
    return selectedSede ? getTimeSlotsForSede(selectedSede.id, day) : TIME_SLOTS_IMOLA;
  }, [selectedSede]);

  const isMileceTimeBlocked = useCallback((operator: string, day: Date, time: string) => {
    if (operator !== 'MILECE') return false;
    if (!isMileceWorkingDay(day)) return false;
    return time === '08:00';
  }, []);

  const isLoredanaBlocked = useCallback((operator: string, day: Date, time: string) => {
    return isLoredanaAfternoonEmpty(operator, time);
  }, []);

  const isSedeOperatorDayClosed = useCallback((sedeId: string, operator: string, day: Date) => {
    if (isWeekend(day)) return true;
    if (sedeId === 'cspt')  return getDay(day) !== 1;
    if (sedeId === 'borgo') return !isBorgoWorkingDay(day);
    if (sedeId === 'imola' && operator === 'MILECE') return !isMileceWorkingDay(day);
    return false;
  }, []);

  const isGiornoChiuso = useCallback((dateStr: string, operatoreId: string) => {
    return giorniChiusi.some(g => g.data === dateStr && (g.operatore_id === null || g.operatore_id === operatoreId));
  }, [giorniChiusi]);

  const getUffChiusoApts = useCallback((dateStr: string, time: string, operatoreId: string): Appointment[] => {
    if (!selectedSede) return [];
    return allAppointments.filter(
      a => a.sede_id === selectedSede.id &&
           a.data === dateStr &&
           a.ora === time &&
           a.operatore_id === operatoreId &&
           a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
    );
  }, [selectedSede, allAppointments]);

  const isUffChiusoSlot = useCallback((dateStr: string, time: string, operatoreId: string): boolean => {
    if (!selectedSede) return false;
    const s = allAppointments.filter(
      a => a.sede_id === selectedSede.id &&
           a.data === dateStr &&
           a.ora === time &&
           a.operatore_id === operatoreId
    );
    return s.length > 0 && s.every(a => a.cliente.trim().toUpperCase() === 'UFF CHIUSO');
  }, [selectedSede, allAppointments]);

  const getRealAppointmentsCount = useCallback((dateStr: string, operatoreId: string) => {
    if (!selectedSede) return 0;
    return allAppointments.filter(
      a => a.sede_id === selectedSede.id &&
           a.data === dateStr &&
           a.operatore_id === operatoreId &&
           a.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
    ).length;
  }, [selectedSede, allAppointments]);

  const getUffChiusoSlotsCount = useCallback((dateStr: string, operatoreId: string) => {
    if (!selectedSede) return 0;
    return getTimeSlotsForSede(selectedSede.id, dateStr).filter(t => isUffChiusoSlot(dateStr, t, operatoreId)).length;
  }, [selectedSede, isUffChiusoSlot]);

  const getAppointmentsForSlot = useCallback((date: string, time: string, operator: string) => {
    if (!selectedSede) return [];
    return allAppointments.filter(
      a => a.sede_id === selectedSede.id && a.data === date && a.ora === time && a.operatore_id === operator
    );
  }, [selectedSede, allAppointments]);

  const getDayAvailability = useCallback((date: string, operator: string): DayAvailability => {
    if (!selectedSede) return 'free';
    const dateObj = dateStrToLocal(date);
    if (isSedeOperatorDayClosed(selectedSede.id, operator, dateObj)) return 'closed';
    if (isGiornoChiuso(date, operator)) return 'closed';
    const slots = getTimeSlotsForSede(selectedSede.id, dateObj);
    const timeBlockedCount = slots.filter(t => 
      isMileceTimeBlocked(operator, dateObj, t) ||
      isLoredanaBlocked(operator, dateObj, t)
    ).length;
    const specialSlotCount = (selectedSede.id === 'imola' && operator !== 'MILECE')
      ? slots.filter(t => IMOLA_SPECIAL_SLOTS.includes(t)).length : 0;
    const totalSlots    = slots.length - timeBlockedCount - specialSlotCount;
    const occupiedSlots = getRealAppointmentsCount(date, operator) + getUffChiusoSlotsCount(date, operator);
    if (totalSlots <= 0)             return 'closed';
    if (occupiedSlots === 0)         return 'free';
    if (occupiedSlots >= totalSlots) return 'full';
    return 'partial';
  }, [selectedSede, isSedeOperatorDayClosed, isGiornoChiuso, isMileceTimeBlocked, isLoredanaBlocked, getRealAppointmentsCount, getUffChiusoSlotsCount]);

  const getFirstAvailableDay = useCallback((operator: string): string | null => {
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
  }, [selectedSede, isSedeOperatorDayClosed, isGiornoChiuso, getDayAvailability]);

  const operatorsInSede = useMemo(() => {
    if (!selectedSede) return [];
    return getOperatorsForSedeId(selectedSede.id, operatori.map(op => op.id).sort());
  }, [selectedSede, operatori]);

  const getSedeOrariLabel = useCallback((date?: Date) => {
    if (!selectedSede) return '';
    if (selectedSede.id === 'cspt')  return 'Lunedì 14:00-16:30';
    if (selectedSede.id === 'borgo') return 'Martedì (sett. 2 e 3) 9:00-11:30';
    if (date && isMileceAfternoonWorkingDay(date)) {
      return '8:00-12:00 / 14:00-16:00';
    }
    return '8:00-12:00';
  }, [selectedSede]);

  // Mutations
  const handleCreateAppointment = useCallback(async (data: any) => {
    const tempId = `__optimistic_${Date.now()}`;
    markLocalMutation();
    setAllAppointments(prev => [...prev, { ...data, id: tempId }]);
    try {
      const res = await fetch('/api/epasa/appuntamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const newApt: Appointment = await res.json();
      setAllAppointments(prev => prev.map(a => a.id === tempId ? newApt : a));
    } catch {
      setAllAppointments(prev => prev.filter(a => a.id !== tempId));
      alert("Errore durante la creazione dell'appuntamento");
    }
  }, [markLocalMutation]);

  const handleUpdateAppointment = useCallback(async (id: string, data: any) => {
    markLocalMutation();
    setAllAppointments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
    try {
      const res = await fetch(`/api/epasa/appuntamenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated: Appointment = await res.json();
      setAllAppointments(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      try {
        const res = await fetch('/api/epasa/appuntamenti');
        const d = await res.json();
        if (d) setAllAppointments(d);
      } catch { }
      alert("Errore durante l'aggiornamento dell'appuntamento");
    }
  }, [markLocalMutation]);

  const handleDeleteAppointment = useCallback(async (id: string) => {
    const snapshot = allAppointments.find(a => a.id === id);
    markLocalMutation();
    setAllAppointments(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch(`/api/epasa/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      if (snapshot) setAllAppointments(prev => [...prev, snapshot]);
      alert("Errore durante l'eliminazione dell'appuntamento");
    }
  }, [allAppointments, markLocalMutation]);

  const handleEditModeSlotClick = useCallback(async (dateStr: string, time: string, operator: string) => {
    if (!selectedSede) return;
    const realApts = allAppointments.filter(
      a => a.sede_id === selectedSede.id &&
           a.data === dateStr &&
           a.ora === time &&
           a.operatore_id === operator &&
           a.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
    );
    if (realApts.length > 0) return;

    const uffApts = getUffChiusoApts(dateStr, time, operator);
    if (uffApts.length > 0) {
      const removedIds = uffApts.map(a => a.id);
      markLocalMutation();
      setAllAppointments(prev => prev.filter(a => !removedIds.includes(a.id)));
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
        } catch {
          await loadData();
          alert('Errore durante lo sblocco');
          return;
        }
      }
    } else {
      const motivo = window.prompt('Motivo chiusura (es. Ferie, Formazione, ...):') ?? '';
      const tempId = `__optimistic_${Date.now()}`;
      markLocalMutation();
      setAllAppointments(prev => [
        ...prev,
        {
          id: tempId,
          sede_id: selectedSede.id,
          operatore_id: operator,
          data: dateStr,
          ora: time,
          cliente: 'UFF CHIUSO',
          mese: dateStr.substring(0, 7),
          note: motivo,
        },
      ]);
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
            note: motivo,
          }),
        });
        if (!res.ok) throw new Error();
        const newApt: Appointment = await res.json();
        setAllAppointments(prev => prev.map(a => a.id === tempId ? newApt : a));
      } catch {
        setAllAppointments(prev => prev.filter(a => a.id !== tempId));
        alert('Errore durante il blocco');
      }
    }
  }, [selectedSede, allAppointments, getUffChiusoApts, markLocalMutation, loadData]);

  return {
    sedi,
    operatori,
    selectedSede,
    setSelectedSede,
    allAppointments,
    setAllAppointments,
    giorniChiusi,
    loading,
    realtimeFlash,
    sediRef,
    currentTimeSlots,
    getTimeSlotsForDay,
    getTimeSlotsForSede,
    operatorsInSede,
    markLocalMutation,
    isMileceTimeBlocked,
    isLoredanaAfternoonBlocked: isLoredanaBlocked,
    isSedeOperatorDayClosed,
    isGiornoChiuso,
    getUffChiusoApts,
    isUffChiusoSlot,
    getRealAppointmentsCount,
    getUffChiusoSlotsCount,
    getAppointmentsForSlot,
    getDayAvailability,
    getFirstAvailableDay,
    getSedeOrariLabel,
    handleCreateAppointment,
    handleUpdateAppointment,
    handleDeleteAppointment,
    handleEditModeSlotClick,
  };
}
