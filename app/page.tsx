'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Settings, Plus, Users, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Agenda {
  id: string;
  nome: string;
  descrizione?: string;
  colore?: string;
  icona?: string;
  created_at: string;
}

export default function HomePage() {
  const router = useRouter();
  const [agende, setAgende] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsOperatori, setStatsOperatori] = useState(0);
  const [statsSedi, setStatsSedi] = useState(0);

  useEffect(() => {
    loadAgende();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { count: personeCount } = await supabase
        .from('persone')
        .select('*', { count: 'exact', head: true });
      
      const { count: sediCount } = await supabase
        .from('sedi')
        .select('*', { count: 'exact', head: true });

      setStatsOperatori(personeCount || 0);
      setStatsSedi(sediCount || 0);
    } catch (error) {
      console.error('Errore caricamento statistiche:', error);
    }
  };

  const loadAgende = async () => {
    try {
      const staticAgende: Agenda[] = [
        {
          id: '730',
          nome: 'Agenda 730',
          descrizione: 'Gestione appuntamenti',
          colore: '#005CA9',
          icona: 'calendar',
          created_at: new Date().toISOString()
        }
      ];
      
      setAgende(staticAgende);
      setLoading(false);
    } catch (error) {
      console.error('Errore caricamento agende:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - SENZA pulsante Impostazioni */}
        <div className="mb-12">
          <div className="flex items-center gap-4">
            <div className="bg-[#005CA9] p-4 rounded-2xl shadow-lg">
              <CalendarIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[#005CA9]">Agende CNA</h1>
              <p className="text-gray-600 mt-1">Seleziona un'agenda per iniziare</p>
            </div>
          </div>
        </div>

        {/* Statistiche rapide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-[#005CA9]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Agende Attive</p>
                <p className="text-3xl font-bold text-[#005CA9] mt-2">{agende.length}</p>
              </div>
              <div className="bg-[#E6F2FF] p-3 rounded-xl">
                <CalendarIcon className="w-8 h-8 text-[#005CA9]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-[#005CA9]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Operatori</p>
                <p className="text-3xl font-bold text-[#005CA9] mt-2">{statsOperatori}</p>
              </div>
              <div className="bg-[#E6F2FF] p-3 rounded-xl">
                <Users className="w-8 h-8 text-[#005CA9]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-[#005CA9]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Sedi</p>
                <p className="text-3xl font-bold text-[#005CA9] mt-2">{statsSedi}</p>
              </div>
              <div className="bg-[#E6F2FF] p-3 rounded-xl">
                <Building2 className="w-8 h-8 text-[#005CA9]" />
              </div>
            </div>
          </div>
        </div>

        {/* Griglia Agende */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Le tue Agende</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#005CA9] text-white rounded-xl hover:bg-[#004080] transition-all shadow-md hover:shadow-lg font-medium">
              <Plus size={20} />
              Nuova Agenda
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agende.map((agenda) => (
              <div
                key={agenda.id}
                onClick={() => router.push(`/agenda/${agenda.id}`)}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-[#005CA9] group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="p-4 rounded-xl transition-all group-hover:scale-110"
                    style={{ backgroundColor: `${agenda.colore}20` }}
                  >
                    <CalendarIcon 
                      className="w-8 h-8 transition-all" 
                      style={{ color: agenda.colore }}
                    />
                  </div>
                  <div className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                    Attiva
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">{agenda.nome}</h3>
                <p className="text-gray-600 text-sm mb-4">{agenda.descrizione || 'Nessuna descrizione'}</p>

                {/* NUOVA SEZIONE: Rotellina impostazioni in basso a sinistra, SENZA data */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      router.push('/impostazioni');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 rounded-full p-2.5 transition-all hover:scale-110"
                    title="Impostazioni agenda"
                  >
                    <Settings size={18} className="text-[#005CA9]" />
                  </button>
                  <div className="text-[#005CA9] group-hover:translate-x-2 transition-transform text-xl">
                    →
                  </div>
                </div>
              </div>
            ))}

            {/* Card per creare nuova agenda */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border-2 border-dashed border-gray-300 hover:border-[#005CA9] transition-all cursor-pointer flex flex-col items-center justify-center min-h-[240px] group">
              <div className="bg-white p-4 rounded-xl shadow-md group-hover:shadow-lg transition-all mb-4">
                <Plus className="w-8 h-8 text-gray-400 group-hover:text-[#005CA9] transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-gray-600 group-hover:text-[#005CA9] transition-colors">
                Crea Nuova Agenda
              </h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                Aggiungi un'agenda per organizzare i tuoi appuntamenti
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
