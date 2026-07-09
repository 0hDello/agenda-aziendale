'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Lock, Unlock, Building2, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, ChevronDown, Plus, MessageSquare,
  CheckSquare, Square, FileText, Save, ChevronUp,
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
import EpasaAppointmentModal, { HIGHLIGHT_STYLE } from './EpasaAppointmentModal';

// ─── Tipi ───────────────────────────────────────────────────────────────────────────────
interface Appointment {
  id: string;
  sede_id: string;
  operatore_id: string;
  data: string;
  ora: string;
  cliente: string;
  mese: string;
  note?: string;
  highlight?: string | null;
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

// ─── Costanti ────────────────────────────────────────────────────────────────────────────
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

const UFF_CHIUSO_BG     = '#D1D5DB';
const UFF_CHIUSO_BORDER = '#9CA3AF';
const UFF_CHIUSO_ICON   = '#6B7280';

const TIME_SLOTS_MAP: Record<string, string[]> = {
  imola: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
  cspt:  ['14:00','14:30','15:00','15:30','16:00','16:30'],
  borgo: ['09:00','09:30','10:00','10:30','11:00','11:30'],
};

const LOREDANA_SEDI = ['imola', 'cspt', 'borgo'];

const HL_CSS: Record<string, { bg: string; bgHover: string; border: string; leftBorder: string; text: string }> = {
  '':       { bg: '#EFF6FF', bgHover: '#DBEAFE', border: '#BFDBFE', leftBorder: '#3B82F6', text: '#1D4ED8' },
  yellow:   { bg: '#FEF9C3', bgHover: '#FEF08A', border: '#EAB308', leftBorder: '#CA8A04', text: '#713F12' },
  orange:   { bg: '#FFEDD5', bgHover: '#FED7AA', border: '#F97316', leftBorder: '#EA580C', text: '#7C2D12' },
  red:      { bg: '#FEE2E2', bgHover: '#FECACA', border: '#EF4444', leftBorder: '#DC2626', text: '#7F1D1D' },
  green:    { bg: '#DCFCE7', bgHover: '#BBF7D0', border: '#22C55E', leftBorder: '#16A34A', text: '#14532D' },
  blue:     { bg: '#DBEAFE', bgHover: '#BFDBFE', border: '#3B82F6', leftBorder: '#2563EB', text: '#1E3A8A' },
  purple:   { bg: '#F3E8FF', bgHover: '#E9D5FF', border: '#A855F7', leftBorder: '#9333EA', text: '#581C87' },
  pink:     { bg: '#FCE7F3', bgHover: '#FBCFE8', border: '#EC4899', leftBorder: '#DB2777', text: '#831843' },
};

// ─── Regole apertura ────────────────────────────────────────────────────────────────────────────
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

// ─── Hook: altezza riga ───────────────────────────────────────────────────────────────────────────
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

// ─── Storage key per le note pomeriggio ─────────────────────────────────────────────────
const AFTERNOON_NOTES_KEY = 'loredana_afternoon_notes';

const loadAfternoonNotes = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AFTERNOON_NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveAfternoonNotes = (notes: Record<string, string>) => {
  try { localStorage.setItem(AFTERNOON_NOTES_KEY, JSON.stringify(notes)); } catch { }
};

// ─── Componente ───────────────────────────────────────────────────────────────────────────────
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

  // ─── Multi-selezione lucchetti ──────────────────────────────────────────────
  // selectedSlots = Set di keys "dateStr|time" selezionati per blocco/sblocco multiplo
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedSlots, setSelectedSlots]     = useState<Set<string>>(new Set());

  const [showModal, setShowModal]   = useState(false);
  const [modalSlot, setModalSlot]   = useState<{ date: string; time: string } | null>(null);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const [localApts, setLocalApts] = useState<Appointment[]>(allAppointments);
  useEffect(() => { setLocalApts(allAppointments); }, [allAppointments]);

  // ─── Pannello note pomeriggio ──────────────────────────────────────────────
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [afternoonNotes, setAfternoonNotes] = useState<Record<string, string>>(loadAfternoonNotes);
  // La data selezionata per le note pomeriggio (default = oggi o primo lunedì disponibile)
  const [noteDate, setNoteDate] = useState<string>(() => {
    const now = new Date();
    // CSPT è solo il lunedì, usiamo la data corrente come default
    return formatDate(now);
  });
  const [noteText, setNoteText] = useState<string>('');
  const [noteSaved, setNoteSaved] = useState(false);

  // Carica il testo nota quando cambia la data selezionata
  useEffect(() => {
    setNoteText(afternoonNotes[noteDate] ?? '');
    setNoteSaved(false);
  }, [noteDate, afternoonNotes]);

  const handleSaveNote = () => {
    const updated = { ...afternoonNotes, [noteDate]: noteText };
    if (!noteText.trim()) {
      delete updated[noteDate];
    }
    setAfternoonNotes(updated);
    saveAfternoonNotes(updated);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const selectedSede =
    loredanaSedi.find(s => s.id === selectedSedeId) ?? loredanaSedi[0];

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

  // ─── Blocco/sblocco singolo slot ──────────────────────────────────────────
  const handleEditModeSlotClick = async (sedeId: string, dateStr: string, time: string) => {
    const realApts = localApts.filter(
      a => a.sede_id === sedeId && a.data === dateStr &&
           a.ora === time && a.operatore_id === LOREDANA_ID &&
           a.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
    );
    if (realApts.length > 0) return;

    const uffApts = localApts.filter(
      a => a.sede_id === sedeId && a.data === dateStr &&
           a.ora === time && a.operatore_id === LOREDANA_ID &&
           a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
    );
    if (uffApts.length > 0) {
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
        } catch { alert('Errore durante lo sblocco'); return; }
      }
      setLocalApts(prev => prev.filter(a => !uffApts.some(u => u.id === a.id)));
    } else {
      const motivo = window.prompt('Motivo chiusura (es. Ferie, Formazione, ...):') ?? '';
      try {
        const res = await fetch('/api/epasa/appuntamenti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sede_id: sedeId, operatore_id: LOREDANA_ID,
            data: dateStr, ora: time,
            cliente: 'UFF CHIUSO', mese: dateStr.substring(0, 7), note: motivo,
          }),
        });
        if (!res.ok) throw new Error();
        const newApt = await res.json();
        setLocalApts(prev => [...prev, newApt]);
      } catch { alert('Errore durante il blocco'); }
    }
  };

  // ─── Toggle selezione slot in modalità multi-select ──────────────────────
  const toggleSlotSelection = (dateStr: string, time: string) => {
    const key = `${dateStr}|${time}`;
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Applica blocco multiplo ai selezionati ───────────────────────────────
  const handleMultiLock = async () => {
    if (selectedSlots.size === 0) return;
    const motivo = window.prompt(`Motivo chiusura per ${selectedSlots.size} slot selezionat${selectedSlots.size === 1 ? 'o' : 'i'} (es. Ferie, Formazione, ...):`) ?? '';
    const sedeId = selectedSede?.id ?? 'imola';
    let errors = 0;
    for (const key of Array.from(selectedSlots)) {
      const [dateStr, time] = key.split('|');
      // Salta se già bloccato o occupato
      const realApts = localApts.filter(
        a => a.sede_id === sedeId && a.data === dateStr && a.ora === time &&
             a.operatore_id === LOREDANA_ID && a.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
      );
      const uffApts = localApts.filter(
        a => a.sede_id === sedeId && a.data === dateStr && a.ora === time &&
             a.operatore_id === LOREDANA_ID && a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
      );
      if (realApts.length > 0 || uffApts.length > 0) continue;
      try {
        const res = await fetch('/api/epasa/appuntamenti', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sede_id: sedeId, operatore_id: LOREDANA_ID,
            data: dateStr, ora: time,
            cliente: 'UFF CHIUSO', mese: dateStr.substring(0, 7), note: motivo,
          }),
        });
        if (!res.ok) throw new Error();
        const newApt = await res.json();
        setLocalApts(prev => [...prev, newApt]);
      } catch { errors++; }
    }
    if (errors > 0) alert(`${errors} slot non sono stati bloccati a causa di errori.`);
    setSelectedSlots(new Set());
    setMultiSelectMode(false);
  };

  // ─── Applica sblocco multiplo ai selezionati ─────────────────────────────
  const handleMultiUnlock = async () => {
    if (selectedSlots.size === 0) return;
    const sedeId = selectedSede?.id ?? 'imola';
    let errors = 0;
    const toRemoveIds: string[] = [];
    for (const key of Array.from(selectedSlots)) {
      const [dateStr, time] = key.split('|');
      const uffApts = localApts.filter(
        a => a.sede_id === sedeId && a.data === dateStr && a.ora === time &&
             a.operatore_id === LOREDANA_ID && a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
      );
      for (const apt of uffApts) {
        try {
          const res = await fetch(`/api/epasa/appuntamenti/${apt.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error();
          toRemoveIds.push(apt.id);
        } catch { errors++; }
      }
    }
    setLocalApts(prev => prev.filter(a => !toRemoveIds.includes(a.id)));
    if (errors > 0) alert(`${errors} slot non sono stati sbloccati a causa di errori.`);
    setSelectedSlots(new Set());
    setMultiSelectMode(false);
  };

  const openNew = (dateStr: string, time: string) => {
    setEditingApt(null); setModalSlot({ date: dateStr, time }); setShowModal(true);
  };
  const openEdit = (apt: Appointment) => {
    setEditingApt(apt); setModalSlot({ date: apt.data, time: apt.ora }); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingApt(null); setModalSlot(null); };
  const handleSave   = async (data: any) => { await onSave(data); };
  const handleUpdate = async (id: string, data: any) => { await onUpdate(id, data); };
  const handleDelete = async (id: string) => {
    await onDelete(id);
    setLocalApts(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) return;
        if (multiSelectMode) { setMultiSelectMode(false); setSelectedSlots(new Set()); return; }
        if (editMode) { setEditMode(false); return; }
        if (showNotesPanel) { setShowNotesPanel(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showModal, editMode, multiSelectMode, showNotesPanel]);

  useEffect(() => {
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-lv-date="${today}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 150);
  }, [currentMonth]);

  // Conta quante note pomeriggio ci sono nel mese corrente
  const csptDaysWithNotes = Object.keys(afternoonNotes).filter(k =>
    k.startsWith(format(currentMonth, 'yyyy-MM')) && afternoonNotes[k]?.trim()
  ).length;

  const content = (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white" style={{ overflow: 'hidden' }}>

      {/* ══ TOPBAR ══ */}
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
          <button onClick={goPrev} disabled={isAtMinMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Mese precedente">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold border rounded-lg transition-colors"
            style={{ minWidth: 160, textAlign: 'center', color: OPERATOR_COLOR, backgroundColor: OPERATOR_COLOR_LIGHT, borderColor: `${OPERATOR_COLOR}33` }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_LIGHT)}>
            <CalendarIcon size={12} className="inline mr-1" />
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </button>
          <button onClick={goNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Mese successivo">
            <ChevronRight size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-1 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <Building2 size={15} className="text-gray-500" />
          <div className="relative">
            <select value={selectedSedeId} onChange={e => setSelectedSedeId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold rounded-lg focus:outline-none cursor-pointer transition-colors"
              style={{ backgroundColor: OPERATOR_COLOR_LIGHT, color: OPERATOR_COLOR, border: `2px solid ${OPERATOR_COLOR}40` }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_HOVER)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_LIGHT)}>
              {loredanaSedi.map(s => (<option key={s.id} value={s.id}>{s.nome}</option>))}
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
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: UFF_CHIUSO_BG, border: `1px solid ${UFF_CHIUSO_BORDER}` }} />
            <span className="text-[10px] text-gray-500">Uff. chiuso</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-gray-100 border border-gray-300" />
            <span className="text-[10px] text-gray-500">Chiuso</span>
          </div>
        </div>

        {/* ── Bottone note pomeriggio ── */}
        <button
          onClick={() => setShowNotesPanel(p => !p)}
          title="Note pomeriggio CSPT"
          className={`relative flex items-center gap-1.5 px-3 h-9 rounded-full border-2 text-xs font-bold transition-all flex-shrink-0 ${
            showNotesPanel
              ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-amber-100 shadow-md'
              : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'
          }`}>
          <FileText size={14} />
          <span className="hidden sm:inline">Note pomeriggio</span>
          {csptDaysWithNotes > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
              {csptDaysWithNotes}
            </span>
          )}
        </button>

        {/* ── Multi-select lucchetti ── */}
        {editMode && (
          <button
            onClick={() => {
              setMultiSelectMode(m => !m);
              setSelectedSlots(new Set());
            }}
            title={multiSelectMode ? 'Esci dalla selezione multipla' : 'Selezione multipla lucchetti'}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-full border-2 text-xs font-bold transition-all flex-shrink-0 ${
              multiSelectMode
                ? 'bg-blue-500 border-blue-600 text-white shadow-blue-200 shadow-md'
                : 'bg-white border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500'
            }`}>
            <CheckSquare size={14} />
            <span className="hidden sm:inline">{multiSelectMode ? `${selectedSlots.size} selezionati` : 'Selezione multipla'}</span>
          </button>
        )}

        {/* Lucchetto */}
        <button
          onClick={() => {
            setEditMode(e => !e);
            if (multiSelectMode) { setMultiSelectMode(false); setSelectedSlots(new Set()); }
          }}
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-all border-2 flex-shrink-0 ${
            editMode
              ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 shadow-lg scale-110'
              : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
          }`}
        >
          {editMode ? <Unlock size={16} /> : <Lock size={16} />}
        </button>

        <button onClick={onClose}
          className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 border border-gray-200 text-gray-500 transition-colors flex-shrink-0"
          title="Chiudi (ESC)">
          <X size={18} />
        </button>
      </div>

      {/* ══ BARRA AZIONI MULTI-SELECT ══ */}
      {multiSelectMode && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200 flex-shrink-0">
          <CheckSquare size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-blue-700">
            {selectedSlots.size === 0
              ? 'Clicca sugli slot liberi per selezionarli'
              : `${selectedSlots.size} slot selezionat${selectedSlots.size === 1 ? 'o' : 'i'}`}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleMultiLock}
              disabled={selectedSlots.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white border border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-600 transition-colors"
            >
              <Lock size={12} /> Blocca selezionati
            </button>
            <button
              onClick={handleMultiUnlock}
              disabled={selectedSlots.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white border border-green-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
            >
              <Unlock size={12} /> Sblocca selezionati
            </button>
            <button
              onClick={() => setSelectedSlots(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-300 hover:bg-gray-100"
            >
              Deseleziona tutti
            </button>
          </div>
        </div>
      )}

      {/* ══ CONTENUTO PRINCIPALE ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Tabella ── */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', minWidth: `${LABEL_W + totalColsWidth}px`, minHeight: '100%' }}>

            {/* Colonna orari fissa */}
            <div style={{ width: LABEL_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#F8FAFC', borderRight: '2px solid #E2E8F0' }}>
              <div style={{ height: HEADER_H, borderBottom: '1px solid #E2E8F0' }} />
              {slots.map(time => (
                <div key={time} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
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
                const headerText = isToday ? '#fff' : isWe ? '#9CA3AF' : '#374151';

                // Indicatore nota pomeriggio (solo per CSPT)
                const hasDayNote = selectedSedeId === 'cspt' && afternoonNotes[dateStr]?.trim();

                return (
                  <div key={dateStr} data-lv-date={dateStr} style={{ width: colW, flexShrink: 0, borderRight: '1px solid #E5E7EB' }}>
                    {/* Header giorno */}
                    <div
                      onClick={() => {
                        if (selectedSedeId === 'cspt' && !isWe && sedeOpen && !manClosed) {
                          setNoteDate(dateStr);
                          setShowNotesPanel(true);
                        }
                      }}
                      title={selectedSedeId === 'cspt' && !isWe && sedeOpen && !manClosed ? 'Apri note pomeriggio' : undefined}
                      style={{
                        height: HEADER_H, backgroundColor: headerBg, color: headerText,
                        borderBottom: '2px solid #E2E8F0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: selectedSedeId === 'cspt' && !isWe && sedeOpen && !manClosed ? 'pointer' : 'default',
                        position: 'relative',
                      }}>
                      <span style={{ fontSize: isWe ? 9 : 10, fontWeight: 700, textTransform: 'capitalize', opacity: 0.8 }}>{format(day, 'EEE', { locale: it })}</span>
                      <span style={{ fontSize: isWe ? 12 : 15, fontWeight: 900, lineHeight: 1.1 }}>{format(day, 'dd')}</span>
                      {hasDayNote && (
                        <div style={{ position: 'absolute', bottom: 3, right: 4 }}>
                          <FileText size={8} style={{ color: isToday ? 'rgba(255,255,255,0.8)' : '#F59E0B' }} />
                        </div>
                      )}
                    </div>

                    {/* Slot */}
                    {slots.map(time => {
                      if (dayOff) {
                        return (
                          <div key={time} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #F1F5F9', backgroundColor: isWe ? '#F3F4F6' : '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {!isWe && <Lock size={8} style={{ color: '#D1D5DB' }} />}
                          </div>
                        );
                      }

                      const apt       = selectedSede ? getAppointmentForSlot(selectedSede.id, dateStr, time) : null;
                      const uffClosed = isUffChiuso(apt);
                      const hasPaz    = apt !== null && !uffClosed;
                      const sedeId    = selectedSede?.id ?? 'imola';
                      const cellKey   = `${dateStr}-${time}`;
                      const slotKey   = `${dateStr}|${time}`;
                      const isHovered = hoveredCell === cellKey;
                      const isSelected = selectedSlots.has(slotKey);

                      // ── Slot UFF CHIUSO ──
                      if (uffClosed) {
                        const motivoChiusura = apt?.note?.trim() || '';
                        return (
                          <div key={time}
                            title={editMode
                              ? (multiSelectMode ? 'Seleziona per sblocco multiplo' : 'Clicca per sbloccare')
                              : (motivoChiusura ? `Ufficio chiuso – ${motivoChiusura}` : 'Ufficio chiuso')}
                            onClick={() => {
                              if (!editMode) return;
                              if (multiSelectMode) toggleSlotSelection(dateStr, time);
                              else handleEditModeSlotClick(sedeId, dateStr, time);
                            }}
                            style={{
                              height: ROW_HEIGHT,
                              borderBottom: `1px solid ${isSelected ? '#3B82F6' : UFF_CHIUSO_BORDER}`,
                              backgroundColor: isSelected ? '#DBEAFE' : UFF_CHIUSO_BG,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              gap: 3, padding: '0 4px',
                              cursor: editMode ? 'pointer' : 'default',
                              outline: isSelected ? '2px solid #3B82F6' : undefined,
                              outlineOffset: isSelected ? '-2px' : undefined,
                            }}>
                            {multiSelectMode && editMode
                              ? (isSelected
                                  ? <CheckSquare size={10} style={{ color: '#2563EB', flexShrink: 0 }} />
                                  : <Square size={10} style={{ color: UFF_CHIUSO_ICON, flexShrink: 0 }} />)
                              : <Lock size={8} style={{ color: isSelected ? '#2563EB' : UFF_CHIUSO_ICON, flexShrink: 0 }} />
                            }
                            {motivoChiusura && !multiSelectMode && (
                              <span style={{ fontSize: 9, color: UFF_CHIUSO_ICON, fontStyle: 'italic', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {motivoChiusura}
                              </span>
                            )}
                            {editMode && !multiSelectMode && <Unlock size={8} style={{ color: UFF_CHIUSO_ICON, marginLeft: 2, flexShrink: 0 }} />}
                          </div>
                        );
                      }

                      // ── Slot con appuntamento reale ──
                      if (hasPaz) {
                        const hlKey   = apt!.highlight || '';
                        const hl      = HL_CSS[hlKey] ?? HL_CSS[''];
                        const hasNote = !!(apt!.note?.trim());

                        const cellBg         = isHovered ? hl.bgHover : hl.bg;
                        const cellBorder     = hl.border;
                        const cellLeftBorder = hl.leftBorder;
                        const cellTextColor  = hl.text;

                        return (
                          <div key={time}
                            onClick={() => !editMode && !multiSelectMode && openEdit(apt!)}
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                            style={{
                              height: ROW_HEIGHT,
                              borderBottom: `1px solid ${cellBorder}`,
                              backgroundColor: cellBg,
                              borderLeft: `3px solid ${cellLeftBorder}`,
                              display: 'flex', alignItems: 'center',
                              gap: 3, padding: '0 5px',
                              overflow: 'visible',
                              cursor: editMode ? 'not-allowed' : 'pointer',
                              position: 'relative',
                              transition: 'background-color 0.1s',
                            }}>

                            <User size={8} style={{ color: cellTextColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: cellTextColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {apt!.cliente}
                            </span>
                            {!editMode && hasNote && (
                              <MessageSquare size={8} style={{ color: cellTextColor, flexShrink: 0, opacity: 0.75 }} />
                            )}

                            {/* Tooltip nota */}
                            {!editMode && hasNote && isHovered && (
                              <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, zIndex: 9999, minWidth: 160, maxWidth: 240, pointerEvents: 'none' }}>
                                <div style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', fontSize: 11, borderRadius: 8, padding: '6px 10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', lineHeight: 1.5, border: '1px solid #BFDBFE' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #BFDBFE' }}>
                                    <MessageSquare size={10} style={{ color: '#3B82F6', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 700, color: '#2563EB', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nota</span>
                                  </div>
                                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1D4ED8' }}>{apt!.note}</p>
                                </div>
                                <div style={{ width: 0, height: 0, marginLeft: 12, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #BFDBFE' }} />
                              </div>
                            )}
                          </div>
                        );
                      }

                      // ── Slot vuoto ──
                      return (
                        <div key={time}
                          onClick={() => {
                            if (multiSelectMode && editMode) {
                              toggleSlotSelection(dateStr, time);
                            } else if (editMode) {
                              handleEditModeSlotClick(sedeId, dateStr, time);
                            } else {
                              openNew(dateStr, time);
                            }
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = multiSelectMode && editMode
                                ? '#EFF6FF'
                                : editMode ? '#F3F4F6' : OPERATOR_COLOR_LIGHT;
                            }
                            const icon = e.currentTarget.querySelector<HTMLElement>('.lv-icon');
                            if (icon) icon.style.opacity = '1';
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                            const icon = e.currentTarget.querySelector<HTMLElement>('.lv-icon');
                            if (icon) icon.style.opacity = '0';
                          }}
                          style={{
                            height: ROW_HEIGHT,
                            borderBottom: `1px solid ${isSelected ? '#3B82F6' : '#F1F5F9'}`,
                            backgroundColor: isSelected ? '#DBEAFE' : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background-color 0.1s',
                            outline: isSelected ? '2px solid #3B82F6' : undefined,
                            outlineOffset: isSelected ? '-2px' : undefined,
                          }}>
                          {multiSelectMode && editMode
                            ? (isSelected
                                ? <CheckSquare size={12} className="lv-icon" style={{ color: '#2563EB', opacity: 1 }} />
                                : <Square size={12} className="lv-icon" style={{ color: '#9CA3AF', opacity: 0, transition: 'opacity 0.15s' }} />)
                            : editMode
                              ? <Lock size={12} className="lv-icon" style={{ color: UFF_CHIUSO_ICON, opacity: 0, transition: 'opacity 0.15s' }} />
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

        {/* ══ PANNELLO NOTE POMERIGGIO ══ */}
        {showNotesPanel && (
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderLeft: '2px solid #FDE68A',
              backgroundColor: '#FFFBEB',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
            {/* Header pannello */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #FDE68A', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: '#D97706', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>NOTE POMERIGGIO</div>
                <div style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>Appuntamenti CSPT pomeridiani</div>
              </div>
              <button
                onClick={() => setShowNotesPanel(false)}
                style={{ padding: 4, borderRadius: 6, color: '#B45309', flexShrink: 0 }}
                className="hover:bg-amber-200 transition-colors"
                title="Chiudi pannello">
                <X size={14} />
              </button>
            </div>

            {/* Selettore data */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #FDE68A' }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#92400E', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Data pomeriggio
              </label>
              <input
                type="date"
                value={noteDate}
                onChange={e => setNoteDate(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 8,
                  border: '1.5px solid #FCD34D', fontSize: 12,
                  backgroundColor: '#FFFFFF', color: '#451A03',
                  fontWeight: 600, outline: 'none',
                }}
              />
            </div>

            {/* Area testo nota */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 16px', gap: 8, overflow: 'hidden' }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nota appuntamenti pomeridiani
              </label>
              <textarea
                value={noteText}
                onChange={e => { setNoteText(e.target.value); setNoteSaved(false); }}
                placeholder={`Appunti pomeriggio ${noteDate}...\n\nEs:\n14:30 – Mario Rossi – consulenza\n15:00 – Anna Bianchi – documentazione\n...`}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  border: '1.5px solid #FCD34D', fontSize: 12,
                  backgroundColor: '#FFFFFF', color: '#1C1917',
                  resize: 'none', outline: 'none', lineHeight: 1.6,
                  fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#F59E0B')}
                onBlur={e => (e.currentTarget.style.borderColor = '#FCD34D')}
              />
              <button
                onClick={handleSaveNote}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8,
                  backgroundColor: noteSaved ? '#059669' : '#D97706',
                  color: '#FFFFFF', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={e => { if (!noteSaved) e.currentTarget.style.backgroundColor = '#B45309'; }}
                onMouseLeave={e => { if (!noteSaved) e.currentTarget.style.backgroundColor = '#D97706'; }}
              >
                <Save size={13} />
                {noteSaved ? 'Salvato!' : 'Salva nota'}
              </button>
            </div>

            {/* Lista note del mese */}
            {csptDaysWithNotes > 0 && (
              <div style={{ borderTop: '1px solid #FDE68A', padding: '10px 16px', backgroundColor: '#FEF9C3', overflowY: 'auto', maxHeight: 180 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Note del mese ({csptDaysWithNotes})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(afternoonNotes)
                    .filter(([k, v]) => k.startsWith(format(currentMonth, 'yyyy-MM')) && v?.trim())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateKey, text]) => {
                      const d = new Date(dateKey + 'T12:00:00');
                      return (
                        <button
                          key={dateKey}
                          onClick={() => setNoteDate(dateKey)}
                          style={{
                            textAlign: 'left', padding: '5px 8px', borderRadius: 6,
                            backgroundColor: noteDate === dateKey ? '#FDE68A' : '#FFFFFF',
                            border: `1px solid ${noteDate === dateKey ? '#F59E0B' : '#FDE68A'}`,
                            cursor: 'pointer', transition: 'background-color 0.1s',
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E' }}>
                            {format(d, 'EEEE dd MMMM', { locale: it })}
                          </div>
                          <div style={{ fontSize: 10, color: '#A16207', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {text.trim().split('\n')[0]}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL ══ */}
      {showModal && modalSlot && selectedSede && (
        <EpasaAppointmentModal
          isOpen={showModal} onClose={closeModal}
          onSave={handleSave} onUpdate={handleUpdate} onDelete={handleDelete}
          existingAppointment={editingApt ?? undefined}
          sedi={loredanaSedi} operatori={operatori}
          selectedDate={modalSlot.date} selectedTime={modalSlot.time}
          selectedSedeId={selectedSede.id} defaultOperatoreId={LOREDANA_ID}
        />
      )}
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}
