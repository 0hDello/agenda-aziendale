'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, MapPin,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import {
  format, addDays, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, parseISO, subMonths, getDay,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';

const ACCENT_COLORS = [
  '#005CA9', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626',
];

export default function OperatoreDashboard() {
  const params    = useParams();
  const router    = useRouter();
  const personaId = params.id as string;

  const [persona, setPersona]           = useState<Persona | null>(null);
  const [persone, setPersone]           = useState<Persona[]>([]);
  const [sedi, setSedi]                 = useState<Sede[]>([]);
  const [personaSede, setPersonaSede]   = useState<PersonaSede[]>([]);
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDay, setSelectedDay]   = useState<Date>(new Date());
  const [calMonth, setCalMonth]         = useState<Date>(new Date());

  useEffect(() => {
    (async () => {
      try {
        const [pR, sR, psR, aR] = await Promise.all([
          fetch('/api/persone'), fetch('/api/sedi'),
          fetch('/api/persona-sede'), fetch('/api/appuntamenti'),
        ]);
        const [pAll, s, ps, a] = await Promise.all([pR.json(), sR.json(), psR.json(), aR.json()]);
        setPersone(pAll || []); setSedi(s || []);
        setPersonaSede(ps || []); setAppointments(a || []);
        const found = (pAll || []).find((p: Persona) => p.id === personaId);
        if (!found) { router.push('/operatore'); return; }
        setPersona(found);
      } catch {}
      setLoading(false);
    })();
  }, [personaId]);

  const color = useMemo(() => {
    const idx = persone.findIndex(p => p.id === personaId);
    return ACCENT_COLORS[idx % ACCENT_COLORS.length];
  }, [persone, personaId]);

  const isReal   = (a: Appuntamento) => (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO';
  const myApts   = useMemo(() => appointments.filter(a => a.persona_id === personaId && isReal(a)), [appointments, personaId]);
  const mySedi   = useMemo(() =>
    personaSede.filter(ps => ps.persona_id === personaId)
      .map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[],
    [personaSede, personaId, sedi]);

  const today       = format(new Date(), 'yyyy-MM-dd');
  const monthStr    = format(new Date(), 'yyyy-MM');
  const prevMStr    = format(subMonths(new Date(), 1), 'yyyy-MM');

  const todayApts      = myApts.filter(a => a.data === today).sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));
  const thisMonthApts  = myApts.filter(a => a.data.startsWith(monthStr));
  const prevMonthApts  = myApts.filter(a => a.data.startsWith(prevMStr));
  const monthDelta     = thisMonthApts.length - prevMonthApts.length;

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedApts   = myApts.filter(a => a.data === selectedDayStr)
    .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));

  const nextApts = myApts
    .filter(a => a.data > today)
    .sort((a, b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio))
    .slice(0, 8);

  const weekdayCounts = [1, 2, 3, 4, 5, 6].map(d => ({
    d,
    label: ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][d],
    count: myApts.filter(a => { try { return getDay(parseISO(a.data)) === d; } catch { return false; } }).length,
  }));
  const maxWD = Math.max(...weekdayCounts.map(w => w.count), 1);

  const sedeStats = mySedi.map(s => ({
    sede: s,
    total: myApts.filter(a => a.sede_id === s.id).length,
    month: myApts.filter(a => a.sede_id === s.id && a.data.startsWith(monthStr)).length,
    pct: myApts.length > 0
      ? Math.round(myApts.filter(a => a.sede_id === s.id).length / myApts.length * 100)
      : 0,
  })).sort((a, b) => b.total - a.total);

  // Calendario
  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(calMonth), { weekStartsOn: 1 }),
  });
  const calWeeks: Date[][] = [];
  for (let i = 0; i < calDays.length; i += 7) calWeeks.push(calDays.slice(i, i + 7));
  const getDayCount = (d: Date) => myApts.filter(a => a.data === format(d, 'yyyy-MM-dd')).length;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  );
  if (!persona) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── TOP BAR ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/operatore')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-xs font-medium transition-colors"
          >
            <ArrowLeft size={13} />
            Cambia operatore
          </button>

          {/* Profilo inline */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {persona.nome.charAt(0).toUpperCase()}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{persona.nome}</p>
              <p className="text-xs text-gray-400">
                {mySedi.map(s => s.nome).join(' · ')}
              </p>
            </div>
          </div>
        </div>

        {/* ── STAT ROW ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Oggi',          value: todayApts.length },
            { label: 'Questo mese',   value: thisMonthApts.length },
            { label: 'Mese scorso',   value: prevMonthApts.length },
            { label: 'Totale storico', value: myApts.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* COLONNA SX: Calendario */}
          <div className="lg:col-span-5 space-y-4">

            {/* Calendario */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-gray-700">Calendario</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCalMonth(m => subMonths(m, 1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft size={14} className="text-gray-400" />
                  </button>
                  <span className="text-xs font-semibold text-gray-600 w-28 text-center capitalize">
                    {format(calMonth, 'MMMM yyyy', { locale: it })}
                  </span>
                  <button
                    onClick={() => setCalMonth(m => addDays(endOfMonth(m), 1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Intestazione giorni */}
              <div className="grid grid-cols-7 mb-2">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-semibold text-gray-300 py-1">{d}</div>
                ))}
              </div>

              {/* Celle */}
              {calWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map((day, di) => {
                    const cnt      = getDayCount(day);
                    const inMonth  = day.getMonth() === calMonth.getMonth();
                    const isTod    = format(day, 'yyyy-MM-dd') === today;
                    const isSel    = isSameDay(day, selectedDay);
                    return (
                      <button
                        key={di}
                        onClick={() => { setSelectedDay(day); setCalMonth(day); }}
                        disabled={!inMonth}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-lg m-0.5 text-[12px] font-medium transition-all
                          ${ !inMonth ? 'opacity-20 pointer-events-none' : 'cursor-pointer hover:bg-gray-50' }
                        `}
                        style={{
                          backgroundColor: isSel ? color : isTod ? `${color}12` : 'transparent',
                          color: isSel ? '#fff' : isTod ? color : '#374151',
                          fontWeight: isTod || isSel ? 700 : 500,
                        }}
                      >
                        {format(day, 'd')}
                        {cnt > 0 && !isSel && (
                          <span
                            className="absolute bottom-1 w-1 h-1 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Distribuzione per giorno */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribuzione settimanale</h2>
              <div className="space-y-2.5">
                {weekdayCounts.map(w => (
                  <div key={w.d} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-400 w-7 flex-shrink-0">{w.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(w.count / maxWD) * 100}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-400 w-4 text-right">{w.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* COLONNA DX */}
          <div className="lg:col-span-7 space-y-4">

            {/* Appuntamenti del giorno selezionato */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 capitalize">
                  {format(selectedDay, 'EEEE dd MMMM', { locale: it })}
                </h2>
                {selectedApts.length > 0 && (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}12`, color }}
                  >
                    {selectedApts.length}
                  </span>
                )}
              </div>

              {selectedApts.length === 0 ? (
                <div className="py-8 flex flex-col items-center text-gray-300">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-2">
                    <User size={16} className="text-gray-300" />
                  </div>
                  <p className="text-sm">Nessun appuntamento</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedApts.map(apt => {
                    const sede = sedi.find(s => s.id === apt.sede_id);
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex flex-col items-end w-16 flex-shrink-0">
                          <span className="text-xs font-bold" style={{ color }}>
                            {apt.ora_inizio.substring(0, 5)}
                          </span>
                          <span className="text-[10px] text-gray-300">
                            {apt.ora_fine.substring(0, 5)}
                          </span>
                        </div>
                        <div className="w-px h-6 bg-gray-100 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{apt.cliente || '—'}</p>
                          {sede && <p className="text-xs text-gray-400">{sede.nome}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Prossimi appuntamenti */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Prossimi appuntamenti</h2>
                {nextApts.length > 0 && (
                  <span className="text-[11px] text-gray-400">{nextApts.length}</span>
                )}
              </div>

              {nextApts.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-6">Nessun appuntamento futuro</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {nextApts.map(apt => {
                    const sede   = sedi.find(s => s.id === apt.sede_id);
                    const dLabel = format(parseISO(apt.data), 'EEE dd/MM', { locale: it });
                    return (
                      <div key={apt.id} className="flex items-center gap-4 py-2.5">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                          style={{ backgroundColor: `${color}10`, color }}
                        >
                          {dLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{apt.cliente || '—'}</p>
                          <p className="text-xs text-gray-400">
                            {apt.ora_inizio.substring(0, 5)}–{apt.ora_fine.substring(0, 5)}
                            {sede ? ` · ${sede.nome}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Statistiche per sede */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Per sede</h2>
              {sedeStats.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-4">Nessuna sede</p>
              ) : (
                <div className="space-y-4">
                  {sedeStats.map(ss => (
                    <div key={ss.sede.id}>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{ss.sede.nome}</span>
                        <span className="text-xs text-gray-400">
                          {ss.total} tot &nbsp;·&nbsp; {ss.month} questo mese
                        </span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${ss.pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
