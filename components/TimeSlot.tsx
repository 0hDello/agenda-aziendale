'use client';

import { Appuntamento } from '@/lib/types';
import { User } from 'lucide-react';
import { TIME_SLOTS } from '@/utils/dateUtils';

interface TimeSlotProps {
  time: string;
  appointments?: Appuntamento[];
  allDayAppointments?: Appuntamento[];
  onClick: (appointment?: Appuntamento) => void;
  onDragStart?: (appointment: Appuntamento, time: string) => void;
  onDrop?: (time: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onResizeStart?: (appointment: Appuntamento) => void;
}

export default function TimeSlot({ 
  time, 
  appointments = [], 
  allDayAppointments = [],
  onClick, 
  onDragStart, 
  onDrop,
  onDragOver,
  onResizeStart
}: TimeSlotProps) {
  const handleDragStart = (e: React.DragEvent, appointment: Appuntamento) => {
    if (onDragStart) {
      e.stopPropagation();
      
      const startTime = appointment.ora_inizio.substring(0, 5);
      onDragStart(appointment, startTime);
      
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

  // Calcola l'altezza in pixel dell'appuntamento
  const calculateAppointmentHeight = (appointment: Appuntamento): number => {
    const startTime = appointment.ora_inizio.substring(0, 5);
    const endTime = appointment.ora_fine.substring(0, 5);
    
    const startIndex = TIME_SLOTS.findIndex(slot => slot.label === startTime);
    let endIndex = TIME_SLOTS.findIndex(slot => slot.label === endTime);
    
    // Gestisce il caso delle 18:00
    if (endIndex === -1 && endTime === '18:00') {
      endIndex = TIME_SLOTS.length;
    }
    
    const slotCount = endIndex - startIndex;
    const slotHeight = 60;

    // Non sottrarre nulla - occupa tutto lo spazio
    return slotCount * slotHeight;
  };

  // Assegna colonne agli appuntamenti
  const assignColumns = (allAppointments: Appuntamento[]): Map<string, number> => {
    const columnMap = new Map<string, number>();
    
    const sorted = [...allAppointments].sort((a, b) => 
      a.ora_inizio.localeCompare(b.ora_inizio) || a.id.localeCompare(b.id)
    );
    
    const columns: { end: string; appointmentId: string }[] = [];
    
    for (const apt of sorted) {
      const start = apt.ora_inizio.substring(0, 5);
      const end = apt.ora_fine.substring(0, 5);
      
      let columnIndex = 0;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i].end <= start) {
          columnIndex = i;
          columns[i] = { end, appointmentId: apt.id };
          break;
        }
        columnIndex = i + 1;
      }
      
      if (columnIndex === columns.length) {
        columns.push({ end, appointmentId: apt.id });
      }
      
      columnMap.set(apt.id, columnIndex);
    }
    
    return columnMap;
  };

  const getMaxColumns = (allAppointments: Appuntamento[]): number => {
    if (allAppointments.length === 0) return 1;
    
    let maxColumns = 1;
    
    TIME_SLOTS.forEach(slot => {
      const overlapping = allAppointments.filter(apt => {
        const aptStart = apt.ora_inizio.substring(0, 5);
        const aptEnd = apt.ora_fine.substring(0, 5);
        return slot.label >= aptStart && slot.label < aptEnd;
      });
      
      maxColumns = Math.max(maxColumns, overlapping.length);
    });
    
    return maxColumns;
  };

  if (appointments.length > 0) {
    // IMPORTANTE: renderizza solo gli appuntamenti che INIZIANO in questo slot
    const startsInThisSlot = appointments.filter(
      (apt) => apt.ora_inizio.substring(0, 5) === time
    );

    // Se non ci sono appuntamenti che iniziano qui, mostra solo la continuazione (senza contenuto)
    if (startsInThisSlot.length === 0) {
      return (
        <div
          className="h-full"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      );
    }

    const columnAssignments = assignColumns(allDayAppointments);
    const maxColumns = getMaxColumns(allDayAppointments);

    // Caso semplice: un solo appuntamento
    if (startsInThisSlot.length === 1 && maxColumns === 1) {
      const appointment = startsInThisSlot[0];
      const height = calculateAppointmentHeight(appointment);

      return (
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, appointment)}
          onClick={() => onClick(appointment)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          data-appointment-id={appointment.id}
          style={{
            height: `${height}px`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 5,
          }}
          className="appointment-cell bg-[#E6F2FF] border-l-4 border-[#005CA9] p-2 cursor-move transition-colors hover:bg-[#D1E7FF] group"
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
          
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, appointment)}
            className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-[#005CA9]/20 hover:bg-[#005CA9]/40 flex items-center justify-center"
            style={{ zIndex: 10 }}
          >
            <div className="w-12 h-1 bg-[#005CA9] rounded-full"></div>
          </div>
        </div>
      );
    }

    // APPUNTAMENTI MULTIPLI
    const columnWidth = 100 / maxColumns;
    const gap = 4;

    return (
      <div className="relative h-full">
        {startsInThisSlot.map((appointment) => {
          const columnIndex = columnAssignments.get(appointment.id) ?? 0;
          const height = calculateAppointmentHeight(appointment);
          
          const leftPosition = columnIndex * columnWidth;
          const actualWidth = columnWidth - (gap / maxColumns);
          
          return (
            <div
              key={appointment.id}
              draggable
              onDragStart={(e) => handleDragStart(e, appointment)}
              onClick={(e) => {
                e.stopPropagation();
                onClick(appointment);
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              data-appointment-id={appointment.id}
              style={{
                position: 'absolute',
                left: `calc(${leftPosition}% + ${columnIndex > 0 ? gap : 0}px)`,
                width: `calc(${actualWidth}% - ${columnIndex > 0 ? gap : 0}px)`,
                top: 0,
                height: `${height}px`,
                zIndex: 5,
              }}
              className="appointment-cell bg-[#E6F2FF] border-l-4 border-[#005CA9] p-1.5 cursor-move transition-all hover:bg-[#D1E7FF] group"
            >
              <div className="pointer-events-none">
                <p className="text-xs font-bold text-[#005CA9] truncate leading-tight">
                  {appointment.cliente || 'App.'}
                </p>
                <p className="text-[10px] text-gray-600 truncate leading-tight mt-0.5">
                  {appointment.ora_inizio?.substring(0, 5)} - {appointment.ora_fine?.substring(0, 5)}
                </p>
              </div>
              
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, appointment)}
                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-[#005CA9]/20 hover:bg-[#005CA9]/40"
                style={{ zIndex: 10 }}
              />
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
