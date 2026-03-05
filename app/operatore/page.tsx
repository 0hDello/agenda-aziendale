'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, ChevronRight, MapPin, Loader2, ArrowLeft, Zap } from 'lucide-react';
import Link from 'next/link';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';
import { format } from 'date-fns';

const PALETTE = [
  { base: '#005CA9', dark: '#003d73' },
  { base: '#0EA5E9', dark: '#0369a1' },
  { base: '#8B5CF6', dark: '#6d28d9' },
  { base: '#10B981', dark: '#047857' },
  { base: '#F59E0B', dark: '#b45309' },
  { base: '#EF4444', dark: '#b91c1c' },
];

export default function OperatoreSelezionePage() {
  const router = useRouter();
  const [persone, setPersone]           = useState<Persona[]>([]);
  const [sedi, setSedi]                 = useState<Sede[]>([]);
  const [personaSede, setPersonaSede]   = useState<PersonaSede[]>([]);
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pR,sR,psR,aR] = await Promise.all([fetch('/api/persone'),fetch('/api/sedi'),fetch('/api/persona-sede'),fetch('/api/appuntamenti')]);
        const [p,s,ps,a] = await Promise.all([pR.json(),sR.json(),psR.json(),aR.json()]);
        setPersone(p||[]); setSedi(s||[]); setPersonaSede(ps||[]); setAppointments(a||[]);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const getSedi = (pid: string) => personaSede.filter(ps => ps.persona_id === pid).map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[];
  const getTodayCnt = (pid: string) => appointments.filter(a => a.persona_id === pid && a.data === today && (a.cliente??'').trim().toUpperCase() !== 'UFF CHIUSO').length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="w-full max-w-sm">

        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-semibold mb-10 transition-colors group">
          <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
          Torna alle agende
        </Link>

        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-2xl" style={{ background: 'linear-gradient(135deg, #005CA9, #003d73)' }}>
            <User size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">Chi sei?</h1>
          <p className="text-slate-500 text-sm mt-2 text-center">Seleziona il tuo nome per accedere alla tua area personale</p>
        </div>

        <div className="space-y-2.5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#005CA9' }} /></div>
          ) : persone.map((p, idx) => {
            const pal = PALETTE[idx % PALETTE.length];
            const mySedi = getSedi(p.id);
            const cnt = getTodayCnt(p.id);
            return (
              <button key={p.id} onClick={() => router.push(`/operatore/${p.id}`)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all group text-left"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.07)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${pal.base}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${pal.base}50`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${pal.base}, ${pal.dark})` }}>
                  <User size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{p.nome}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                    <MapPin size={9} />{mySedi.map(s => s.nome).join(' · ') || 'Nessuna sede'}
                  </p>
                </div>
                {cnt > 0 && (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
                    style={{ background: `${pal.base}30`, color: pal.base === '#005CA9' ? '#93c5fd' : pal.base }}>
                    <Zap size={9}/>{cnt} oggi
                  </span>
                )}
                <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-300 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
