'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Lock, Unlock, Building2, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, ChevronDown, Plus,
} from 'lucide-react';
import {
  format,
  isWeekend,
  getDay,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { it } from 'date-fns/locale';
import EpasaAppointmentModal from './EpasaAppointmentModal';

// ─── Tipi ─────────────────────────────────────────────────────────────────────
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

export interface LoredanaViewProps {
  allAppointments: Appointment[];
  giorniChiusi: GiornoChiuso[];
  sedi: Sede[];
  operatori: Operatore[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// ─── Costanti ───────────────────────────────────────────────────────────────────
const LOREDANA_ID  = 'LOREDANA';
const MIN_DATE     = new Date(2026, 0, 1);
const TOPBAR_H     = 53;
const HEADER_H     = 54;
const ROW_MIN      = 44;
const FILL_RATIO   = 0.82;
const LABEL_W      = 68;
const COL_WIDTH    = 115;
const COL_WIDTH_WE = 48;

const OPERATOR_COLOR        = '#005CA9';
const OPERATOR_COLOR_LIGHT  = '#E6F2FF';
const OPERATOR_COLOR_HOVER  = '#D1E7FF';
const OPERATOR_COLOR_BORDER = '#BFDBFE';
const OPERATOR_COLOR_TEXT   = '#004080';

const TIME_SLOTS_MAP: Record<string, string[]> = {
  imola: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
  cspt:  ['14:00','14:30','15:00','15:30','16:00','16:30'],
  borgo: ['09:00','09:30','10:00','10:30','11:00','11:30'],
};

const LOREDANA_SEDI = ['imola', 'cspt', 'borgo'];

// ─── Regole apertura ─────────────────────────────────────────────────────────
const isBorgoWorkingDay = (date: Date): boolean => {
  const y   = date.getFullYear();
  const m   = date.getMonth();
  const d   = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  if (dow !== 2) return false;
  const exceptions: Record<string, number[]> = {
    '2026-9':  [8, 15],
    '2026-10': [6, 20],
    '2026-12': [15],
  };
  const key = `${y}-${m + 1}`;
  if (exceptions[key]) return exceptions[key].includes(d);
  const dowFirst       = new Date(y, m, 1, 12).getDay();
  const offsetMonFirst = (dowFirst + 6) % 7;
  const firstMondayD   = offsetMonFirst === 0 ? 1 : 8 - offsetMonFirst;
  const offsetMon = (dow + 6) % 7;
  const mondayD   = d - offsetMon;
  const diffDays  = mondayD - firstMondayD;
  if (diffDays < 0) return false;
  const week = Math.round(diffDays / 7) + 1;
  return week === 2 || week === 3;
};

const isSedeOpenOnDay = (sedeId: string, date: Date): boolean => {
  if (isWeekend(date)) return false;
  const dow = getDay(date);
  if (sedeId === 'cspt')  return dow === 1;
  if (sedeId === 'borgo') return isBorgoWorkingDay(date);
  return true;
};

const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

// ─── Hook: calcola altezza riga ───────────────────────────────────────────────
function useRowHeight(slotCount: number): number {
  const [rowH, setRowH] = useState<number>(ROW_MIN);

  useEffect(() => {
    const compute = () => {
      const available = window.innerHeight - TOPBAR_H - HEADER_H;
      const ideal     = Math.floor((available * FILL_RATIO) / slotCount);
      setRowH(Math.max(ideal, ROW_MIN));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [slotCount]);

  return rowH;
}

// ─── Componente ─────────────────────────────────────────────────────────────────
export default function LoredanaView({
  allAppointments,
  giorniChiusi,
  sedi,
  operatori,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: LoredanaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today     = formatDate(new Date());

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loredanaSedi = sedi.filter(s => LOREDANA_SEDI.includes(s.id));
  const [selectedSedeId, setSelectedSedeId] = useState<string>('imola');
  const [editMode, setEditMode]             = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [modalSlot, setModalSlot]   = useState<{ date: string; time: string } | null>(null);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);

  // Stato locale degli appuntamenti (sincronizzato con prop + mutazioni)
  const [localApts, setLocalApts] = useState<Appointment[]>(allAppointments);
  useEffect(() => { setLocalApts(allAppointments); }, [allAppointments]);

  const selectedSede =
    loredanaSedi.find(s => s.id === selectedSedeId) ??
    loredanaSedi[0];

  const slots      = selectedSede ? (TIME_SLOTS_MAP[selectedSede.id] ?? TIME_SLOTS_MAP['imola']) : [];
  const ROW_HEIGHT = useRowHeight(slots.length);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  });

  const totalColsWidth = days.reduce((acc, day) => acc + (isWeekend(day) ? COL_WIDTH_WE : COL_WIDTH), 0);

  const isAtMinMonth =
    currentMonth.getFullYear() === MIN_DATE.getFullYear() &&
    currentMonth.getMonth()    === MIN_DATE.getMonth();

  const goPrev  = () => { if (!isAtMinMonth) setCurrentMonth(prev => subMonths(prev, 1)); };
  const goNext  = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToday = () => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const isGiornoChiuso = (dateStr: string): boolean =>
    giorniChiusi.some(
      g => g.data === dateStr &&
           (g.operatore_id === null || g.operatore_id === LOREDANA_ID)
    );

  const getAppointmentForSlot = (sedeId: string, dateStr: string, time: string): Appointment | null =>
    localApts.find(
      apt =>
        apt.operatore_id === LOREDANA_ID &&
        apt.sede_id  === sedeId &&
        apt.data     === dateStr &&
        apt.ora      === time
    ) ?? null;

  const isUffChiuso = (apt: Appointment | null): boolean =>
    apt !== null && apt.cliente.trim().toUpperCase() === 'UFF CHIUSO';

  // ─── Edit-mode: blocca / sblocca slot ─────────────────────────────────────────
const handleEditModeSlotClick = async (sedeId: string, dateStr: string, time: string) => {
  const uffApts = localApts.filter(
    a => a.sede_id === sedeId && a.data === dateStr &&
         a.ora === time && a.operatore_id === LOREDANA_ID &&
         a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
  );

  if (uffApts.length > 0) {
    // Sblocca: elimina gli appuntamenti "UFF CHIUSO"
    for (const apt of uffApts) {
      try {
        const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
      } catch { alert('Errore durante lo sblocco'); return; }
    }
    setLocalApts(prev => prev.filter(a => !uffApts.some(u => u.id === a.id)));
  } else {
    // Blocca: elimina eventuali appuntamenti esistenti e crea "UFF CHIUSO"
    const existing = localApts.filter(
      a => a.sede_id === sedeId && a.data === dateStr &&
           a.ora === time && a.operatore_id === LOREDANA_ID
    );
    const deletedIds: string[] = [];
    for (const apt of existing) {
      try {
        const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        deletedIds.push(apt.id);
      } catch { alert('Errore durante il blocco'); return; }
    }
    setLocalApts(prev => prev.filter(a => !deletedIds.includes(a.id)));
    try {
      const res = await fetch('/api/epasa/appuntamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sede_id: sedeId,
          operatore_id: LOREDANA_ID,
          data: dateStr,
          ora: time,
          cliente: 'UFF CHIUSO',
          mese: dateStr.substring(0, 7),
        }),
      });
      if (!res.ok) throw new Error();
      const newApt = await res.json();
      setLocalApts(prev => [...prev, newApt]);
    } catch { alert('Errore durante il blocco'); }
  }
};

  const openNew = (dateStr: string, time: string) => {
    setEditingApt(null);
    setModalSlot({ date: dateStr, time });
    setShowModal(true);
  };

  const openEdit = (apt: Appointment) => {
    setEditingApt(apt);
    setModalSlot({ date: apt.data, time: apt.ora });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingApt(null);
    setModalSlot(null);
  };

  // CRUD con aggiornamento stato locale
  const handleSave = async (data: any) => {
    await onSave(data);
    // Il componente padre aggiornerà allAppointments via SSE / reload
  };

  const handleUpdate = async (id: string, data: any) => {
    await onUpdate(id, data);
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    setLocalApts(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) return;
        if (editMode) { setEditMode(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showModal, editMode]);

  useEffect(() => {
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-lv-date="${today}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 150);
  }, [currentMonth]);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white"
      style={{ overflow: 'hidden' }}
    >
      {/* ══════════ TOPBAR ══════════ */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b-2 flex-shrink-0 shadow-sm" style={{ borderColor: `${OPERATOR_COLOR}33` }}>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shadow" style={{ backgroundColor: OPERATOR_COLOR }}>
            <User size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold leading-none" style={{ color: OPERATOR_COLOR }}>LOREDANA</div>
            <div className="text-[10px] text-gray-400 leading-none mt-0.5">Vista mensile</div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-1 flex-shrink-0" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={isAtMinMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Mese precedente"
          >
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold border rounded-lg transition-colors"
            style={{
              minWidth: 160,
              textAlign: 'center',
              color: OPERATOR_COLOR,
              backgroundColor: OPERATOR_COLOR_LIGHT,
              borderColor: `${OPERATOR_COLOR}33`,
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_LIGHT)}
          >
            <CalendarIcon size={12} className="inline mr-1" />
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </button>
          <button
            onClick={goNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Mese successivo"
          >
            <ChevronRight size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-1 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <Building2 size={15} className="text-gray-500" />
          <div className="relative">
            <select
              value={selectedSedeId}
              onChange={e => setSelectedSedeId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold rounded-lg focus:outline-none cursor-pointer transition-colors"
              style={{
                backgroundColor: OPERATOR_COLOR_LIGHT,
                color: OPERATOR_COLOR,
                border: `2px solid ${OPERATOR_COLOR}40`,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_HOVER)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_LIGHT)}
            >
              {loredanaSedi.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: OPERATOR_COLOR }} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3 mr-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: OPERATOR_COLOR_LIGHT, border: `1px solid ${OPERATOR_COLOR}` }} />
            <span className="text-[10px] text-gray-500">Appuntamento</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400" />
            <span className="text-[10px] text-gray-500">Uff. chiuso</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-gray-100 border border-gray-300" />
            <span className="text-[10px] text-gray-500">Chiuso</span>
          </div>
        </div>

        {/* ─── Pulsante lucchetto ─── */}
        <div className="relative group flex-shrink-0">
          <button
            onClick={() => setEditMode(e => !e)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-all border-2 ${
              editMode
                ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 shadow-lg scale-110'
                : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
            }`}
            title={editMode ? 'Disattiva modalità modifica' : 'Attiva modalità modifica (blocca slot)'}
          >
            {editMode ? <Unlock size={16} /> : <Lock size={16} />}
          </button>
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30">
            {editMode ? 'Esci dalla modifica' : 'Blocca / sblocca slot'}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 border border-gray-200 text-gray-500 transition-colors flex-shrink-0"
          title="Chiudi (ESC)"
        >
          <X size={18} />
        </button>
      </div>

      {/* ══════════ BANNER EDIT MODE ══════════ */}
      {editMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b-2 border-amber-400 flex-shrink-0">
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

      {/* ══════════ TABELLA ══════════ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          style={{
            display: 'flex',
            minWidth: `${LABEL_W + totalColsWidth}px`,
            minHeight: '100%',
          }}
        >
          {/* Colonna orari fissa */}
          <div
            style={{
              width: LABEL_W,
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 20,
              backgroundColor: '#F8FAFC',
              borderRight: '2px solid #E2E8F0',
            }}
          >
            <div style={{ height: HEADER_H, borderBottom: '1px solid #E2E8F0' }} />
            {slots.map(time => (
              <div
                key={time}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{time}</span>
              </div>
            ))}
          </div>

          {/* Colonne giorni */}
          <div style={{ display: 'flex', flex: 1 }}>
            {days.map(day => {
              const dateStr   = formatDate(day);
              const isToday   = dateStr === today;
              const isWe      = isWeekend(day);
              const colW      = isWe ? COL_WIDTH_WE : COL_WIDTH;
              const manClosed = isGiornoChiuso(dateStr);
              const sedeOpen  = selectedSede ? isSedeOpenOnDay(selectedSede.id, day) : false;
              const dayOff    = !sedeOpen || manClosed || isWe;

              const headerBg   = isToday ? OPERATOR_COLOR : isWe ? '#E5E7EB' : '#F8FAFC';
              const headerText = isToday ? '#fff'          : isWe ? '#9CA3AF' : '#374151';

              return (
                <div
                  key={dateStr}
                  data-lv-date={dateStr}
                  style={{ width: colW, flexShrink: 0, borderRight: '1px solid #E5E7EB' }}
                >
                  {/* Intestazione giorno */}
                  <div
                    style={{
                      height: HEADER_H,
                      backgroundColor: headerBg,
                      color: headerText,
                      borderBottom: '2px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ fontSize: isWe ? 9 : 10, fontWeight: 700, textTransform: 'capitalize', opacity: 0.8 }}>
                      {format(day, 'EEE', { locale: it })}
                    </span>
                    <span style={{ fontSize: isWe ? 12 : 15, fontWeight: 900, lineHeight: 1.1 }}>
                      {format(day, 'dd')}
                    </span>
                  </div>

                  {/* Slot */}
                  {slots.map(time => {
                    if (dayOff) {
                      return (
                        <div
                          key={time}
                          style={{
                            height: ROW_HEIGHT,
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: isWe ? '#F3F4F6' : '#F9FAFB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {!isWe && <Lock size={8} style={{ color: '#D1D5DB' }} />}
                        </div>
                      );
                    }

                    const apt       = selectedSede ? getAppointmentForSlot(selectedSede.id, dateStr, time) : null;
                    const uffClosed = isUffChiuso(apt);
                    const hasPaz    = apt !== null && !uffClosed;
                    const sedeId    = selectedSede?.id ?? 'imola';

                    if (uffClosed) {
                      return (
                        <div
                          key={time}
                          title={editMode ? 'Clicca per sbloccare' : 'Ufficio chiuso'}
                          onClick={() => editMode && handleEditModeSlotClick(sedeId, dateStr, time)}
                          style={{
                            height: ROW_HEIGHT,
                            borderBottom: '1px solid #FDE68A',
                            backgroundColor: editMode ? '#FEF3C7' : '#FFFBEB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            padding: '0 4px',
                            cursor: editMode ? 'pointer' : 'default',
                          }}
                        >
                          <Lock size={8} style={{ color: '#F59E0B' }} />
                          
                          {editMode && <Unlock size={8} style={{ color: '#F59E0B', marginLeft: 2 }} />}
                        </div>
                      );
                    }

                    if (hasPaz) {
                      return (
                        <div
                          key={time}
                          title={editMode ? 'Clicca per bloccare questo slot' : `Modifica: ${apt!.cliente}${apt!.note ? ' — ' + apt!.note : ''}`}
                          onClick={() => editMode ? handleEditModeSlotClick(sedeId, dateStr, time) : openEdit(apt!)}
                          style={{
                            height: ROW_HEIGHT,
                            borderBottom: editMode ? '1px solid #FCD34D' : `1px solid ${OPERATOR_COLOR_BORDER}`,
                            backgroundColor: editMode ? '#FFFBEB' : OPERATOR_COLOR_LIGHT,
                            borderLeft: editMode ? '3px solid #F59E0B' : `3px solid ${OPERATOR_COLOR}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '0 6px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = editMode ? '#FEF3C7' : OPERATOR_COLOR_HOVER)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = editMode ? '#FFFBEB' : OPERATOR_COLOR_LIGHT)}
                        >
                          {editMode ? (
                            <>
                              <Lock size={8} style={{ color: '#F59E0B', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#92400E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                blocca
                              </span>
                            </>
                          ) : (
                            <>
                              <User size={8} style={{ color: OPERATOR_COLOR, flexShrink: 0 }} />
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: OPERATOR_COLOR_TEXT,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {apt!.cliente}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    }

                    // Slot vuoto
                    return (
                      <div
                        key={time}
                        title={editMode ? 'Clicca per bloccare questo slot' : 'Aggiungi appuntamento'}
                        onClick={() => editMode ? handleEditModeSlotClick(sedeId, dateStr, time) : openNew(dateStr, time)}
                        style={{
                          height: ROW_HEIGHT,
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = editMode ? '#FFFBEB' : OPERATOR_COLOR_LIGHT;
                          const icon = e.currentTarget.querySelector<HTMLElement>('.lv-icon');
                          if (icon) icon.style.opacity = '1';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = '#FFFFFF';
                          const icon = e.currentTarget.querySelector<HTMLElement>('.lv-icon');
                          if (icon) icon.style.opacity = '0';
                        }}
                      >
                        {editMode
                          ? <Lock size={12} className="lv-icon" style={{ color: '#F59E0B', opacity: 0, transition: 'opacity 0.15s' }} />
                          : <Plus size={14} className="lv-icon" style={{ color: OPERATOR_COLOR, opacity: 0, transition: 'opacity 0.15s' }} />
                        }
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════ MODAL ══════════ */}
      {showModal && modalSlot && selectedSede && (
        <EpasaAppointmentModal
          isOpen={showModal}
          onClose={closeModal}
          onSave={handleSave}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          existingAppointment={editingApt ?? undefined}
          sedi={loredanaSedi}
          operatori={operatori}
          selectedDate={modalSlot.date}
          selectedTime={modalSlot.time}
          selectedSedeId={selectedSede.id}
          defaultOperatoreId={LOREDANA_ID}
        />
      )}
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}
