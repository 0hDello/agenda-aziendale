'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Printer, X, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Appuntamento, Persona, Sede } from '@/lib/types';

interface CalendarPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  selectedSedeId: string;
  sedi: Sede[];
  sedePersone: Persona[];
  appointments: Appuntamento[];
  isDayClosedForSede: (day: Date) => boolean;
  getTimeSlotsForDay: (day: Date) => { hour: number; minute: number; label: string }[];
}

export default function CalendarPrintModal({
  isOpen,
  onClose,
  selectedDate,
  selectedSedeId,
  sedi,
  sedePersone,
  appointments,
  isDayClosedForSede,
  getTimeSlotsForDay,
}: CalendarPrintModalProps) {
  const [printDateFrom, setPrintDateFrom]               = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [printDateTo, setPrintDateTo]                   = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [printSelectedPersone, setPrintSelectedPersone] = useState<string[]>(['__all__']);

  useEffect(() => {
    if (isOpen) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setPrintDateFrom(dateStr);
      setPrintDateTo(dateStr);
      setPrintSelectedPersone(['__all__']);
    }
  }, [isOpen, selectedDate]);

  const togglePrintPersona = (personaId: string) => {
    setPrintSelectedPersone(prev => {
      if (personaId === '__all__') return ['__all__'];
      const withoutAll = prev.filter(id => id !== '__all__');
      const exists = withoutAll.includes(personaId);
      if (exists) {
        const next = withoutAll.filter(id => id !== personaId);
        return next.length ? next : ['__all__'];
      }
      return [...withoutAll, personaId];
    });
  };

  const getPrintDatesInRange = (from: string, to: string): Date[] => {
    if (!from || !to) return [];
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const start = new Date(fy, fm - 1, fd, 12);
    const end = new Date(ty, tm - 1, td, 12);
    const dates: Date[] = [];
    let current = start;
    while (current <= end) {
      dates.push(current);
      current = addDays(current, 1);
    }
    return dates;
  };

  const printPreviewCount = useMemo(() => {
    if (!printDateFrom || !printDateTo) return 0;
    return appointments.filter(a => {
      const inRange = a.data >= printDateFrom && a.data <= printDateTo;
      const inSede = a.sede_id === selectedSedeId;
      const notClosed = (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO';
      const validPersona = printSelectedPersone.includes('__all__') ? true : printSelectedPersone.includes(a.persona_id);
      return inRange && inSede && notClosed && validPersona;
    }).length;
  }, [printDateFrom, printDateTo, printSelectedPersone, appointments, selectedSedeId]);

  const printPreviewDaysCount = useMemo(
    () => getPrintDatesInRange(printDateFrom, printDateTo).length,
    [printDateFrom, printDateTo]
  );

  const printPreviewPeopleCount = printSelectedPersone.includes('__all__')
    ? sedePersone.length
    : printSelectedPersone.length;

  const buildPrintableRowsForPersonaDay = (dateStr: string, personaId: string, day: Date) => {
    const slots = getTimeSlotsForDay(day);

    const dayApts = appointments
      .filter(a =>
        a.data === dateStr &&
        a.persona_id === personaId &&
        a.sede_id === selectedSedeId &&
        (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
      )
      .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));

    return slots.map(slot => {
      const startingAppointment = dayApts.find(a => a.ora_inizio.substring(0, 5) === slot.label);
      if (startingAppointment) {
        return {
          time: `${startingAppointment.ora_inizio.substring(0, 5)}\u2013${startingAppointment.ora_fine.substring(0, 5)}`,
          cliente: startingAppointment.cliente ?? '',
          note: startingAppointment.note ?? '',
          empty: false,
        };
      }

      const coveredByLongAppointment = dayApts.some(a =>
        slot.label > a.ora_inizio.substring(0, 5) &&
        slot.label < a.ora_fine.substring(0, 5)
      );
      if (coveredByLongAppointment) return null;

      return {
        time: slot.label,
        cliente: '',
        note: '',
        empty: true,
      };
    }).filter(Boolean) as { time: string; cliente: string; note: string; empty: boolean }[];
  };

  const handlePrint = () => {
    if (!printDateFrom || !printDateTo) return;

    const sede = sedi.find(s => s.id === selectedSedeId);
    const isAll = printSelectedPersone.includes('__all__');
    const selectedPeople = isAll
      ? sedePersone
      : sedePersone.filter(p => printSelectedPersone.includes(p.id));

    if (selectedPeople.length === 0) {
      alert('Seleziona almeno un operatore');
      return;
    }

    const allDays = getPrintDatesInRange(printDateFrom, printDateTo);
    const printableDays = allDays.filter(day => !isDayClosedForSede(day));

    if (printableDays.length === 0) {
      alert('Nessun giorno lavorativo da stampare nel periodo selezionato');
      return;
    }

    const pagesHtml = printableDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'EEEE dd MMMM yyyy', { locale: it });

      const blocksHtml = selectedPeople.map(persona => {
        const rowsData = buildPrintableRowsForPersonaDay(dateStr, persona.id, day);

        const rows = rowsData.map(row => {
          if (row.empty) {
            return `<tr class="empty-row"><td class="ora">${row.time}</td><td class="cliente empty-cell">\u2014</td><td class="note empty-cell">slot vuoto</td></tr>`;
          }
          return `<tr><td class="ora">${row.time}</td><td class="cliente">${row.cliente}</td><td class="note">${row.note}</td></tr>`;
        }).join('');

        const realAppointmentsCount = appointments.filter(a =>
          a.data === dateStr &&
          a.persona_id === persona.id &&
          a.sede_id === selectedSedeId &&
          (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
        ).length;

        return `<div class="block"><div class="block-header"><div class="avatar">${persona.nome.substring(0,1)}</div><span class="nome">${persona.nome}</span><span class="cnt">${realAppointmentsCount} appt.</span></div><table><thead><tr><th>Orario</th><th>Cliente</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }).join('');

      return `<section class="print-page"><header><div><h1>Agenda 730</h1><div class="sub">Sede: ${sede?.nome ?? ''} &mdash; ${isAll ? 'Tutti gli operatori' : selectedPeople.map(p => p.nome).join(', ')}</div></div><div class="meta"><strong>${dayLabel}</strong></div></header><div class="grid">${blocksHtml}</div></section>`;
    }).join('');

    const rangeLabel = printDateFrom === printDateTo ? printDateFrom : `${printDateFrom} - ${printDateTo}`;

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/><title>Agenda 730 \u2013 ${rangeLabel}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:8mm 10mm}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #005CA9;padding-bottom:6px;margin-bottom:10px}header h1{font-size:15px;color:#005CA9;font-weight:800}.sub{font-size:9px;color:#555;margin-top:2px}.meta{text-align:right;font-size:9px;color:#555}.meta strong{display:block;font-size:12px;color:#222;text-transform:capitalize}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.block{break-inside:avoid;border:1px solid #d0dce8;border-radius:4px;overflow:hidden}.block-header{display:flex;align-items:center;gap:5px;background:#005CA9;color:#fff;padding:5px 7px}.avatar{width:20px;height:20px;background:rgba(255,255,255,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0}.nome{font-weight:700;font-size:10px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cnt{font-size:9px;opacity:0.8;white-space:nowrap}table{width:100%;border-collapse:collapse}thead tr{background:#E6F0F9}thead th{padding:3px 5px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;color:#005CA9;border-bottom:2px solid #005CA9}tbody tr{border-bottom:1px solid #e8e8e8}tbody tr:nth-child(even){background:#F8FAFB}tbody td{padding:6px 5px;vertical-align:top;font-size:9px}td.ora{white-space:nowrap;font-weight:700;color:#005CA9;width:65px}td.cliente{font-weight:600;word-break:break-word;white-space:normal}td.note{color:#666;font-style:italic;word-break:break-word;white-space:normal}.empty-row td{color:#9aa4af}.empty-cell{font-style:italic}.print-page{page-break-after:always;margin-bottom:10mm}.print-page:last-child{page-break-after:auto}footer{margin-top:10px;font-size:8px;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;padding-top:6px}@media print{body{padding:8mm 10mm}@page{size:A4 portrait;margin:8mm}}</style></head><body>${pagesHtml}<footer>Stampato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })} &mdash; Agenda Aziendale</footer><script>window.onload=()=>{window.print()}<\/script></body></html>`;

    const win = window.open('', '_blank', 'width=900,height=750');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-10"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border-t-4 border-[#005CA9]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-[#005CA9]" />
            <span className="font-bold text-[#005CA9] text-sm">Stampa appuntamenti</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Dal giorno</label>
              <input
                type="date"
                value={printDateFrom}
                onChange={e => {
                  setPrintDateFrom(e.target.value);
                  if (e.target.value > printDateTo) setPrintDateTo(e.target.value);
                }}
                className="w-full px-3 py-2.5 text-sm bg-[#F5F8FA] border-2 border-gray-200 rounded-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005CA9]/40 focus:border-[#005CA9] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Al giorno</label>
              <input
                type="date"
                value={printDateTo}
                min={printDateFrom}
                onChange={e => setPrintDateTo(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[#F5F8FA] border-2 border-gray-200 rounded-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005CA9]/40 focus:border-[#005CA9] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Operatori</label>
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
              <label className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                printSelectedPersone.includes('__all__')
                  ? 'border-[#005CA9] bg-[#E6F2FF]'
                  : 'border-gray-200 bg-[#F5F8FA] hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={printSelectedPersone.includes('__all__')}
                  onChange={() => togglePrintPersona('__all__')}
                  className="w-4 h-4 accent-[#005CA9]"
                />
                <span className={`text-sm font-semibold ${
                  printSelectedPersone.includes('__all__') ? 'text-[#005CA9]' : 'text-gray-700'
                }`}>
                  Tutti gli operatori
                </span>
              </label>
              {sedePersone.map(p => (
                <label key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                  printSelectedPersone.includes(p.id)
                    ? 'border-[#005CA9] bg-[#E6F2FF]'
                    : 'border-gray-200 bg-[#F5F8FA] hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={printSelectedPersone.includes(p.id)}
                    onChange={() => togglePrintPersona(p.id)}
                    className="w-4 h-4 accent-[#005CA9]"
                  />
                  <div className="w-6 h-6 rounded-full bg-[#005CA9] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">{p.nome.substring(0, 1)}</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    printSelectedPersone.includes(p.id) ? 'text-[#005CA9] font-semibold' : 'text-gray-700'
                  }`}>
                    {p.nome}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {printDateFrom && printDateTo && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 border bg-indigo-50 border-indigo-200">
              <CalendarIcon size={14} className="flex-shrink-0 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">
                {printPreviewCount === 0
                  ? 'Nessun appuntamento nel periodo selezionato'
                  : `${printPreviewCount} appuntament${printPreviewCount === 1 ? 'o' : 'i'} · ${printPreviewDaysCount} giorn${printPreviewDaysCount === 1 ? 'o' : 'i'} · ${printPreviewPeopleCount} operator${printPreviewPeopleCount === 1 ? 'e' : 'i'}`
                }
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handlePrint}
            disabled={!printDateFrom || !printDateTo}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#005CA9] text-white text-sm font-semibold hover:bg-[#004080] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer size={14} /> Stampa
          </button>
        </div>
      </div>
    </div>
  );
}
