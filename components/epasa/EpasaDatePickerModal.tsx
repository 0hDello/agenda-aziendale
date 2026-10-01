'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isWeekend,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { MIN_DATE } from './types';

interface EpasaDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onGoToToday: () => void;
}

export default function EpasaDatePickerModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  onGoToToday,
}: EpasaDatePickerModalProps) {
  const [pickerDate, setPickerDate] = useState<Date>(selectedDate);

  useEffect(() => {
    if (isOpen) setPickerDate(selectedDate);
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');
  const ms = startOfMonth(pickerDate);
  const days = eachDayOfInterval({ start: ms, end: endOfMonth(pickerDate) });
  const firstDow = (getDay(ms) + 6) % 7;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-4 border-[#005CA9]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#005CA9]">Seleziona Data</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setPickerDate(subMonths(pickerDate, 1))}
            disabled={pickerDate <= MIN_DATE}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
          {Array(firstDow).fill(null).map((_, i) => (
            <div key={`e-${i}`} className="aspect-square" />
          ))}
          {days.map((day, i) => {
            const isSel = formatDate(day) === formatDate(selectedDate);
            const isTod = formatDate(day) === formatDate(new Date());
            const isBef = day < MIN_DATE;
            const isWe  = isWeekend(day);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (!isBef) {
                    onSelectDate(day);
                    onClose();
                  }
                }}
                disabled={isBef}
                className={`aspect-square rounded-lg text-sm font-medium ${
                  isBef
                    ? 'bg-transparent text-gray-300 cursor-not-allowed'
                    : isSel
                    ? 'bg-[#005CA9] text-white shadow-md'
                    : isTod
                    ? 'bg-[#E6F2FF] text-[#005CA9] font-bold'
                    : isWe
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-gray-100 text-gray-800 hover:bg-[#E6F2FF]'
                } ${!isBef ? 'cursor-pointer' : ''}`}
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
          className="w-full px-4 py-3 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] font-semibold"
        >
          Vai a Oggi
        </button>
      </div>
    </div>
  );
}
