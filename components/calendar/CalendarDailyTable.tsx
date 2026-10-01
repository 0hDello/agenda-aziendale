'use client';

import React from 'react';
import { User, Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Appuntamento, Persona } from '@/lib/types';
import { formatDate } from '@/utils/dateUtils';
import TimeSlot from '../TimeSlot';

interface CalendarDailyTableProps {
  scrollRef: (el: HTMLDivElement | null) => void;
  visibleDays: Date[];
  sedePersone: Persona[];
  getTimeSlotsForDay: (day: Date) => { hour: number; minute: number; label: string }[];
  isDayFullyClosedForAllPersone: (day: Date, personeInSede: Persona[]) => boolean;
  isPersonaDisabledForDay: (day: Date, persona: Persona) => boolean;
  isUffChiusoSlot: (dateStr: string, slotLabel: string, personaId: string) => boolean;
  getUffChiusoApts: (dateStr: string, slotLabel: string, personaId: string) => Appuntamento[];
  getAppointmentsForSlot: (dateStr: string, slotLabel: string, personaId: string) => Appuntamento[];
  appointmentsByDayPerson: Map<string, Appuntamento[]>;
  isBorgoSede: boolean;
  deferredEditMode: boolean;
  onEditModeSlotClick: (dateStr: string, slotLabel: string, personaId: string, day: Date) => void;
  onSlotClick: (date: string, time: string, personaId: string, existingAppointment?: Appuntamento) => void;
  onDragStart: (appointment: Appuntamento, time: string) => void;
  onDrop: (date: string, newTime: string, personaId: string, day: Date) => void;
  onDragOver: (e: React.DragEvent) => void;
}

export default function CalendarDailyTable({
  scrollRef,
  visibleDays,
  sedePersone,
  getTimeSlotsForDay,
  isDayFullyClosedForAllPersone,
  isPersonaDisabledForDay,
  isUffChiusoSlot,
  getUffChiusoApts,
  getAppointmentsForSlot,
  appointmentsByDayPerson,
  isBorgoSede,
  deferredEditMode,
  onEditModeSlotClick,
  onSlotClick,
  onDragStart,
  onDrop,
  onDragOver,
}: CalendarDailyTableProps) {
  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ overflowAnchor: 'none' }}>
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="sticky top-0 z-20">
            <tr className="border-b-2 border-[#005CA9]/20">
              <th className="p-2 text-left text-xs font-semibold bg-[#F5F8FA] sticky left-0 z-10 w-[60px] border-r border-gray-200">
                <span className="text-[#005CA9]">Orario</span>
              </th>
              {sedePersone.map(persona => (
                <th key={persona.id} className="p-2 text-center text-xs font-semibold bg-[#F5F8FA] min-w-[150px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-6 h-6 bg-[#005CA9] rounded-full flex items-center justify-center">
                      <User size={14} className="text-white" />
                    </div>
                    <span className="text-[#005CA9]">{persona.nome}</span>
                  </div>
                </th>
              ))}
              <th className="p-2 text-right text-xs font-semibold bg-[#F5F8FA] sticky right-0 z-10 w-[60px] border-l border-gray-200">
                <span className="text-[#005CA9]">Orario</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleDays.map(day => {
              const dateStr      = formatDate(day);
              const isToday      = formatDate(new Date()) === dateStr;
              const isClosed     = isDayFullyClosedForAllPersone(day, sedePersone);
              const dayTimeSlots = getTimeSlotsForDay(day);

              return (
                <React.Fragment key={dateStr}>
                  <tr data-date={dateStr}>
                    <td
                      colSpan={sedePersone.length + 2}
                      className={`p-0 sticky left-0 z-10 ${
                        isToday ? 'bg-[#005CA9]' : isClosed ? 'bg-gray-200' : 'bg-[#EEF4FB]'
                      }`}
                    >
                      <div className={`flex items-center justify-between px-4 py-2 border-b-2 ${
                        isToday ? 'border-white/20' : isClosed ? 'border-gray-300' : 'border-[#005CA9]/15'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm ${
                            isToday ? 'bg-white/20 text-white' : isClosed ? 'bg-gray-300 text-gray-500' : 'bg-[#005CA9] text-white'
                          }`}>
                            {format(day, 'd')}
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 ${
                              isToday ? 'text-blue-200' : isClosed ? 'text-gray-400' : 'text-[#005CA9]/50'
                            }`}>
                              {format(day, 'EEEE', { locale: it })}
                            </p>
                            <p className={`text-sm font-bold leading-tight ${
                              isToday ? 'text-white' : isClosed ? 'text-gray-500' : 'text-[#005CA9]'
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
                          {isClosed && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-300/60 text-gray-500 text-[10px] font-bold rounded-full uppercase tracking-wide">
                              <Lock size={8} /> Chiuso
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {isClosed ? (
                    <tr>
                      <td
                        colSpan={sedePersone.length + 2}
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
                          <span className="text-sm font-semibold text-gray-400">
                            {isBorgoSede ? 'Borgo è aperto solo il mercoledì' : 'Sede chiusa'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dayTimeSlots.map(slot => (
                      <tr key={`${dateStr}-${slot.label}`}>
                        <td className="p-0 bg-[#F5F8FA] sticky left-0 z-10 border-r border-gray-200 border-b border-gray-300 w-[60px]">
                          <div className="px-1 py-2 text-xs font-semibold text-gray-700">{slot.label}</div>
                        </td>
                        {sedePersone.map(persona => {
                          if (isPersonaDisabledForDay(day, persona)) {
                            return (
                              <td
                                key={`${persona.id}-${slot.label}`}
                                className="relative p-0 border-r border-gray-300 border-b border-gray-300 bg-gray-400 select-none"
                                style={{ height: '45px' }}
                              />
                            );
                          }

                          const slotApts = getAppointmentsForSlot(dateStr, slot.label, persona.id);
                          const dayApts  = appointmentsByDayPerson.get(`${dateStr}|${persona.id}`) ?? [];
                          const isUffC   = isUffChiusoSlot(dateStr, slot.label, persona.id);

                          if (isUffC) {
                            const uffNote = getUffChiusoApts(dateStr, slot.label, persona.id)[0]?.note?.trim() || '';
                            return (
                              <td
                                key={`${persona.id}-${slot.label}`}
                                className={`relative p-0 border-r border-slate-500 border-b border-slate-500 bg-slate-600 ${
                                  deferredEditMode ? 'cursor-pointer hover:bg-slate-700' : 'select-none'
                                }`}
                                style={{ height: '45px' }}
                                title={deferredEditMode ? 'Clicca per sbloccare' : (uffNote ? `Ufficio chiuso – ${uffNote}` : 'Ufficio chiuso')}
                                onClick={() => deferredEditMode && onEditModeSlotClick(dateStr, slot.label, persona.id, day)}
                              >
                                <div className="w-full h-full flex items-center px-2 gap-1.5">
                                  <Lock size={9} className="text-slate-300 flex-shrink-0" />
                                  <span className="text-[10px] text-slate-200 font-semibold italic truncate flex-1">
                                    {uffNote || 'uff. chiuso'}
                                  </span>
                                  {deferredEditMode && <Unlock size={9} className="text-amber-300 flex-shrink-0" />}
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={`${persona.id}-${slot.label}`}
                              className={`relative p-0 border-r border-gray-300 ${!slotApts.length ? 'border-b border-gray-300' : ''}`}
                              style={{ height: '45px' }}
                            >
                              {deferredEditMode && slotApts.length === 0 ? (
                                <div
                                  onClick={() => onEditModeSlotClick(dateStr, slot.label, persona.id, day)}
                                  className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-amber-50 group"
                                  title="Clicca per bloccare questo slot"
                                >
                                  <Lock size={12} className="text-gray-300 opacity-30 group-hover:opacity-100 group-hover:text-amber-500" />
                                </div>
                              ) : (
                                <TimeSlot
                                  time={slot.label}
                                  appointments={slotApts}
                                  allDayAppointments={dayApts}
                                  daySlots={dayTimeSlots}
                                  onClick={apt => !deferredEditMode && onSlotClick(dateStr, slot.label, persona.id, apt)}
                                  onDragStart={onDragStart}
                                  onDrop={t => onDrop(dateStr, t, persona.id, day)}
                                  onDragOver={onDragOver}
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="p-0 bg-[#F5F8FA] sticky right-0 z-10 border-l border-gray-200 border-b border-gray-300 w-[60px]">
                          <div className="px-1 py-2 text-xs font-semibold text-gray-700 text-right">{slot.label}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
