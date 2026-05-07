'use client';

import { useState, useEffect, useRef } from 'react';
import {
  StickyNote,
  Plus,
  Trash2,
  Search,
  Pin,
  PinOff,
  X,
  Edit3,
  Check,
} from 'lucide-react';

interface Nota {
  id: string;
  titolo: string;
  contenuto: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  colore?: string;
}

const COLORI = [
  { label: 'Giallo', value: 'amber' },
  { label: 'Verde', value: 'green' },
  { label: 'Blu', value: 'blue' },
  { label: 'Rosa', value: 'pink' },
  { label: 'Grigio', value: 'gray' },
];

const COLORE_STYLES: Record<string, { bg: string; border: string; title: string }> = {
  amber: { bg: 'var(--color-note-subtle)',         border: 'var(--color-note-border)',  title: 'var(--color-note)' },
  green: { bg: 'rgba(46,125,50,0.08)',              border: 'rgba(46,125,50,0.25)',      title: 'var(--color-success)' },
  blue:  { bg: 'var(--color-primary-subtle)',       border: 'rgba(0,92,169,0.25)',       title: 'var(--color-primary)' },
  pink:  { bg: 'rgba(156,39,176,0.08)',             border: 'rgba(156,39,176,0.25)',     title: 'rgb(156,39,176)' },
  gray:  { bg: 'var(--color-surface-offset)',       border: 'var(--color-border)',       title: 'var(--color-text-muted)' },
};

const DEFAULT_COLORE = 'amber';

function formatDate(iso: string) {
  const d = new Date(iso);
  const oggi = new Date();
  if (d.toDateString() === oggi.toDateString()) {
    return `Oggi ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NotePage() {
  const [note, setNote] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ titolo: '', contenuto: '', colore: DEFAULT_COLORE });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadNote(); }, []);

  const loadNote = async () => {
    try {
      const res = await fetch('/api/note');
      if (res.ok) setNote(await res.json());
    } catch {}
    setLoading(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ titolo: '', contenuto: '', colore: DEFAULT_COLORE });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const openEdit = (nota: Nota) => {
    setEditingId(nota.id);
    setForm({ titolo: nota.titolo, contenuto: nota.contenuto, colore: nota.colore || DEFAULT_COLORE });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const saveNota = async () => {
    if (!form.contenuto.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/note/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const updated = await res.json();
          setNote(prev => prev.map(n => n.id === editingId ? updated : n));
        }
      } else {
        const res = await fetch('/api/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const nuova = await res.json();
          setNote(prev => [nuova, ...prev]);
        }
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ titolo: '', contenuto: '', colore: DEFAULT_COLORE });
    } catch {}
    setSaving(false);
  };

  const deleteNota = async (id: string) => {
    try {
      await fetch(`/api/note/${id}`, { method: 'DELETE' });
      setNote(prev => prev.filter(n => n.id !== id));
      setDeleteConfirm(null);
    } catch {}
  };

  const togglePin = async (nota: Nota) => {
    try {
      const res = await fetch(`/api/note/${nota.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nota, pinned: !nota.pinned }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNote(prev => prev.map(n => n.id === nota.id ? updated : n));
      }
    } catch {}
  };

  const filtered = note
    .filter(n =>
      n.titolo.toLowerCase().includes(search.toLowerCase()) ||
      n.contenuto.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const pinnedCount = note.filter(n => n.pinned).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="app-topbar">
        <div className="topbar-breadcrumb">
          <StickyNote size={16} strokeWidth={1.75} />
          <span className="current">Note</span>
          {note.length > 0 && (
            <span className="badge badge-primary" style={{ marginLeft: 'var(--space-2)' }}>
              {note.length}
            </span>
          )}
        </div>
        <div className="topbar-actions">
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 'var(--space-2)',
                color: 'var(--color-text-faint)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="form-input"
              style={{ paddingLeft: 'var(--space-8)', width: 200, height: 32, fontSize: 'var(--text-xs)' }}
              placeholder="Cerca note..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={14} />
            Nuova nota
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>

        {/* New/Edit form */}
        {showForm && (
          <div
            ref={formRef}
            className="card animate-fade-in"
            style={{ marginBottom: 'var(--space-6)', maxWidth: 600 }}
          >
            <div className="card-header">
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {editingId ? 'Modifica nota' : 'Nuova nota'}
              </h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                aria-label="Chiudi"
              >
                <X size={15} />
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Titolo */}
              <div>
                <label className="form-label">Titolo (opzionale)</label>
                <input
                  className="form-input"
                  placeholder="Titolo della nota..."
                  value={form.titolo}
                  onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                />
              </div>
              {/* Contenuto */}
              <div>
                <label className="form-label">Contenuto *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Scrivi qui la tua nota..."
                  value={form.contenuto}
                  onChange={e => setForm(f => ({ ...f, contenuto: e.target.value }))}
                  rows={5}
                  autoFocus
                />
              </div>
              {/* Colore */}
              <div>
                <label className="form-label">Colore</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {COLORI.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm(f => ({ ...f, colore: c.value }))}
                      style={{
                        padding: '4px var(--space-3)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        border: form.colore === c.value
                          ? `2px solid ${COLORE_STYLES[c.value]?.title || 'var(--color-primary)'}`
                          : '2px solid var(--color-border)',
                        background: COLORE_STYLES[c.value]?.bg || 'var(--color-surface-offset)',
                        color: COLORE_STYLES[c.value]?.title || 'var(--color-text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {form.colore === c.value && <Check size={11} />}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                >
                  Annulla
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveNota}
                  disabled={saving || !form.contenuto.trim()}
                  style={{ opacity: (!form.contenuto.trim() || saving) ? 0.6 : 1 }}
                >
                  {saving ? 'Salvataggio...' : (editingId ? 'Aggiorna' : 'Salva nota')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-xl)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-16)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}>
            <StickyNote size={48} strokeWidth={1} style={{ color: 'var(--color-text-faint)', marginBottom: 'var(--space-4)' }} />
            <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
              {search ? 'Nessuna nota trovata' : 'Nessuna nota ancora'}
            </p>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {search ? 'Prova con parole chiave diverse' : 'Clicca "Nuova nota" per aggiungere la prima nota'}
            </p>
          </div>
        ) : (
          <>
            {pinnedCount > 0 && !search && (
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 'var(--space-3)' }}>
                In evidenza
              </p>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 'var(--space-4)',
              alignItems: 'start',
            }}>
              {filtered.map((nota, idx) => {
                const stile = COLORE_STYLES[nota.colore || DEFAULT_COLORE] || COLORE_STYLES[DEFAULT_COLORE];
                return (
                  <div
                    key={nota.id}
                    className="note-card animate-fade-in"
                    style={{
                      backgroundColor: stile.bg,
                      borderColor: stile.border,
                      animationDelay: `${idx * 30}ms`,
                    }}
                  >
                    <div className="note-card-header">
                      <h4 className="note-card-title" style={{ color: stile.title }}>
                        {nota.titolo || 'Nota senza titolo'}
                      </h4>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ width: 26, height: 26, color: nota.pinned ? stile.title : 'var(--color-text-faint)' }}
                          onClick={() => togglePin(nota)}
                          title={nota.pinned ? 'Rimuovi da evidenza' : 'Metti in evidenza'}
                          aria-label={nota.pinned ? 'Rimuovi da evidenza' : 'Metti in evidenza'}
                        >
                          {nota.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ width: 26, height: 26 }}
                          onClick={() => openEdit(nota)}
                          title="Modifica"
                          aria-label="Modifica nota"
                        >
                          <Edit3 size={13} />
                        </button>
                        {deleteConfirm === nota.id ? (
                          <>
                            <button
                              className="btn btn-icon"
                              style={{ width: 26, height: 26, background: 'var(--color-error)', color: 'white' }}
                              onClick={() => deleteNota(nota.id)}
                              title="Conferma eliminazione"
                              aria-label="Conferma eliminazione"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ width: 26, height: 26 }}
                              onClick={() => setDeleteConfirm(null)}
                              title="Annulla"
                              aria-label="Annulla eliminazione"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ width: 26, height: 26 }}
                            onClick={() => setDeleteConfirm(nota.id)}
                            title="Elimina"
                            aria-label="Elimina nota"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="note-card-content">{nota.contenuto}</p>
                    <div className="note-card-date">
                      <span>{formatDate(nota.updatedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
