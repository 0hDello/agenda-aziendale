'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Database, Table, FileText } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Query SQL */}
          <Link href="/admin/query">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer">
              <FileText className="w-12 h-12 text-blue-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Esegui Query SQL</h2>
              <p className="text-gray-600">Esegui query SQL personalizzate sul database</p>
            </div>
          </Link>

          {/* Card Visualizza Tabelle */}
          <Link href="/admin/tables">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer">
              <Table className="w-12 h-12 text-green-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Visualizza Tabelle</h2>
              <p className="text-gray-600">Esplora tutte le tabelle del database</p>
            </div>
          </Link>

          {/* Card Gestione Database */}
          <Link href="/admin/database">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition cursor-pointer">
              <Database className="w-12 h-12 text-purple-600 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Info Database</h2>
              <p className="text-gray-600">Informazioni e statistiche del database</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
