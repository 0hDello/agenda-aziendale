'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { Sede } from '@/lib/types';

export default function SediManager() {
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSede, setEditingSede] = useState<Sede | null>(null);
  const [formData, setFormData] = useState({ nome: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSedi();
  }, []);

  const loadSedi = async () => {
    try {
      const response = await fetch('/api/sedi');
      const data = await response.json();
      setSedi(data || []);
    } catch (error) {
      console.error('Errore caricamento sedi:', error);
    }
  };

  const handleOpenModal = (sede?: Sede) => {
    if (sede) {
      setEditingSede(sede);
      setFormData({ nome: sede.nome });
    } else {
      setEditingSede(null);
      setFormData({ nome: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSede(null);
    setFormData({ nome: '' });
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      alert('Inserisci un nome valido per la sede');
      return;
    }

    setLoading(true);

    try {
      if (editingSede) {
        // Update esistente
        const response = await fetch(`/api/sedi/${editingSede.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: formData.nome.trim() }),
        });

        if (!response.ok) {
          let errorMsg = 'Errore aggiornamento';
          try {
            const error = await response.json();
            errorMsg = error.error || errorMsg;
          } catch {}
          console.error('❌ Errore aggiornamento:', response.status);
          throw new Error(errorMsg);
        }
      } else {
        // Insert nuovo
        console.log('📤 Invio richiesta POST a /api/sedi');
        const response = await fetch('/api/sedi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: formData.nome.trim() }),
        });

        console.log('📡 Status risposta:', response.status);
        console.log('📡 Headers:', response.headers.get('content-type'));
        
        if (!response.ok) {
          let errorMsg = `Errore ${response.status}: ${response.statusText}`;
          try {
            const error = await response.json();
            errorMsg = error.error || errorMsg;
          } catch {}
          console.error('❌ Errore dal server:', errorMsg);
          throw new Error(errorMsg);
        }
        
        const result = await response.json();
        console.log(' Sede creata:', result);
      }

      await loadSedi();
      handleCloseModal();
    } catch (error: any) {
      console.error('❌ Errore completo salvataggio sede:', error);
      alert(`Errore durante il salvataggio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa sede?')) return;

    try {
      const response = await fetch(`/api/sedi/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore eliminazione');
      }

      await loadSedi();
    } catch (error) {
      console.error('Errore eliminazione sede:', error);
      alert('Impossibile eliminare: potrebbero esistere appuntamenti associati');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="w-7 h-7 text-[#005CA9]" />
          Gestione Sedi
        </h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#005CA9] text-white px-4 py-2 rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Aggiungi Sede
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#005CA9] text-white">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Nome Sede</th>
              <th className="px-6 py-4 text-left font-semibold">Data Creazione</th>
              <th className="px-6 py-4 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {sedi.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  Nessuna sede presente. Clicca su "Aggiungi Sede" per iniziare.
                </td>
              </tr>
            ) : (
              sedi.map((sede) => (
                <tr key={sede.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{sede.nome}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {sede.created_at ? new Date(sede.created_at).toLocaleDateString('it-IT') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(sede)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(sede.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingSede ? 'Modifica Sede' : 'Nuova Sede'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Sede
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ nome: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSave();
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005CA9] focus:border-transparent"
                  placeholder="Es. Sede Imola"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center justify-center gap-2"
                  disabled={loading || !formData.nome.trim()}
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
