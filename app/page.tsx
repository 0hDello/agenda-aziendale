'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Settings,
  User,
  BarChart2,
  ArrowRight,
} from 'lucide-react';

interface Agenda {
  id: string;
  nome: string;
  descrizione?: string;
  colore?: string;
  active: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [agende, setAgende] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAgende(); }, []);

  const loadAgende = async () => {
    try {
      const res = await fetch('/api/agende');
      if (!res.ok) throw new Error();
      setAgende(await res.json());
    } catch {}
    setLoading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto',
        }} />
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Caricamento...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: 'var(--space-8) var(--space-8)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 'var(--space-1)',
        }}>Agende</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Seleziona un&apos;agenda per iniziare a lavorare
        </p>
      </div>

      {/* Grid */}
      {agende.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-16)',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
        }}>
          <CalendarIcon size={48} strokeWidth={1} style={{ color: 'var(--color-text-faint)', marginBottom: 'var(--space-4)' }} />
          <p style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Nessuna agenda disponibile</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>Configura le agende nelle impostazioni</p>
        </div>
      ) : (
        <div className="agenda-grid">
          {agende.map(agenda => (
            <div
              key={agenda.id}
              className={`agenda-card${!agenda.active ? ' disabled' : ''}`}
              style={{ '--card-accent': agenda.colore || 'var(--color-primary)' } as React.CSSProperties}
              onClick={() => agenda.active && router.push(`/agenda/${agenda.id}`)}
            >
              {/* Card top */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: `${agenda.colore || '#005CA9'}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CalendarIcon
                    size={20}
                    strokeWidth={1.75}
                    style={{ color: agenda.active ? (agenda.colore || 'var(--color-primary)') : 'var(--color-text-faint)' }}
                  />
                </div>
                <span className={`badge ${agenda.active ? 'badge-active' : 'badge-inactive'}`}>
                  {agenda.active ? 'Attiva' : 'Disattivata'}
                </span>
              </div>

              {/* Card content */}
              <h3 style={{
                fontSize: 'var(--text-base)',
                fontWeight: 700,
                color: agenda.active ? 'var(--color-text)' : 'var(--color-text-muted)',
                marginBottom: 'var(--space-1)',
                fontFamily: 'var(--font-display)',
              }}>{agenda.nome}</h3>
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-faint)',
                lineHeight: 1.5,
                marginBottom: 'var(--space-4)',
              }}>{agenda.descrizione || 'Nessuna descrizione'}</p>

              {/* Card footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid var(--color-divider)',
              }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {agenda.id === '730' && (
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={e => { e.stopPropagation(); router.push('/impostazioni'); }}
                      title="Impostazioni"
                      aria-label="Impostazioni"
                    >
                      <Settings size={15} strokeWidth={1.75} />
                    </button>
                  )}
                  {agenda.id === '730' && (
                    <button
                      disabled
                      className="btn btn-ghost btn-icon"
                      title="Prossimamente"
                      aria-label="Area operatore (prossimamente)"
                      style={{ opacity: 0.4, cursor: 'not-allowed' }}
                    >
                      <User size={15} strokeWidth={1.75} />
                    </button>
                  )}
                  {agenda.id === '730' && (
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={e => { e.stopPropagation(); router.push('/statistiche/730'); }}
                      title="Statistiche"
                      aria-label="Statistiche"
                    >
                      <BarChart2 size={15} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <span style={{
                  color: agenda.active ? 'var(--color-primary)' : 'var(--color-text-faint)',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <ArrowRight size={16} strokeWidth={2} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
