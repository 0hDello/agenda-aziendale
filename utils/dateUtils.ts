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

export const TIME_SLOTS = [
  // MATTINA: 09:00 - 12:00
  { hour: 9, minute: 0, label: '09:00' },
  { hour: 9, minute: 30, label: '09:30' },
  { hour: 10, minute: 0, label: '10:00' },
  { hour: 10, minute: 30, label: '10:30' },
  { hour: 11, minute: 0, label: '11:00' },
  { hour: 11, minute: 30, label: '11:30' },
  { hour: 12, minute: 0, label: '12:00' },
  
  // PAUSA PRANZO - rimossi 12:30, 13:00, 13:30
  
  // POMERIGGIO: 14:00 - 17:30
  { hour: 14, minute: 0, label: '14:00' },
  { hour: 14, minute: 30, label: '14:30' },
  { hour: 15, minute: 0, label: '15:00' },
  { hour: 15, minute: 30, label: '15:30' },
  { hour: 16, minute: 0, label: '16:00' },
  { hour: 16, minute: 30, label: '16:30' },
  { hour: 17, minute: 0, label: '17:00' },
  { hour: 17, minute: 30, label: '17:30' },
];
