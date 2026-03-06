'use client';

import { useState, useEffect } from 'react';
import {
  User, X, ChevronRight, ChevronLeft,
  CalendarDays, Clock3, TrendingUp,
  Loader2, MapPin, LogOut,
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Appuntamento, Sede, PersonaSede } from '@/lib/types';

interface Props { onClose: () => void; }
type Step = 'choose' | 'dashboard';

const PERSON_COLORS = ['#005CA9','#7C3AED','#0891B2','#059669','#D97706','#DC2626'];

export default function OperatorePannello({ onClose }: Props) {
  const [step, setStep]                       = useState<Step>('choose');
  const [persone, setPersone]                 = useState<Persona[]>([]);
  const [sedi, setSedi]                       = useState<Sede[]>([]);
  const [personaSede, setPersonaSede]         = useState<PersonaSede[]>([]);
  const [appointments, setAppointments]       = useState<Appuntamento[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pR, sR, psR, aR] = await Promise.all([
          fetch('/api/persone'), fetch('/api/sedi'),
          fetch('/api/persona-sede'), fetch('/api/appuntamenti'),
        ]);
        const [p, s, ps, a] = await Promise.all([pR.json(), sR.json(), psR.json(), aR.json()]);
        if (p)  setPersone(p);
        if (s)  setSedi(s);
        if (ps) setPersonaSede(ps);
        if (a)  setAppointments(a);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const getSedi    = (id: string) => personaSede.filter(ps => ps.persona_id === id).map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[];
  const getApts    = (id: string) => appointments.filter(a => a.persona_id === id);
  const isReal     = (a: Appuntamento) => (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO';
  const todayStr   = format(new Date(), 'yyyy-MM-dd');
  const thisMonth  = format(new Date(), 'yyyy-MM');

  // ── CHOOSE ─────────────────────────────────────────────────────────────────
  const renderChoose = () => (
    <div className="flex flex-col h-full">
      <div className="px-7 pt-8 pb-5">
        <p className="text-[13px] text-gray-400 leading-relaxed">
          Seleziona il tuo profilo per accedere alla tua agenda personale.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 size={22} className="animate-spin text-[#005CA9]" />
          </div>
        ) : persone.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-12">Nessun operatore trovato.</p>
        ) : (
          <div className="space-y-2">
            {persone.map((p, idx) => {
              const color    = PERSON_COLORS[idx % PERSON_COLORS.length];
              const mySedi   = getSedi(p.id);
              const todayCnt = getApts(p.id).filter(a => a.data === todayStr && isReal(a)).length;
              const weekCnt  = getApts(p.id).filter(a => {
                const end = format(addDays(new Date(), 7), 'yyyy-MM-dd');
                return a.data >= todayStr && a.data <= end && isReal(a);
              }).length;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPersona(p); setStep('dashboard'); }}
                  className="w-full text-left rounded-2xl border border-gray-100 bg-white hover:border-[#005CA9]/30 hover:shadow-md transition-all duration-200 group overflow-hidden"
                >
                  <div className="flex items-stretch">
                    {/* Banda colore sinistra */}
                    <div className="w-1.5 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: color }} />
                    <div className="flex items-center gap-4 px-4 py-4 flex-1">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <User size={20} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{p.nome}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {mySedi.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
                              <MapPin size={9} />{s.nome}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {todayCnt > 0 && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
                            {todayCnt} oggi
                          </span>
                        )}
                        {weekCnt > 0 && (
                          <span className="text-[11px] text-gray-400">{weekCnt} questa settimana</span>
                        )}
                      </div>
                      <ChevronRight size={15} className="text-gray-300 group-hover:text-[#005CA9] transition-colors flex-shrink-0" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    if (!selectedPersona) return null;
    const idx      = persone.findIndex(p => p.id === selectedPersona.id);
    const color    = PERSON_COLORS[idx % PERSON_COLORS.length];
    const mySedi   = getSedi(selectedPersona.id);
    const myApts   = getApts(selectedPersona.id).filter(isReal);

    const todayApts   = myApts.filter(a => a.data === todayStr).sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio));
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const weekEnd     = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const weekApts    = myApts.filter(a => a.data >= todayStr && a.data <= weekEnd);
    const monthApts   = myApts.filter(a => a.data.startsWith(thisMonth));
    const totalApts   = myApts.length;

    // Prossimi appuntamenti (da domani, 7 gg)
    const nextApts = myApts
      .filter(a => a.data > todayStr && a.data <= weekEnd)
      .sort((a,b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio))
      .slice(0, 10);

    // Performance sedi
    const sediPerf = mySedi.map(s => ({
      nome: s.nome,
      count: monthApts.filter(a => a.sede_id === s.id).length,
      pct: monthApts.length > 0
        ? Math.round(monthApts.filter(a => a.sede_id === s.id).length / monthApts.length * 100)
        : 0,
    }));

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Hero profilo */}
        <div className="relative px-7 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: `${color}15` }}
            >
              <User size={24} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">La tua agenda</p>
              <h2 className="text-xl font-bold text-gray-900 truncate">{selectedPersona.nome}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {mySedi.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    <MapPin size={9} />{s.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 3 pillole stat */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            {[
              { icon: <CalendarDays size={13} />, label: 'Oggi',      val: todayApts.length,   active: todayApts.length > 0 },
              { icon: <Clock3 size={13} />,       label: '7 giorni',  val: weekApts.length,    active: weekApts.length > 0 },
              { icon: <TrendingUp size={13} />,   label: 'Questo mese', val: monthApts.length, active: monthApts.length > 0 },
            ].map(k => (
              <div
                key={k.label}
                className="rounded-xl px-3 py-3 flex flex-col items-center gap-1 border"
                style={k.active
                  ? { backgroundColor: `${color}08`, borderColor: `${color}30`, color }
                  : { backgroundColor: '#F9FAFB', borderColor: '#F0F0F0', color: '#9CA3AF' }
                }
              >
                {k.icon}
                <span className="text-2xl font-black leading-none">{k.val}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{k.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Corpo scrollabile */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">

          {/* Appuntamenti oggi */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Oggi</h3>
              <span className="text-[11px] text-gray-400">{format(new Date(), 'EEE dd MMM', { locale: it })}</span>
            </div>
            {todayApts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-5 flex items-center justify-center">
                <p className="text-xs text-gray-400">Nessun appuntamento oggi</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {todayApts.map(a => <AptCard key={a.id} apt={a} sedi={sedi} color={color} />)}
              </div>
            )}
          </div>

          {/* Prossimi 7 giorni */}
          {nextApts.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Prossimi 7 giorni</h3>
              <div className="space-y-1.5">
                {nextApts.map(a => <AptCard key={a.id} apt={a} sedi={sedi} color={color} showDate />)}
              </div>
            </div>
          )}

          {/* Performance mensile */}
          {sediPerf.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Performance mensile</h3>
                <span className="text-[11px] text-gray-400 capitalize">{format(new Date(), 'MMMM', { locale: it })}</span>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                {sediPerf.map(s => (
                  <div key={s.nome}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-xs font-semibold text-gray-700">{s.nome}</span>
                      <span className="text-xs text-gray-400">{s.count} apt · {s.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totale storico */}
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Storico totale</p>
                <p className="text-4xl font-black" style={{ color }}>{totalApts}</p>
                <p className="text-[11px] text-gray-400 mt-1">appuntamenti</p>
              </div>
              <div className="p-5 bg-gray-50/60">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Questo mese</p>
                <p className="text-4xl font-black text-gray-800">{monthApts.length}</p>
                <p className="text-[11px] text-gray-400 mt-1">appuntamenti</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[360px] bg-white z-50 shadow-2xl flex flex-col border-l border-gray-100">

        {/* Top bar */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step === 'dashboard' && (
              <button
                onClick={() => setStep('choose')}
                className="-ml-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#005CA9' }}>
              <User size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">
              {step === 'choose' ? 'Area Operatore' : selectedPersona?.nome.split(' ')[0]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-hidden">
          {step === 'choose' ? renderChoose() : renderDashboard()}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-300 text-center tracking-wide">
            Vista personale · sola lettura · aggiornamento in tempo reale
          </p>
        </div>
      </div>
    </>
  );
}

// ── Riga appuntamento ─────────────────────────────────────────────────────────
function AptCard({
  apt, sedi, color, showDate,
}: { apt: Appuntamento; sedi: Sede[]; color: string; showDate?: boolean }) {
  const sede  = sedi.find(s => s.id === apt.sede_id);
  const start = apt.ora_inizio.substring(0, 5);
  const end   = apt.ora_fine.substring(0, 5);
  return (
    <div className="flex items-center gap-3 rounded-xl px-3.5 py-3 bg-white border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Orario */}
      <div className="flex-shrink-0 text-center" style={{ minWidth: 42 }}>
        <p className="text-[11px] font-bold" style={{ color }}>{start}</p>
        <p className="text-[10px] text-gray-400">{end}</p>
      </div>
      {/* Separatore */}
      <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{apt.cliente || '—'}</p>
        {sede && <p className="text-[10px] text-gray-400 truncate">{sede.nome}</p>}
      </div>
      {/* Data (se prossimi) */}
      {showDate && (
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 flex-shrink-0">
          {format(parseISO(apt.data), 'EEE dd/MM', { locale: it })}
        </span>
      )}
    </div>
  );
}
