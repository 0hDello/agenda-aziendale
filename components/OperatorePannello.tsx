'use client';

import { useState, useEffect } from 'react';
import {
  User,
  X,
  ChevronRight,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  MapPin,
  Star,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Persona, Appuntamento, Sede, PersonaSede } from '@/lib/types';

interface OperatorePannelloProps {
  onClose: () => void;
}

type Step = 'choose' | 'dashboard';

const COLORS = [
  '#005CA9', '#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
];

export default function OperatorePannello({ onClose }: OperatorePannelloProps) {
  const [step, setStep] = useState<Step>('choose');
  const [persone, setPersone]               = useState<Persona[]>([]);
  const [sedi, setSedi]                     = useState<Sede[]>([]);
  const [personaSede, setPersonaSede]       = useState<PersonaSede[]>([]);
  const [appointments, setAppointments]     = useState<Appuntamento[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, sRes, psRes, aRes] = await Promise.all([
          fetch('/api/persone'),
          fetch('/api/sedi'),
          fetch('/api/persona-sede'),
          fetch('/api/appuntamenti'),
        ]);
        const [pData, sData, psData, aData] = await Promise.all([
          pRes.json(), sRes.json(), psRes.json(), aRes.json(),
        ]);
        if (pData)  setPersone(pData);
        if (sData)  setSedi(sData);
        if (psData) setPersonaSede(psData);
        if (aData)  setAppointments(aData);
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const getSediForPersona = (personaId: string) =>
    personaSede
      .filter(ps => ps.persona_id === personaId)
      .map(ps => sedi.find(s => s.id === ps.sede_id))
      .filter(Boolean) as Sede[];

  const getAppuntamentiPersona = (personaId: string) =>
    appointments.filter(a => a.persona_id === personaId);

  const handleSelectPersona = (p: Persona) => {
    setSelectedPersona(p);
    setStep('dashboard');
  };

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    if (!selectedPersona) return null;
    const myApts = getAppuntamentiPersona(selectedPersona.id);
    const mySedi = getSediForPersona(selectedPersona.id);
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayApts = myApts
      .filter(a => a.data === today && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO')
      .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));
    const tomorrowApts = myApts
      .filter(a => a.data === format(addDays(new Date(), 1), 'yyyy-MM-dd') && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO');
    const weekApts = myApts.filter(a => {
      const end = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      return a.data >= today && a.data <= end && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO';
    });
    const nextDays = myApts
      .filter(a => a.data > today && a.data <= format(addDays(new Date(), 7), 'yyyy-MM-dd') && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO')
      .sort((a, b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio))
      .slice(0, 8);

    // Performance mensile per sede
    const thisMonth = format(new Date(), 'yyyy-MM');
    const monthApts = myApts.filter(a => a.data.startsWith(thisMonth) && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO');
    const totalMonth = monthApts.length;
    const sediPerf = mySedi.map(s => ({
      sede: s,
      count: monthApts.filter(a => a.sede_id === s.id).length,
      pct: totalMonth > 0 ? Math.round((monthApts.filter(a => a.sede_id === s.id).length / totalMonth) * 100) : 0,
    }));

    // Storico totale
    const totalStorico = myApts.filter(a => (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO').length;

    return (
      <div className="flex flex-col h-full gap-5">
        {/* Header banner operatore */}
        <header className="w-full bg-gradient-to-r from-[#176356] to-[#38b2ac] rounded-xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/40">
              <User size={26} className="text-white" />
            </div>
            <div>
              <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest">Operatore</p>
              <h2 className="text-white text-lg font-bold leading-tight">{selectedPersona.nome}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {mySedi.map(s => (
                  <span key={s.id} className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <MapPin size={8} />{s.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* Mini stats */}
          <div className="flex justify-around mt-4 pt-4 border-t border-white/20 text-[11px] font-semibold tracking-wide uppercase">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-white/70">Oggi</span>
              <span className="text-white font-bold text-base">{todayApts.length}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-white/70">Domani</span>
              <span className="text-white font-bold text-base">{tomorrowApts.length}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-white/70">7 giorni</span>
              <span className="text-white font-bold text-base">{weekApts.length}</span>
            </div>
          </div>
        </header>

        {/* Performance Mensile */}
        <section className="bg-[#2D3748] rounded-xl p-5 border border-gray-700/30">
          <h3 className="text-sm font-semibold text-white mb-4">Performance Mensile</h3>
          {sediPerf.length === 0 ? (
            <p className="text-xs text-slate-500 text-center">Nessuna sede associata</p>
          ) : (
            <div className="space-y-4">
              {sediPerf.map(({ sede, count, pct }) => (
                <div key={sede.id}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-white text-xs font-medium">
                      {sede.nome}{' '}
                      <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                    <span className="text-slate-400 text-xs">{count} apt</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: '#38b2ac' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Totale Storico */}
        <section className="bg-[#2D3748] rounded-xl p-5 border border-gray-700/30">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white text-sm font-medium mb-1">Totale Storico</p>
              <p className="text-5xl font-bold text-white">{totalStorico}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-xs mb-1">Questo Mese</p>
              <p className="text-5xl font-semibold text-white">{totalMonth}</p>
            </div>
          </div>
        </section>

        {/* Appuntamenti oggi */}
        <section className="bg-[#2D3748] rounded-xl p-5 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-[#38b2ac]" />
            <span className="text-xs font-bold text-white uppercase tracking-wide">Oggi</span>
            <span className="ml-auto text-[10px] text-slate-500">{format(new Date(), 'EEEE dd MMM', { locale: it })}</span>
          </div>
          {todayApts.length === 0 ? (
            <div className="rounded-xl bg-[#1A202C] border border-gray-700/30 p-3 text-center">
              <p className="text-xs text-slate-500">Nessun appuntamento oggi 🎉</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {todayApts.map(apt => (
                <AptRow key={apt.id} apt={apt} sedi={sedi} />
              ))}
            </div>
          )}
        </section>

        {/* Prossimi 7 giorni */}
        <section className="bg-[#2D3748] rounded-xl p-5 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-3">
            <Star size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wide">Prossimi 7 giorni</span>
          </div>
          {nextDays.length === 0 ? (
            <div className="rounded-xl bg-[#1A202C] border border-gray-700/30 p-3 text-center">
              <p className="text-xs text-slate-500">Nessun appuntamento in arrivo</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {nextDays.map(apt => (
                <AptRow key={apt.id} apt={apt} sedi={sedi} showDate />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  // ─── SCELTA OPERATORE ─────────────────────────────────────────────────────
  const renderChoose = () => (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500 text-center mb-2">Seleziona il tuo nome per vedere la tua agenda personale</p>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[#38b2ac]" />
        </div>
      ) : persone.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Nessun operatore disponibile</p>
      ) : (
        persone.map((p, idx) => {
          const mySedi = getSediForPersona(p.id);
          const color = COLORS[idx % COLORS.length];
          const todayCnt = appointments.filter(
            a => a.persona_id === p.id &&
              a.data === format(new Date(), 'yyyy-MM-dd') &&
              (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
          ).length;
          return (
            <button
              key={p.id}
              onClick={() => handleSelectPersona(p)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-700/40 bg-[#2D3748] hover:border-[#38b2ac] hover:bg-[#38b2ac]/10 transition-all group"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}25` }}>
                <User size={20} style={{ color }} />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-white text-sm">{p.nome}</p>
                <p className="text-xs text-slate-500 mt-0.5">{mySedi.map(s => s.nome).join(' · ') || 'Nessuna sede'}</p>
              </div>
              {todayCnt > 0 && (
                <span className="text-[11px] font-bold bg-[#38b2ac]/20 text-[#38b2ac] rounded-full px-2 py-0.5">{todayCnt} oggi</span>
              )}
              <ChevronRight size={16} className="text-slate-600 group-hover:text-[#38b2ac] transition-colors" />
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer dark */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-[#1A202C] z-50 shadow-2xl flex flex-col animate-slide-in-right border-l border-gray-800/50">
        {/* Header drawer */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-800/50">
          <div className="flex items-center gap-2">
            {step === 'dashboard' && (
              <button
                onClick={() => setStep('choose')}
                className="mr-1 p-1.5 rounded-lg hover:bg-[#2D3748] transition-colors"
              >
                <ChevronLeft size={16} className="text-slate-400" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-[#38b2ac] flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm leading-tight">
                {step === 'choose' ? 'Chi sei?' : 'La tua agenda'}
              </h2>
              {step === 'choose' && <p className="text-[10px] text-slate-500">Seleziona operatore</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#2D3748] transition-colors"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'choose' ? renderChoose() : renderDashboard()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800/50">
          <p className="text-[10px] text-slate-600 text-center">
            Vista personale sola lettura · dati aggiornati in tempo reale
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Componente riga appuntamento ─────────────────────────────────────────────
function AptRow({ apt, sedi, showDate }: { apt: Appuntamento; sedi: Sede[]; showDate?: boolean }) {
  const sede = sedi.find(s => s.id === apt.sede_id);
  const label = apt.ora_inizio.substring(0, 5) + ' - ' + apt.ora_fine.substring(0, 5);
  const dateLabel = showDate ? format(parseISO(apt.data), 'EEE dd/MM', { locale: it }) : null;
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[#1A202C] border border-gray-700/40 hover:border-[#38b2ac]/40 transition-all">
      <div className="w-1 h-8 rounded-full flex-shrink-0 bg-[#38b2ac]" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{apt.cliente || '—'}</p>
        <p className="text-[10px] text-slate-500">{label}{sede ? ` · ${sede.nome}` : ''}</p>
      </div>
      {dateLabel && (
        <span className="text-[10px] font-semibold text-slate-400 bg-[#2D3748] rounded-full px-2 py-0.5 flex-shrink-0">{dateLabel}</span>
      )}
    </div>
  );
}
