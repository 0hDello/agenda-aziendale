'use client';

import React, { useState, useEffect, useRef, useDeferredValue, useCallback } from 'react';
import { subDays, addDays, subMonths, addMonths, parseISO } from 'date-fns';
import { Appuntamento } from '@/lib/types';
import AppointmentModal, { AppointmentModalHandle } from './AppointmentModal';
import { MIN_DATE } from './calendar/types';
import { useCalendarData } from './calendar/useCalendarData';
import { useCalendarInfiniteScroll } from './calendar/useCalendarInfiniteScroll';
import CalendarHeader from './calendar/CalendarHeader';
import CalendarDailyTable from './calendar/CalendarDailyTable';
import CalendarMonthlyView from './calendar/CalendarMonthlyView';
import CalendarSearchModal from './calendar/CalendarSearchModal';
import CalendarPrintModal from './calendar/CalendarPrintModal';
import CalendarDatePickerModal from './calendar/CalendarDatePickerModal';

interface CalendarProps {
  agendaId?: string;
}

export default function Calendar({ agendaId = '730' }: CalendarProps) {
  const data = useCalendarData(agendaId);
  const scroll = useCalendarInfiniteScroll();

  const appointmentModalRef = useRef<AppointmentModalHandle>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<{
    appointment: Appuntamento;
    originalTime: string;
  } | null>(null);

  const [showDatePicker, setShowDatePicker]                 = useState(false);
  const [selectedMonthlyPersona, setSelectedMonthlyPersona] = useState<string | null>(null);
  const [editMode, setEditMode]                             = useState(false);
  const deferredEditMode                                    = useDeferredValue(editMode);
  const [showSearch, setShowSearch]                         = useState(false);
  const [showPrintModal, setShowPrintModal]                 = useState(false);

  // Cross-cell appointment hover styling
  useEffect(() => {
    const getCell = (e: Event) => (e.target instanceof Element ? e.target.closest('[data-appointment-id]') : null);
    const handleMouseEnter = (e: Event) => {
      const cell = getCell(e);
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) {
          document.querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`).forEach(el => el.classList.add('appointment-hover'));
        }
      }
    };
    const handleMouseLeave = (e: Event) => {
      const cell = getCell(e);
      if (cell) {
        const id = cell.getAttribute('data-appointment-id');
        if (id) {
          document.querySelectorAll<HTMLElement>(`[data-appointment-id="${id}"]`).forEach(el => el.classList.remove('appointment-hover'));
        }
      }
    };
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      document.querySelectorAll<HTMLElement>('.appointment-hover').forEach(el => el.classList.remove('appointment-hover'));
    };
  }, []);

  // Global shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSlotClick = useCallback((
    date: string,
    time: string,
    personaId: string,
    existingAppointment?: Appuntamento
  ) => {
    const day         = parseISO(date);
    const daySlots    = data.getTimeSlotsForDay(day);
    const dayEndSlots = data.getEndTimeSlotsForDay(day);
    appointmentModalRef.current?.open({
      date,
      time,
      personaId,
      existingAppointment,
      sedeId: data.selectedSedeId,
      daySlots,
      dayEndSlots,
    });
  }, [data]);

  const handleDragStart = useCallback((appointment: Appuntamento, time: string) => {
    setDraggedAppointment({ appointment, originalTime: time });
  }, []);

  const handleDrop = useCallback((date: string, newTime: string, personaId: string, day: Date) => {
    data.handleDrop(date, newTime, personaId, day, draggedAppointment, () => {
      setDraggedAppointment(null);
    });
  }, [data, draggedAppointment]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handlePrev = useCallback(() => {
    if (scroll.viewMode === 'daily') {
      scroll.navigateToDate(subDays(scroll.selectedDate, 1));
    } else if (scroll.selectedDate > MIN_DATE) {
      scroll.setSelectedDate(subMonths(scroll.selectedDate, 1));
    }
  }, [scroll]);

  const handleNext = useCallback(() => {
    if (scroll.viewMode === 'daily') {
      scroll.navigateToDate(addDays(scroll.selectedDate, 1));
    } else {
      scroll.setSelectedDate(addMonths(scroll.selectedDate, 1));
    }
  }, [scroll]);

  const navigateToSearchResult = useCallback((apt: Appuntamento) => {
    const targetSede = data.sediRef.current.find(s => s.id === apt.sede_id);
    if (targetSede) data.setSelectedSedeId(targetSede.id);
    try {
      const [y, m, d] = apt.data.split('-').map(Number);
      setTimeout(() => scroll.navigateToDate(new Date(y, m - 1, d, 12, 0, 0)), 50);
    } catch { }
    scroll.setViewMode('daily');
    setShowSearch(false);
  }, [data, scroll]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white border-t-4 border-[#005CA9]">
      {/* ── HEADER ── */}
      <CalendarHeader
        realtimeFlash={data.realtimeFlash}
        onOpenSearch={() => setShowSearch(true)}
        onOpenPrint={() => setShowPrintModal(true)}
        viewMode={scroll.viewMode}
        onToggleViewMode={scroll.setViewMode}
        editMode={editMode}
        onToggleEditMode={() => setEditMode(e => !e)}
        onPrev={handlePrev}
        onNext={handleNext}
        selectedDate={scroll.selectedDate}
        onToggleDatePicker={() => setShowDatePicker(d => !d)}
        selectedSedeId={data.selectedSedeId}
        onSelectSedeId={data.setSelectedSedeId}
        sedi={data.sedi}
      />

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden">
        {scroll.viewMode === 'daily' ? (
          <CalendarDailyTable
            scrollRef={scroll.setScrollRef}
            visibleDays={scroll.visibleDays}
            sedePersone={data.sedePersone}
            getTimeSlotsForDay={data.getTimeSlotsForDay}
            isDayFullyClosedForAllPersone={data.isDayFullyClosedForAllPersone}
            isPersonaDisabledForDay={data.isPersonaDisabledForDay}
            isUffChiusoSlot={data.isUffChiusoSlot}
            getUffChiusoApts={data.getUffChiusoApts}
            getAppointmentsForSlot={data.getAppointmentsForSlot}
            appointmentsByDayPerson={data.appointmentsByDayPerson}
            isBorgoSede={data.isBorgoSede}
            deferredEditMode={deferredEditMode}
            onEditModeSlotClick={data.handleEditModeSlotClick}
            onSlotClick={handleSlotClick}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        ) : (
          <CalendarMonthlyView
            selectedDate={scroll.selectedDate}
            selectedMonthlyPersona={selectedMonthlyPersona}
            onSelectMonthlyPersona={setSelectedMonthlyPersona}
            sedePersone={data.sedePersone}
            getFirstAvailableDay={data.getFirstAvailableDay}
            getDayAvailability={data.getDayAvailability}
            getFreeSlots={data.getFreeSlots}
            isDayClosedForSede={data.isDayClosedForSede}
            onNavigateToDate={scroll.navigateToDate}
            onSwitchToDaily={() => scroll.setViewMode('daily')}
          />
        )}
      </div>

      {/* ── PRINT MODAL ── */}
      <CalendarPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        selectedDate={scroll.selectedDate}
        selectedSedeId={data.selectedSedeId}
        sedi={data.sedi}
        sedePersone={data.sedePersone}
        appointments={data.appointments}
        isDayClosedForSede={data.isDayClosedForSede}
        getTimeSlotsForDay={data.getTimeSlotsForDay}
      />

      {/* ── SEARCH OVERLAY ── */}
      <CalendarSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        appointments={data.appointments}
        personeMap={data.personeMap}
        sedi={data.sedi}
        onSelectResult={navigateToSearchResult}
      />

      {/* ── DATE PICKER ── */}
      <CalendarDatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={scroll.selectedDate}
        onSelectDate={scroll.navigateToDate}
        onGoToToday={() => scroll.navigateToDate(new Date())}
        isDayClosedForSede={data.isDayClosedForSede}
      />

      {/* ── APPOINTMENT MODAL ── */}
      <AppointmentModal
        ref={appointmentModalRef}
        onSave={data.handleCreateAppointment}
        onUpdate={data.handleUpdateAppointment}
        onDelete={data.handleDeleteAppointment}
        persone={data.persone}
        sedi={data.sedi}
        personaSede={data.personaSede}
      />
    </div>
  );
}
