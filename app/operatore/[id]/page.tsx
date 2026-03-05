'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, MapPin, Calendar, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Loader2, Minus, Zap, Target,
  Clock, BarChart2, Award, Layers,
} from 'lucide-react';
import {
  format, addDays, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, parseISO, subMonths, getDay,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';

const PALETTE = [
  { base: '#005CA9', light: '#E6F2FF', dark: '#003d73' },
  { base: '#0EA5E9', light: '#E0F5FF', dark: '#0369a1' },
  { base: '#8B5CF6', light: '#EDE9FE', dark: '#6d28d9' },
  { base: '#10B981', light: '#D1FAE5', dark: '#047857' },
  { base: '#F59E0B', light: '#FEF3C7', dark: '#b45309' },
  { base: '#EF4444', light: '#FEE2E2', dark: '#b91c1c' },
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

  const pal = useMemo(() => {
    const idx = persone.findIndex(p => p.id === personaId);
    return PALETTE[idx % PALETTE.length] ?? PALETTE[0];
  }, [persone, personaId]);

  const myApts = useMemo(() =>
    appointments.filter(a => a.persona_id === personaId &&
      (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'),
    [appointments, personaId]);

  const mySedi = useMemo(() =>
    personaSede.filter(ps => ps.persona_id === personaId)
      .map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[],
    [personaSede, personaId, sedi]);

  const today    = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const monthStr = format(new Date(), 'yyyy-MM');
  const prevMStr = format(subMonths(new Date(), 1), 'yyyy-MM');

  const todayApts     = myApts.filter(a => a.data === today).sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio));
  const tomorrowApts  = myApts.filter(a => a.data === tomorrow);
  const thisMonthApts = myApts.filter(a => a.data.startsWith(monthStr));
  const prevMonthApts = myApts.filter(a => a.data.startsWith(prevMStr));
  const monthDelta    = thisMonthApts.length - prevMonthApts.length;

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedApts   = myApts.filter(a => a.data === selectedDayStr)
    .sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio));

  const nextApts = myApts.filter(a => a.data > today)
    .sort((a,b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio))
    .slice(0, 10);

  const weekdayCounts = [1,2,3,4,5,6].map(d => ({
    d, label: ['','Lun','Mar','Mer','Gio','Ven','Sab'][d],
    count: myApts.filter(a => { try { return getDay(parseISO(a.data)) === d; } catch { return false; } }).length,
  }));
  const maxWD = Math.max(...weekdayCounts.map(w => w.count), 1);
  const busiestDay = [...weekdayCounts].sort((a,b) => b.count - a.count)[0];

  const sedeStats = mySedi.map(s => ({
    sede: s,
    count: myApts.filter(a => a.sede_id === s.id).length,
    month: myApts.filter(a => a.sede_id === s.id && a.data.startsWith(monthStr)).length,
  })).sort((a,b) => b.count - a.count);

  // Calendario
  const calDays  = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(calMonth), { weekStartsOn: 1 }),
  });
  const calWeeks: Date[][] = [];
  for (let i = 0; i < calDays.length; i += 7) calWeeks.push(calDays.slice(i, i + 7));
  const getDayCount = (d: Date) => myApts.filter(a => a.data === format(d, 'yyyy-MM-dd')).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: PALETTE[0].base }}>
          <Loader2 size={28} className="animate-spin text-white" />
        </div>
        <p className="text-slate-400 text-sm">Caricamento...</p>
      </div>
    </div>
  );
  if (!persona) return null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>

      {/* ── SIDEBAR + MAIN LAYOUT ─────────────────────────────────────── */}
      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r border-white/5 p-6"
          style={{ background: 'rgba(255,255,255,0.03)' }}>

          {/* Back */}
          <button onClick={() => router.push('/operatore')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold mb-10 transition-colors group">
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Cambia operatore
          </button>

          {/* Avatar + nome */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${pal.base}, ${pal.dark})` }}>
              <User size={36} className="text-white" />
            </div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Operatore</p>
            <h2 className="text-white text-xl font-black leading-tight">{persona.nome}</h2>
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {mySedi.map(s => (
                <span key={s.id} className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${pal.base}30`, color: pal.base === '#005CA9' ? '#60a5fa' : pal.base }}>
                  <MapPin size={8} />{s.nome}
                </span>
              ))}
            </div>
          </div>

          {/* KPI verticali */}
          <div className="space-y-3 mb-8">
            {[
              { label: 'Oggi', value: todayApts.length, icon: <Zap size={14}/>, accent: todayApts.length > 0 },
              { label: 'Domani', value: tomorrowApts.length, icon: <Clock size={14}/>, accent: false },
              { label: 'Questo mese', value: thisMonthApts.length, icon: <Calendar size={14}/>, accent: false },
              { label: 'Totale storico', value: myApts.length, icon: <BarChart2 size={14}/>, accent: false },
            ].map(k => (
              <div key={k.label}
                className="flex items-center justify-between rounded-xl px-4 py-3 border"
                style={{
                  background: k.accent ? `${pal.base}25` : 'rgba(255,255,255,0.04)',
                  borderColor: k.accent ? `${pal.base}60` : 'rgba(255,255,255,0.06)',
                }}>
                <div className="flex items-center gap-2.5">
                  <span style={{ color: k.accent ? pal.base === '#005CA9' ? '#60a5fa' : pal.base : '#64748b' }}>{k.icon}</span>
                  <span className="text-slate-400 text-xs font-medium">{k.label}</span>
                </div>
                <span className="text-white font-black text-lg">{k.value}</span>
              </div>
            ))}
          </div>

          {/* Trend mese */}
          <div className="rounded-xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">Trend mensile</p>
            <div className="flex items-end gap-1 justify-between">
              <div className="text-center">
                <p className="text-slate-400 text-[10px] mb-1">Scorso</p>
                <p className="text-slate-300 text-lg font-black">{prevMonthApts.length}</p>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {monthDelta > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold"><TrendingUp size={14}/>+{monthDelta}</span>
                ) : monthDelta < 0 ? (
                  <span className="flex items-center gap-1 text-red-400 text-xs font-bold"><TrendingDown size={14}/>{monthDelta}</span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-500 text-xs font-bold"><Minus size={14}/>0</span>
                )}
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-[10px] mb-1">Questo</p>
                <p className="font-black text-lg" style={{ color: '#60a5fa' }}>{thisMonthApts.length}</p>
              </div>
            </div>
          </div>

          {/* Pattern settimanale */}
          <div className="mt-4 rounded-xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">Per giorno della settimana</p>
            <div className="space-y-2">
              {weekdayCounts.map(w => (
                <div key={w.d} className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px] font-bold w-7">{w.label}</span>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: '6px', background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(w.count/maxWD)*100}%`, background: `linear-gradient(90deg, ${pal.base}, ${pal.dark})` }} />
                  </div>
                  <span className="text-slate-500 text-[10px] w-4 text-right">{w.count}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto">

          {/* Mobile back */}
          <div className="lg:hidden px-4 pt-5">
            <button onClick={() => router.push('/operatore')}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors">
              <ArrowLeft size={14} /> Cambia operatore
            </button>
          </div>

          {/* HERO STRIP */}
          <div className="px-6 pt-8 pb-6">
            <div className="rounded-2xl overflow-hidden relative"
              style={{ background: `linear-gradient(135deg, ${pal.base}ee 0%, ${pal.dark}cc 100%)` }}>
              {/* Motivo decorativo */}
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 90% 10%, rgba(255,255,255,0.12) 0%, transparent 50%),
                  radial-gradient(circle at 10% 90%, rgba(255,255,255,0.06) 0%, transparent 40%)`
              }} />
              <div className="relative px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                    {format(new Date(), "EEEE dd MMMM yyyy", { locale: it })}
                  </p>
                  <h1 className="text-white text-2xl font-black mt-0.5">
                    {todayApts.length === 0
                      ? 'Nessun appuntamento oggi 🎉'
                      : `${todayApts.length} appuntament${todayApts.length > 1 ? 'i' : 'o'} oggi`}
                  </h1>
                  {tomorrowApts.length > 0 && (
                    <p className="text-white/60 text-xs mt-1">Domani: {tomorrowApts.length} appuntament{tomorrowApts.length===1?'o':'i'}</p>
                  )}
                </div>
                <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
                  <Zap size={24} className="text-white" />
                </div>
              </div>

              {/* Quick insight bar */}
              <div className="relative border-t border-white/10 px-6 py-3 grid grid-cols-3 gap-4">
                {[
                  { label: 'Giorno top', value: busiestDay?.label ?? '—', icon: <Award size={12}/> },
                  { label: 'Media/giorno (mese)', value: thisMonthApts.length > 0 ? (thisMonthApts.length / new Date().getDate()).toFixed(1) : '0', icon: <Target size={12}/> },
                  { label: 'Sedi attive', value: mySedi.length, icon: <Layers size={12}/> },
                ].map(q => (
                  <div key={q.label} className="flex items-center gap-2">
                    <span className="text-white/50">{q.icon}</span>
                    <div>
                      <p className="text-white/50 text-[9px] uppercase tracking-wide font-bold">{q.label}</p>
                      <p className="text-white font-black text-sm">{q.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GRID CONTENUTO */}
          <div className="px-6 pb-10 grid grid-cols-1 xl:grid-cols-5 gap-5">

            {/* CALENDARIO — 2 colonne su xl */}
            <div className="xl:col-span-2">
              <SectionCard title="Calendario" icon={<Calendar size={15}/>}>
                {/* Header mese */}
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCalMonth(m => subMonths(m,1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
                    <ChevronLeft size={14} className="text-slate-400"/>
                  </button>
                  <span className="text-white text-sm font-bold capitalize">
                    {format(calMonth,'MMMM yyyy',{locale:it})}
                  </span>
                  <button onClick={() => setCalMonth(m => addDays(endOfMonth(m),1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
                    <ChevronRight size={14} className="text-slate-400"/>
                  </button>
                </div>
                {/* Giorni */}
                <div className="grid grid-cols-7 mb-1">
                  {['L','M','M','G','V','S','D'].map((d,i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-slate-600 py-1">{d}</div>
                  ))}
                </div>
                {calWeeks.map((week,wi) => (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((day,di) => {
                      const cnt  = getDayCount(day);
                      const inMonth = day.getMonth() === calMonth.getMonth();
                      const isTod   = format(day,'yyyy-MM-dd') === today;
                      const isSel   = isSameDay(day, selectedDay);
                      return (
                        <button key={di}
                          onClick={() => { setSelectedDay(day); setCalMonth(day); }}
                          className={`relative aspect-square flex flex-col items-center justify-center rounded-lg m-0.5 text-[11px] font-bold transition-all
                            ${ !inMonth ? 'opacity-15 pointer-events-none' : 'cursor-pointer' }
                          `}
                          style={{
                            background: isSel ? pal.base : isTod ? `${pal.base}30` : cnt > 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
                            color: isSel ? '#fff' : isTod ? '#93c5fd' : inMonth ? '#cbd5e1' : '#334155',
                            boxShadow: isSel ? `0 4px 14px ${pal.base}60` : 'none',
                          }}
                        >
                          {format(day,'d')}
                          {cnt > 0 && !isSel && (
                            <span className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: pal.base }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </SectionCard>
            </div>

            {/* AGENDA GIORNO — 3 colonne su xl */}
            <div className="xl:col-span-3">
              <SectionCard
                title={format(selectedDay,'EEEE dd MMMM',{locale:it})}
                icon={<Clock size={15}/>}
                badge={selectedApts.length > 0 ? `${selectedApts.length}` : undefined}
                badgeColor={pal.base}
              >
                {selectedApts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <Calendar size={20} className="opacity-40" />
                    </div>
                    <p className="text-sm">Nessun appuntamento</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedApts.map((apt, idx) => {
                      const sede = sedi.find(s => s.id === apt.sede_id);
                      return (
                        <div key={apt.id}
                          className="group flex items-stretch gap-3 rounded-xl p-3 border transition-all cursor-default"
                          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${pal.base}18`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                          {/* Orario */}
                          <div className="flex flex-col items-center justify-center w-12 text-center flex-shrink-0">
                            <span className="text-[10px] font-black" style={{ color: pal.base === '#005CA9' ? '#60a5fa' : pal.base }}>
                              {apt.ora_inizio.substring(0,5)}
                            </span>
                            <div className="w-px h-3 my-0.5" style={{ background: `${pal.base}50` }} />
                            <span className="text-[9px] text-slate-600">{apt.ora_fine.substring(0,5)}</span>
                          </div>
                          {/* Separatore */}
                          <div className="w-0.5 rounded-full flex-shrink-0" style={{ background: `linear-gradient(to bottom, ${pal.base}, ${pal.dark})` }} />
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm truncate">{apt.cliente || '—'}</p>
                            <p className="text-slate-500 text-[11px] mt-0.5">{sede?.nome ?? ''}</p>
                            {apt.note && <p className="text-slate-600 text-[10px] italic truncate mt-0.5">{apt.note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* PROSSIMI APPUNTAMENTI — full width */}
            <div className="xl:col-span-3">
              <SectionCard title="Prossimi appuntamenti" icon={<TrendingUp size={15}/>}
                badge={nextApts.length > 0 ? `${nextApts.length}` : undefined} badgeColor={pal.base}>
                {nextApts.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">Nessun appuntamento futuro</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {nextApts.map(apt => {
                      const sede = sedi.find(s => s.id === apt.sede_id);
                      const dLabel = format(parseISO(apt.data), 'EEE dd/MM', { locale: it });
                      return (
                        <div key={apt.id} className="flex items-center gap-3 py-2.5"
                          style={{ transition: 'background .15s' }}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: pal.base }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-200 font-semibold text-sm truncate">{apt.cliente || '—'}</p>
                            <p className="text-slate-600 text-[11px]">{apt.ora_inizio.substring(0,5)}–{apt.ora_fine.substring(0,5)}{sede ? ` · ${sede.nome}` : ''}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${pal.base}25`, color: pal.base === '#005CA9' ? '#93c5fd' : pal.base }}>
                            {dLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* SEDI — 2 colonne su xl */}
            <div className="xl:col-span-2">
              <SectionCard title="Per sede" icon={<BarChart2 size={15}/>}>
                {sedeStats.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-4">Nessuna sede</p>
                ) : (
                  <div className="space-y-4">
                    {sedeStats.map((ss) => {
                      const pct = myApts.length > 0 ? Math.round((ss.count / myApts.length) * 100) : 0;
                      return (
                        <div key={ss.sede.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-slate-300 text-xs font-semibold truncate">{ss.sede.nome}</span>
                            <span className="text-slate-500 text-[10px]">{ss.count} tot · {ss.month} mese</span>
                          </div>
                          <div className="relative rounded-full overflow-hidden" style={{ height: '6px', background: 'rgba(255,255,255,0.07)' }}>
                            <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${pal.base}, ${pal.dark})` }} />
                          </div>
                          <p className="text-slate-600 text-[10px] mt-1 text-right">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// ── Card sezione riutilizzabile ────────────────────────────────────────────────
function SectionCard({
  title, icon, badge, badgeColor, children,
}: {
  title: string; icon?: React.ReactNode; badge?: string;
  badgeColor?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden h-full"
      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-slate-200 text-sm font-bold capitalize">{title}</h3>
        </div>
        {badge && (
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full"
            style={{ background: `${badgeColor}30`, color: badgeColor === '#005CA9' ? '#93c5fd' : badgeColor }}>
            {badge}
          </span>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
