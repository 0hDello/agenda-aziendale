'use client';

import React from 'react';
import { User, Lock, Unlock, MessageSquare, Plus } from 'lucide-react';
import { format, isWeekend } from 'date-fns';
import { it } from 'date-fns/locale';
import { Sede, Appointment, OPERATOR_COLOR, dateStrToLocal } from './types';
import { HIGHLIGHT_STYLE } from '../EpasaAppointmentModal';

interface EpasaDailyTableProps {
  scrollRef: (el: HTMLDivElement | null) => void;
  visibleDays: Date[];
  operatorsInSede: string[];
  currentTimeSlots: string[];
  getTimeSlotsForDay?: (day: Date) => string[];
  selectedSede: Sede;
  editMode: boolean;
  getAppointmentsForSlot: (date: string, time: string, operator: string) => Appointment[];
  isSedeOperatorDayClosed: (sedeId: string, operator: string, day: Date) => boolean;
  isGiornoChiuso: (dateStr: string, operator: string) => boolean;
  isMileceTimeBlocked: (operator: string, day: Date, time: string) => boolean;
  isLoredanaAfternoonBlocked?: (operator: string, day: Date, time: string, sedeId?: string) => boolean;
  isUffChiusoSlot: (dateStr: string, time: string, operator: string) => boolean;
  getUffChiusoApts: (dateStr: string, time: string, operator: string) => Appointment[];
  onEditModeSlotClick: (dateStr: string, time: string, operator: string) => void;
  onOpenEditAppointment: (apt: Appointment) => void;
  onOpenNewAppointment: (date: string, time: string, operator: string) => void;
}

export default function EpasaDailyTable({
  scrollRef,
  visibleDays,
  operatorsInSede,
  currentTimeSlots,
  getTimeSlotsForDay,
  selectedSede,
  editMode,
  getAppointmentsForSlot,
  isSedeOperatorDayClosed,
  isGiornoChiuso,
  isMileceTimeBlocked,
  isLoredanaAfternoonBlocked,
  isUffChiusoSlot,
  getUffChiusoApts,
  onEditModeSlotClick,
  onOpenEditAppointment,
  onOpenNewAppointment,
}: EpasaDailyTableProps) {
  const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

  return (
    <div>
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 65px)', overflowAnchor: 'none' }}
      >
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2 border-[#005CA9]/20">
              <th
                className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-300"
                style={{ width: '60px' }}
              >
                <span className="text-[#005CA9]">Orario</span>
              </th>
              {operatorsInSede.length > 0 ? (
                operatorsInSede.map(operator => (
                  <th
                    key={operator}
                    className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] border-r border-gray-300"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: OPERATOR_COLOR }}
                      >
                        <User size={14} className="text-white" />
                      </div>
                      <span style={{ color: OPERATOR_COLOR }} className="font-bold">
                        {operator}
                      </span>
                    </div>
                  </th>
                ))
              ) : (
                <th className="p-2 text-center text-xs text-gray-500">
                  Nessun operatore per questa sede
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(day => {
              const dateStr = formatDate(day);
              const isToday = formatDate(new Date()) === dateStr;
              const isWe    = isWeekend(day);

              return (
                <React.Fragment key={dateStr}>
                  <tr data-epasa-date={dateStr}>
                    <td
                      colSpan={Math.max(operatorsInSede.length + 1, 2)}
                      className={`p-0 sticky left-0 z-10 ${
                        isToday ? 'bg-[#005CA9]' : isWe ? 'bg-gray-200' : 'bg-[#EEF4FB]'
                      }`}
                    >
                      <div className={`flex items-center justify-between px-4 py-2 border-b-2 ${
                        isToday ? 'border-white/20' : isWe ? 'border-gray-300' : 'border-[#005CA9]/15'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm ${
                            isToday ? 'bg-white/20 text-white' : isWe ? 'bg-gray-300 text-gray-500' : 'bg-[#005CA9] text-white'
                          }`}>
                            {format(day, 'd')}
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 ${
                              isToday ? 'text-blue-200' : isWe ? 'text-gray-400' : 'text-[#005CA9]/50'
                            }`}>
                              {format(day, 'EEEE', { locale: it })}
                            </p>
                            <p className={`text-sm font-bold leading-tight ${
                              isToday ? 'text-white' : isWe ? 'text-gray-500' : 'text-[#005CA9]'
                            }`}>
                              {format(day, 'dd MMMM yyyy', { locale: it })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                              Oggi
                            </span>
                          )}
                          {isWe && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-300/60 text-gray-500 text-[10px] font-bold rounded-full uppercase tracking-wide">
                              <Lock size={8} /> Chiuso
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {isWe && (
                    <tr>
                      <td
                        colSpan={Math.max(operatorsInSede.length + 1, 2)}
                        className="p-5 text-center border-b-2 border-gray-300"
                        style={{
                          height: '64px',
                          background: 'repeating-linear-gradient(45deg,#f9fafb,#f9fafb 8px,#f1f5f9 8px,#f1f5f9 16px)',
                        }}
                      >
                        <div className="flex items-center justify-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <Lock size={13} className="text-gray-400" />
                          </div>
                          <span className="text-sm font-semibold text-gray-400">Sede chiusa</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!isWe &&
                    (() => {
                      const daySlots = getTimeSlotsForDay ? getTimeSlotsForDay(day) : currentTimeSlots;
                      return daySlots.map(time => {
                        return (
                          <tr key={`${dateStr}-${time}`}>
                            <td
                              className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-300 border-b border-gray-300"
                              style={{ width: '60px', height: '45px' }}
                            >
                              <div className="px-1 py-2 text-xs font-semibold text-gray-700">{time}</div>
                            </td>
                            {operatorsInSede.length > 0 ? (
                              operatorsInSede.map(operator => {
                                const slotApts    = getAppointmentsForSlot(dateStr, time, operator);
                                const dayLocal    = dateStrToLocal(dateStr);
                                const isDayClosed = isSedeOperatorDayClosed(selectedSede.id, operator, dayLocal);
                                const isManually  = isGiornoChiuso(dateStr, operator);
                                const isMTC       = isMileceTimeBlocked(operator, dayLocal, time);
                                const isLorBlocked = isLoredanaAfternoonBlocked
                                  ? isLoredanaAfternoonBlocked(operator, dayLocal, time, selectedSede.id)
                                  : false;
                                const isUffC      = isUffChiusoSlot(dateStr, time, operator);

                                if (isDayClosed || isManually) {
                                  const title = isDayClosed
                                    ? selectedSede.id === 'cspt'
                                      ? 'CSPT: aperto solo il lunedì pomeriggio'
                                      : selectedSede.id === 'borgo'
                                      ? 'Borgo: martedì della 2ª e 3ª settimana'
                                      : operator === 'MILECE'
                                      ? 'MILECE non lavora questo giorno'
                                      : 'Ufficio chiuso'
                                    : 'Ufficio chiuso';
                                  return (
                                    <td
                                      key={`${operator}-${time}`}
                                      className="relative p-0 border-r border-slate-500 border-b border-slate-500 bg-slate-600 select-none"
                                      style={{ height: '45px' }}
                                      title={title}
                                    >
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[10px] text-slate-200 font-medium flex items-center gap-1">
                                          <Lock size={9} /> chiuso
                                        </span>
                                      </div>
                                    </td>
                                  );
                                }

                                if (isMTC) {
                                  return (
                                    <td
                                      key={`${operator}-${time}`}
                                      className="relative p-0 border-r border-slate-500 border-b border-slate-500 bg-slate-600 select-none"
                                      style={{ height: '45px' }}
                                      title="MILECE inizia alle 08:30"
                                    >
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[10px] text-slate-200 font-medium flex items-center gap-1">
                                          <Lock size={9} /> chiuso
                                        </span>
                                      </div>
                                    </td>
                                  );
                                }

                                if (isLorBlocked) {
                                  return (
                                    <td
                                      key={`${operator}-${time}`}
                                      className="p-0 border-r border-gray-300 border-b border-gray-300 bg-white select-none"
                                      style={{ height: '45px' }}
                                    />
                                  );
                                }

                            if (isUffC) {
                              const uffApt = getUffChiusoApts(dateStr, time, operator)[0];
                              const motivoChiusura = uffApt?.note?.trim() || '';
                              return (
                                <td
                                  key={`${operator}-${time}`}
                                  className={`relative p-0 border-r border-slate-500 border-b border-slate-500 bg-slate-600 ${
                                    editMode ? 'cursor-pointer hover:bg-slate-700' : 'select-none'
                                  }`}
                                  style={{ height: '45px' }}
                                  title={
                                    editMode
                                      ? 'Clicca per sbloccare'
                                      : motivoChiusura
                                      ? `Ufficio chiuso – ${motivoChiusura}`
                                      : 'Ufficio chiuso'
                                  }
                                  onClick={() => editMode && onEditModeSlotClick(dateStr, time, operator)}
                                >
                                  <div className="w-full h-full flex items-center px-2 gap-1.5">
                                    <Lock size={9} className="text-slate-300 flex-shrink-0" />
                                    <span className="text-[10px] text-slate-200 font-semibold italic truncate flex-1">
                                      {motivoChiusura ? motivoChiusura : 'uff. chiuso'}
                                    </span>
                                    {editMode && <Unlock size={9} className="text-amber-300 flex-shrink-0" />}
                                  </div>
                                </td>
                              );
                            }

                            if (slotApts.length > 0) {
                              const apt   = slotApts[0];
                              const hlKey = apt.highlight || '';
                              const hl    = HIGHLIGHT_STYLE[hlKey] ?? HIGHLIGHT_STYLE[''];
                              return (
                                <td
                                  key={`${operator}-${time}`}
                                  className="relative p-0 border-r border-gray-300 border-b border-gray-300 group/slot"
                                  style={{ height: '45px' }}
                                >
                                  <div
                                    onClick={() => !editMode && onOpenEditAppointment(apt)}
                                    className={`w-full h-full px-2 py-1 ${hl.cell} border-l-4 ${hl.border} flex items-center ${
                                      editMode ? 'cursor-not-allowed' : 'hover:brightness-95 cursor-pointer'
                                    }`}
                                    title={editMode ? 'Slot occupato: non bloccabile' : undefined}
                                  >
                                    <div className="w-full overflow-hidden">
                                      <div className="flex items-center gap-1 w-full">
                                        <User size={10} className={`${hl.text} flex-shrink-0`} />
                                        <span className={`text-[10px] font-bold truncate ${hl.text} flex-1 min-w-0`}>
                                          {apt.cliente}
                                        </span>
                                        {apt.note && !editMode && (
                                          <MessageSquare size={9} className={`${hl.text} flex-shrink-0 opacity-60`} />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {!editMode && apt.note && (
                                    <div
                                      className="absolute bottom-full left-0 mb-1 z-[60] pointer-events-none opacity-0 group-hover/slot:opacity-100"
                                      style={{ minWidth: '160px', maxWidth: '240px' }}
                                    >
                                      <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded-lg shadow-lg px-3 py-2 leading-relaxed">
                                        <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-blue-200">
                                          <MessageSquare size={10} className="text-blue-500 flex-shrink-0" />
                                          <span className="font-bold text-blue-600 text-[10px] uppercase tracking-wide">Nota</span>
                                        </div>
                                        <p className="whitespace-pre-wrap break-words text-blue-700">{apt.note}</p>
                                      </div>
                                      <div
                                        className="w-0 h-0 ml-4"
                                        style={{
                                          borderLeft: '5px solid transparent',
                                          borderRight: '5px solid transparent',
                                          borderTop: '5px solid #bfdbfe',
                                        }}
                                      />
                                    </div>
                                  )}
                                </td>
                              );
                            }

                            return (
                              <td
                                key={`${operator}-${time}`}
                                className="relative p-0 border-r border-gray-300 border-b border-gray-300 group"
                                style={{ height: '45px' }}
                              >
                                <div
                                  onClick={() =>
                                    editMode
                                      ? onEditModeSlotClick(dateStr, time, operator)
                                      : onOpenNewAppointment(dateStr, time, operator)
                                  }
                                  className={`w-full h-full cursor-pointer flex items-center justify-center ${
                                    editMode ? 'hover:bg-gray-100 group-hover:bg-gray-100' : 'hover:bg-blue-50 group-hover:bg-blue-50'
                                  }`}
                                  title={editMode ? 'Clicca per bloccare questo slot' : undefined}
                                >
                                  {editMode ? (
                                    <Lock size={12} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                                  ) : (
                                    <Plus size={14} className="text-gray-400 opacity-0 group-hover:opacity-100" />
                                  )}
                                </div>
                              </td>
                            );
                          })
                        ) : (
                          <td className="p-2 text-center text-xs text-gray-400">-</td>
                        )}
                      </tr>
                    );
                  });
                })()}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
