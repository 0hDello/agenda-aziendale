'use client';

import { MessageSquare, User } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Appuntamento } from '@/lib/types';
import { TIME_SLOTS } from '@/utils/dateUtils';

const HIGHLIGHT_MAP: Record<string, { bg: string; border: string; text: string }> = {
  '':      { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  yellow:  { bg: '#fef9c3', border: '#eab308', text: '#713f12' },
  orange:  { bg: '#ffedd5', border: '#f97316', text: '#7c2d12' },
  red:     { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d' },
  green:   { bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
  blue:    { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a' },
  purple:  { bg: '#f3e8ff', border: '#a855f7', text: '#581c87' },
  pink:    { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
};

interface TimeSlotProps {
  time: string;
  appointments?: Appuntamento[];
  allDayAppointments?: Appuntamento[];
  onClick: (appointment?: Appuntamento) => void;
  onDragStart?: (appointment: Appuntamento, time: string) => void;
  onDrop?: (time: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  /** Slot del giorno corrente (per calcolo altezza corretto) */
  daySlots?: { label: string }[];
}

function AppointmentCell({
  apt,
  style,
  className,
  onDragStart,
  onDrop,
  onDragOver,
  onClick,
}: {
  apt: Appuntamento;
  style: React.CSSProperties;
  className: string;
  onDragStart: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const hl = HIGHLIGHT_MAP[apt.highlight ?? ''] ?? HIGHLIGHT_MAP[''];
  const cellRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
  const [above, setAbove] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (!apt.note || !cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const isAbove = spaceBelow < 150;
    setAbove(isAbove);
    setTooltipStyle({
      position: 'fixed',
      left: rect.left,
      top: isAbove ? rect.top - 8 : rect.bottom + 6,
      minWidth: '160px',
      maxWidth: '260px',
      zIndex: 99999,
      transform: isAbove ? 'translateY(-100%)' : 'none',
    });
  }, [apt.note]);

  const handleMouseLeave = useCallback(() => setTooltipStyle(null), []);

  return (
    <div
      ref={cellRef}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-appointment-id={apt.id}
      style={{
        ...style,
        backgroundColor: hl.bg,
        borderLeftColor: hl.border,
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
      }}
      className={`appointment-cell px-2 cursor-move transition-colors flex items-center ${className}`}
    >
      <div className="w-full overflow-hidden">
        <div className="flex items-center gap-1 w-full">
          <User size={10} className="flex-shrink-0" style={{ color: hl.text }} />
          <span
            className="text-[10px] font-semibold truncate flex-1 min-w-0 pointer-events-none"
            style={{ color: hl.text }}
          >
            {apt.cliente || 'Appuntamento'}
          </span>
          {apt.note && (
            <MessageSquare size={9} className="flex-shrink-0 opacity-60" style={{ color: hl.text }} />
          )}
        </div>
      </div>

      {/* Tooltip nota via portal */}
      {apt.note && tooltipStyle && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div style={tooltipStyle} className="pointer-events-none">
          {!above && (
            <div className="w-0 h-0 ml-3" style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '5px solid #93c5fd',
            }} />
          )}
          <div className="bg-blue-50 border border-blue-300 text-blue-800 text-[11px] rounded-lg shadow-xl px-3 py-2 leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-blue-200">
              <MessageSquare size={10} className="text-blue-500 flex-shrink-0" />
              <span className="font-bold text-blue-600 text-[10px] uppercase tracking-wide">Nota</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-blue-700">{apt.note}</p>
          </div>
          {above && (
            <div className="w-0 h-0 ml-3" style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #93c5fd',
            }} />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function TimeSlot({
  time,
  appointments = [],
  allDayAppointments = [],
  onClick,
  onDragStart,
  onDrop,
  onDragOver,
  daySlots,
}: TimeSlotProps) {

  // Usa gli slot del giorno se forniti, altrimenti fallback al globale
  const slots = daySlots && daySlots.length > 0 ? daySlots : TIME_SLOTS;

  const handleDragStartInner = (e: React.DragEvent, appointment: Appuntamento) => {
    if (onDragStart) {
      e.stopPropagation();
      onDragStart(appointment, appointment.ora_inizio.substring(0, 5));
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
    const si = slots.findIndex(s => s.label === apt.ora_inizio.substring(0, 5));
    let   ei = slots.findIndex(s => s.label === apt.ora_fine.substring(0, 5));
    if (ei === -1) ei = slots.length;
    const diff = ei - si;
    if (diff <= 0) return 45; // fallback minimo
    return diff * 45;
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
    slots.forEach(slot => {
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
      return (
        <AppointmentCell
          apt={apt}
          style={{ height: `${h}px`, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 }}
          className=""
          onDragStart={e => handleDragStartInner(e, apt)}
          onClick={() => onClick(apt)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      );
    }

    const colW = 100 / maxCols;
    const gap  = 4;
    return (
      <div className="relative h-full">
        {startsHere.map(apt => {
          const ci = colMap.get(apt.id) ?? 0;
          const h  = calculateHeight(apt);
          return (
            <AppointmentCell
              key={apt.id}
              apt={apt}
              style={{
                position: 'absolute',
                left:   `calc(${ci * colW}% + ${ci > 0 ? gap : 0}px)`,
                width:  `calc(${colW}% - ${ci > 0 ? gap : 0}px)`,
                top: 0,
                height: `${h}px`,
                zIndex: 5,
              }}
              className=""
              onDragStart={e => handleDragStartInner(e, apt)}
              onClick={e => { e.stopPropagation(); onClick(apt); }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
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
