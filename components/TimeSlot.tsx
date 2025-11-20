'use client';

import { Appuntamento } from '@/lib/types';
import { User } from 'lucide-react';
import { TIME_SLOTS } from '@/utils/dateUtils';

interface TimeSlotProps {
  time: string;
  appointments?: Appuntamento[];
  onClick: (appointment?: Appuntamento) => void;
  onDragStart?: (appointment: Appuntamento, time: string) => void;
  onDrop?: (time: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onResizeStart?: (appointment: Appuntamento) => void;
}

export default function TimeSlot({ 
  time, 
  appointments = [], 
  onClick, 
  onDragStart, 
  onDrop,
  onDragOver,
  onResizeStart
}: TimeSlotProps) {
  const handleDragStart = (e: React.DragEvent, appointment: Appuntamento) => {
    if (onDragStart) {
      e.stopPropagation();
      
      // Usa l'ora di inizio effettiva dell'appuntamento, non l'ora dello slot corrente
      const startTime = appointment.ora_inizio.substring(0, 5);
      onDragStart(appointment, startTime);
      
      // Crea un'immagine di drag personalizzata
      const dragImage = document.createElement('div');
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.width = '200px';
      dragImage.style.padding = '10px';
      dragImage.style.backgroundColor = '#E6F2FF';
      dragImage.style.border = '3px solid #005CA9';
      dragImage.style.borderRadius = '8px';
      dragImage.style.color = '#005CA9';
      dragImage.style.fontWeight = 'bold';
      dragImage.innerHTML = `
        <div style="font-size: 14px;">${appointment.cliente || 'Appuntamento'}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          ${appointment.ora_inizio?.substring(0, 5)} - ${appointment.ora_fine?.substring(0, 5)}
        </div>
      `;
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 100, 30);
      
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDrop) {
      onDrop(time);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragOver) {
      onDragOver(e);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, appointment: Appuntamento) => {
    e.stopPropagation();
    e.preventDefault();
    if (onResizeStart) {
      onResizeStart(appointment);
    }
  };

  // Funzione helper per verificare se questo slot è l'ultimo dell'appuntamento
  const isLastSlotForAppointment = (appointment: Appuntamento): boolean => {
    const currentSlotIndex = TIME_SLOTS.findIndex(slot => slot.label === time);
    const nextSlotTime = currentSlotIndex >= 0 && currentSlotIndex < TIME_SLOTS.length - 1
      ? TIME_SLOTS[currentSlotIndex + 1].label
      : null;
    
    const aptEnd = appointment.ora_fine.substring(0, 5);
    return nextSlotTime ? aptEnd <= nextSlotTime : true;
  };

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
        const isLastSlot = isLastSlotForAppointment(apt);
        
        return (
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, apt)}
            onClick={() => onClick(apt)}
            data-appointment-id={apt.id}
            className="appointment-cell absolute inset-0 bg-[#E6F2FF] border-l-4 border-[#005CA9] cursor-move transition-colors group"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {/* Continuazione */}
            
            {/* RESIZE HANDLE - Solo nell'ultima cella */}
            {isLastSlot && (
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, apt)}
                className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-[#005CA9]/20 hover:bg-[#005CA9]/40 flex items-center justify-center"
                style={{ zIndex: 10 }}
              >
                <div className="w-12 h-1 bg-[#005CA9] rounded-full"></div>
              </div>
            )}
          </div>
        );
      } else {
        // CONTINUAZIONI MULTIPLE
        return (
          <div 
            className="absolute inset-0 flex gap-1 bg-white p-1"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {continuesInThisSlot.map((apt) => {
              const isLastSlot = isLastSlotForAppointment(apt);
              
              return (
                <div
                  key={apt.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, apt)}
                  onClick={() => onClick(apt)}
                  data-appointment-id={apt.id}
                  className="appointment-cell flex-1 bg-[#E6F2FF] border-l-4 border-[#005CA9] cursor-move transition-colors relative group"
                >
                  {/* Continuazione */}
                  
                  {/* RESIZE HANDLE - Solo nell'ultima cella */}
                  {isLastSlot && (
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, apt)}
                      className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-[#005CA9]/20 hover:bg-[#005CA9]/40"
                      style={{ zIndex: 10 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      }
    }

    // Se ci sono appuntamenti che INIZIANO in questo slot
    if (startsInThisSlot.length === 1) {
      // UN SOLO APPUNTAMENTO
      const appointment = startsInThisSlot[0];
      const isLastSlot = isLastSlotForAppointment(appointment);

      return (
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, appointment)}
          onClick={() => onClick(appointment)}
          data-appointment-id={appointment.id}
          className="appointment-cell absolute inset-0 bg-[#E6F2FF] border-l-4 border-[#005CA9] p-2 cursor-move transition-colors hover:bg-[#D1E7FF] group"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="flex items-start gap-2 pointer-events-none">
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
          
          {/* RESIZE HANDLE - Solo se questo slot è l'ultimo */}
          {isLastSlot && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, appointment)}
              className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-[#005CA9]/20 hover:bg-[#005CA9]/40 flex items-center justify-center"
              style={{ zIndex: 10 }}
            >
              <div className="w-12 h-1 bg-[#005CA9] rounded-full"></div>
            </div>
          )}
        </div>
      );
    }

    // APPUNTAMENTI MULTIPLI
    return (
      <div 
        className="absolute inset-0 flex gap-1 bg-white p-1"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {startsInThisSlot.map((appointment) => {
          const isLastSlot = isLastSlotForAppointment(appointment);
          
          return (
            <div
              key={appointment.id}
              draggable
              onDragStart={(e) => handleDragStart(e, appointment)}
              onClick={(e) => {
                e.stopPropagation();
                onClick(appointment);
              }}
              data-appointment-id={appointment.id}
              className="appointment-cell flex-1 bg-[#E6F2FF] border-l-4 border-[#005CA9] p-1.5 cursor-move transition-all min-w-0 hover:bg-[#D1E7FF] relative group"
            >
              <div className="pointer-events-none">
                <p className="text-xs font-bold text-[#005CA9] truncate leading-tight">
                  {appointment.cliente || 'App.'}
                </p>
                <p className="text-[10px] text-gray-600 truncate leading-tight mt-0.5">
                  {appointment.ora_inizio?.substring(0, 5)} - {appointment.ora_fine?.substring(0, 5)}
                </p>
              </div>
              
              {/* RESIZE HANDLE - Solo se questo slot è l'ultimo */}
              {isLastSlot && (
                <div
                  onMouseDown={(e) => handleResizeMouseDown(e, appointment)}
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-[#005CA9]/20 hover:bg-[#005CA9]/40"
                  style={{ zIndex: 10 }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Cella vuota
  return (
    <div
      onClick={() => onClick()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
