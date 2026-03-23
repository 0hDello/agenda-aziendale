'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  User,
  Lock,
  Unlock,
  MessageSquare,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import React from 'react';
import EpasaAppointmentModal, { HIGHLIGHT_STYLE } from './EpasaAppointmentModal';

// ─── Configurazione fissa ─────────────────────────────────────────────────────

const AUDIO_MEDICAL_DAYS: { date: string; sede_id: string; sede_label: string }[] = [
  { date: '2026-05-13', sede_id: 'imola', sede_label: 'Imola' },
  { date: '2026-05-21', sede_id: 'borgo', sede_label: 'Borgo' },
  { date: '2026-06-17', sede_id: 'imola', sede_label: 'Imola' },
];

const TIME_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];

const OPERATOR_ID    = 'audio-medical';
const OPERATOR_LABEL = 'AUDIO MEDICAL';
const OPERATOR_COLOR = '#005CA9';

const SEDI_MOCK = AUDIO_MEDICAL_DAYS.map(d => ({ id: d.sede_id, nome: d.sede_label, colore: OPERATOR_COLOR }));
const OPERATORI_MOCK = [{ id: OPERATOR_ID, nome: OPERATOR_LABEL, colore: OPERATOR_COLOR }];

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  sede_id: string;
  data: string;
  ora: string;
  cliente: string;
  note?: string;
  highlight?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AudioMedicalCalendar() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [editMode, setEditMode]         = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string; sedeId: string } | null>(null);
  const [editingApt, setEditingApt]     = useState<Appointment | null>(null);
  const [realtimeFlash, setRealtimeFlash] = useState(false);

  const sseReloadTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const localMutationAtRef = useRef<number>(0);
  const SSE_RELOAD_DEBOUNCE   = 800;
  const LOCAL_MUTATION_WINDOW = 3000;

  // ─── Caricamento dati ───────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/audio-medical/appuntamenti');
      const data = await res.json();
      if (Array.isArray(data)) setAppointments(data);
    } catch (e) {
      console.error('Errore caricamento appuntamenti Audio Medical:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── SSE real-time ──────────────────────────────────────────────────────────

  useEffect(() => {
    const es = new EventSource('/api/audio-medical/events');
    es.addEventListener('update', () => {
      if (Date.now() - localMutationAtRef.current < LOCAL_MUTATION_WINDOW) return;
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
      sseReloadTimerRef.current = setTimeout(async () => {
        try {
          const res  = await fetch('/api/audio-medical/appuntamenti');
          const data = await res.json();
          if (Array.isArray(data)) {
            setAppointments(data);
            setRealtimeFlash(true);
            setTimeout(() => setRealtimeFlash(false), 1500);
          }
        } catch { }
      }, SSE_RELOAD_DEBOUNCE);
    });
    es.onerror = () => {};
    return () => {
      es.close();
      if (sseReloadTimerRef.current) clearTimeout(sseReloadTimerRef.current);
    };
  }, []);

  const markLocalMutation = () => { localMutationAtRef.current = Date.now(); };

  // ─── CRUD appuntamenti ──────────────────────────────────────────────────────

  const handleCreate = async (formData: any) => {
    const tempId = `__optimistic_${Date.now()}`;
    markLocalMutation();
    setAppointments(prev => [...prev, { ...formData, id: tempId }]);
    try {
      const res = await fetch('/api/audio-medical/appuntamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      const newApt: Appointment = await res.json();
      setAppointments(prev => prev.map(a => a.id === tempId ? newApt : a));
    } catch {
      setAppointments(prev => prev.filter(a => a.id !== tempId));
      alert("Errore durante la creazione dell'appuntamento");
    }
  };

  const handleUpdate = async (id: string, formData: any) => {
    markLocalMutation();
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...formData } : a));
    try {
      const res = await fetch(`/api/audio-medical/appuntamenti/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      const updated: Appointment = await res.json();
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
    } catch {
      await loadData();
      alert("Errore durante l'aggiornamento dell'appuntamento");
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = appointments.find(a => a.id === id);
    markLocalMutation();
    setAppointments(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch(`/api/audio-medical/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      if (snapshot) setAppointments(prev => [...prev, snapshot]);
      alert("Errore durante l'eliminazione dell'appuntamento");
    }
  };

  // ─── Blocco/sblocco slot in editMode ───────────────────────────────────────

  const handleEditModeSlotClick = async (dateStr: string, time: string, sedeId: string) => {
    const realApts = appointments.filter(
      a => a.data === dateStr && a.ora === time && a.cliente.trim().toUpperCase() !== 'UFF CHIUSO',
    );
    if (realApts.length > 0) return;

    const uffApts = appointments.filter(
      a => a.data === dateStr && a.ora === time && a.cliente.trim().toUpperCase() === 'UFF CHIUSO',
    );

    if (uffApts.length > 0) {
      const ids = uffApts.map(a => a.id);
      markLocalMutation();
      setAppointments(prev => prev.filter(a => !ids.includes(a.id)));
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/audio-medical/appuntamenti/${apt.id}`, { method: 'DELETE' });
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
      const newApt: Appointment = {
        id: tempId,
        sede_id: sedeId,
        data: dateStr,
        ora: time,
        cliente: 'UFF CHIUSO',
        note: motivo,
      };
      markLocalMutation();
      setAppointments(prev => [...prev, newApt]);
      try {
        const res = await fetch('/api/audio-medical/appuntamenti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newApt),
        });
        if (!res.ok) throw new Error();
        const saved: Appointment = await res.json();
        setAppointments(prev => prev.map(a => a.id === tempId ? saved : a));
      } catch {
        setAppointments(prev => prev.filter(a => a.id !== tempId));
        alert('Errore durante il blocco');
      }
    }
  };

  // ─── Helper slot ────────────────────────────────────────────────────────────

  const getSlotApts  = (dateStr: string, time: string) =>
    appointments.filter(a => a.data === dateStr && a.ora === time);

  const isUffChiuso = (dateStr: string, time: string) => {
    const s = appointments.filter(a => a.data === dateStr && a.ora === time);
    return s.length > 0 && s.every(a => a.cliente.trim().toUpperCase() === 'UFF CHIUSO');
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: OPERATOR_COLOR, borderTopColor: 'transparent' }} />
          <p className="text-gray-500 font-medium">Caricamento agenda Audio Medical…</p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white border-t-4" style={{ borderColor: OPERATOR_COLOR }}>

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 bg-white border-b-2 px-4 py-3" style={{ borderColor: `${OPERATOR_COLOR}30` }}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg shadow-lg" style={{ backgroundColor: OPERATOR_COLOR }}>
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" style={{ color: OPERATOR_COLOR }}>
                  Agenda Screening
                </h1>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  realtimeFlash
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-50 text-gray-400 border border-gray-200'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${realtimeFlash ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {realtimeFlash ? 'Aggiornato' : 'Live'}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                13 mag · Imola &nbsp;|&nbsp; 21 mag · Borgo &nbsp;|&nbsp; 17 giu · Imola &nbsp;·&nbsp; 9:00–12:30
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative group">
              <button
                onClick={() => setEditMode(e => !e)}
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow border-2 ${
                  editMode
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
                }`}
                title={editMode ? 'Disattiva modalità modifica' : 'Attiva modalità modifica'}>
                {editMode ? <Unlock size={16} /> : <Lock size={16} />}
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-30">
                {editMode ? 'Esci dalla modifica' : 'Modifica slot'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2" style={{ borderColor: `${OPERATOR_COLOR}30` }}>
              <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-300" style={{ width: '60px' }}>
                <span style={{ color: OPERATOR_COLOR }}>Orario</span>
              </th>
              <th className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] border-r border-gray-300">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: OPERATOR_COLOR }}>
                    <User size={14} className="text-white" />
                  </div>
                  <span className="font-bold" style={{ color: OPERATOR_COLOR }}>{OPERATOR_LABEL}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {AUDIO_MEDICAL_DAYS.map(({ date: dateStr, sede_id, sede_label }) => {
              const dayDate = new Date(dateStr + 'T12:00:00');
              const today   = format(new Date(), 'yyyy-MM-dd');
              const isToday = dateStr === today;

              return (
                <React.Fragment key={dateStr}>

                  {/* ── Intestazione giorno ── */}
                  <tr data-audio-medical-date={dateStr}>
                    <td colSpan={2} className="p-0 sticky left-0 z-10"
                      style={{ backgroundColor: isToday ? OPERATOR_COLOR : '#EEF4FB' }}>
                      <div className={`flex items-center justify-between px-4 py-2 border-b-2`}
                        style={{ borderColor: isToday ? 'rgba(255,255,255,0.2)' : `${OPERATOR_COLOR}20` }}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm text-white`}
                            style={{ backgroundColor: isToday ? 'rgba(255,255,255,0.2)' : OPERATOR_COLOR }}>
                            {format(dayDate, 'd')}
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-0.5`}
                              style={{ color: isToday ? 'rgba(233,213,255,1)' : `${OPERATOR_COLOR}80` }}>
                              {format(dayDate, 'EEEE', { locale: it })}
                            </p>
                            <p className={`text-sm font-bold leading-tight`}
                              style={{ color: isToday ? '#ffffff' : OPERATOR_COLOR }}>
                              {format(dayDate, 'dd MMMM yyyy', { locale: it })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                              Oggi
                            </span>
                          )}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/60"
                            style={{ color: OPERATOR_COLOR }}>
                            <Building2 size={10} />
                            <span>{sede_label}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* ── Slot orari ── */}
                  {TIME_SLOTS.map(time => {
                    const slotApts = getSlotApts(dateStr, time);
                    const isUffC   = isUffChiuso(dateStr, time);

                    // Slot bloccato (UFF CHIUSO)
                    if (isUffC) {
                      const motivo = slotApts[0]?.note?.trim() || '';
                      return (
                        <tr key={`${dateStr}-${time}`}>
                          <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-300 border-b border-gray-300"
                            style={{ width: '60px', height: '45px' }}>
                            <div className="px-1 py-2 text-xs font-semibold text-gray-700">{time}</div>
                          </td>
                          <td
                            className={`relative p-0 border-r border-slate-500 border-b border-slate-500 bg-slate-600 ${editMode ? 'cursor-pointer hover:bg-slate-700' : 'select-none'}`}
                            style={{ height: '45px' }}
                            title={editMode ? 'Clicca per sbloccare' : motivo ? `Ufficio chiuso – ${motivo}` : 'Ufficio chiuso'}
                            onClick={() => editMode && handleEditModeSlotClick(dateStr, time, sede_id)}>
                            <div className="w-full h-full flex items-center px-2 gap-1.5">
                              <Lock size={9} className="text-slate-300 flex-shrink-0" />
                              <span className="text-[10px] text-slate-200 font-semibold italic truncate flex-1">
                                {motivo || 'uff. chiuso'}
                              </span>
                              {editMode && <Unlock size={9} className="text-amber-300 flex-shrink-0" />}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Slot con appuntamento
                    if (slotApts.length > 0) {
                      const apt   = slotApts[0];
                      const hlKey = apt.highlight || '';
                      const hl    = HIGHLIGHT_STYLE[hlKey] ?? HIGHLIGHT_STYLE[''];
                      return (
                        <tr key={`${dateStr}-${time}`}>
                          <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-300 border-b border-gray-300"
                            style={{ width: '60px', height: '45px' }}>
                            <div className="px-1 py-2 text-xs font-semibold text-gray-700">{time}</div>
                          </td>
                          <td className="relative p-0 border-r border-gray-300 border-b border-gray-300 group/slot" style={{ height: '45px' }}>
                            <div
                              onClick={() => {
                                if (!editMode) {
                                  setEditingApt(apt);
                                  setSelectedSlot({ date: dateStr, time, sedeId: sede_id });
                                  setShowModal(true);
                                }
                              }}
                              className={`w-full h-full px-2 py-1 ${hl.cell} border-l-4 ${hl.border} flex items-center ${
                                editMode ? 'cursor-not-allowed' : 'hover:brightness-95 cursor-pointer'
                              }`}
                              title={editMode ? 'Slot occupato: non bloccabile' : undefined}>
                              <div className="w-full overflow-hidden">
                                <div className="flex items-center gap-1 w-full">
                                  <User size={10} className={`${hl.text} flex-shrink-0`} />
                                  <span className={`text-[10px] font-bold truncate ${hl.text} flex-1 min-w-0`}>{apt.cliente}</span>
                                  {apt.note && !editMode && <MessageSquare size={9} className={`${hl.text} flex-shrink-0 opacity-60`} />}
                                </div>
                              </div>
                            </div>
                            {!editMode && apt.note && (
                              <div className="absolute bottom-full left-0 mb-1 z-[60] pointer-events-none opacity-0 group-hover/slot:opacity-100"
                                style={{ minWidth: '160px', maxWidth: '240px' }}>
                                <div className="bg-purple-50 border border-purple-200 text-purple-800 text-[11px] rounded-lg shadow-lg px-3 py-2 leading-relaxed">
                                  <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-purple-200">
                                    <MessageSquare size={10} className="text-purple-500 flex-shrink-0" />
                                    <span className="font-bold text-purple-600 text-[10px] uppercase tracking-wide">Nota</span>
                                  </div>
                                  <p className="whitespace-pre-wrap break-words text-purple-700">{apt.note}</p>
                                </div>
                                <div className="w-0 h-0 ml-4" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #e9d5ff' }} />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    // Slot libero
                    return (
                      <tr key={`${dateStr}-${time}`}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-300 border-b border-gray-300"
                          style={{ width: '60px', height: '45px' }}>
                          <div className="px-1 py-2 text-xs font-semibold text-gray-700">{time}</div>
                        </td>
                        <td
                          className={`relative p-0 border-r border-gray-200 border-b border-gray-200 bg-white ${
                            editMode ? 'cursor-pointer hover:bg-amber-50' : 'hover:bg-blue-50 cursor-pointer'
                          }`}
                          style={{ height: '45px' }}
                          onClick={() => {
                            if (editMode) {
                              handleEditModeSlotClick(dateStr, time, sede_id);
                            } else {
                              setEditingApt(null);
                              setSelectedSlot({ date: dateStr, time, sedeId: sede_id });
                              setShowModal(true);
                            }
                          }}>
                          {editMode && (
                            <div className="w-full h-full flex items-center justify-center opacity-20">
                              <Lock size={11} className="text-amber-600" />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── MODAL ── */}
      {showModal && selectedSlot && (
        <EpasaAppointmentModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingApt(null); setSelectedSlot(null); }}
          onSave={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          existingAppointment={editingApt}
          sedi={SEDI_MOCK}
          operatori={OPERATORI_MOCK}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          selectedSedeId={selectedSlot.sedeId}
          defaultOperatoreId={OPERATOR_ID}
        />
      )}
    </div>
  );
}
