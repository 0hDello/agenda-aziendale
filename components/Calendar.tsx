'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2, User } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { Appuntamento, Persona, Sede, PersonaSede } from '@/lib/types';
import { getWeekDays, formatDate, TIME_SLOTS } from '@/utils/dateUtils';
import TimeSlot from './TimeSlot';
import AppointmentModal from './AppointmentModal';

export default function Calendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  // ... altro stato invariato ...

  const weekDays = getWeekDays(currentWeek);

  // ... resto del codice invariato ...

  return (
    <div className="min-h-screen p-4 md:p-8 animate-fade-in">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        {/* ... codice header invariato ... */}
        {/* Griglia sede selezionata */}
        {selectedSede && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-in border-l-4 border-[#005CA9]">
            <div className="bg-[#005CA9] text-white p-5">
              {/* ... codice sede, operatore, pulsanti ... */}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#005CA9]/20">
                    {/* ... colonna orario e giorni settimana ... */}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot) => {
                    const isSlotEmpty = weekDays.every(day => {
                      const dateStr = formatDate(day);
                      const appointmentsInSlot = getAppointmentsForSlot(dateStr, slot.label);
                      return appointmentsInSlot.length === 0;
                    });
                    return (
                      <tr key={slot.label} className={isSlotEmpty ? "border-b border-gray-100" : ""}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200">
                          <div className="px-4 py-3 text-sm font-semibold text-gray-700">
                            {slot.label}
                          </div>
                        </td>
                        {weekDays.map((day) => {
                          const dateStr = formatDate(day);
                          const appointmentsInSlot = getAppointmentsForSlot(dateStr, slot.label);
                          return (
                            <td key={`${dateStr}-${slot.label}`} className="p-0 border-r border-black-100">
                              <TimeSlot
                                time={slot.label}
                                appointments={appointmentsInSlot}
                                onClick={(appointment) => handleSlotClick(dateStr, slot.label, appointment)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {/* ... AppointmentModal invariato ... */}
    </div>
  );
}
