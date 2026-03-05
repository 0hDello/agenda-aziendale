'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  X,
  ChevronRight,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  MapPin,
  Star,
  BarChart2,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { format, addDays, isToday, isTomorrow, parseISO } from 'date-fns';
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
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const todayApts = myApts.filter(a => a.data === today && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO').sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));
    const tomorrowApts = myApts.filter(a => a.data === tomorrow && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO').sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));
    const weekApts = myApts.filter(a => {
      const d = a.data;
      const end = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      return d >= today && d <= end && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO';
    });

    const colorIdx = persone.findIndex(p => p.id === selectedPersona.id) % COLORS.length;
    const color = COLORS[colorIdx];

    // Prossimi appuntamenti (prossimi 7 gg, escluso oggi)
    const nextDays = myApts
      .filter(a => a.data > today && a.data <= format(addDays(new Date(), 7), 'yyyy-MM-dd') && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO')
      .sort((a, b) => a.data.localeCompare(b.data) || a.ora_inizio.localeCompare(b.ora_inizio))
      .slice(0, 8);

    return (
      <div className="flex flex-col h-full">
        {/* Header operatore */}
        <div className="relative overflow-hidden rounded-2xl mb-5 p-5" style={{ background: `linear-gradient(135deg, ${color}ee, ${color}99)` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/40">
              <User size={28} className="text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Operatore</p>
              <h2 className="text-white text-xl font-bold leading-tight">{selectedPersona.nome}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                {mySedi.map(s => (
                  <span key={s.id} className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <MapPin size={8} />{s.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: <Calendar size={16} />, label: 'Oggi', value: todayApts.length, color: 'bg-blue-50 text-blue-600 border-blue-100' },
            { icon: <Clock size={16} />, label: 'Domani', value: tomorrowApts.length, color: 'bg-purple-50 text-purple-600 border-purple-100' },
            { icon: <TrendingUp size={16} />, label: '7 giorni', value: weekApts.length, color: 'bg-green-50 text-green-600 border-green-100' },
          ].map(k => (
            <div key={k.label} className={`rounded-xl p-3 border ${k.color} flex flex-col items-center gap-1`}>
              {k.icon}
              <span className="text-2xl font-black">{k.value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{k.label}</span>
            </div>
          ))}
        </div>

        {/* Appuntamenti oggi */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-blue-500" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Oggi</span>
            <span className="ml-auto text-[10px] text-gray-400">{format(new Date(), 'EEEE dd MMM', { locale: it })}</span>
          </div>
          {todayApts.length === 0 ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-400">Nessun appuntamento oggi 🎉</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {todayApts.map(apt => (
                <AptRow key={apt.id} apt={apt} sedi={sedi} color={color} />
              ))}
            </div>
          )}
        </div>

        {/* Prossimi appuntamenti */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Star size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Prossimi 7 giorni</span>
          </div>
          {nextDays.length === 0 ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-400">Nessun appuntamento nei prossimi 7 giorni</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {nextDays.map(apt => (
                <AptRow key={apt.id} apt={apt} sedi={sedi} color={color} showDate />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── SCELTA OPERATORE ─────────────────────────────────────────────────────
  const renderChoose = () => (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500 text-center mb-2">Seleziona il tuo nome per vedere la tua agenda personale</p>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#005CA9]" /></div>
      ) : persone.length === 0 ? (
        <p className="text-center text-sm text-gray-400">Nessun operatore disponibile</p>
      ) : (
        persone.map((p, idx) => {
          const mySedi = getSediForPersona(p.id);
          const color = COLORS[idx % COLORS.length];
          const todayCnt = appointments.filter(a => a.persona_id === p.id && a.data === format(new Date(), 'yyyy-MM-dd') && (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO').length;
          return (
            <button
              key={p.id}
              onClick={() => handleSelectPersona(p)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-transparent bg-gray-50 hover:border-[#005CA9] hover:bg-blue-50 transition-all group"
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                <User size={22} style={{ color }} />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-gray-800 text-sm">{p.nome}</p>
                <p className="text-xs text-gray-400 mt-0.5">{mySedi.map(s => s.nome).join(' · ') || 'Nessuna sede'}</p>
              </div>
              {todayCnt > 0 && (
                <span className="text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{todayCnt} oggi</span>
              )}
              <ChevronRight size={16} className="text-gray-300 group-hover:text-[#005CA9] transition-colors" />
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header drawer */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === 'dashboard' && (
              <button
                onClick={() => setStep('choose')}
                className="mr-1 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} className="text-gray-500" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-[#005CA9] flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm leading-tight">
                {step === 'choose' ? 'Chi sei?' : 'La tua agenda'}
              </h2>
              {step === 'choose' && <p className="text-[10px] text-gray-400">Seleziona operatore</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'choose' ? renderChoose() : renderDashboard()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            Vista personale sola lettura · dati aggiornati in tempo reale
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Componente riga appuntamento ─────────────────────────────────────────────
function AptRow({ apt, sedi, color, showDate }: { apt: Appuntamento; sedi: Sede[]; color: string; showDate?: boolean }) {
  const sede = sedi.find(s => s.id === apt.sede_id);
  const label = apt.ora_inizio.substring(0, 5) + ' - ' + apt.ora_fine.substring(0, 5);
  const dateLabel = showDate ? format(parseISO(apt.data), 'EEE dd/MM', { locale: it }) : null;
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white border border-gray-100 hover:border-gray-200 transition-all">
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-800 truncate">{apt.cliente || '—'}</p>
        <p className="text-[10px] text-gray-400">{label}{sede ? ` · ${sede.nome}` : ''}</p>
      </div>
      {dateLabel && (
        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">{dateLabel}</span>
      )}
    </div>
  );
}
