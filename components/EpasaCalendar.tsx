'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { subDays, addDays, subMonths, addMonths } from 'date-fns';
import { Appointment, MIN_DATE, dateStrToLocal } from './epasa/types';
import { useEpasaData } from './epasa/useEpasaData';
import { useEpasaInfiniteScroll } from './epasa/useEpasaInfiniteScroll';
import EpasaHeader from './epasa/EpasaHeader';
import EpasaDailyTable from './epasa/EpasaDailyTable';
import EpasaMonthlyView from './epasa/EpasaMonthlyView';
import EpasaSearchModal from './epasa/EpasaSearchModal';
import EpasaDatePickerModal from './epasa/EpasaDatePickerModal';
import EpasaAppointmentModal from './EpasaAppointmentModal';
import LoredanaView from './LoredanaView';

interface EpasaCalendarProps {
  agendaId: string;
  initialLoredana?: boolean;
}

export default function EpasaCalendar({ agendaId: _agendaId, initialLoredana = false }: EpasaCalendarProps) {
  const data   = useEpasaData();
  const scroll = useEpasaInfiniteScroll();

  const [showDatePicker, setShowDatePicker]                   = useState(false);
  const [showModal, setShowModal]                             = useState(false);
  const [selectedSlot, setSelectedSlot]                       = useState<{ date: string; time: string; operator?: string } | null>(null);
  const [editingAppointment, setEditingAppointment]           = useState<Appointment | null>(null);
  const [editMode, setEditMode]                               = useState(false);
  const [selectedMonthlyOperator, setSelectedMonthlyOperator] = useState<string | null>(null);
  const [showLoredanaView, setShowLoredanaView]               = useState(initialLoredana);
  const [showSearch, setShowSearch]                           = useState(false);

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

  const openModalForNewAppointment = useCallback((date: string, time: string, operator: string) => {
    setSelectedSlot({ date, time, operator });
    setEditingAppointment(null);
    setShowModal(true);
  }, []);

  const openModalForEditAppointment = useCallback((appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedSlot({ date: appointment.data, time: appointment.ora, operator: appointment.operatore_id });
    setShowModal(true);
  }, []);

  const navigateToSearchResult = useCallback((apt: Appointment) => {
    const targetSede = data.sediRef.current.find(s => s.id === apt.sede_id);
    if (targetSede) data.setSelectedSede(targetSede);
    setTimeout(() => scroll.navigateToDate(dateStrToLocal(apt.data)), 50);
    scroll.setViewMode('daily');
    setShowSearch(false);
  }, [data, scroll]);

  const handlePrev = useCallback(() => {
    if (scroll.viewMode === 'daily') {
      const d = subDays(scroll.selectedDate, 1);
      if (d >= MIN_DATE) scroll.navigateToDate(d);
    } else {
      const d = subMonths(scroll.selectedDate, 1);
      if (d >= MIN_DATE) scroll.setSelectedDate(d);
    }
  }, [scroll]);

  const handleNext = useCallback(() => {
    if (scroll.viewMode === 'daily') {
      scroll.navigateToDate(addDays(scroll.selectedDate, 1));
    } else {
      scroll.setSelectedDate(addMonths(scroll.selectedDate, 1));
    }
  }, [scroll]);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto animate-spin" />
          <p className="mt-4 text-gray-600 font-medium">Caricamento agenda EPASA...</p>
        </div>
      </div>
    );
  }

  if (!data.selectedSede) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-600">Nessuna sede disponibile</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white border-t-4 border-[#005CA9]">
      {/* ── HEADER ── */}
      <EpasaHeader
        selectedSede={data.selectedSede}
        sedi={data.sedi}
        onSelectSede={data.setSelectedSede}
        realtimeFlash={data.realtimeFlash}
        onOpenSearch={() => setShowSearch(true)}
        sedeOrariLabel={data.getSedeOrariLabel(scroll.selectedDate)}
        onOpenLoredanaView={() => setShowLoredanaView(true)}
        viewMode={scroll.viewMode}
        onToggleViewMode={scroll.setViewMode}
        editMode={editMode}
        onToggleEditMode={() => setEditMode(e => !e)}
        onPrev={handlePrev}
        onNext={handleNext}
        selectedDate={scroll.selectedDate}
        onToggleDatePicker={() => setShowDatePicker(d => !d)}
      />

      {/* ── BODY ── */}
      <div className="flex-1 overflow-hidden">
        {scroll.viewMode === 'daily' ? (
          <EpasaDailyTable
            scrollRef={scroll.setScrollRef}
            visibleDays={scroll.visibleDays}
            operatorsInSede={data.operatorsInSede}
            currentTimeSlots={data.currentTimeSlots}
            getTimeSlotsForDay={data.getTimeSlotsForDay}
            selectedSede={data.selectedSede}
            editMode={editMode}
            getAppointmentsForSlot={data.getAppointmentsForSlot}
            isSedeOperatorDayClosed={data.isSedeOperatorDayClosed}
            isGiornoChiuso={data.isGiornoChiuso}
            isMileceTimeBlocked={data.isMileceTimeBlocked}
            isLoredanaAfternoonBlocked={data.isLoredanaAfternoonBlocked}
            isUffChiusoSlot={data.isUffChiusoSlot}
            getUffChiusoApts={data.getUffChiusoApts}
            onEditModeSlotClick={data.handleEditModeSlotClick}
            onOpenEditAppointment={openModalForEditAppointment}
            onOpenNewAppointment={openModalForNewAppointment}
          />
        ) : (
          <EpasaMonthlyView
            selectedDate={scroll.selectedDate}
            selectedSede={data.selectedSede}
            operatorsInSede={data.operatorsInSede}
            selectedMonthlyOperator={selectedMonthlyOperator}
            onSelectMonthlyOperator={setSelectedMonthlyOperator}
            getFirstAvailableDay={data.getFirstAvailableDay}
            getDayAvailability={data.getDayAvailability}
            getTimeSlotsForSede={data.getTimeSlotsForSede}
            isMileceTimeBlocked={data.isMileceTimeBlocked}
            isLoredanaAfternoonBlocked={data.isLoredanaAfternoonBlocked}
            getRealAppointmentsCount={data.getRealAppointmentsCount}
            getUffChiusoSlotsCount={data.getUffChiusoSlotsCount}
            onNavigateToDate={scroll.navigateToDate}
            onSwitchToDaily={() => scroll.setViewMode('daily')}
          />
        )}
      </div>

      {/* ── SEARCH OVERLAY ── */}
      <EpasaSearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        allAppointments={data.allAppointments}
        sedi={data.sedi}
        onSelectResult={navigateToSearchResult}
      />

      {/* ── LOREDANA VIEW ── */}
      {showLoredanaView && (
        <LoredanaView
          onClose={() => setShowLoredanaView(false)}
          allAppointments={data.allAppointments}
          giorniChiusi={data.giorniChiusi}
          sedi={data.sedi}
          operatori={data.operatori}
          onSave={data.handleCreateAppointment}
          onUpdate={data.handleUpdateAppointment}
          onDelete={data.handleDeleteAppointment}
        />
      )}

      {/* ── DATE PICKER ── */}
      <EpasaDatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={scroll.selectedDate}
        onSelectDate={scroll.navigateToDate}
        onGoToToday={() => scroll.navigateToDate(new Date())}
      />

      {/* ── APPOINTMENT MODAL ── */}
      {showModal && selectedSlot && (
        <EpasaAppointmentModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingAppointment(null);
            setSelectedSlot(null);
          }}
          onSave={data.handleCreateAppointment}
          onUpdate={data.handleUpdateAppointment}
          onDelete={data.handleDeleteAppointment}
          existingAppointment={editingAppointment}
          sedi={data.sedi}
          operatori={data.operatori}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
          selectedSedeId={data.selectedSede.id}
          defaultOperatoreId={selectedSlot.operator}
        />
      )}
    </div>
  );
}
