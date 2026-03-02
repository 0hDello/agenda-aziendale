'use client';

import { Appuntamento } from '@/lib/types';
import { TIME_SLOTS } from '@/utils/dateUtils';
import { HIGHLIGHT_STYLE } from './AppointmentModal';

interface TimeSlotProps {
  time: string;
  appointments?: Appuntamento[];
  allDayAppointments?: Appuntamento[];
  onClick: (appointment?: Appuntamento) => void;
  onDragStart?: (appointment: Appuntamento, time: string) => void;
  onDrop?: (time: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export default function TimeSlot({ 
  time, 
  appointments = [], 
  allDayAppointments = [],
  onClick, 
  onDragStart, 
  onDrop,
  onDragOver,
}: TimeSlotProps) {

  const getHighlight = (apt: Appuntamento) =>
    HIGHLIGHT_STYLE[apt.highlight ?? ''] ?? HIGHLIGHT_STYLE[''];

  const handleDragStart = (e: React.DragEvent, appointment: Appuntamento) => {
    if (onDragStart) {
      e.stopPropagation();
      const startTime = appointment.ora_inizio.substring(0, 5);
      onDragStart(appointment, startTime);
      const dragImage = document.createElement('div');
      dragImage.style.cssText = 'position:absolute;top:-1000px;width:200px;padding:10px;background:#E6F2FF;border:3px solid #005CA9;border-radius:8px;color:#005CA9;font-weight:bold;';
      dragImage.innerHTML = `
        <div style="font-size:14px">${appointment.cliente || 'Appuntamento'}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${appointment.ora_inizio?.substring(0,5)} - ${appointment.ora_fine?.substring(0,5)}</div>
      `;
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 100, 30);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleDrop     = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); onDrop?.(time); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); onDragOver?.(e); };

  const calculateHeight = (apt: Appuntamento): number => {
    const si = TIME_SLOTS.findIndex(s => s.label === apt.ora_inizio.substring(0, 5));
    let   ei = TIME_SLOTS.findIndex(s => s.label === apt.ora_fine.substring(0, 5));
    if (ei === -1) ei = TIME_SLOTS.length;
    return (ei - si) * 45;
  };

  const assignColumns = (all: Appuntamento[]): Map<string, number> => {
    const map = new Map<string, number>();
    const sorted = [...all].sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio) || a.id.localeCompare(b.id));
    const cols: { end: string }[] = [];
    for (const apt of sorted) {
      const start = apt.ora_inizio.substring(0, 5);
      const end   = apt.ora_fine.substring(0, 5);
      let ci = 0;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i].end <= start) { ci = i; cols[i] = { end }; break; }
        ci = i + 1;
      }
      if (ci === cols.length) cols.push({ end });
      map.set(apt.id, ci);
    }
    return map;
  };

  const getMaxColumns = (all: Appuntamento[]): number => {
    if (!all.length) return 1;
    let max = 1;
    TIME_SLOTS.forEach(slot => {
      const ov = all.filter(a => slot.label >= a.ora_inizio.substring(0,5) && slot.label < a.ora_fine.substring(0,5));
      max = Math.max(max, ov.length);
    });
    return max;
  };

  if (appointments.length > 0) {
    const startsHere = appointments.filter(a => a.ora_inizio.substring(0,5) === time);
    if (!startsHere.length) return <div className="h-full" onDrop={handleDrop} onDragOver={handleDragOver} />;

    const colMap  = assignColumns(allDayAppointments);
    const maxCols = getMaxColumns(allDayAppointments);

    if (startsHere.length === 1 && maxCols === 1) {
      const apt = startsHere[0];
      const h   = calculateHeight(apt);
      const hl  = getHighlight(apt);
      return (
        <div
          draggable
          onDragStart={e => handleDragStart(e, apt)}
          onClick={() => onClick(apt)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          data-appointment-id={apt.id}
          style={{ height: `${h}px`, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 }}
          className={`appointment-cell border-l-4 p-2 cursor-move transition-colors group mb-1 ${hl.cell} ${hl.border}`}
        >
          <div className="flex items-start gap-2 pointer-events-none">
            <div className={`rounded-full w-3 h-3 flex-shrink-0 mt-0.5 ${hl.border.replace('border-','bg-')}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${hl.text}`}>
                {apt.cliente || 'Appuntamento'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {apt.ora_inizio?.substring(0,5)} - {apt.ora_fine?.substring(0,5)}
              </p>
              {apt.note && <p className="text-xs text-gray-500 truncate mt-1">{apt.note}</p>}
            </div>
          </div>
        </div>
      );
    }

    const colW = 100 / maxCols;
    const gap  = 4;
    return (
      <div className="relative h-full">
        {startsHere.map(apt => {
          const ci = colMap.get(apt.id) ?? 0;
          const h  = calculateHeight(apt);
          const hl = getHighlight(apt);
          return (
            <div
              key={apt.id}
              draggable
              onDragStart={e => handleDragStart(e, apt)}
              onClick={e => { e.stopPropagation(); onClick(apt); }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              data-appointment-id={apt.id}
              style={{
                position: 'absolute',
                left:   `calc(${ci * colW}% + ${ci > 0 ? gap : 0}px)`,
                width:  `calc(${colW}% - ${ci > 0 ? gap : 0}px)`,
                top: 0,
                height: `${h}px`,
                zIndex: 5,
              }}
              className={`appointment-cell border-l-4 p-1.5 cursor-move transition-all group mb-1 ${hl.cell} ${hl.border}`}
            >
              <div className="flex items-start gap-1 pointer-events-none">
                <div className={`rounded-full w-2 h-2 flex-shrink-0 mt-0.5 ${hl.border.replace('border-','bg-')}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate leading-tight ${hl.text}`}>
                    {apt.cliente || 'App.'}
                  </p>
                  <p className="text-[10px] text-gray-600 truncate leading-tight mt-0.5">
                    {apt.ora_inizio?.substring(0,5)} - {apt.ora_fine?.substring(0,5)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="h-full min-h-[45px] hover:bg-gray-50 cursor-pointer transition-colors flex items-center justify-center group"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </div>
  );
}
