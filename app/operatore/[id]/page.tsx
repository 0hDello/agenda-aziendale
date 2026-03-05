'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, MapPin, Calendar, Clock, TrendingUp, TrendingDown,
  CheckCircle, Star, BarChart2, AlertCircle, ChevronLeft, ChevronRight,
  Loader2, Minus, Sun, Cloud,
} from 'lucide-react';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, parseISO, subMonths, getDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';

const COLORS = ['#005CA9','#0EA5E9','#8B5CF6','#10B981','#F59E0B','#EF4444'];

export default function OperatoreDashboard() {
  const params   = useParams();
  const router   = useRouter();
  const personaId = params.id as string;

  const [persona, setPersona]         = useState<Persona | null>(null);
  const [persone, setPersone]         = useState<Persona[]>([]);
  const [sedi, setSedi]               = useState<Sede[]>([]);
  const [personaSede, setPersonaSede] = useState<PersonaSede[]>([]);
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [calMonth, setCalMonth]       = useState<Date>(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, sRes, psRes, aRes] = await Promise.all([
          fetch('/api/persone'), fetch('/api/sedi'),
          fetch('/api/persona-sede'), fetch('/api/appuntamenti'),
        ]);
        const [pAll, s, ps, a] = await Promise.all([pRes.json(), sRes.json(), psRes.json(), aRes.json()]);
        setPersone(pAll || []); setSedi(s || []); setPersonaSede(ps || []); setAppointments(a || []);
        const found = (pAll || []).find((p: Persona) => p.id === personaId);
        if (!found) { router.push('/operatore'); return; }
        setPersona(found);
      } catch {}
      setLoading(false);
    };
    load();
  }, [personaId]);

  const personaIdx = useMemo(() => persone.findIndex(p => p.id === personaId), [persone, personaId]);
  const color = COLORS[personaIdx % COLORS.length] || '#005CA9';

  const myApts = useMemo(() =>
    appointments.filter(a => a.persona_id === personaId && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'),
    [appointments, personaId]);

  const mySedi = useMemo(() =>
    personaSede.filter(ps => ps.persona_id === personaId)
      .map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[],
    [personaSede, personaId, sedi]);

  const today     = format(new Date(), 'yyyy-MM-dd');
  const tomorrow  = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const monthStr  = format(new Date(), 'yyyy-MM');
  const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  const todayApts     = myApts.filter(a => a.data === today).sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio));
  const tomorrowApts  = myApts.filter(a => a.data === tomorrow).sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio));
  const thisMonthApts = myApts.filter(a => a.data.startsWith(monthStr));
  const prevMonthApts = myApts.filter(a => a.data.startsWith(prevMonth));
  const monthDelta    = thisMonthApts.length - prevMonthApts.length;

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedApts = myApts.filter(a => a.data === selectedDayStr).sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio));

  // Prossimi appuntamenti futuri
  const nextApts = myApts.filter(a => a.data > today)
    .sort((a,b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio))
    .slice(0, 12);

  // Statistiche per sede
  const sedeStats = mySedi.map(s => ({
    sede: s,
    count: myApts.filter(a => a.sede_id === s.id).length,
    thisMonth: myApts.filter(a => a.sede_id === s.id && a.data.startsWith(monthStr)).length,
  }));

  // Giorno della settimana più occupato (storico)
  const weekdayCounts = [0,1,2,3,4,5,6].map(d => ({
    day: d,
    label: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][d],
    count: myApts.filter(a => {
      try { return getDay(parseISO(a.data)) === d; } catch { return false; }
    }).length,
  }));
  const busiestDay = weekdayCounts.reduce((a,b) => b.count > a.count ? b : a, weekdayCounts[0]);
  const maxWDCount = Math.max(...weekdayCounts.map(w => w.count), 1);

  // Calendario mensile
  const monthStart = startOfMonth(calMonth);
  const monthEnd   = endOfMonth(calMonth);
  const calDays    = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
  const calWeeks: Date[][] = [];
  for (let i = 0; i < calDays.length; i += 7) calWeeks.push(calDays.slice(i, i + 7));

  const getDayCount = (d: Date) => myApts.filter(a => a.data === format(d, 'yyyy-MM-dd')).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA]">
      <Loader2 size={36} className="animate-spin text-[#005CA9]" />
    </div>
  );

  if (!persona) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA]">
      {/* TOP HERO */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}f0 0%, ${color}99 100%)` }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-8">
          <button onClick={() => router.push('/operatore')}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold mb-6 transition-colors">
            <ArrowLeft size={16} /> Cambia operatore
          </button>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur border-2 border-white/40 flex items-center justify-center shadow-xl">
              <User size={40} className="text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Area Operatore</p>
              <h1 className="text-4xl font-black text-white leading-tight">{persona.nome}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {mySedi.map(s => (
                  <span key={s.id} className="flex items-center gap-1 text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">
                    <MapPin size={10} />{s.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            {[
              { label: 'Oggi', value: todayApts.length, icon: <Sun size={16}/>, sub: todayApts.length === 0 ? 'Giornata libera 🎉' : `${todayApts.length} cliente${todayApts.length>1?'i':''}` },
              { label: 'Domani', value: tomorrowApts.length, icon: <Cloud size={16}/>, sub: tomorrowApts.length === 0 ? 'Nessun appuntamento' : `${tomorrowApts.length} cliente${tomorrowApts.length>1?'i':''}` },
              { label: 'Questo mese', value: thisMonthApts.length, icon: <Calendar size={16}/>, sub: monthDelta > 0 ? `+${monthDelta} vs mese scorso` : monthDelta < 0 ? `${monthDelta} vs mese scorso` : 'Come mese scorso' },
              { label: 'Totale storico', value: myApts.length, icon: <BarChart2 size={16}/>, sub: `su ${mySedi.length} sed${mySedi.length===1?'e':'i'}` },
            ].map(k => (
              <div key={k.label} className="bg-white/15 backdrop-blur rounded-2xl px-4 py-3 border border-white/20">
                <div className="flex items-center gap-2 text-white/70 mb-1">{k.icon}<span className="text-xs font-semibold uppercase tracking-wide">{k.label}</span></div>
                <p className="text-3xl font-black text-white">{k.value}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COL SINISTRA: Calendario + agenda giorno */}
        <div className="lg:col-span-2 space-y-6">

          {/* Calendario mensile */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900 text-lg">📅 Calendario</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalMonth(m => subMonths(m,1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft size={16} className="text-gray-500"/></button>
                <span className="text-sm font-bold text-gray-700 capitalize w-32 text-center">{format(calMonth,'MMMM yyyy',{locale:it})}</span>
                <button onClick={() => setCalMonth(m => addDays(endOfMonth(m),1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight size={16} className="text-gray-500"/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['L','M','M','G','V','S','D'].map((d,i) => (
                <div key={i} className="text-center text-[11px] font-bold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {calWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const cnt = getDayCount(day);
                  const isThisMonth = day.getMonth() === calMonth.getMonth();
                  const isTod = format(day,'yyyy-MM-dd') === today;
                  const isSel = isSameDay(day, selectedDay);
                  return (
                    <button key={di}
                      onClick={() => { setSelectedDay(day); setCalMonth(day); }}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl m-0.5 transition-all text-xs font-bold
                        ${ !isThisMonth ? 'opacity-20 cursor-default' : 'cursor-pointer hover:bg-gray-100' }
                        ${ isSel ? 'ring-2 ring-offset-1 text-white' : '' }
                        ${ isTod && !isSel ? 'border-2 border-[#005CA9] text-[#005CA9]' : '' }
                        ${ !isTod && !isSel ? 'text-gray-700' : '' }
                      `}
                      style={isSel ? { backgroundColor: color, ringColor: color } : {}}
                    >
                      {format(day, 'd')}
                      {cnt > 0 && (
                        <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${ isSel ? 'bg-white' : '' }`}
                          style={!isSel ? { backgroundColor: color } : {}} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Appuntamenti giorno selezionato */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <h2 className="font-black text-gray-900 text-lg mb-1">
              🗓 {format(selectedDay, 'EEEE dd MMMM yyyy', { locale: it })}
            </h2>
            <p className="text-xs text-gray-400 mb-4">{selectedApts.length} appuntament{selectedApts.length===1?'o':'i'}</p>
            {selectedApts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nessun appuntamento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedApts.map(apt => {
                  const sede = sedi.find(s => s.id === apt.sede_id);
                  return (
                    <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all">
                      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{apt.cliente || '—'}</p>
                        <p className="text-xs text-gray-400">{apt.ora_inizio.substring(0,5)} – {apt.ora_fine.substring(0,5)}{sede ? ` · ${sede.nome}` : ''}</p>
                        {apt.note && <p className="text-xs text-gray-400 italic truncate mt-0.5">{apt.note}</p>}
                      </div>
                      <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{apt.ora_inizio.substring(0,5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prossimi appuntamenti */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <h2 className="font-black text-gray-900 text-lg mb-4">⏭ Prossimi appuntamenti</h2>
            {nextApts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nessun appuntamento futuro</p>
            ) : (
              <div className="space-y-2">
                {nextApts.map(apt => {
                  const sede = sedi.find(s => s.id === apt.sede_id);
                  const dateLabel = format(parseISO(apt.data), 'EEE dd/MM', { locale: it });
                  return (
                    <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all">
                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{apt.cliente || '—'}</p>
                        <p className="text-xs text-gray-400">{apt.ora_inizio.substring(0,5)} – {apt.ora_fine.substring(0,5)}{sede ? ` · ${sede.nome}` : ''}</p>
                      </div>
                      <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">{dateLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COL DESTRA: Stats + sedi + pattern settimanale */}
        <div className="space-y-6">

          {/* Avvisi */}
          <div className="bg-white rounded-2xl shadow-md p-5 space-y-3">
            <h2 className="font-black text-gray-900 text-base mb-2">🔔 Avvisi</h2>
            <AlertRow
              color={todayApts.length === 0 ? '#10B981' : color}
              icon={todayApts.length === 0 ? '🎉' : '📋'}
              text={todayApts.length === 0 ? 'Nessun appuntamento oggi' : `Hai ${todayApts.length} appuntament${todayApts.length>1?'i':'o'} oggi`}
            />
            <AlertRow color={color} icon="📆" text={`Domani: ${tomorrowApts.length} appuntament${tomorrowApts.length===1?'o':'i'}`} />
            {monthDelta !== 0 && (
              <AlertRow
                color={monthDelta > 0 ? '#10B981' : '#EF4444'}
                icon={monthDelta > 0 ? '📈' : '📉'}
                text={`${Math.abs(monthDelta)} appuntament${Math.abs(monthDelta)===1?'o':'i'} ${monthDelta>0?'in più':'in meno'} rispetto al mese scorso`}
              />
            )}
            <AlertRow color={color} icon="🏆" text={`Giorno più impegnato: ${busiestDay.label} (${busiestDay.count} app.)`} />
          </div>

          {/* Statistiche mese */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <h2 className="font-black text-gray-900 text-base mb-3">📊 Statistiche</h2>
            <div className="space-y-3">
              <StatRow label="Questo mese" value={thisMonthApts.length} prev={prevMonthApts.length} color={color} />
              <StatRow label="Mese scorso" value={prevMonthApts.length} color="#9CA3AF" />
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Totale storico</p>
                <p className="text-2xl font-black" style={{ color }}>{myApts.length}</p>
              </div>
              {thisMonthApts.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Media giornaliera (mese)</p>
                  <p className="text-xl font-black text-gray-700">{(thisMonthApts.length / new Date().getDate()).toFixed(1)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Distribuzione per sede */}
          {sedeStats.length > 0 && (
            <div className="bg-white rounded-2xl shadow-md p-5">
              <h2 className="font-black text-gray-900 text-base mb-3">🏢 Per sede</h2>
              <div className="space-y-3">
                {sedeStats.sort((a,b) => b.count - a.count).map((ss, idx) => {
                  const pct = myApts.length > 0 ? Math.round((ss.count / myApts.length) * 100) : 0;
                  return (
                    <div key={ss.sede.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-700 truncate">{ss.sede.nome}</span>
                        <span className="text-xs text-gray-400">{ss.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{ss.thisMonth} questo mese</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pattern settimanale */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <h2 className="font-black text-gray-900 text-base mb-3">📆 Pattern settimanale</h2>
            <p className="text-[11px] text-gray-400 mb-3">Distribuzione storica per giorno</p>
            <div className="space-y-1.5">
              {weekdayCounts.filter(w => w.day >= 1 && w.day <= 6).map(w => (
                <div key={w.day} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-500 w-6">{w.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${(w.count/maxWDCount)*100}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-[11px] text-gray-400 w-5 text-right">{w.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ color, icon, text }: { color: string; icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: `${color}10` }}>
      <span className="text-lg">{icon}</span>
      <p className="text-xs font-semibold text-gray-700 leading-tight">{text}</p>
    </div>
  );
}

function StatRow({ label, value, prev, color }: { label: string; value: number; prev?: number; color: string }) {
  const delta = prev !== undefined ? value - prev : null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        {delta !== null && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${ delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400' }`}>
            {delta > 0 ? <TrendingUp size={10}/> : delta < 0 ? <TrendingDown size={10}/> : <Minus size={10}/>}
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
        <span className="text-sm font-black" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}
