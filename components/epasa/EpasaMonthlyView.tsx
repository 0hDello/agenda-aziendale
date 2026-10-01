'use client';

import React from 'react';
import { User, Calendar as CalendarIcon } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getMonth,
  isWeekend,
} from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Sede,
  DayAvailability,
  OPERATOR_COLOR,
  IMOLA_SPECIAL_SLOTS,
  MIN_DATE,
  dateStrToLocal,
} from './types';

interface EpasaMonthlyViewProps {
  selectedDate: Date;
  selectedSede: Sede | null;
  operatorsInSede: string[];
  selectedMonthlyOperator: string | null;
  onSelectMonthlyOperator: (op: string) => void;
  getFirstAvailableDay: (op: string) => string | null;
  getDayAvailability: (date: string, op: string) => DayAvailability;
  getTimeSlotsForSede: (sedeId: string, date?: Date | string) => string[];
  isMileceTimeBlocked: (operator: string, day: Date, time: string) => boolean;
  isLoredanaAfternoonBlocked?: (operator: string, day: Date, time: string, sedeId?: string) => boolean;
  getRealAppointmentsCount: (dateStr: string, operator: string) => number;
  getUffChiusoSlotsCount: (dateStr: string, operator: string) => number;
  onNavigateToDate: (date: Date) => void;
  onSwitchToDaily: () => void;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function EpasaMonthlyView({
  selectedDate,
  selectedSede,
  operatorsInSede,
  selectedMonthlyOperator,
  onSelectMonthlyOperator,
  getFirstAvailableDay,
  getDayAvailability,
  getTimeSlotsForSede,
  isMileceTimeBlocked,
  isLoredanaAfternoonBlocked,
  getRealAppointmentsCount,
  getUffChiusoSlotsCount,
  onNavigateToDate,
  onSwitchToDaily,
}: EpasaMonthlyViewProps) {
  const activeMonthlyOperator = selectedMonthlyOperator && operatorsInSede.includes(selectedMonthlyOperator)
    ? selectedMonthlyOperator
    : operatorsInSede[0] ?? null;

  if (!activeMonthlyOperator) return null;

  const operator = activeMonthlyOperator;
  const operatorColor = OPERATOR_COLOR;
  const fa = getFirstAvailableDay(operator);
  const monthStart = startOfMonth(selectedDate);
  const monthEnd   = endOfMonth(selectedDate);
  const allCalDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end:   endOfWeek(monthEnd, { weekStartsOn: 1 }),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < allCalDays.length; i += 7) weeks.push(allCalDays.slice(i, i + 7));

  const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

  return (
    <div className="p-3 md:p-4">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {operatorsInSede.length > 1 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <User size={16} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Operatore</span>
            <div className="flex items-center gap-1">
              {operatorsInSede.map(op => {
                const isActive = op === activeMonthlyOperator;
                return (
                  <button
                    key={op}
                    onClick={() => onSelectMonthlyOperator(op)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${
                      isActive ? 'text-white shadow-md' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                    style={isActive ? { backgroundColor: OPERATOR_COLOR } : {}}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : OPERATOR_COLOR }}
                    >
                      <User size={11} className="text-white" />
                    </div>
                    {op}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {operatorsInSede.length === 1 && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: operatorColor }}
            >
              <User size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: operatorColor }}>
              {operator}
            </span>
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          {fa && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
              <CalendarIcon size={12} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">
                Primo libero: {format(dateStrToLocal(fa), 'dd/MM', { locale: it })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
            {[
              ['bg-green-500', 'Libero'],
              ['bg-yellow-400', 'Parziale'],
              ['bg-red-500', 'Pieno'],
              ['bg-gray-300', 'Chiuso'],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${c}`} />
                <span className="text-[11px] text-gray-600">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAY_NAMES.map((name, idx) => (
            <div
              key={name}
              className={`py-2 text-center text-xs font-bold uppercase tracking-wider ${
                idx >= 5 ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-600'
              }`}
            >
              {name}
            </div>
          ))}
        </div>
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0" style={{ minHeight: '80px' }}>
            {week.map((day, dIdx) => {
              const dateStr = formatDate(day);
              const isThisMonth = getMonth(day) === getMonth(selectedDate);
              if (!isThisMonth) {
                return (
                  <div
                    key={dateStr}
                    className={`p-1.5 border-r border-gray-200 last:border-r-0 ${
                      dIdx >= 5 ? 'bg-gray-100' : 'bg-gray-50'
                    }`}
                  />
                );
              }
              const isToday  = formatDate(new Date()) === dateStr;
              const isWe     = isWeekend(day);
              const isBefore = day < MIN_DATE;
              const av       = getDayAvailability(dateStr, operator);
              const isClosed = isWe || av === 'closed';
              let freeSlots  = 0;
              if (!isClosed && selectedSede) {
                const slots   = getTimeSlotsForSede(selectedSede.id, day);
                const dateObj = dateStrToLocal(dateStr);
                const tbc = slots.filter(t => 
                  isMileceTimeBlocked(operator, dateObj, t) ||
                  (isLoredanaAfternoonBlocked && isLoredanaAfternoonBlocked(operator, dateObj, t, selectedSede.id))
                ).length;
                const ssc = (selectedSede.id === 'imola' && operator !== 'MILECE')
                  ? slots.filter(t => IMOLA_SPECIAL_SLOTS.includes(t)).length : 0;
                freeSlots = Math.max(
                  0,
                  slots.length - tbc - ssc - getRealAppointmentsCount(dateStr, operator) - getUffChiusoSlotsCount(dateStr, operator)
                );
              }
              const avBg = isClosed
                ? (isWe ? 'bg-gray-100' : 'bg-gray-50')
                : av === 'free'
                ? 'bg-green-50'
                : av === 'partial'
                ? 'bg-yellow-50'
                : 'bg-red-50';
              const avBorder = isClosed
                ? ''
                : av === 'free'
                ? 'border-t-2 border-green-400'
                : av === 'partial'
                ? 'border-t-2 border-yellow-400'
                : 'border-t-2 border-red-500';
              const avDot = av === 'free'
                ? 'bg-green-500'
                : av === 'partial'
                ? 'bg-yellow-400'
                : av === 'full'
                ? 'bg-red-500'
                : 'bg-gray-300';

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    if (!isClosed && !isBefore) {
                      onNavigateToDate(day);
                      onSwitchToDaily();
                    }
                  }}
                  className={`relative p-1.5 border-r border-gray-200 last:border-r-0 ${avBg} ${avBorder} ${
                    !isClosed && !isBefore ? 'cursor-pointer hover:bg-gray-50' : ''
                  } ${isBefore && !isClosed ? 'opacity-40' : ''}`}
                  title={
                    isClosed
                      ? 'Chiuso'
                      : freeSlots > 0
                      ? `${operator} - ${format(day, 'dd/MM/yyyy')} - ${freeSlots} slot liber${freeSlots === 1 ? 'o' : 'i'}`
                      : `${operator} - ${format(day, 'dd/MM/yyyy')} - Pieno`
                  }
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-[#005CA9] text-white' : isWe ? 'text-gray-400' : 'text-gray-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {!isClosed && <div className={`w-2 h-2 rounded-full mt-1 ${avDot}`} />}
                  </div>
                  {!isClosed && freeSlots > 0 && (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                      <span className="text-[10px] font-semibold text-green-700">
                        {freeSlots} liber{freeSlots === 1 ? 'o' : 'i'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
