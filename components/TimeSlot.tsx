'use client';

import { Appuntamento } from '@/lib/types';
import { User } from 'lucide-react';
import { useState } from 'react';

interface TimeSlotProps {
  time: string;
  appointments?: Appuntamento[];
  onClick: (appointment?: Appuntamento) => void;
}

export default function TimeSlot({ time, appointments = [], onClick }: TimeSlotProps) {
  if (appointments.length > 0) {
    // Separa appuntamenti che INIZIANO qui da quelli che CONTINUANO
    const startsInThisSlot = appointments.filter(
      (apt) => apt.ora_inizio.substring(0, 5) === time
    );
    const continuesInThisSlot = appointments.filter(
      (apt) => apt.ora_inizio.substring(0, 5) !== time
    );

    // Se questo slot contiene solo continuazioni
    if (startsInThisSlot.length === 0 && continuesInThisSlot.length > 0) {
      if (continuesInThisSlot.length === 1) {
        // UNA SOLA CONTINUAZIONE
        const apt = continuesInThisSlot[0];
        return (
          <div
            onClick={() => onClick(apt)}
            data-appointment-id={apt.id}
            className="appointment-cell h-full min-h-[60px] bg-[#E6F2FF] border-l-4 border-[#005CA9] cursor-pointer transition-colors"
          >
            {/* Continuazione */} 
          </div>
        );
      } else {
        // CONTINUAZIONI MULTIPLE
        return (
          <div className="h-full min-h-[60px] flex gap-1 bg-white p-1">
            {continuesInThisSlot.map((apt) => (
              <div
                key={apt.id}
                onClick={() => onClick(apt)}
                data-appointment-id={apt.id}
                className="appointment-cell flex-1 bg-[#E6F2FF] border-l-4 border-[#005CA9] cursor-pointer transition-colors"
              >
                {/* Continuazione */}
              </div>
            ))}
          </div>
        );
      }
    }

    // Se ci sono appuntamenti che INIZIANO in questo slot
    if (startsInThisSlot.length === 1) {
      // UN SOLO APPUNTAMENTO
      const appointment = startsInThisSlot[0];

      return (
        <div
          onClick={() => onClick(appointment)}
          data-appointment-id={appointment.id}
          className="appointment-cell h-full min-h-[60px] bg-[#E6F2FF] border-l-4 border-[#005CA9] p-2 cursor-pointer transition-colors rounded-t-lg"
        >
          <div className="flex items-start gap-2">
            <div className="bg-[#005CA9] text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
              <User size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#005CA9] truncate">
                {appointment.cliente || 'Appuntamento'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {appointment.ora_inizio?.substring(0, 5)} - {appointment.ora_fine?.substring(0, 5)}
              </p>
              {appointment.note && (
                <p className="text-xs text-gray-500 truncate mt-1">
                  {appointment.note}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // APPUNTAMENTI MULTIPLI
    return (
      <div className="h-full min-h-[60px] flex gap-1 bg-white p-1">
        {startsInThisSlot.map((appointment) => (
          <div
            key={appointment.id}
            onClick={(e) => {
              e.stopPropagation();
              onClick(appointment);
            }}
            data-appointment-id={appointment.id}
            className="appointment-cell flex-1 bg-[#E6F2FF] border-l-4 border-[#005CA9] p-1.5 cursor-pointer transition-all min-w-0 rounded-t-lg"
          >
            <p className="text-xs font-bold text-[#005CA9] truncate leading-tight">
              {appointment.cliente || 'App.'}
            </p>
            <p className="text-[10px] text-gray-600 truncate leading-tight mt-0.5">
              {appointment.ora_inizio?.substring(0, 5)} - {appointment.ora_fine?.substring(0, 5)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  // Cella vuota
  return (
    <div
      onClick={() => onClick()}
      className="h-full min-h-[60px] hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-center group"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
  );
}
