'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, ChevronRight, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';
import { format } from 'date-fns';

const COLORS = ['#005CA9','#0EA5E9','#8B5CF6','#10B981','#F59E0B','#EF4444'];

export default function OperatoreSelezionePage() {
  const router = useRouter();
  const [persone, setPersone]         = useState<Persona[]>([]);
  const [sedi, setSedi]               = useState<Sede[]>([]);
  const [personaSede, setPersonaSede] = useState<PersonaSede[]>([]);
  const [appointments, setAppointments] = useState<Appuntamento[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, sRes, psRes, aRes] = await Promise.all([
          fetch('/api/persone'), fetch('/api/sedi'),
          fetch('/api/persona-sede'), fetch('/api/appuntamenti'),
        ]);
        const [p, s, ps, a] = await Promise.all([pRes.json(), sRes.json(), psRes.json(), aRes.json()]);
        setPersone(p || []); setSedi(s || []); setPersonaSede(ps || []); setAppointments(a || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');

  const getSediForPersona = (pid: string) =>
    personaSede.filter(ps => ps.persona_id === pid)
      .map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[];

  const getTodayCount = (pid: string) =>
    appointments.filter(a => a.persona_id === pid && a.data === today &&
      (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back */}
        <Link href="/" className="flex items-center gap-2 text-[#005CA9] text-sm font-semibold mb-8 hover:opacity-70 transition-opacity">
          <ArrowLeft size={16} /> Torna alle agende
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-[#005CA9] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <User size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">Chi sei?</h1>
          <p className="text-gray-500 mt-2 text-sm">Seleziona il tuo nome per accedere alla tua area personale</p>
        </div>

        {/* Lista operatori */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-[#005CA9]" /></div>
          ) : persone.map((p, idx) => {
            const color = COLORS[idx % COLORS.length];
            const mySedi = getSediForPersona(p.id);
            const todayCnt = getTodayCount(p.id);
            return (
              <button key={p.id} onClick={() => router.push(`/operatore/${p.id}`)}
                className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white shadow-md hover:shadow-xl border-2 border-transparent hover:border-[#005CA9] transition-all group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <User size={24} style={{ color }} />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900 text-base">{p.nome}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-gray-400" />
                    <p className="text-xs text-gray-400">{mySedi.map(s => s.nome).join(' · ') || 'Nessuna sede'}</p>
                  </div>
                </div>
                {todayCnt > 0 && (
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 rounded-full px-3 py-1">{todayCnt} oggi</span>
                )}
                <ChevronRight size={18} className="text-gray-300 group-hover:text-[#005CA9] transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
