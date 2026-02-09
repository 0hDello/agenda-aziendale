'use client';

import { useState } from 'react';
import { Play, AlertCircle, CheckCircle } from 'lucide-react';

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const executeQuery = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch('/api/admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Errore durante l\'esecuzione della query');
      } else {
        setResults(data);
      }
    } catch (err) {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Esegui Query SQL</h1>

        {/* Editor Query */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium mb-2">Query SQL</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-40 p-4 border rounded font-mono text-sm"
            placeholder="SELECT * FROM nome_tabella;"
          />
          
          <button
            onClick={executeQuery}
            disabled={loading || !query.trim()}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Esecuzione...' : 'Esegui Query'}
          </button>

          {/* Query di esempio */}
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <p className="text-sm font-medium mb-2">Esempi:</p>
            <div className="space-y-1 text-sm text-gray-600">
              <button 
                onClick={() => setQuery('SELECT * FROM appuntamenti LIMIT 10;')}
                className="block hover:text-blue-600"
              >
                • SELECT * FROM appuntamenti LIMIT 10;
              </button>
              <button 
                onClick={() => setQuery('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';')}
                className="block hover:text-blue-600"
              >
                • Visualizza tutte le tabelle
              </button>
            </div>
          </div>
        </div>

        {/* Errori */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Errore</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Risultati */}
        {results && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-semibold">Risultati</h2>
              <span className="text-sm text-gray-600">
                ({results.rowCount} {results.rowCount === 1 ? 'riga' : 'righe'})
              </span>
            </div>

            {results.rows && results.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(results.rows[0]).map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {Object.values(row).map((value: any, cellIdx: number) => (
                          <td
                            key={cellIdx}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            {value === null ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : typeof value === 'object' ? (
                              JSON.stringify(value)
                            ) : (
                              String(value)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">Query eseguita con successo. Nessun risultato.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
