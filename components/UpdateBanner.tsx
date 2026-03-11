'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const CHECK_INTERVAL_MS = 60_000; // controlla ogni 60 secondi

export default function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed]   = useState(false);
  const initialBuildId              = useRef<string | null>(null);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBuildId = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.buildId === 'string' ? data.buildId : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Primo fetch: memorizziamo il build ID corrente
    fetchBuildId().then(id => {
      if (id) initialBuildId.current = id;
    });

    intervalRef.current = setInterval(async () => {
      const current = await fetchBuildId();
      if (
        current &&
        initialBuildId.current &&
        current !== initialBuildId.current
      ) {
        setShowBanner(true);
        // Smetti di controllare: il banner è già visibile
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!showBanner || dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5"
      style={{
        background: 'linear-gradient(90deg, #005CA9 0%, #0074D9 100%)',
        boxShadow: '0 2px 12px rgba(0,92,169,0.35)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <p className="text-sm font-semibold text-white">
          È disponibile una nuova versione dell&apos;app.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1 bg-white text-[#005CA9] rounded-full text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm"
        >
          <RefreshCw size={12} />
          Aggiorna ora
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-white/70 hover:text-white transition-colors flex-shrink-0"
        title="Chiudi (potrai aggiornare più tardi)"
      >
        <X size={18} />
      </button>
    </div>
  );
}
