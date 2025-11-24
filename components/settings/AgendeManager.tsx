'use client';

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, X, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PersonaSede, Persona, Sede } from '@/lib/types';

interface PersonaSedeExtended extends PersonaSede {
  persona?: Persona;
  sede?: Sede;
}

export default function AgendeManager() {
  const [agende, setAgende] = useState<PersonaSedeExtended[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ persona_id: '', sede_id: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Carica agende con relazioni
    const { data: agendeData, error: agendeError } = await supabase
      .from('persona_sede')
      .select(`
        *,
        persona:persone(id, nome),
        sede:sedi(id, nome)
      `)
      .order('created_at', { ascending: false });
    
    if (agendeError) {
      console.error('Errore caricamento agende:', agendeError);
    } else {
      setAgende(agendeData || []);
    }

    // Carica persone
    const { data: personeData } = await supabase
      .from('persone')
      .select('*')
      .order('nome');
    setPersone(personeData || []);

    // Carica sedi
    const { data: sediData } = await supabase
      .from('sedi')
      .select('*')
      .order('nome');
    setSedi(sediData || []);
  };

  const handleOpenModal = () => {
    setFormData({ persona_id: '', sede_id: '' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ persona_id: '', sede_id: '' });
  };

  const handleSave = async () => {
    if (!formData.persona_id || !formData.sede_id) {
      alert('Seleziona sia la persona che la sede');
      return;
    }

    // Verifica se esiste già questa associazione
    const exists = agende.some(
      (a) => a.persona_id === formData.persona_id && a.sede_id === formData.sede_id
    );

    if (exists) {
      alert('Questa associazione esiste già');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('persona_sede')
        .insert([formData]);
      
      if (error) throw error;

      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Errore salvataggio agenda:', error);
      alert('Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa associazione?')) return;

    const { error } = await supabase
      .from('persona_sede')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Errore eliminazione agenda:', error);
      alert('Errore durante l\'eliminazione');
      return;
    }

    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-[#005CA9]" />
          Gestione Agende
        </h2>
        <button
          onClick={handleOpenModal}
          className="bg-[#005CA9] text-white px-4 py-2 rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Associa Persona a Sede
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#005CA9] text-white">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Persona</th>
              <th className="px-6 py-4 text-left font-semibold">Sede</th>
              <th className="px-6 py-4 text-left font-semibold">Data Creazione</th>
              <th className="px-6 py-4 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {agende.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Nessuna associazione presente. Clicca su "Associa Persona a Sede" per iniziare.
                </td>
              </tr>
            ) : (
              agende.map((agenda) => (
                <tr key={agenda.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {agenda.persona?.nome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {agenda.sede?.nome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {agenda.created_at ? new Date(agenda.created_at).toLocaleDateString('it-IT') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(agenda.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
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
                Nuova Associazione
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
                  Persona
                </label>
                <select
                  value={formData.persona_id}
                  onChange={(e) => setFormData({ ...formData, persona_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005CA9] focus:border-transparent"
                >
                  <option value="">Seleziona una persona</option>
                  {persone.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sede
                </label>
                <select
                  value={formData.sede_id}
                  onChange={(e) => setFormData({ ...formData, sede_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005CA9] focus:border-transparent"
                >
                  <option value="">Seleziona una sede</option>
                  {sedi.map((sede) => (
                    <option key={sede.id} value={sede.id}>
                      {sede.nome}
                    </option>
                  ))}
                </select>
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
                  disabled={loading}
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
