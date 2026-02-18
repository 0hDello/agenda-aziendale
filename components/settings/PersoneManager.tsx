'use client';

import { useState, useEffect } from 'react';
import { User, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { Persona } from '@/lib/types';

export default function PersoneManager() {
  const [persone, setPersone] = useState<Persona[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({ nome: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPersone();
  }, []);

  
  const loadPersone = async () => {
    try {
      const response = await fetch('/api/persone');
      const data = await response.json();
      setPersone(data || []);
    } catch (error) {
      console.error('Errore caricamento persone:', error);
    }
  };

  const handleOpenModal = (persona?: Persona) => {
    if (persona) {
      setEditingPersona(persona);
      setFormData({ nome: persona.nome });
    } else {
      setEditingPersona(null);
      setFormData({ nome: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPersona(null);
    setFormData({ nome: '' });
  };

 
  const handleSave = async () => {
    if (!formData.nome.trim()) {
      alert('Inserisci un nome valido');
      return;
    }

    setLoading(true);

    try {
      if (editingPersona) {
        
        const response = await fetch(`/api/persone/${editingPersona.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: formData.nome.trim() }),
        });

        if (!response.ok) throw new Error('Errore aggiornamento');
      } else {
        
        const response = await fetch('/api/persone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: formData.nome.trim() }),
        });

        if (!response.ok) throw new Error('Errore creazione');
      }

      await loadPersone();
      handleCloseModal();
    } catch (error) {
      console.error('Errore salvataggio persona:', error);
      alert('Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  
  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa persona?')) return;

    try {
      const response = await fetch(`/api/persone/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore eliminazione');
      }

      await loadPersone();
    } catch (error) {
      console.error('Errore eliminazione persona:', error);
      alert('Impossibile eliminare: potrebbero esistere appuntamenti associati');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <User className="w-7 h-7 text-[#005CA9]" />
          Gestione Persone
        </h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#005CA9] text-white px-4 py-2 rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Aggiungi Persona
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#005CA9] text-white">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Nome</th>
              <th className="px-6 py-4 text-left font-semibold">Data Creazione</th>
              <th className="px-6 py-4 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {persone.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  Nessuna persona presente. Clicca su "Aggiungi Persona" per iniziare.
                </td>
              </tr>
            ) : (
              persone.map((persona) => (
                <tr key={persona.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{persona.nome}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {persona.created_at ? new Date(persona.created_at).toLocaleDateString('it-IT') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(persona)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(persona.id)}
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
                {editingPersona ? 'Modifica Persona' : 'Nuova Persona'}
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
                  Nome Completo
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
                  placeholder="Es. Mario Rossi"
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
