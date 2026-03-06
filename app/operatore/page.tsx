'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, ChevronRight, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Persona, Sede, PersonaSede, Appuntamento } from '@/lib/types';
import { format } from 'date-fns';

const ACCENT_COLORS = [
  '#005CA9', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626',
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
        const [pR, sR, psR, aR] = await Promise.all([
          fetch('/api/persone'), fetch('/api/sedi'),
          fetch('/api/persona-sede'), fetch('/api/appuntamenti'),
        ]);
        const [p, s, ps, a] = await Promise.all([pR.json(), sR.json(), psR.json(), aR.json()]);
        setPersone(p || []); setSedi(s || []);
        setPersonaSede(ps || []); setAppointments(a || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const getSedi = (pid: string) =>
    personaSede.filter(ps => ps.persona_id === pid)
      .map(ps => sedi.find(s => s.id === ps.sede_id)).filter(Boolean) as Sede[];
  const getTodayCnt = (pid: string) =>
    appointments.filter(a =>
      a.persona_id === pid && a.data === today &&
      (a.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO'
    ).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-xs font-medium mb-12 transition-colors"
        >
          <ArrowLeft size={13} />
          Torna alle agende
        </Link>

        {/* Titolo */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Area Operatore</h1>
          <p className="text-gray-400 text-sm mt-1">Seleziona il tuo profilo per accedere alla tua agenda</p>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="space-y-2">
            {persone.map((p, idx) => {
              const color   = ACCENT_COLORS[idx % ACCENT_COLORS.length];
              const mySedi  = getSedi(p.id);
              const cnt     = getTodayCnt(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/operatore/${p.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group text-left"
                >
                  {/* Iniziale */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {p.nome.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      {mySedi.map(s => (
                        <span key={s.id} className="flex items-center gap-0.5">
                          <MapPin size={9} />{s.nome}
                        </span>
                      ))}
                    </p>
                  </div>

                  {/* Badge oggi */}
                  {cnt > 0 && (
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${color}12`, color }}
                    >
                      {cnt} oggi
                    </span>
                  )}

                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
