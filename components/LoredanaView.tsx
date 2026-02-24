'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Lock, Building2, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon,
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

// ─── Tipi ────────────────────────────────────────────────────────────────────
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

export interface LoredanaViewProps {
  allAppointments: Appointment[];
  giorniChiusi: GiornoChiuso[];
  sedi: Sede[];
  onClose: () => void;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const LOREDANA_ID = 'LOREDANA';
const MIN_DATE    = new Date(2026, 0, 1);

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

// ─── Componente ───────────────────────────────────────────────────────────────
export default function LoredanaView({
  allAppointments,
  giorniChiusi,
  sedi,
  onClose,
}: LoredanaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today     = formatDate(new Date());

  // Mese corrente per navigazione
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Sedi selezionate (default: tutte quelle di Loredana disponibili)
  const loredanaSedi     = sedi.filter(s => LOREDANA_SEDI.includes(s.id));
  const allSediIds       = loredanaSedi.map(s => s.id);
  const [selectedSediIds, setSelectedSediIds] = useState<string[]>(allSediIds);

  // Aggiorna default quando arrivano le sedi
  useEffect(() => {
    if (allSediIds.length > 0 && selectedSediIds.length === 0) {
      setSelectedSediIds(allSediIds);
    }
  }, [sedi]);

  // Toggle singola sede
  const toggleSede = (id: string) => {
    setSelectedSediIds(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(s => s !== id) : prev   // almeno 1 sempre attiva
        : [...prev, id]
    );
  };

  // Giorni del mese corrente
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  });

  const goPrev = () => {
    const prev = subMonths(currentMonth, 1);
    if (prev >= new Date(MIN_DATE.getFullYear(), MIN_DATE.getMonth(), 1))
      setCurrentMonth(prev);
  };
  const goNext = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToday = () => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const isGiornoChiuso = (dateStr: string): boolean =>
    giorniChiusi.some(
      g => g.data === dateStr &&
           (g.operatore_id === null || g.operatore_id === LOREDANA_ID)
    );

  const getAppointmentForSlot = (sedeId: string, dateStr: string, time: string): Appointment | null =>
    allAppointments.find(
      apt =>
        apt.operatore_id === LOREDANA_ID &&
        apt.sede_id  === sedeId &&
        apt.data     === dateStr &&
        apt.ora      === time
    ) ?? null;

  const isUffChiuso = (apt: Appointment | null): boolean =>
    apt !== null && apt.cliente.trim().toUpperCase() === 'UFF CHIUSO';

  // Chiudi con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Scroll automatico su "oggi" all'apertura
  useEffect(() => {
    setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-lv-date="${today}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 150);
  }, [currentMonth]);

  const sediToShow = loredanaSedi.filter(s => selectedSediIds.includes(s.id));

  const COL_WIDTH  = 115;  // px colonna giorno
  const ROW_HEIGHT = 40;   // px riga slot
  const LABEL_W    = 68;   // px colonna sede+orario fissa
  const HEADER_H   = 54;   // px header giorno

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-white"
      style={{ overflow: 'hidden' }}
    >
      {/* ══════════ TOPBAR ══════════ */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b-2 border-green-300 flex-shrink-0 shadow-sm">

        {/* Avatar + titolo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#16A34A] flex items-center justify-center shadow">
            <User size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-[#16A34A] leading-none">LOREDANA</div>
            <div className="text-[10px] text-gray-400 leading-none mt-0.5">Vista mensile</div>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Navigazione mese */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Mese precedente"
          >
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-bold text-[#005CA9] bg-[#E6F2FF] border border-[#005CA9]/20 rounded-lg hover:bg-[#D1E7FF] transition-colors whitespace-nowrap"
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

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Selezione sedi */}
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-gray-500 flex-shrink-0" />
          <div className="flex items-center gap-1.5">
            {loredanaSedi.map(s => {
              const active = selectedSediIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSede(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                    active
                      ? 'bg-[#16A34A] border-[#16A34A] text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-[#16A34A] hover:text-[#16A34A]'
                  }`}
                >
                  {s.nome}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="ml-auto flex items-center gap-3 mr-2">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-green-200 border border-green-500" />
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

        {/* Chiudi */}
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 border border-gray-200 text-gray-500 transition-colors flex-shrink-0"
          title="Chiudi (ESC)"
        >
          <X size={18} />
        </button>
      </div>

      {/* ══════════ TABELLA ══════════ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          style={{
            display: 'flex',
            minWidth: `${LABEL_W + days.length * COL_WIDTH}px`,
            minHeight: '100%',
          }}
        >
          {/* ── Colonna fissa sinistra: sede + orario ── */}
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
            {/* Angolo vuoto (altezza = header giorni) */}
            <div style={{ height: HEADER_H, borderBottom: '1px solid #E2E8F0' }} />

            {/* Righe sede + orario */}
            {sediToShow.map(sede => {
              const slots = TIME_SLOTS_MAP[sede.id] ?? TIME_SLOTS_MAP['imola'];
              return (
                <div key={sede.id}>
                  {/* Etichetta sede */}
                  <div
                    style={{
                      backgroundColor: '#16A34A',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 10,
                      padding: '3px 8px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid #15803d',
                    }}
                  >
                    {sede.nome}
                  </div>
                  {/* Slot orari */}
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
              );
            })}
          </div>

          {/* ── Colonne giorni ── */}
          <div style={{ display: 'flex', flex: 1 }}>
            {days.map(day => {
              const dateStr = formatDate(day);
              const isToday = dateStr === today;
              const isWe    = isWeekend(day);
              const manClosed = isGiornoChiuso(dateStr);

              const headerBg = isToday
                ? '#005CA9'
                : isWe
                ? '#E5E7EB'
                : '#F8FAFC';
              const headerText = isToday ? '#fff' : isWe ? '#9CA3AF' : '#374151';

              return (
                <div
                  key={dateStr}
                  data-lv-date={dateStr}
                  style={{
                    width: COL_WIDTH,
                    flexShrink: 0,
                    borderRight: '1px solid #E5E7EB',
                  }}
                >
                  {/* ── Intestazione giorno ── */}
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
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize', opacity: 0.8 }}>
                      {format(day, 'EEE', { locale: it })}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.1 }}>
                      {format(day, 'dd')}
                    </span>
                    {isWe && (
                      <span style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>weekend</span>
                    )}
                  </div>

                  {/* ── Righe per ogni sede selezionata ── */}
                  {sediToShow.map(sede => {
                    const slots   = TIME_SLOTS_MAP[sede.id] ?? TIME_SLOTS_MAP['imola'];
                    const sedeOpen = isSedeOpenOnDay(sede.id, day);
                    const dayOff   = !sedeOpen || manClosed || isWe;

                    return (
                      <div key={sede.id}>
                        {/* Separatore sede */}
                        <div
                          style={{
                            height: 20,
                            backgroundColor: dayOff ? '#F3F4F6' : '#F0FDF4',
                            borderBottom: '1px solid #D1FAE5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {dayOff && !isWe && (
                            <span style={{ fontSize: 8, color: '#9CA3AF', fontWeight: 600 }}>chiuso</span>
                          )}
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
                                <Lock size={8} style={{ color: '#D1D5DB' }} />
                              </div>
                            );
                          }

                          const apt       = getAppointmentForSlot(sede.id, dateStr, time);
                          const uffClosed = isUffChiuso(apt);
                          const hasPaz    = apt !== null && !uffClosed;

                          if (uffClosed) {
                            return (
                              <div
                                key={time}
                                title="Ufficio chiuso"
                                style={{
                                  height: ROW_HEIGHT,
                                  borderBottom: '1px solid #FDE68A',
                                  backgroundColor: '#FFFBEB',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 3,
                                  padding: '0 4px',
                                }}
                              >
                                <Lock size={8} style={{ color: '#F59E0B' }} />
                                <span style={{ fontSize: 9, fontWeight: 600, color: '#92400E' }}>uff. chiuso</span>
                              </div>
                            );
                          }

                          if (hasPaz) {
                            return (
                              <div
                                key={time}
                                title={`${apt!.cliente}${apt!.note ? ' — ' + apt!.note : ''}`}
                                style={{
                                  height: ROW_HEIGHT,
                                  borderBottom: '1px solid #BBF7D0',
                                  backgroundColor: '#F0FDF4',
                                  borderLeft: '3px solid #16A34A',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '0 6px',
                                  overflow: 'hidden',
                                }}
                              >
                                <User size={8} style={{ color: '#16A34A', flexShrink: 0 }} />
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: '#166534',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {apt!.cliente}
                                </span>
                              </div>
                            );
                          }

                          // Slot libero
                          return (
                            <div
                              key={time}
                              style={{
                                height: ROW_HEIGHT,
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: '#FFFFFF',
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // Portal: si monta su document.body, fuori da qualsiasi layout
  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}
