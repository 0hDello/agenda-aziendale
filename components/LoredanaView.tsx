'use client';

import { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  isWeekend,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getDay,
} from 'date-fns';
import { it } from 'date-fns/locale';

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

interface LoredanaViewProps {
  onClose: () => void;
  allAppointments: Appointment[];
  giorniChiusi: GiornoChiuso[];
  sedi: Sede[];
}

// ─── Costanti ──────────────────────────────────────────────────────────────────
const LOREDANA_ID = 'LOREDANA';

// Sedi in cui lavora Loredana
const LOREDANA_SEDI = ['imola', 'cspt', 'borgo'];

const TIME_SLOTS_MAP: Record<string, string[]> = {
  imola: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00'],
  cspt:  ['14:00','14:30','15:00','15:30','16:00','16:30'],
  borgo: ['09:00','09:30','10:00','10:30','11:00','11:30'],
};

// Giorni lavorativi per sede
const isSedeOpenOnDay = (sedeId: string, date: Date): boolean => {
  if (isWeekend(date)) return false;
  const dow = getDay(date); // 0=Dom, 1=Lun, ..., 6=Sab
  if (sedeId === 'cspt')  return dow === 1; // solo lunedì
  if (sedeId === 'borgo') {
    // Martedì della 2ª e 3ª settimana del mese (approssimazione semplificata)
    if (dow !== 2) return false;
    const d = date.getDate();
    return (d >= 8 && d <= 21);
  }
  return true; // imola: lun-ven
};

// ─── Componente ────────────────────────────────────────────────────────────────
export default function LoredanaView({
  onClose,
  allAppointments,
  giorniChiusi,
  sedi,
}: LoredanaViewProps) {
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    // Inizia dal lunedì della settimana corrente
    return startOfWeek(today, { weekStartsOn: 1 });
  });

  // 7 giorni visibili (una settimana)
  const days = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 6),
  });

  const goToPrevWeek = () => setStartDate(d => subDays(d, 7));
  const goToNextWeek = () => setStartDate(d => addDays(d, 7));
  const goToCurrentWeek = () => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

  const isGiornoChiuso = (dateStr: string): boolean =>
    giorniChiusi.some(
      g => g.data === dateStr && (g.operatore_id === null || g.operatore_id === LOREDANA_ID)
    );

  // Appuntamenti reali di Loredana (no UFF CHIUSO) per una sede e data
  const getClienti = (sedeId: string, dateStr: string): string[] => {
    return allAppointments
      .filter(
        apt =>
          apt.operatore_id === LOREDANA_ID &&
          apt.sede_id === sedeId &&
          apt.data === dateStr &&
          apt.cliente.trim().toUpperCase() !== 'UFF CHIUSO'
      )
      .map(apt => apt.cliente);
  };

  // Conta gli slot "UFF CHIUSO" per sede e data
  const hasUffChiuso = (sedeId: string, dateStr: string): boolean => {
    const slots = TIME_SLOTS_MAP[sedeId] || [];
    return slots.some(time =>
      allAppointments.some(
        apt =>
          apt.operatore_id === LOREDANA_ID &&
          apt.sede_id === sedeId &&
          apt.data === dateStr &&
          apt.ora === time &&
          apt.cliente.trim().toUpperCase() === 'UFF CHIUSO'
      )
    );
  };

  // Sedi visibili di Loredana (solo quelle che esistono nel db)
  const loredanaSedi = sedi.filter(s => LOREDANA_SEDI.includes(s.id));

  const sediBySede: Record<string, Sede> = {};
  loredanaSedi.forEach(s => { sediBySede[s.id] = s; });

  const today = formatDate(new Date());

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-2 md:p-4 overflow-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border-t-4 border-[#16A34A] w-full max-w-[1400px] mt-4 mb-4 animate-slide-in">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-[#16A34A] p-2 rounded-lg shadow">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#16A34A]">Vista Loredana</h2>
              <p className="text-xs text-gray-500">Appuntamenti settimanali per sede</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevWeek}
              className="p-2 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              title="Settimana precedente"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>

            <button
              onClick={goToCurrentWeek}
              className="px-3 py-2 text-sm font-semibold text-[#16A34A] bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
            >
              Settimana corrente
            </button>

            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              title="Settimana successiva"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>

            <span className="ml-2 text-sm font-semibold text-gray-700 capitalize">
              {format(startDate, "'Sett.' dd MMM", { locale: it })} —{' '}
              {format(addDays(startDate, 6), 'dd MMM yyyy', { locale: it })}
            </span>

            <button
              onClick={onClose}
              className="ml-4 p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
              title="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── Tabella ─── */}
        <div className="overflow-x-auto p-3">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {/* Colonna sede */}
                <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">
                  Sede
                </th>
                {/* Colonne giorni */}
                {days.map(day => {
                  const dateStr = formatDate(day);
                  const isToday = dateStr === today;
                  const isWe = isWeekend(day);
                  return (
                    <th
                      key={dateStr}
                      className={`border-b border-r border-gray-200 px-2 py-2 text-center min-w-[130px] ${
                        isToday
                          ? 'bg-[#005CA9] text-white'
                          : isWe
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="text-xs font-bold capitalize">
                        {format(day, 'EEEE', { locale: it })}
                      </div>
                      <div className="text-sm font-semibold">
                        {format(day, 'dd/MM')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {LOREDANA_SEDI.map(sedeId => {
                const sede = sediBySede[sedeId];
                if (!sede) return null;

                return (
                  <tr key={sedeId} className="border-b border-gray-100">
                    {/* Label sede */}
                    <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sede.colore || '#16A34A' }}
                        />
                        <span className="text-xs font-bold text-gray-700">{sede.nome}</span>
                      </div>
                    </td>

                    {/* Celle per giorno */}
                    {days.map(day => {
                      const dateStr = formatDate(day);
                      const isWe = isWeekend(day);
                      const sedeOpen = isSedeOpenOnDay(sedeId, day);
                      const manuallyClosed = isGiornoChiuso(dateStr);
                      const isClosed = !sedeOpen || manuallyClosed;
                      const uffClosed = !isClosed && hasUffChiuso(sedeId, dateStr);
                      const clienti = isClosed ? [] : getClienti(sedeId, dateStr);

                      if (isWe) {
                        return (
                          <td
                            key={dateStr}
                            className="border-r border-gray-100 px-2 py-2 bg-gray-50 text-center align-top"
                            style={{ minHeight: '60px' }}
                          >
                            <span className="text-[10px] text-gray-300 font-medium">—</span>
                          </td>
                        );
                      }

                      if (isClosed) {
                        return (
                          <td
                            key={dateStr}
                            className="border-r border-gray-100 px-2 py-2 bg-gray-50 align-top"
                            style={{ minHeight: '60px' }}
                          >
                            <div className="flex items-center gap-1 justify-center mt-1">
                              <Lock size={10} className="text-gray-400" />
                              <span className="text-[10px] text-gray-400 font-medium">chiuso</span>
                            </div>
                          </td>
                        );
                      }

                      if (uffClosed && clienti.length === 0) {
                        return (
                          <td
                            key={dateStr}
                            className="border-r border-gray-100 px-2 py-2 bg-amber-50 align-top"
                            style={{ minHeight: '60px' }}
                          >
                            <div className="flex items-center gap-1 justify-center mt-1">
                              <Lock size={10} className="text-amber-500" />
                              <span className="text-[10px] text-amber-600 font-semibold">uff. chiuso</span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={dateStr}
                          className="border-r border-gray-100 px-2 py-1.5 align-top"
                          style={{ minHeight: '60px' }}
                        >
                          {clienti.length === 0 ? (
                            <div className="flex items-center justify-center h-full mt-2">
                              <span className="text-[10px] text-green-500 font-medium">libero</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {clienti.map((c, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1 bg-green-50 border border-green-200 rounded px-1.5 py-0.5"
                                >
                                  <User size={9} className="text-green-600 flex-shrink-0" />
                                  <span className="text-[10px] font-medium text-green-800 truncate max-w-[100px]">
                                    {c}
                                  </span>
                                </div>
                              ))}
                              {uffClosed && (
                                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5">
                                  <Lock size={9} className="text-amber-500 flex-shrink-0" />
                                  <span className="text-[10px] font-medium text-amber-700">+ chiuso</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Legenda ─── */}
        <div className="flex items-center gap-4 px-4 pb-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-50 border border-green-200" />
            <span className="text-[11px] text-gray-500">Appuntamento</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
            <span className="text-[11px] text-gray-500">Uff. chiuso (manuale)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
            <span className="text-[11px] text-gray-500">Sede chiusa / non lavora</span>
          </div>
          <span className="text-[11px] text-green-600 font-semibold ml-auto">
            Operatrice: LOREDANA
          </span>
        </div>
      </div>
    </div>
  );
}
