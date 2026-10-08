'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Lock, Unlock, Building2, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, ChevronDown, Plus, MessageSquare,
  FileText, Save, Search,
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
import { formatDateDisplay } from '@/utils/dateUtils';
import { isLoredanaAfternoonWorkingDay, dateStrToLocal } from './epasa/types';

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
const LOREDANA_ID = 'LOREDANA';
const MIN_DATE = new Date(2026, 0, 1);
const TOPBAR_H = 53;
const HEADER_H = 54;
const ROW_MIN = 44;
const FILL_RATIO = 0.82;
const LABEL_W = 68;
const COL_WIDTH = 115;
const COL_WIDTH_WE = 48;

const OPERATOR_COLOR = '#005CA9';
const OPERATOR_COLOR_LIGHT = '#E6F2FF';
const OPERATOR_COLOR_HOVER = '#D1E7FF';

const UFF_CHIUSO_BG = '#D1D5DB';
const UFF_CHIUSO_BORDER = '#9CA3AF';
const UFF_CHIUSO_ICON = '#6B7280';

const BULK_HOVER_BG = '#DBEAFE';
const BULK_HOVER_BORDER = '#60A5FA';

const TIME_SLOTS_MAP: Record<string, string[]> = {
  imola: [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ],
  cspt: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30'],
  borgo: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
};

const LOREDANA_SEDI = ['imola', 'cspt', 'borgo'];

const HL_CSS: Record<string, { bg: string; bgHover: string; border: string; leftBorder: string; text: string }> = {
  '': { bg: '#EFF6FF', bgHover: '#DBEAFE', border: '#BFDBFE', leftBorder: '#3B82F6', text: '#1D4ED8' },
  yellow: { bg: '#FEF9C3', bgHover: '#FEF08A', border: '#EAB308', leftBorder: '#CA8A04', text: '#713F12' },
  orange: { bg: '#FFEDD5', bgHover: '#FED7AA', border: '#F97316', leftBorder: '#EA580C', text: '#7C2D12' },
  red: { bg: '#FEE2E2', bgHover: '#FECACA', border: '#EF4444', leftBorder: '#DC2626', text: '#7F1D1D' },
  green: { bg: '#DCFCE7', bgHover: '#BBF7D0', border: '#22C55E', leftBorder: '#16A34A', text: '#14532D' },
  blue: { bg: '#DBEAFE', bgHover: '#BFDBFE', border: '#3B82F6', leftBorder: '#2563EB', text: '#1E3A8A' },
  purple: { bg: '#F3E8FF', bgHover: '#E9D5FF', border: '#A855F7', leftBorder: '#9333EA', text: '#581C87' },
  pink: { bg: '#FCE7F3', bgHover: '#FBCFE8', border: '#EC4899', leftBorder: '#DB2777', text: '#831843' },
};

// ─── Regole apertura ─────────────────────────────────────────────────────────────────────
const isBorgoWorkingDay = (date: Date): boolean => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  if (dow !== 2) return false;
  const exceptions: Record<string, number[]> = {
    '2026-9': [8, 15],
    '2026-10': [6, 20],
    '2026-12': [15],
  };
  const key = `${y}-${m + 1}`;
  if (exceptions[key]) return exceptions[key].includes(d);
  const dowFirst = new Date(y, m, 1, 12).getDay();
  const offsetMonFirst = (dowFirst + 6) % 7;
  const firstMondayD = offsetMonFirst === 0 ? 1 : 8 - offsetMonFirst;
  const offsetMon = (dow + 6) % 7;
  const mondayD = d - offsetMon;
  const diffDays = mondayD - firstMondayD;
  if (diffDays < 0) return false;
  const week = Math.round(diffDays / 7) + 1;
  return week === 2 || week === 3;
};

const isSedeOpenOnDay = (sedeId: string, date: Date): boolean => {
  if (isWeekend(date)) return false;
  const dow = getDay(date);
  if (sedeId === 'cspt') return dow === 1;
  if (sedeId === 'borgo') return isBorgoWorkingDay(date);
  return true;
};

const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

// ─── Hook: altezza riga ──────────────────────────────────────────────────────────────────
function useRowHeight(slotCount: number): number {
  const [rowH, setRowH] = useState<number>(ROW_MIN);
  useEffect(() => {
    const compute = () => {
      const available = window.innerHeight - TOPBAR_H - HEADER_H;
      const ideal = Math.floor((available * FILL_RATIO) / slotCount);
      setRowH(Math.max(ideal, ROW_MIN));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [slotCount]);
  return rowH;
}

// ─── Componente ──────────────────────────────────────────────────────────────────────────

// ─── Componente ──────────────────────────────────────────────────────────────────────────
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
  const today = formatDate(new Date());

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loredanaSedi = sedi.filter(s => LOREDANA_SEDI.includes(s.id));
  const [selectedSedeId, setSelectedSedeId] = useState<string>('imola');
  const [editMode, setEditMode] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalSlot, setModalSlot] = useState<{ date: string; time: string } | null>(null);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const [localApts, setLocalApts] = useState<Appointment[]>(allAppointments);
  useEffect(() => { setLocalApts(allAppointments); }, [allAppointments]);

  // ─── Barra di ricerca orizzontale ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedAptId, setHighlightedAptId] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Chiusura dropdown se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scorciatoia globale Ctrl+K per dare focus alla ricerca
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        if (searchQuery.trim()) {
          setIsDropdownOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchQuery]);

  // Risultati ricerca filtrati per Loredana
  const searchResults = useMemo(() => {
    if (!localApts || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = localApts.filter(
      a =>
        a.operatore_id.toUpperCase() === LOREDANA_ID &&
        a.cliente.trim().toUpperCase() !== 'UFF CHIUSO' &&
        (a.cliente.toLowerCase().includes(q) ||
          (a.note?.toLowerCase().includes(q)) ||
          a.data.includes(q) ||
          a.sede_id.toLowerCase().includes(q) ||
          a.ora.includes(q))
    );
    results.sort((a, b) => b.data.localeCompare(a.data));
    return results.slice(0, 30);
  }, [searchQuery, localApts]);

  const handleSelectSearchResult = (apt: Appointment) => {
    setIsDropdownOpen(false);
    setSearchQuery('');
    searchInputRef.current?.blur();

    // 1. Sede: cambia sede se diversa
    if (apt.sede_id && apt.sede_id !== selectedSedeId) {
      setSelectedSedeId(apt.sede_id);
    }

    // 2. Mese: naviga al mese dell'appuntamento se diverso
    const [y, m] = apt.data.split('-').map(Number);
    const targetMonth = new Date(y, m - 1, 1);
    if (
      currentMonth.getFullYear() !== targetMonth.getFullYear() ||
      currentMonth.getMonth() !== targetMonth.getMonth()
    ) {
      setCurrentMonth(targetMonth);
    }

    // 3. Evidenziazione visiva
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedAptId(apt.id);

    // 4. Scorrimento morbido fino alla cella o colonna del giorno
    setTimeout(() => {
      const aptEl = document.getElementById(`lv-apt-${apt.id}`);
      if (aptEl) {
        aptEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } else {
        const dayEl = scrollRef.current?.querySelector<HTMLElement>(`[data-lv-date="${apt.data}"]`);
        if (dayEl) {
          dayEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 250);

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedAptId(null);
    }, 2500);
  };

  // ─── Pannello note pomeriggio ──────────────────────────────────────────────
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [afternoonNotes, setAfternoonNotes] = useState<Record<string, string>>({});
  const [noteDate, setNoteDate] = useState<string>(() => {
    const now = new Date();
    return formatDate(now);
  });
  const [noteText, setNoteText] = useState<string>('');
  const [noteSaved, setNoteSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/epasa/note-pomeriggio')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setAfternoonNotes(data);
      })
      .catch(err => console.error('Errore caricamento note:', err));
  }, []);

  useEffect(() => {
    setNoteText(afternoonNotes[noteDate] ?? '');
    setNoteSaved(false);
  }, [noteDate]);

  const handleNoteChange = (text: string) => {
    setNoteText(text);
    const updated = { ...afternoonNotes, [noteDate]: text };
    if (!text.trim()) delete updated[noteDate];
    setAfternoonNotes(updated);
    setNoteSaved(false);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      fetch('/api/epasa/note-pomeriggio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: noteDate, testo: text })
      })
        .then(res => res.json())
        .then(() => {
          setNoteSaved(true);
          setTimeout(() => setNoteSaved(false), 2000);
        })
        .catch(err => console.error('Errore salvataggio nota:', err));
    }, 1000);
  };

  const selectedSede =
    loredanaSedi.find(s => s.id === selectedSedeId) ?? loredanaSedi[0];

  const slots = selectedSede ? (TIME_SLOTS_MAP[selectedSede.id] ?? TIME_SLOTS_MAP['imola']) : [];
  const ROW_HEIGHT = useRowHeight(slots.length);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const totalColsWidth = days.reduce((acc, day) => acc + (isWeekend(day) ? COL_WIDTH_WE : COL_WIDTH), 0);

  const isAtMinMonth =
    currentMonth.getFullYear() === MIN_DATE.getFullYear() &&
    currentMonth.getMonth() === MIN_DATE.getMonth();

  const goPrev = () => { if (!isAtMinMonth) setCurrentMonth(prev => subMonths(prev, 1)); };
  const goNext = () => setCurrentMonth(prev => addMonths(prev, 1));
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
        apt.sede_id === sedeId &&
        apt.data === dateStr &&
        apt.ora === time
    ) ?? null;

  const isUffChiuso = (apt: Appointment | null): boolean =>
    apt !== null && apt.cliente.trim().toUpperCase() === 'UFF CHIUSO';

  const getRealAppointmentsForSlot = (sedeId: string, dateStr: string, time: string) =>
    localApts.filter(
      a => a.sede_id === sedeId &&
        a.data === dateStr &&
        a.ora === time &&
        a.operatore_id === LOREDANA_ID &&
        a.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
    );

  const getUffChiusoAppointmentsForSlot = (sedeId: string, dateStr: string, time: string) =>
    localApts.filter(
      a => a.sede_id === sedeId &&
        a.data === dateStr &&
        a.ora === time &&
        a.operatore_id === LOREDANA_ID &&
        a.cliente.trim().toUpperCase() === 'UFF CHIUSO'
    );

  const createUffChiuso = async (sedeId: string, dateStr: string, time: string, motivo: string) => {
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
        note: motivo,
      }),
    });
    if (!res.ok) throw new Error();
    return res.json();
  };

  const deleteUffChiuso = async (aptIds: string[]) => {
    for (const id of aptIds) {
      const res = await fetch(`/api/epasa/appuntamenti/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    }
  };

  // ─── Toggle singolo slot in modalità lucchetto ─────────────────────────────
  const handleProtectedSlotToggle = async (sedeId: string, dateStr: string, time: string, bulkMotivo?: string) => {
    const realApts = getRealAppointmentsForSlot(sedeId, dateStr, time);
    if (realApts.length > 0) return;

    const uffApts = getUffChiusoAppointmentsForSlot(sedeId, dateStr, time);

    if (uffApts.length > 0) {
      try {
        await deleteUffChiuso(uffApts.map(a => a.id));
        setLocalApts(prev => prev.filter(a => !uffApts.some(u => u.id === a.id)));
      } catch {
        alert('Errore durante lo sblocco');
      }
      return;
    }

    const motivo = bulkMotivo ?? window.prompt('Motivo chiusura (es. Ferie, Formazione, ...):') ?? '';
    try {
      const newApt = await createUffChiuso(sedeId, dateStr, time, motivo);
      setLocalApts(prev => [...prev, newApt]);
    } catch {
      alert('Errore durante il blocco');
    }
  };

  // ─── Toggle intera giornata dal numero in alto ─────────────────────────────
  const handleDayHeaderToggle = async (dateStr: string) => {
    if (!editMode || !selectedSede) return;

    const dayDate = new Date(`${dateStr}T12:00:00`);
    const sedeOpen = isSedeOpenOnDay(selectedSede.id, dayDate);
    const manClosed = isGiornoChiuso(dateStr);
    if (!sedeOpen || manClosed || isWeekend(dayDate)) return;

    const sedeId = selectedSede.id;
    const actionableSlots = slots.filter(time => {
      if (sedeId === 'imola' && time >= '14:00' && !isLoredanaAfternoonWorkingDay(dayDate)) return false;
      return getRealAppointmentsForSlot(sedeId, dateStr, time).length === 0;
    });
    if (actionableSlots.length === 0) return;

    const blockedSlots = actionableSlots.filter(time => getUffChiusoAppointmentsForSlot(sedeId, dateStr, time).length > 0);
    const allBlocked = blockedSlots.length === actionableSlots.length;

    if (allBlocked) {
      try {
        const idsToDelete = actionableSlots.flatMap(time =>
          getUffChiusoAppointmentsForSlot(sedeId, dateStr, time).map(a => a.id)
        );
        await deleteUffChiuso(idsToDelete);
        setLocalApts(prev => prev.filter(a => !idsToDelete.includes(a.id)));
      } catch {
        alert('Errore durante lo sblocco della giornata');
      }
      return;
    }

    const motivo = window.prompt(`Motivo chiusura giornata ${format(new Date(`${dateStr}T12:00:00`), 'dd/MM/yyyy')} (es. Ferie, Formazione, ...):`) ?? '';
    try {
      const newAppointments: Appointment[] = [];
      for (const time of actionableSlots) {
        const isAlreadyBlocked = getUffChiusoAppointmentsForSlot(sedeId, dateStr, time).length > 0;
        if (isAlreadyBlocked) continue;
        const newApt = await createUffChiuso(sedeId, dateStr, time, motivo);
        newAppointments.push(newApt);
      }
      if (newAppointments.length > 0) {
        setLocalApts(prev => [...prev, ...newAppointments]);
      }
    } catch {
      alert('Errore durante il blocco della giornata');
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

  const handleSave = async (data: any) => { await onSave(data); };
  const handleUpdate = async (id: string, data: any) => { await onUpdate(id, data); };
  const handleDelete = async (id: string) => {
    await onDelete(id);
    setLocalApts(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) return;
        if (editMode) { setEditMode(false); return; }
        if (showNotesPanel) { setShowNotesPanel(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showModal, editMode, showNotesPanel]);

  useEffect(() => {
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-lv-date="${today}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 150);
  }, [currentMonth, today]);

  const daysWithNotes = Object.keys(afternoonNotes).filter(k =>
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
            style={{ minWidth: 160, textAlign: 'center', color: OPERATOR_COLOR, backgroundColor: OPERATOR_COLOR_LIGHT, borderColor: `${OPERATOR_COLOR}33` }}
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
              style={{ backgroundColor: OPERATOR_COLOR_LIGHT, color: OPERATOR_COLOR, border: `2px solid ${OPERATOR_COLOR}40` }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_HOVER)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = OPERATOR_COLOR_LIGHT)}
            >
              {loredanaSedi.map(s => (<option key={s.id} value={s.id}>{s.nome}</option>))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: OPERATOR_COLOR }} />
          </div>
        </div>

        {/* ── BARRA ORIZZONTALE DI RICERCA ── */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 min-w-[200px] max-w-xs md:max-w-sm lg:max-w-md mx-2 flex items-center"
        >
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-300 hover:border-gray-400 focus-within:border-[#005CA9] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#005CA9]/20 transition-all w-full h-[36px] shadow-xs">
            <Search size={15} className="text-[#005CA9] flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsDropdownOpen(true);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsDropdownOpen(false);
                  searchInputRef.current?.blur();
                } else if (e.key === 'Enter') {
                  if (searchResults.length > 0) {
                    e.preventDefault();
                    handleSelectSearchResult(searchResults[0]);
                  }
                }
              }}
              placeholder="Cerca cliente, note, data..."
              className="w-full text-xs bg-transparent outline-none text-gray-800 placeholder-gray-400 font-medium"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsDropdownOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                title="Cancella ricerca"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block text-[10px] text-gray-400 bg-gray-200/70 px-1.5 py-0.5 rounded font-mono pointer-events-none select-none">
                Ctrl+K
              </kbd>
            )}
          </div>

          {/* Dropdown Floating dei Risultati */}
          {isDropdownOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-[10000] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Search size={22} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-700">Nessun risultato trovato</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Nessun appuntamento corrisponde a &quot;{searchQuery}&quot;
                    </p>
                  </div>
                ) : (
                  searchResults.map(apt => {
                    const sede = sedi.find(s => s.id === apt.sede_id);
                    return (
                      <div
                        key={apt.id}
                        onClick={() => handleSelectSearchResult(apt)}
                        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#E6F2FF] cursor-pointer transition-colors group text-left"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-xs"
                          style={{ backgroundColor: OPERATOR_COLOR }}
                        >
                          <User size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-900 truncate group-hover:text-[#005CA9]">
                              {apt.cliente}
                            </p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 bg-blue-100 text-[#005CA9] border border-blue-200">
                              {sede?.nome || apt.sede_id.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>
                              {format(dateStrToLocal(apt.data), 'EEE dd/MM/yyyy', { locale: it })}
                            </span>
                            <span>&middot;</span>
                            <span className="font-bold text-gray-800">{apt.ora}</span>
                          </p>
                          {apt.note && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5 italic">
                              {apt.note}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-[#005CA9] flex-shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="px-3.5 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {searchResults.length} risultat{searchResults.length === 1 ? 'o' : 'i'} &mdash; premi <kbd className="font-mono font-bold bg-white px-1 py-0.5 rounded border text-[10px]">Invio</kbd> per il primo
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={() => setEditMode(e => !e)}
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-all border-2 flex-shrink-0 ${editMode
              ? 'bg-amber-500 border-amber-600 text-white shadow-amber-200 shadow-lg scale-110'
              : 'bg-white border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-500'
            }`}
          title={editMode ? 'Esci dalla modalità blocco multiplo' : 'Entra in modalità blocco multiplo'}
        >
          {editMode ? <Unlock size={16} /> : <Lock size={16} />}
        </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 border border-gray-200 text-gray-500 transition-colors flex-shrink-0"
            title="Chiudi (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {editMode && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <Lock size={14} className="text-amber-600" />
          <span className="text-xs font-bold text-amber-700">
            Modalità blocco multiplo attiva: clicca sugli slot per bloccare/sbloccare, oppure clicca il numero del giorno per agire su tutta la giornata
          </span>
        </div>
      )}

      {/* ══ CONTENUTO PRINCIPALE ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Tabella ── */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', minWidth: `${LABEL_W + totalColsWidth}px`, minHeight: '100%' }}>

            {/* Colonna orari fissa */}
            <div style={{ width: LABEL_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#F8FAFC', borderRight: '2px solid #E2E8F0' }}>
              <div style={{ height: HEADER_H, borderBottom: '2px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#F8FAFC' }} />
              {slots.map(time => (
                <div key={time} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{time}</span>
                </div>
              ))}
            </div>

            {/* Colonne giorni */}
            <div style={{ display: 'flex', flex: 1 }}>
              {days.map(day => {
                const dateStr = formatDate(day);
                const isToday = dateStr === today;
                const isWe = isWeekend(day);
                const colW = isWe ? COL_WIDTH_WE : COL_WIDTH;
                const manClosed = isGiornoChiuso(dateStr);
                const sedeOpen = selectedSede ? isSedeOpenOnDay(selectedSede.id, day) : false;
                const dayOff = !sedeOpen || manClosed || isWe;
                const headerBg = isToday ? OPERATOR_COLOR : isWe ? '#E5E7EB' : '#F8FAFC';
                const headerText = isToday ? '#fff' : isWe ? '#9CA3AF' : '#374151';

                const hasDayNote = afternoonNotes[dateStr]?.trim();

                const isLorActiveSlot = (time: string) => {
                  if (selectedSede?.id === 'imola' && time >= '14:00') {
                    return isLoredanaAfternoonWorkingDay(dateStr);
                  }
                  return true;
                };

                const actionableSlotsCount = selectedSede && !dayOff
                  ? slots.filter(time => isLorActiveSlot(time) && getRealAppointmentsForSlot(selectedSede.id, dateStr, time).length === 0).length
                  : 0;

                const blockedSlotsCount = selectedSede && !dayOff
                  ? slots.filter(time => isLorActiveSlot(time) && getUffChiusoAppointmentsForSlot(selectedSede.id, dateStr, time).length > 0).length
                  : 0;

                const dayFullyBlocked = actionableSlotsCount > 0 && blockedSlotsCount === actionableSlotsCount;

                return (
                  <div key={dateStr} data-lv-date={dateStr} style={{ width: colW, flexShrink: 0, borderRight: '1px solid #E5E7EB' }}>
                    {/* Header giorno */}
                    <div
                      onClick={() => {
                        if (editMode) {
                          handleDayHeaderToggle(dateStr);
                        }
                      }}
                      title={
                        editMode
                          ? 'Blocca/sblocca tutta la giornata'
                          : undefined
                      }
                      style={{
                        height: HEADER_H,
                        backgroundColor: editMode && dayFullyBlocked ? '#F59E0B' : headerBg,
                        color: editMode && dayFullyBlocked ? '#fff' : headerText,
                        borderBottom: '2px solid #E2E8F0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: editMode ? 'pointer' : 'default',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        transition: 'background-color 0.15s',
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
                              borderBottom: `1px solid ${isWe ? '#F1F5F9' : UFF_CHIUSO_BORDER}`,
                              backgroundColor: isWe ? '#F3F4F6' : UFF_CHIUSO_BG,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {!isWe && <Lock size={12} style={{ color: UFF_CHIUSO_ICON }} />}
                          </div>
                        );
                      }

                      if (selectedSede?.id === 'imola' && time >= '14:00' && !isLoredanaAfternoonWorkingDay(dateStr)) {
                        const dow = getDay(day);
                        const tooltip = dow === 1
                          ? 'Lunedì pomeriggio: Loredana riceve a CSPT'
                          : dow === 5
                          ? 'Venerdì: solo mattina (08:00 – 12:00)'
                          : 'Non riceve di pomeriggio';
                        return (
                          <div
                            key={time}
                            title={tooltip}
                            style={{
                              height: ROW_HEIGHT,
                              borderBottom: `1px solid ${UFF_CHIUSO_BORDER}`,
                              backgroundColor: UFF_CHIUSO_BG,
                            }}
                          />
                        );
                      }

                      const apt = selectedSede ? getAppointmentForSlot(selectedSede.id, dateStr, time) : null;
                      const uffClosed = isUffChiuso(apt);
                      const hasPaz = apt !== null && !uffClosed;
                      const sedeId = selectedSede?.id ?? 'imola';
                      const cellKey = `${dateStr}-${time}`;
                      const isHovered = hoveredCell === cellKey;

                      // ── Slot UFF CHIUSO ──
                      if (uffClosed) {
                        const motivoChiusura = apt?.note?.trim() || '';
                        return (
                          <div
                            key={time}
                            title={editMode ? 'Clicca per sbloccare' : (motivoChiusura ? `Ufficio chiuso – ${motivoChiusura}` : 'Ufficio chiuso')}
                            onClick={() => {
                              if (!editMode) return;
                              handleProtectedSlotToggle(sedeId, dateStr, time);
                            }}
                            onMouseEnter={e => {
                              if (editMode) e.currentTarget.style.backgroundColor = BULK_HOVER_BG;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = UFF_CHIUSO_BG;
                            }}
                            style={{
                              height: ROW_HEIGHT,
                              borderBottom: `1px solid ${editMode ? BULK_HOVER_BORDER : UFF_CHIUSO_BORDER}`,
                              backgroundColor: UFF_CHIUSO_BG,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 3,
                              padding: '0 4px',
                              cursor: editMode ? 'pointer' : 'default',
                              transition: 'background-color 0.1s',
                            }}
                          >
                            <Lock size={8} style={{ color: UFF_CHIUSO_ICON, flexShrink: 0 }} />
                            {motivoChiusura && (
                              <span style={{ fontSize: 9, color: UFF_CHIUSO_ICON, fontStyle: 'italic', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {motivoChiusura}
                              </span>
                            )}
                            {editMode && <Unlock size={8} style={{ color: UFF_CHIUSO_ICON, marginLeft: 2, flexShrink: 0 }} />}
                          </div>
                        );
                      }

                      // ── Slot con appuntamento reale ──
                      if (hasPaz) {
                        const hlKey = apt!.highlight || '';
                        const hl = HL_CSS[hlKey] ?? HL_CSS[''];
                        const hasNote = !!(apt!.note?.trim());
                        const isHighlighted = highlightedAptId === apt!.id;

                        const cellBg = isHighlighted ? '#FEE2E2' : (isHovered ? hl.bgHover : hl.bg);
                        const cellBorder = isHighlighted ? '#EF4444' : hl.border;
                        const cellLeftBorder = isHighlighted ? '#DC2626' : hl.leftBorder;
                        const cellTextColor = isHighlighted ? '#B91C1C' : hl.text;

                        return (
                          <div
                            id={`lv-apt-${apt!.id}`}
                            key={time}
                            onClick={() => !editMode && openEdit(apt!)}
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                            style={{
                              height: ROW_HEIGHT,
                              borderBottom: `1px solid ${cellBorder}`,
                              backgroundColor: cellBg,
                              borderLeft: `3px solid ${cellLeftBorder}`,
                              boxShadow: isHighlighted ? '0 0 0 2px #EF4444, 0 4px 14px rgba(239, 68, 68, 0.4)' : undefined,
                              zIndex: isHighlighted ? 35 : undefined,
                              transform: isHighlighted ? 'scale(1.02)' : undefined,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '0 5px',
                              overflow: 'visible',
                              cursor: editMode ? 'not-allowed' : 'pointer',
                              position: 'relative',
                              transition: 'all 0.25s ease',
                              opacity: editMode ? 0.7 : 1,
                            }}
                          >
                            <User size={8} style={{ color: cellTextColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: cellTextColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {apt!.cliente}
                            </span>
                            {!editMode && hasNote && (
                              <MessageSquare size={8} style={{ color: cellTextColor, flexShrink: 0, opacity: 0.75 }} />
                            )}

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
                        <div
                          key={time}
                          onClick={() => {
                            if (editMode) {
                              handleProtectedSlotToggle(sedeId, dateStr, time);
                            } else {
                              openNew(dateStr, time);
                            }
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = editMode ? BULK_HOVER_BG : OPERATOR_COLOR_LIGHT;
                            const icon = e.currentTarget.querySelector<HTMLElement>('.lv-icon');
                            if (icon) icon.style.opacity = '1';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            const icon = e.currentTarget.querySelector<HTMLElement>('.lv-icon');
                            if (icon) icon.style.opacity = '0';
                          }}
                          style={{
                            height: ROW_HEIGHT,
                            borderBottom: `1px solid ${editMode ? BULK_HOVER_BORDER : '#F1F5F9'}`,
                            backgroundColor: '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.1s',
                          }}
                        >
                          {editMode
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
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #FDE68A', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} style={{ color: '#D97706', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>NOTE POMERIGGIO</div>
                <div style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>Appuntamenti pomeridiani e promemoria</div>
              </div>
              <button
                onClick={() => setShowNotesPanel(false)}
                style={{ padding: 4, borderRadius: 6, color: '#B45309', flexShrink: 0 }}
                className="hover:bg-amber-200 transition-colors"
                title="Chiudi pannello"
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '16px', borderBottom: '1px solid #FDE68A', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <CalendarIcon size={14} /> Seleziona data
              </label>
              <input
                type="date"
                value={noteDate}
                onChange={e => setNoteDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '2px solid #FCD34D',
                  fontSize: 13,
                  backgroundColor: '#FFFFFF',
                  color: '#451A03',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#F59E0B')}
                onBlur={e => (e.currentTarget.style.borderColor = '#FCD34D')}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Testo della nota
                </label>
                {noteSaved && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Save size={12} /> Salvato
                  </span>
                )}
              </div>
              <textarea
                value={noteText}
                onChange={e => handleNoteChange(e.target.value)}
                placeholder={`Appunti pomeriggio ${formatDateDisplay(new Date(noteDate))}...\n\n(Salvato automaticamente)`}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 8,
                  border: '2px solid #FCD34D',
                  fontSize: 13,
                  backgroundColor: '#FFFFFF',
                  color: '#1C1917',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#F59E0B')}
                onBlur={e => (e.currentTarget.style.borderColor = '#FCD34D')}
              />
            </div>

            {daysWithNotes > 0 && (
              <div style={{ borderTop: '2px solid #FDE68A', padding: '16px', backgroundColor: '#FEF9C3', overflowY: 'auto', maxHeight: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> Note in questo mese ({daysWithNotes})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(afternoonNotes)
                    .filter(([k, v]) => k.startsWith(format(currentMonth, 'yyyy-MM')) && v?.trim())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateKey, text]) => {
                      const d = new Date(dateKey + 'T12:00:00');
                      const isSelected = noteDate === dateKey;
                      return (
                        <button
                          key={dateKey}
                          onClick={() => setNoteDate(dateKey)}
                          style={{
                            textAlign: 'left',
                            padding: '8px 12px',
                            borderRadius: 8,
                            backgroundColor: isSelected ? '#FDE68A' : '#FFFFFF',
                            border: `2px solid ${isSelected ? '#F59E0B' : '#FDE68A'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: isSelected ? '0 2px 4px rgba(217, 119, 6, 0.1)' : 'none',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#F59E0B'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#FDE68A'; }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? '#92400E' : '#B45309' }}>
                            {format(d, 'EEEE dd MMMM', { locale: it })}
                          </div>
                          <div style={{ fontSize: 11, color: '#92400E', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>
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