'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import { it } from 'date-fns/locale';

interface CalendarDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onGoToToday: () => void;
  isDayClosedForSede: (day: Date) => boolean;
}

export default function CalendarDatePickerModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  onGoToToday,
  isDayClosedForSede,
}: CalendarDatePickerModalProps) {
  const [pickerDate, setPickerDate] = useState<Date>(selectedDate);

  useEffect(() => {
    if (isOpen) setPickerDate(selectedDate);
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const ms   = startOfMonth(pickerDate);
  const me   = endOfMonth(pickerDate);
  const days = eachDayOfInterval({
    start: startOfWeek(ms, { weekStartsOn: 1 }),
    end: endOfWeek(me, { weekStartsOn: 1 }),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-in border-t-4 border-[#005CA9]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#005CA9]">Seleziona Data</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setPickerDate(subMonths(pickerDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft size={20} className="text-[#005CA9]" />
          </button>
          <h4 className="text-lg font-bold text-gray-800 capitalize">
            {format(pickerDate, 'MMMM yyyy', { locale: it })}
          </h4>
          <button
            type="button"
            onClick={() => setPickerDate(addMonths(pickerDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight size={20} className="text-[#005CA9]" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-600 py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 mb-6">
          {days.map((day, i) => {
            const isCurr   = isSameMonth(day, pickerDate);
            const isSel    = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
            const isTod    = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isClosed = isDayClosedForSede(day);

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelectDate(day);
                  onClose();
                }}
                className={`aspect-square rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isSel
                    ? 'bg-[#005CA9] text-white shadow-md scale-105'
                    : isTod
                    ? 'bg-[#E6F2FF] text-[#005CA9] font-bold'
                    : isClosed && isCurr
                    ? 'bg-gray-200 text-gray-400'
                    : isCurr
                    ? 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF] hover:scale-105'
                    : 'bg-transparent text-gray-300'
                }`}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onGoToToday();
            onClose();
          }}
          className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-colors font-semibold"
        >
          Vai a Oggi
        </button>
      </div>
    </div>
  );
}
