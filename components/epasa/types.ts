import { getDay } from 'date-fns';

export interface Sede {
  id: string;
  nome: string;
  colore: string;
}

export interface Operatore {
  id: string;
  nome: string;
  colore: string;
}

export interface Appointment {
  id: string;
  sede_id: string;
  operatore_id: string;
  data: string;
  ora: string;
  cliente: string;
  mese: string;
  note?: string;
  highlight?: string;
}

export interface GiornoChiuso {
  id: number;
  data: string;
  operatore_id: string | null;
  motivo: string | null;
}

export type ViewMode = 'daily' | 'monthly';
export type DayAvailability = 'free' | 'partial' | 'full' | 'closed';

export const TIME_SLOTS_IMOLA: string[] = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00',
];
export const TIME_SLOTS_IMOLA_AFTERNOON_2027: string[] = [
  '14:00','14:30','15:00','15:30',
];
export const TIME_SLOTS_IMOLA_2027: string[] = [
  ...TIME_SLOTS_IMOLA,
  ...TIME_SLOTS_IMOLA_AFTERNOON_2027,
];
export const TIME_SLOTS_CSPT: string[] = [
  '14:00','14:30','15:00','15:30','16:00','16:30',
];
export const TIME_SLOTS_BORGO: string[] = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
];
export const IMOLA_SPECIAL_SLOTS: string[] = ['08:00'];

export const dateStrToLocal = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

export const isDateIn2027OrLater = (date: Date | string): boolean => {
  if (typeof date === 'string') {
    const year = parseInt(date.substring(0, 4), 10);
    return !isNaN(year) && year >= 2027;
  }
  return date.getFullYear() >= 2027;
};

export const isMileceAfternoonWorkingDay = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? dateStrToLocal(date) : date;
  const y = d.getFullYear();
  if (y !== 2027) return false;

  const dow = d.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
  // Solo Martedì (2) e Mercoledì (3)
  if (dow !== 2 && dow !== 3) return false;

  const m = d.getMonth() + 1; // 1=Gennaio, 2=Febbraio, 3=Marzo
  const day = d.getDate();

  // Gennaio 2027: dall'11 al 27
  if (m === 1) return day >= 11 && day <= 27;

  // Febbraio 2027: dal 3 al 24
  if (m === 2) return day >= 3 && day <= 24;

  // Marzo 2027: dall'8 al 24
  if (m === 3) return day >= 8 && day <= 24;

  return false;
};

export const getTimeSlotsForSede = (sedeId: string, date?: Date | string): string[] => {
  if (sedeId === 'cspt')  return TIME_SLOTS_CSPT;
  if (sedeId === 'borgo') return TIME_SLOTS_BORGO;
  if (date && isMileceAfternoonWorkingDay(date)) {
    return TIME_SLOTS_IMOLA_2027;
  }
  return TIME_SLOTS_IMOLA;
};

export const getOperatorsForSedeId = (sedeId: string, allOperators: string[]): string[] => {
  if (sedeId === 'cspt' || sedeId === 'borgo')
    return allOperators.filter(op => op.toUpperCase() === 'LOREDANA');
  return allOperators;
};

export const MILECE_HISTORICAL_WORKING_DAYS = [2, 3, 5];
export const MILECE_START_TIME              = '08:30';

export const getWeekOfMonthFromFirstMonday = (date: Date): number => {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  const mondayD = d - (dow + 6) % 7;
  const dowFirst = new Date(y, m, 1, 12).getDay();
  const offsetMonFirst = (dowFirst + 6) % 7;
  const firstMondayD = offsetMonFirst === 0 ? 1 : 8 - offsetMonFirst;
  const diffDays = mondayD - firstMondayD;
  if (diffDays < 0) return 0;
  return Math.round(diffDays / 7) + 1;
};

export const BORGO_EXCEPTIONS: Record<string, number[]> = {
  '2026-9':  [8, 15],
  '2026-10': [6, 20],
  '2026-12': [15],
};

export const isBorgoWorkingDay = (date: Date): boolean => {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const dow = new Date(y, m, d, 12).getDay();
  if (dow !== 2) return false;
  const exKey = `${y}-${m + 1}`;
  if (BORGO_EXCEPTIONS[exKey] !== undefined) return BORGO_EXCEPTIONS[exKey].includes(d);
  const week = getWeekOfMonthFromFirstMonday(date);
  return week === 2 || week === 3;
};

export const isMileceWorkingDay = (d: Date) => {
  const dow = getDay(d);
  if (dow === 0 || dow === 6) return false;
  const y = d.getFullYear();
  const m = d.getMonth();
  if (y > 2026 || (y === 2026 && m >= 7)) {
    return dow >= 1 && dow <= 5;
  }
  return MILECE_HISTORICAL_WORKING_DAYS.includes(dow);
};

export const isMileceTimeBlocked = (operator: string, day: Date, time: string): boolean => {
  if (operator !== 'MILECE') return false;
  if (!isMileceWorkingDay(day)) return false;
  return time === '08:00';
};

export const isLoredanaAfternoonEmpty = (operator: string, time: string): boolean => {
  if (operator.toUpperCase() !== 'LOREDANA') return false;
  return TIME_SLOTS_IMOLA_AFTERNOON_2027.includes(time);
};

export const isLoredanaAfternoonBlocked = (operator: string, day: Date, time: string, sedeId?: string): boolean => {
  if (sedeId !== 'imola') return false;
  if (!isMileceAfternoonWorkingDay(day)) return false;
  if (operator.toUpperCase() !== 'LOREDANA') return false;
  return TIME_SLOTS_IMOLA_AFTERNOON_2027.includes(time);
};

export const MAX_VISIBLE_DAYS    = 60;
export const DAYS_PAST           = 3;
export const DAYS_FUTURE         = 10;
export const DAYS_TO_LOAD        = 5;
export const MIN_DATE            = new Date(2026, 0, 1);
export const SCROLL_THRESHOLD_FW = 400;
export const SCROLL_THRESHOLD_BK = 200;
export const SSE_RELOAD_DEBOUNCE = 800;
export const STICKY_HEADER_HEIGHT = 41;
export const LOCAL_MUTATION_WINDOW = 3000;

export const OPERATOR_COLOR = '#005CA9';
