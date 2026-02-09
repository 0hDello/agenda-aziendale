'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalendarIcon, Settings } from 'lucide-react';

interface Agenda {
  id: string;
  nome: string;
  descrizione?: string;
  colore?: string;
  icona?: string;
  created_at?: string;
  active: boolean; //: da "attiva" a "active"
}

export default function HomePage() {
  const router = useRouter();
  const [agende, setAgende] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgende();
  }, []);

  const loadAgende = async () => {
    try {
      const response = await fetch('/api/agende');
      if (!response.ok) throw new Error('Errore caricamento agende');
      
      const data = await response.json();
      setAgende(data);
    } catch (error) {
      console.error('Errore caricamento agende:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgendaClick = (agenda: Agenda) => {
    if (agenda.active) { //: da "attiva" a "active"
      router.push(`/agenda/${agenda.id}`);
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
        {/* Header */}
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

        {/* Griglia Agende */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Le tue Agende</h2>
          </div>

          {agende.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nessuna agenda disponibile</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agende.map((agenda) => (
                <div
                  key={agenda.id}
                  onClick={() => handleAgendaClick(agenda)}
                  className={`rounded-2xl p-6 shadow-lg transition-all duration-300 border-2 border-transparent ${
                    agenda.active   
                      ? 'bg-white hover:shadow-2xl cursor-pointer hover:border-[#005CA9] group'
                      : 'bg-gray-100 cursor-not-allowed opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className={`p-4 rounded-xl transition-all ${
                        agenda.active ? 'group-hover:scale-110' : ''   
                      }`}
                      style={{ backgroundColor: `${agenda.colore || '#005CA9'}20` }}
                    >
                      <CalendarIcon 
                        className="w-8 h-8 transition-all" 
                        style={{ color: agenda.active ? (agenda.colore || '#005CA9') : '#9CA3AF' }} //  
                      />
                    </div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                      agenda.active   
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {agenda.active ? 'Attiva' : 'Disattivata'} {/*   */}
                    </div>
                  </div>

                  <h3 className={`text-xl font-bold mb-2 ${
                    agenda.active ? 'text-gray-800' : 'text-gray-500' //  
                  }`}>
                    {agenda.nome}
                  </h3>
                  <p className={`text-sm mb-4 ${
                    agenda.active ? 'text-gray-600' : 'text-gray-400' //  
                  }`}>
                    {agenda.descrizione || 'Nessuna descrizione'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    {agenda.id === '730' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          router.push('/impostazioni');
                        }}
                        className="bg-gray-200 hover:bg-gray-300 rounded-full p-2.5 transition-all hover:scale-110"
                        title="Impostazioni agenda"
                      >
                        <Settings size={18} className="text-[#005CA9]" />
                      </button>
                    )}
                    {agenda.id !== '730' && <div></div>}

                    {agenda.active && ( //  
                      <div className="text-[#005CA9] group-hover:translate-x-2 transition-transform text-xl">
                        →
                      </div>
                    )}
                    {!agenda.active && ( //  
                      <div className="text-gray-400 text-xl">
                        →
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
