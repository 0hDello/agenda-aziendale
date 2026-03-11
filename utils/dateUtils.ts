import { format, addDays, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';

export const getWeekDays = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const formatDate = (date: Date) => {
  return format(date, 'yyyy-MM-dd');
};

export const formatDateDisplay = (date: Date) => {
  return format(date, 'EEEE dd/MM', { locale: it });
};

// ─── Eccezioni sabato Agenda 730 ────────────────────────────────────────────────
// 3 sabati lavorativi SOLO per MONICA CAPECCHI: 08:30–12:00
export const SABATI_730_ECCEZIONE = ['2026-05-23', '2026-06-06', '2026-06-13'];

// Helper: true se il nome corrisponde a Monica
const isMonica = (personaNome?: string) =>
  !!personaNome && personaNome.toLowerCase().includes('monica');

// Slot sabato 730 eccezionale: 08:30–12:00
export const TIME_SLOTS_730_SABATO = [
  { hour: 8,  minute: 30, label: '08:30' },
  { hour: 9,  minute: 0,  label: '09:00' },
  { hour: 9,  minute: 30, label: '09:30' },
  { hour: 10, minute: 0,  label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0,  label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0,  label: '12:00' },
];

export const END_TIME_SLOTS_730_SABATO = [
  ...TIME_SLOTS_730_SABATO,
  { hour: 12, minute: 30, label: '12:30' },
];

// ─── Slot condivisi ──────────────────────────────────────────────────────────────────
const TIME_SLOTS_STD_LMM = [
  { hour: 9,  minute: 0,  label: '09:00' },
  { hour: 9,  minute: 30, label: '09:30' },
  { hour: 10, minute: 0,  label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0,  label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0,  label: '12:00' },
  { hour: 14, minute: 0,  label: '14:00' },
  { hour: 14, minute: 30, label: '14:30' },
  { hour: 15, minute: 0,  label: '15:00' },
  { hour: 15, minute: 30, label: '15:30' },
  { hour: 16, minute: 0,  label: '16:00' },
  { hour: 17, minute: 0,  label: '17:00' },
  { hour: 17, minute: 30, label: '17:30' },
];

const END_TIME_SLOTS_STD_LMM = [
  ...TIME_SLOTS_STD_LMM,
  { hour: 18, minute: 0, label: '18:00' },
];

const TIME_SLOTS_STD_VEN = [
  { hour: 9,  minute: 0,  label: '09:00' },
  { hour: 9,  minute: 30, label: '09:30' },
  { hour: 10, minute: 0,  label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0,  label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0,  label: '12:00' },
];

const END_TIME_SLOTS_STD_VEN = [
  ...TIME_SLOTS_STD_VEN,
  { hour: 12, minute: 30, label: '12:30' },
];

// ─── Slot IMOLA ────────────────────────────────────────────────────────────────────────
const TIME_SLOTS_IMOLA_LMM     = TIME_SLOTS_STD_LMM;
const END_TIME_SLOTS_IMOLA_LMM = END_TIME_SLOTS_STD_LMM;

const TIME_SLOTS_IMOLA_GIO = [
  { hour: 9,  minute: 0,  label: '09:00' },
  { hour: 9,  minute: 30, label: '09:30' },
  { hour: 10, minute: 0,  label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0,  label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0,  label: '12:00' },
  { hour: 16, minute: 0,  label: '16:00' },
  { hour: 16, minute: 30, label: '16:30' },
  { hour: 17, minute: 0,  label: '17:00' },
  { hour: 17, minute: 30, label: '17:30' },
  { hour: 18, minute: 0,  label: '18:00' },
  { hour: 18, minute: 30, label: '18:30' },
  { hour: 19, minute: 0,  label: '19:00' },
  { hour: 19, minute: 30, label: '19:30' },
];

const END_TIME_SLOTS_IMOLA_GIO = [
  ...TIME_SLOTS_IMOLA_GIO,
  { hour: 20, minute: 0, label: '20:00' },
];

const TIME_SLOTS_IMOLA_VEN     = TIME_SLOTS_STD_VEN;
const END_TIME_SLOTS_IMOLA_VEN = END_TIME_SLOTS_STD_VEN;

export const TIME_SLOTS_IMOLA     = TIME_SLOTS_IMOLA_LMM;
export const END_TIME_SLOTS_IMOLA = END_TIME_SLOTS_IMOLA_LMM;

// ─── Slot BORGO / CSPT ───────────────────────────────────────────────────────────────
export const TIME_SLOTS_BORGO     = TIME_SLOTS_STD_LMM;
export const END_TIME_SLOTS_BORGO = END_TIME_SLOTS_STD_LMM;
export const TIME_SLOTS_CSPT      = TIME_SLOTS_STD_LMM;
export const END_TIME_SLOTS_CSPT  = END_TIME_SLOTS_STD_LMM;

export const TIME_SLOTS     = TIME_SLOTS_IMOLA;
export const END_TIME_SLOTS = END_TIME_SLOTS_IMOLA;

// ─── Helper interno ─────────────────────────────────────────────────────────────────────
const getStdSlotsForDay    = (dow: number) => dow === 5 ? TIME_SLOTS_STD_VEN    : TIME_SLOTS_STD_LMM;
const getStdEndSlotsForDay = (dow: number) => dow === 5 ? END_TIME_SLOTS_STD_VEN : END_TIME_SLOTS_STD_LMM;

// ─── Funzioni principali ──────────────────────────────────────────────────────────────────

export const getTimeSlotsForSede = (nomeSedeOrId: string, date?: Date, agendaId?: string) => {
  if (agendaId === '730' && date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (SABATI_730_ECCEZIONE.includes(dateStr)) return TIME_SLOTS_730_SABATO;
  }

  const n   = nomeSedeOrId.toLowerCase();
  const dow = date?.getDay() ?? 1;

  if (n.includes('imola') || n === '') {
    if (!date) return TIME_SLOTS_IMOLA_LMM;
    if (dow === 4) return TIME_SLOTS_IMOLA_GIO;
    if (dow === 5) return TIME_SLOTS_IMOLA_VEN;
    return TIME_SLOTS_IMOLA_LMM;
  }

  if (n.includes('borgo') || n.includes('cspt')) {
    return getStdSlotsForDay(dow);
  }

  return TIME_SLOTS_STD_LMM;
};

export const getEndTimeSlotsForSede = (nomeSedeOrId: string, date?: Date, agendaId?: string) => {
  if (agendaId === '730' && date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (SABATI_730_ECCEZIONE.includes(dateStr)) return END_TIME_SLOTS_730_SABATO;
  }

  const n   = nomeSedeOrId.toLowerCase();
  const dow = date?.getDay() ?? 1;

  if (n.includes('imola') || n === '') {
    if (!date) return END_TIME_SLOTS_IMOLA_LMM;
    if (dow === 4) return END_TIME_SLOTS_IMOLA_GIO;
    if (dow === 5) return END_TIME_SLOTS_IMOLA_VEN;
    return END_TIME_SLOTS_IMOLA_LMM;
  }

  if (n.includes('borgo') || n.includes('cspt')) {
    return getStdEndSlotsForDay(dow);
  }

  return END_TIME_SLOTS_STD_LMM;
};

/**
 * Verifica se un giorno è lavorativo per la sede (e opzionalmente per la persona).
 * Per i sabati eccezione Agenda 730 il giorno è lavorativo SOLO per Monica.
 */
export const isSedeWorkingDay = (
  nomeSedeOrId: string,
  date: Date,
  agendaId?: string,
  personaNome?: string
): boolean => {
  const n   = nomeSedeOrId.toLowerCase();
  const dow = date.getDay();

  if (agendaId === '730' && dow === 6) {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (SABATI_730_ECCEZIONE.includes(dateStr)) {
      // Sabato eccezione: lavorativo SOLO per Monica
      return isMonica(personaNome);
    }
  }

  if (n.includes('borgo') || n.includes('cspt')) return dow >= 1 && dow <= 5;
  return dow >= 1 && dow <= 5;
};
