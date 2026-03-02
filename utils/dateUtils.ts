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

// Slot Imola: Lun-Ven 09:00-12:00 e 14:00-17:30 (senza 16:30)
export const TIME_SLOTS_IMOLA = [
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
  // 16:30 escluso per Imola
  { hour: 17, minute: 0,  label: '17:00' },
];

export const END_TIME_SLOTS_IMOLA = [
  ...TIME_SLOTS_IMOLA,
  { hour: 17, minute: 30, label: '17:30' },
];

// Slot Borgo: solo mercoledì 08:30-12:30 e 14:00-18:00
export const TIME_SLOTS_BORGO = [
  { hour: 8,  minute: 30, label: '08:30' },
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

export const END_TIME_SLOTS_BORGO = [
  ...TIME_SLOTS_BORGO,
  { hour: 18, minute: 0, label: '18:00' },
];

// Compatibilità retroattiva: TIME_SLOTS punta a Imola di default
export const TIME_SLOTS = TIME_SLOTS_IMOLA;
export const END_TIME_SLOTS = END_TIME_SLOTS_IMOLA;

export const getTimeSlotsForSede = (nomeSedeOrId: string) => {
  const n = nomeSedeOrId.toLowerCase();
  if (n.includes('borgo')) return TIME_SLOTS_BORGO;
  return TIME_SLOTS_IMOLA;
};

export const getEndTimeSlotsForSede = (nomeSedeOrId: string) => {
  const n = nomeSedeOrId.toLowerCase();
  if (n.includes('borgo')) return END_TIME_SLOTS_BORGO;
  return END_TIME_SLOTS_IMOLA;
};

// Verifica se un giorno è lavorativo per la sede
export const isSedeWorkingDay = (nomeSedeOrId: string, date: Date): boolean => {
  const n = nomeSedeOrId.toLowerCase();
  const dow = date.getDay(); // 0=dom, 1=lun, ..., 6=sab
  if (n.includes('borgo')) return dow === 3; // solo mercoledì
  return dow >= 1 && dow <= 5; // Lun-Ven per Imola e altri
};
