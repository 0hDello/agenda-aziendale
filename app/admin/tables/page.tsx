'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';

interface TableInfo {
  name: string;
  rowCount: number;
  columns?: any[];
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const response = await fetch('/api/admin/tables');
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      console.error('Errore caricamento tabelle:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    setSelectedTable(tableName);
    setTableData(null);
    setLoadingData(true);

    try {
      const response = await fetch(`/api/admin/tables/${tableName}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Errore:', data.error);
        setTableData({ rows: [], rowCount: 0, error: data.error });
      } else {
        setTableData(data);
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error);
      setTableData({ rows: [], rowCount: 0, error: 'Errore di connessione' });
    } finally {
      setLoadingData(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Torna alle agende
        </Link>

        <h1 className="text-3xl font-bold mb-8">Tabelle Database</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lista Tabelle */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Tabelle ({tables.length})</h2>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => loadTableData(table.name)}
                    className={`w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between transition ${
                      selectedTable === table.name ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4" />
                      <span className="font-medium">{table.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{table.rowCount}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dati Tabella */}
          <div className="lg:col-span-3">
            {!selectedTable ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Seleziona una tabella per visualizzare i dati
              </div>
            ) : loadingData ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Caricamento dati...</p>
              </div>
            ) : tableData?.error ? (
              <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center text-red-600">
                  <p className="font-semibold mb-2">Errore</p>
                  <p className="text-sm">{tableData.error}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h2 className="text-xl font-semibold">{selectedTable}</h2>
                  <p className="text-sm text-gray-600">
                    {tableData?.rowCount || 0} {tableData?.rowCount === 1 ? 'riga' : 'righe'}
                  </p>
                </div>

                <div className="p-4 overflow-x-auto">
                  {tableData?.rows && tableData.rows.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(tableData.rows[0]).map((key) => (
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
                        {tableData.rows.map((row: any, idx: number) => (
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
                  ) : (
                    <p className="text-gray-600 text-center py-8">Tabella vuota</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
