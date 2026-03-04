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

// ─── Slot condivisi (riutilizzati da più sedi) ───────────────────────────────────

// Lun/Mar/Mer (+ Gio per CSPT/Borgo): 09:00–12:30 + 14:00–17:30  (fine: 18:00)
const TIME_SLOTS_STD_LMM = [
  { hour: 9,  minute: 0,  label: '09:00' },
  { hour: 9,  minute: 30, label: '09:30' },
  { hour: 10, minute: 0,  label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0,  label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0,  label: '12:00' },
  { hour: 12, minute: 30, label: '12:30' },
  { hour: 14, minute: 0,  label: '14:00' },
  { hour: 14, minute: 30, label: '14:30' },
  { hour: 15, minute: 0,  label: '15:00' },
  { hour: 15, minute: 30, label: '15:30' },
  { hour: 16, minute: 0,  label: '16:00' },
  { hour: 16, minute: 30, label: '16:30' },
  { hour: 17, minute: 0,  label: '17:00' },
  { hour: 17, minute: 30, label: '17:30' },
];

const END_TIME_SLOTS_STD_LMM = [
  ...TIME_SLOTS_STD_LMM,
  { hour: 18, minute: 0, label: '18:00' },
];

// Venerdì standard: solo 09:00–12:00  (fine: 12:30)
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

// ─── Slot IMOLA per giorno ─────────────────────────────────────────────────

// Lun / Mar / Mer: identico a STD_LMM
const TIME_SLOTS_IMOLA_LMM     = TIME_SLOTS_STD_LMM;
const END_TIME_SLOTS_IMOLA_LMM = END_TIME_SLOTS_STD_LMM;

// Gio Imola: 09:00–12:30 + 16:00–19:30  (fine: 20:00)
const TIME_SLOTS_IMOLA_GIO = [
  { hour: 9,  minute: 0,  label: '09:00' },
  { hour: 9,  minute: 30, label: '09:30' },
  { hour: 10, minute: 0,  label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0,  label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0,  label: '12:00' },
  { hour: 12, minute: 30, label: '12:30' },
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

// Ven Imola: identico a STD_VEN
const TIME_SLOTS_IMOLA_VEN     = TIME_SLOTS_STD_VEN;
const END_TIME_SLOTS_IMOLA_VEN = END_TIME_SLOTS_STD_VEN;

// Compatibilità retroattiva
export const TIME_SLOTS_IMOLA     = TIME_SLOTS_IMOLA_LMM;
export const END_TIME_SLOTS_IMOLA = END_TIME_SLOTS_IMOLA_LMM;

// ─── Slot BORGO per giorno ─────────────────────────────────────────────────
// Lun–Gio: uguale a Imola LMM (09:00–12:30 + 14:00–17:30)
// Ven:    uguale a Imola VEN  (09:00–12:00, fine 12:30)

export const TIME_SLOTS_BORGO     = TIME_SLOTS_STD_LMM; // legacy export
export const END_TIME_SLOTS_BORGO = END_TIME_SLOTS_STD_LMM;

// ─── Slot CSPT per giorno ─────────────────────────────────────────────────
// Lun–Gio: uguale a Imola LMM (09:00–12:30 + 14:00–17:30)
// Ven:    uguale a Imola VEN  (09:00–12:00, fine 12:30)

export const TIME_SLOTS_CSPT     = TIME_SLOTS_STD_LMM; // legacy export
export const END_TIME_SLOTS_CSPT = END_TIME_SLOTS_STD_LMM;

// Compatibilità retroattiva generica
export const TIME_SLOTS     = TIME_SLOTS_IMOLA;
export const END_TIME_SLOTS = END_TIME_SLOTS_IMOLA;

// ─── Helper interno: slot per-giorno data sede ───────────────────────────
// Lun(1) Mar(2) Mer(3) Gio(4) → STD_LMM
// Ven(5)                      → STD_VEN
const getStdSlotsForDay = (dow: number) =>
  dow === 5 ? TIME_SLOTS_STD_VEN : TIME_SLOTS_STD_LMM;

const getStdEndSlotsForDay = (dow: number) =>
  dow === 5 ? END_TIME_SLOTS_STD_VEN : END_TIME_SLOTS_STD_LMM;

// ─── Funzioni principali ───────────────────────────────────────────────────

/**
 * Restituisce gli slot di inizio per la sede e il giorno specifico.
 * @param nomeSedeOrId  nome della sede
 * @param date          data del giorno (opzionale)
 */
export const getTimeSlotsForSede = (nomeSedeOrId: string, date?: Date) => {
  const n   = nomeSedeOrId.toLowerCase();
  const dow = date?.getDay() ?? 1; // default lun

  // IMOLA: Gio speciale, Ven standard, resto LMM
  if (n.includes('imola') || n === '') {
    if (!date) return TIME_SLOTS_IMOLA_LMM;
    if (dow === 4) return TIME_SLOTS_IMOLA_GIO;
    if (dow === 5) return TIME_SLOTS_IMOLA_VEN;
    return TIME_SLOTS_IMOLA_LMM;
  }

  // BORGO e CSPT: Lun–Gio = STD_LMM, Ven = STD_VEN
  if (n.includes('borgo') || n.includes('cspt')) {
    return getStdSlotsForDay(dow);
  }

  return TIME_SLOTS_STD_LMM;
};

/**
 * Restituisce gli slot di fine per la sede e il giorno specifico.
 */
export const getEndTimeSlotsForSede = (nomeSedeOrId: string, date?: Date) => {
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

// Verifica se un giorno è lavorativo per la sede
export const isSedeWorkingDay = (nomeSedeOrId: string, date: Date): boolean => {
  const n   = nomeSedeOrId.toLowerCase();
  const dow = date.getDay(); // 0=dom, 1=lun, ..., 6=sab

  // BORGO e CSPT: Lun(1)–Ven(5)
  if (n.includes('borgo') || n.includes('cspt')) return dow >= 1 && dow <= 5;

  // IMOLA e default: Lun(1)–Ven(5)
  return dow >= 1 && dow <= 5;
};
