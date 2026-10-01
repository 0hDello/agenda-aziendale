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
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona } from '@/lib/types';
import { DayAvailability, MIN_DATE } from './types';

interface CalendarMonthlyViewProps {
  selectedDate: Date;
  selectedMonthlyPersona: string | null;
  onSelectMonthlyPersona: (id: string) => void;
  sedePersone: Persona[];
  getFirstAvailableDay: (personaId: string) => string | null;
  getDayAvailability: (dateStr: string, personaId: string, day: Date) => DayAvailability;
  getFreeSlots: (dateStr: string, personaId: string, day: Date) => number;
  isDayClosedForSede: (day: Date) => boolean;
  onNavigateToDate: (date: Date) => void;
  onSwitchToDaily: () => void;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function CalendarMonthlyView({
  selectedDate,
  selectedMonthlyPersona,
  onSelectMonthlyPersona,
  sedePersone,
  getFirstAvailableDay,
  getDayAvailability,
  getFreeSlots,
  isDayClosedForSede,
  onNavigateToDate,
  onSwitchToDaily,
}: CalendarMonthlyViewProps) {
  const activePersona = (selectedMonthlyPersona && sedePersone.some(p => p.id === selectedMonthlyPersona))
    ? selectedMonthlyPersona
    : sedePersone[0]?.id ?? null;

  if (!activePersona) return null;

  const personaNome = sedePersone.find(p => p.id === activePersona)?.nome ?? '';
  const fa = getFirstAvailableDay(activePersona);
  const monthStart = startOfMonth(selectedDate);
  const monthEnd   = endOfMonth(selectedDate);
  const allCalDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  });

  const weeks: Date[][] = [];
  for (let i = 0; i < allCalDays.length; i += 7) {
    weeks.push(allCalDays.slice(i, i + 7));
  }

  return (
    <div className="p-3 md:p-4 h-full overflow-y-auto">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {sedePersone.length > 1 ? (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <User size={16} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Persona</span>
            <div className="flex items-center gap-1">
              {sedePersone.map(p => {
                const isActive = p.id === activePersona;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectMonthlyPersona(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      isActive
                        ? 'text-white shadow-md scale-105'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                    style={isActive ? { backgroundColor: '#005CA9' } : {}}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : '#005CA9' }}
                    >
                      <User size={11} className="text-white" />
                    </div>
                    {p.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#005CA9]">
              <User size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm text-[#005CA9]">{personaNome}</span>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          {fa && (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
              <CalendarIcon size={12} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">
                Primo libero: {format(new Date(fa), 'dd/MM', { locale: it })}
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
          <div key={wIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0" style={{ minHeight: '80px' }}>
            {week.map((day, dIdx) => {
              const dateStr     = format(day, 'yyyy-MM-dd');
              const isThisMonth = getMonth(day) === getMonth(selectedDate);
              if (!isThisMonth) {
                return (
                  <div
                    key={dateStr}
                    className={`p-1.5 border-r border-gray-100 last:border-r-0 ${
                      dIdx >= 5 ? 'bg-gray-100' : 'bg-gray-50'
                    }`}
                  />
                );
              }

              const isToday   = format(new Date(), 'yyyy-MM-dd') === dateStr;
              const isClosed  = isDayClosedForSede(day);
              const isBefore  = day < MIN_DATE;
              const av        = getDayAvailability(dateStr, activePersona, day);
              const freeSlots = (!isClosed && av !== 'full') ? getFreeSlots(dateStr, activePersona, day) : 0;
              const avBg      = isClosed ? 'bg-gray-100' : av === 'free' ? 'bg-green-50' : av === 'partial' ? 'bg-yellow-50' : 'bg-red-50';
              const avBorder  = isClosed ? '' : av === 'free' ? 'border-t-2 border-green-400' : av === 'partial' ? 'border-t-2 border-yellow-400' : 'border-t-2 border-red-500';
              const avDot     = isClosed ? 'bg-gray-300' : av === 'free' ? 'bg-green-500' : av === 'partial' ? 'bg-yellow-400' : 'bg-red-500';

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    if (!isClosed && !isBefore) {
                      onNavigateToDate(day);
                      onSwitchToDaily();
                    }
                  }}
                  className={`relative p-1.5 border-r border-gray-100 last:border-r-0 transition-all ${avBg} ${avBorder} ${
                    !isClosed && !isBefore ? 'cursor-pointer hover:brightness-95' : ''
                  } ${isBefore && !isClosed ? 'opacity-40' : ''}`}
                  title={
                    isClosed
                      ? 'Chiuso'
                      : freeSlots > 0
                      ? `${personaNome} - ${format(day, 'dd/MM/yyyy')} - ${freeSlots} slot liber${freeSlots === 1 ? 'o' : 'i'}`
                      : `${personaNome} - ${format(day, 'dd/MM/yyyy')} - Pieno`
                  }
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-[#005CA9] text-white' : isClosed ? 'text-gray-400' : 'text-gray-700'
                    }`}>
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
