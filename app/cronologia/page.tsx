'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, History, RefreshCw, Building2, Calendar, Plus, Pencil, Trash2 } from 'lucide-react';

interface LogEntry {
  id: number;
  source: 'EPASA' | 'SALA_RIUNIONI';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  descrizione: string;
  dettagli: object | null;
  created_at: string;
}

const ACTION_CONFIG = {
  CREATE: { label: 'Aggiunta', icon: Plus,   bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  dot: 'bg-green-500' },
  UPDATE: { label: 'Modifica', icon: Pencil,  bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500'  },
  DELETE: { label: 'Elimina',  icon: Trash2,  bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    dot: 'bg-red-500'   },
};

const SOURCE_CONFIG = {
  EPASA:         { label: 'Agenda EPASA',  bg: 'bg-[#E6F2FF]', text: 'text-[#005CA9]', icon: Calendar  },
  SALA_RIUNIONI: { label: 'Sale Riunioni', bg: 'bg-purple-50',  text: 'text-purple-700', icon: Building2 },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function CronologiaPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'EPASA' | 'SALA_RIUNIONI'>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cronologia');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { /* silenzioso */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = logs.filter(l => {
    if (filter !== 'ALL' && l.source !== filter) return false;
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 bg-white hover:bg-gray-50 rounded-xl shadow border border-gray-200 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-[#005CA9] p-2.5 rounded-xl shadow-lg">
                <History className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#005CA9]">Cronologia</h1>
                <p className="text-sm text-gray-500">Storico di tutte le modifiche</p>
              </div>
            </div>
          </div>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow border border-gray-200 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Aggiorna</span>
          </button>
        </div>

        {/* Filtri */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Filtro sorgente */}
          {(['ALL', 'EPASA', 'SALA_RIUNIONI'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                filter === s
                  ? 'bg-[#005CA9] text-white border-[#005CA9]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#005CA9]'
              }`}
            >
              {s === 'ALL' ? 'Tutte le agende' : SOURCE_CONFIG[s].label}
            </button>
          ))}

          <div className="w-px bg-gray-300 mx-1" />

          {/* Filtro azione */}
          {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map(a => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                actionFilter === a
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {a === 'ALL' ? 'Tutte le azioni' : ACTION_CONFIG[a].label}
            </button>
          ))}
        </div>

        {/* Counter */}
        <p className="text-xs text-gray-400 mb-4">{filtered.length} eventi trovati</p>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#005CA9]"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow border border-gray-100">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Nessun evento trovato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((log) => {
              const ac = ACTION_CONFIG[log.action];
              const sc = SOURCE_CONFIG[log.source];
              const ActionIcon = ac.icon;
              const SourceIcon = sc.icon;
              return (
                <div
                  key={log.id}
                  className={`bg-white rounded-xl shadow-sm border-l-4 ${ac.border} p-4 flex items-start gap-4 hover:shadow-md transition-shadow`}
                >
                  {/* Icona azione */}
                  <div className={`p-2 rounded-lg ${ac.bg} flex-shrink-0 mt-0.5`}>
                    <ActionIcon className={`w-4 h-4 ${ac.text}`} />
                  </div>

                  {/* Contenuto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Badge azione */}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ac.bg} ${ac.text}`}>
                        {ac.label}
                      </span>
                      {/* Badge sorgente */}
                      <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        <SourceIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">{log.descrizione}</p>
                  </div>

                  {/* Data */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
