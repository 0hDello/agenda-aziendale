'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar as CalendarIcon, Settings, Database, FileText, History, User, BarChart2 } from 'lucide-react';
import EpasaSettingsModal from '@/components/epasa/EpasaSettingsModal';
import { EpasaSettings, DEFAULT_EPASA_SETTINGS, Sede } from '@/components/epasa/types';

interface Agenda {
  id: string;
  nome: string;
  descrizione?: string;
  colore?: string;
  active: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [agende, setAgende] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEpasaSettings, setShowEpasaSettings] = useState(false);
  const [epasaSettings, setEpasaSettings] = useState<EpasaSettings>(DEFAULT_EPASA_SETTINGS);
  const [epasaSedi, setEpasaSedi] = useState<Sede[]>([
    { id: 'imola', nome: 'Imola', colore: '#005CA9' },
    { id: 'cspt', nome: 'CSPT', colore: '#005CA9' },
    { id: 'borgo', nome: 'Borgo', colore: '#005CA9' },
  ]);

  useEffect(() => {
    loadAgende();
    try {
      const saved = localStorage.getItem('epasa_settings');
      if (saved) {
        setEpasaSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch {}

    fetch('/api/epasa/sedi')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setEpasaSedi(data);
      })
      .catch(() => {});
  }, []);

  const handleSaveEpasaSettings = (newSettings: EpasaSettings) => {
    setEpasaSettings(newSettings);
    try {
      localStorage.setItem('epasa_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.error(e);
    }
  };

  const loadAgende = async () => {
    try {
      const res = await fetch('/api/agende');
      if (!res.ok) throw new Error();
      setAgende(await res.json());
    } catch {}
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#005CA9] mx-auto" />
        <p className="mt-4 text-gray-600 font-medium">Caricamento...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src="/logo-cna.png" alt="Logo CNA" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[#005CA9]">Agende</h1>
              <p className="text-gray-600 mt-1">Seleziona un&apos;agenda per iniziare</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled
              onClick={() => router.push('/operatore')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-400 rounded-xl shadow-sm cursor-not-allowed opacity-60"
              title="Prossimamente">
              <User className="w-4 h-4" />
              <span className="text-sm font-semibold">Area Operatore</span>
            </button>
            <Link href="/cronologia">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200">
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Cronologia</span>
              </button>
            </Link>
            <Link href="/admin/query">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Query SQL</span>
              </button>
            </Link>
            <Link href="/admin/tables">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200">
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium">Tabelle</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Griglia Agende */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Le tue Agende</h2>
          {agende.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nessuna agenda disponibile</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {agende.map(agenda => (
                <div key={agenda.id}
                  onClick={() => agenda.active && router.push(`/agenda/${agenda.id}`)}
                  className={`rounded-2xl p-4 shadow-lg transition-all duration-300 border-2 border-transparent ${
                    agenda.active ? 'bg-white hover:shadow-2xl cursor-pointer hover:border-[#005CA9] group' : 'bg-gray-100 cursor-not-allowed opacity-75'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl transition-all ${ agenda.active ? 'group-hover:scale-110' : '' }`}
                      style={{ backgroundColor: `${agenda.colore || '#005CA9'}20` }}>
                      <CalendarIcon className="w-6 h-6" style={{ color: agenda.active ? (agenda.colore||'#005CA9') : '#9CA3AF' }} />
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${ agenda.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700' }`}>
                      {agenda.active ? 'Attiva' : 'Disattivata'}
                    </span>
                  </div>
                  <h3 className={`text-lg font-bold mb-1 ${ agenda.active ? 'text-gray-800' : 'text-gray-500' }`}>{agenda.nome}</h3>
                  <p className={`text-xs mb-3 ${ agenda.active ? 'text-gray-600' : 'text-gray-400' }`}>{agenda.descrizione || 'Nessuna descrizione'}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      {agenda.id === '730' && (
                        <button
                          onClick={e => { e.stopPropagation(); router.push('/impostazioni'); }}
                          className="bg-gray-200 hover:bg-gray-300 rounded-full p-2.5 transition-all hover:scale-110"
                          title="Impostazioni">
                          <Settings size={18} className="text-[#005CA9]" />
                        </button>
                      )}
                      {agenda.id === '730' && (
                        <button
                          disabled
                          onClick={e => e.stopPropagation()}
                          className="bg-gray-100 rounded-full p-2.5 cursor-not-allowed opacity-40"
                          title="Prossimamente">
                          <User size={18} className="text-gray-400" />
                        </button>
                      )}
                      {agenda.id === '730' && (
                        <button
                          onClick={e => { e.stopPropagation(); router.push('/statistiche/730'); }}
                          className="bg-blue-50 hover:bg-blue-100 border border-[#005CA9]/20 hover:border-[#005CA9]/50 rounded-full p-2.5 transition-all hover:scale-110"
                          title="Statistiche operatori">
                          <BarChart2 size={18} className="text-[#005CA9]" />
                        </button>
                      )}
                      {agenda.id === 'epasa' && (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setShowEpasaSettings(true);
                            }}
                            className="bg-gray-200 hover:bg-gray-300 rounded-full p-2.5 transition-all hover:scale-110"
                            title="Impostazioni EPASA">
                            <Settings size={18} className="text-[#005CA9]" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); router.push('/statistiche/epasa'); }}
                            className="bg-blue-50 hover:bg-blue-100 border border-[#005CA9]/20 hover:border-[#005CA9]/50 rounded-full p-2.5 transition-all hover:scale-110"
                            title="Statistiche EPASA">
                            <BarChart2 size={18} className="text-[#005CA9]" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className={`text-xl transition-transform ${ agenda.active ? 'text-[#005CA9] group-hover:translate-x-2' : 'text-gray-400' }`}>→</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modale Impostazioni EPASA */}
      <EpasaSettingsModal
        isOpen={showEpasaSettings}
        onClose={() => setShowEpasaSettings(false)}
        settings={epasaSettings}
        onSaveSettings={handleSaveEpasaSettings}
        sedi={epasaSedi}
      />
    </div>
  );
}
