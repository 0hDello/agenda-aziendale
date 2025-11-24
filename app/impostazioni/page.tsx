'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Building2, Calendar, Bell } from 'lucide-react';

export default function ImpostazioniPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F2FF] to-[#F5F8FA] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-[#005CA9] transition-colors font-medium mb-6"
          >
            <ArrowLeft size={20} />
            Torna alla Home
          </button>

          <h1 className="text-3xl font-bold text-[#005CA9]">Impostazioni</h1>
          <p className="text-gray-600 mt-2">Gestisci le impostazioni dell'applicazione</p>
        </div>

        {/* Sezioni Impostazioni */}
        <div className="space-y-4">
          <div
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
            onClick={() => router.push('/impostazioni/persone')}
          >
            <div className="flex items-center gap-4">
              <div className="bg-[#E6F2FF] p-3 rounded-xl">
                <Users className="w-6 h-6 text-[#005CA9]" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Gestione Persone</h3>
                <p className="text-sm text-gray-600">Aggiungi o modifica operatori</p>
              </div>
              <div className="text-gray-400">→</div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
            onClick={() => router.push('/impostazioni/sedi')}
          >
            <div className="flex items-center gap-4">
              <div className="bg-[#E6F2FF] p-3 rounded-xl">
                <Building2 className="w-6 h-6 text-[#005CA9]" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Gestione Sedi</h3>
                <p className="text-sm text-gray-600">Configura le sedi operative</p>
              </div>
              <div className="text-gray-400">→</div>
            </div>
          </div>

          <div
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
            onClick={() => router.push('/impostazioni/agende')}
          >
            <div className="flex items-center gap-4">
              <div className="bg-[#E6F2FF] p-3 rounded-xl">
                <Calendar className="w-6 h-6 text-[#005CA9]" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Gestione Agende</h3>
                <p className="text-sm text-gray-600">Crea e modifica agende</p>
              </div>
              <div className="text-gray-400">→</div>
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}
