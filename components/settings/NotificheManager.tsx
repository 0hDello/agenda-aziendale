'use client';

import { useState } from 'react';
import { Bell, Send, CheckCircle, AlertCircle } from 'lucide-react';

interface Notifica {
  id: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  messaggio: string;
  destinatari: string[];
  dataInvio: Date;
}

export default function NotificheManager() {
  const [notifiche] = useState<Notifica[]>([
    {
      id: '1',
      tipo: 'success',
      messaggio: 'Appuntamento confermato per domani alle 10:00',
      destinatari: ['Mario Rossi', 'Luigi Verdi'],
      dataInvio: new Date('2025-11-23T14:30:00'),
    },
    {
      id: '2',
      tipo: 'info',
      messaggio: 'Nuova sede aggiunta: Milano Centro',
      destinatari: ['Tutti gli operatori'],
      dataInvio: new Date('2025-11-22T09:15:00'),
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'info' as Notifica['tipo'],
    messaggio: '',
    destinatari: '',
  });

  const getTipoIcon = (tipo: Notifica['tipo']) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'info':
        return <Bell className="w-5 h-5 text-blue-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getTipoColor = (tipo: Notifica['tipo']) => {
    switch (tipo) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
    }
  };

  const handleSendNotification = () => {
    if (!formData.messaggio.trim() || !formData.destinatari.trim()) {
      alert('Compila tutti i campi');
      return;
    }

    
    alert('Funzionalità di invio notifiche in sviluppo. La notifica verrebbe inviata a: ' + formData.destinatari);
    setIsModalOpen(false);
    setFormData({ tipo: 'info', messaggio: '', destinatari: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="w-7 h-7 text-[#005CA9]" />
          Gestione Notifiche
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#005CA9] text-white px-4 py-2 rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          Invia Notifica
        </button>
      </div>

      <div className="space-y-4">
        {notifiche.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">
            Nessuna notifica inviata. Clicca su "Invia Notifica" per iniziare.
          </div>
        ) : (
          notifiche.map((notifica) => (
            <div
              key={notifica.id}
              className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${getTipoColor(notifica.tipo)}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">{getTipoIcon(notifica.tipo)}</div>
                <div className="flex-1">
                  <p className="text-gray-800 font-medium mb-2">{notifica.messaggio}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>
                      <strong>Destinatari:</strong> {notifica.destinatari.join(', ')}
                    </span>
                    <span>
                      <strong>Inviata:</strong>{' '}
                      {notifica.dataInvio.toLocaleString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">Invia Nuova Notifica</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as Notifica['tipo'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005CA9] focus:border-transparent"
                >
                  <option value="info">Informazione</option>
                  <option value="success">Successo</option>
                  <option value="warning">Avviso</option>
                  <option value="error">Errore</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Messaggio</label>
                <textarea
                  value={formData.messaggio}
                  onChange={(e) => setFormData({ ...formData, messaggio: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005CA9] focus:border-transparent"
                  placeholder="Scrivi il messaggio della notifica..."
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Destinatari</label>
                <input
                  type="text"
                  value={formData.destinatari}
                  onChange={(e) => setFormData({ ...formData, destinatari: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005CA9] focus:border-transparent"
                  placeholder="Es. Mario Rossi, Luigi Verdi"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSendNotification}
                  className="flex-1 px-4 py-2 bg-[#005CA9] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Invia
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
