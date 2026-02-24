'use client';

import { useRef } from 'react';
import { User, Lock, Building2, ChevronDown } from 'lucide-react';
import {
  format,
  addDays,
  isWeekend,
  getDay,
  eachDayOfInterval,
  startOfDay,
} from 'date-fns';
import { it } from 'date-fns/locale';
import React from 'react';

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
  selectedSedeId: string;
  onSedeChange: (sedeId: string) => void;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────
const LOREDANA_ID = 'LOREDANA';
const MIN_DATE    = new Date(2026, 0, 1);

// Quanti giorni mostrare in totale nella tabella orizzontale
const TOTAL_DAYS = 90;

const TIME_SLOTS_MAP: Record<string, string[]> = {
  imola: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
  cspt:  ['14:00','14:30','15:00','15:30','16:00','16:30'],
  borgo: ['09:00','09:30','10:00','10:30','11:00','11:30'],
};

const LOREDANA_SEDI = ['imola', 'cspt', 'borgo'];

// Regola apertura per sede + Loredana
const isBorgoWorkingDay = (date: Date): boolean => {
  const y   = date.getFullYear();
  const m   = date.getMonth();
  const d   = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  if (dow !== 2) return false;
  // Eccezioni manuali (stessa logica di EpasaCalendar)
  const exceptions: Record<string, number[]> = {
    '2026-9':  [8, 15],
    '2026-10': [6, 20],
    '2026-12': [15],
  };
  const key = `${y}-${m + 1}`;
  if (exceptions[key]) return exceptions[key].includes(d);
  // 2ª e 3ª settimana del mese (dal primo lunedì)
  const dowFirst = new Date(y, m, 1, 12).getDay();
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
  return true; // imola: lun-ven
};

const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

// ─── Componente ───────────────────────────────────────────────────────────────
export default function LoredanaView({
  allAppointments,
  giorniChiusi,
  sedi,
  selectedSedeId,
  onSedeChange,
}: LoredanaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sedi in cui lavora Loredana
  const loredanaSedi = sedi.filter(s => LOREDANA_SEDI.includes(s.id));
  const currentSede  = loredanaSedi.find(s => s.id === selectedSedeId) ?? loredanaSedi[0];
  const sedeId       = currentSede?.id ?? 'imola';
  const timeSlots    = TIME_SLOTS_MAP[sedeId] ?? TIME_SLOTS_MAP['imola'];

  // Range di giorni: da oggi - 7 fino a oggi + TOTAL_DAYS
  const startDate = addDays(new Date(), -7);
  const days      = eachDayOfInterval({
    start: startOfDay(startDate) >= startOfDay(MIN_DATE) ? startDate : MIN_DATE,
    end:   addDays(new Date(), TOTAL_DAYS),
  });

  const today = formatDate(new Date());

  const isGiornoChiuso = (dateStr: string): boolean =>
    giorniChiusi.some(
      g => g.data === dateStr &&
           (g.operatore_id === null || g.operatore_id === LOREDANA_ID)
    );

  // Appuntamento di Loredana per sede + data + orario
  const getAppointmentForSlot = (dateStr: string, time: string): Appointment | null => {
    return allAppointments.find(
      apt =>
        apt.operatore_id === LOREDANA_ID &&
        apt.sede_id  === sedeId &&
        apt.data     === dateStr &&
        apt.ora      === time
    ) ?? null;
  };

  const isUffChiuso = (apt: Appointment | null): boolean =>
    apt !== null && apt.cliente.trim().toUpperCase() === 'UFF CHIUSO';

  const COL_WIDTH    = 110; // px per colonna giorno
  const ROW_HEIGHT   = 42;  // px per riga orario
  const LABEL_W      = 70;  // px colonna orario fissa a sinistra

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 107px)' }}>

      {/* ─── Sub-header sede ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-green-50 border-b-2 border-green-300 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center">
            <User size={13} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[#16A34A]">LOREDANA</span>
        </div>

        <span className="text-gray-300">|</span>

        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-gray-500" />
          <div className="relative">
            <select
              value={sedeId}
              onChange={e => onSedeChange(e.target.value)}
              className="pl-3 pr-8 py-1.5 text-sm bg-white text-[#005CA9] border-2 border-[#005CA9]/20 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#16A34A]/50 appearance-none cursor-pointer hover:bg-green-50 transition-colors"
            >
              {loredanaSedi.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#005CA9] pointer-events-none" />
          </div>
        </div>

        <span className="ml-auto text-[11px] text-gray-400">
          Scorri orizzontalmente per navigare tra i giorni
        </span>

        {/* Legenda */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-green-100 border border-green-400" />
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
      </div>

      {/* ─── Tabella con scroll orizzontale ──────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto flex-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ display: 'flex', minWidth: `${LABEL_W + days.length * COL_WIDTH}px` }}>

          {/* Colonna fissa orari */}
          <div
            className="flex-shrink-0 bg-[#F5F8FA] border-r border-gray-200"
            style={{ width: LABEL_W, position: 'sticky', left: 0, zIndex: 20 }}
          >
            {/* Header angolo */}
            <div
              className="bg-[#F5F8FA] border-b border-gray-200 flex items-center justify-center"
              style={{ height: 50 }}
            >
              <span className="text-[10px] font-bold text-[#005CA9] uppercase tracking-wider">Orario</span>
            </div>
            {/* Righe orario */}
            {timeSlots.map(time => (
              <div
                key={time}
                className="border-b border-gray-100 flex items-center px-2"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="text-xs font-semibold text-gray-600">{time}</span>
              </div>
            ))}
          </div>

          {/* Colonne giorni */}
          <div style={{ display: 'flex', flex: 1 }}>
            {days.map(day => {
              const dateStr  = formatDate(day);
              const isToday  = dateStr === today;
              const isWe     = isWeekend(day);
              const sedeOpen = isSedeOpenOnDay(sedeId, day);
              const manClosed = isGiornoChiuso(dateStr);
              const dayOff   = !sedeOpen || manClosed;

              const headerBg = isToday
                ? '#005CA9'
                : isWe
                ? '#E5E7EB'
                : dayOff
                ? '#F3F4F6'
                : '#F5F8FA';

              const headerText = isToday ? '#FFFFFF' : isWe || dayOff ? '#9CA3AF' : '#374151';

              return (
                <div
                  key={dateStr}
                  style={{ width: COL_WIDTH, flexShrink: 0, borderRight: '1px solid #E5E7EB' }}
                >
                  {/* Intestazione giorno */}
                  <div
                    style={{
                      height: 50,
                      backgroundColor: headerBg,
                      color: headerText,
                      borderBottom: '1px solid #E5E7EB',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>
                      {format(day, 'EEE', { locale: it })}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      {format(day, 'dd/MM')}
                    </span>
                  </div>

                  {/* Celle orario */}
                  {timeSlots.map(time => {
                    if (dayOff || isWe) {
                      return (
                        <div
                          key={time}
                          style={{
                            height: ROW_HEIGHT,
                            borderBottom: '1px solid #F3F4F6',
                            backgroundColor: '#F9FAFB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Lock size={9} style={{ color: '#D1D5DB' }} />
                        </div>
                      );
                    }

                    const apt        = getAppointmentForSlot(dateStr, time);
                    const uffClosed  = isUffChiuso(apt);
                    const hasCliente = apt !== null && !uffClosed;

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
                          <Lock size={9} style={{ color: '#F59E0B', flexShrink: 0 }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: '#92400E' }}>uff. chiuso</span>
                        </div>
                      );
                    }

                    if (hasCliente) {
                      return (
                        <div
                          key={time}
                          title={apt!.cliente + (apt!.note ? ' — ' + apt!.note : '')}
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
                          <User size={9} style={{ color: '#16A34A', flexShrink: 0 }} />
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
                          borderBottom: '1px solid #F3F4F6',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
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
}
