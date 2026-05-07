'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  StickyNote,
  History,
  BarChart2,
  Settings,
  Database,
  FileText,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    section: 'Principale',
    items: [
      { href: '/',         icon: CalendarDays, label: 'Agende',     exact: true },
      { href: '/note',     icon: StickyNote,   label: 'Note',       exact: false },
      { href: '/cronologia', icon: History,    label: 'Cronologia', exact: false },
      { href: '/statistiche/730', icon: BarChart2, label: 'Statistiche', exact: false },
    ],
  },
  {
    section: 'Gestione',
    items: [
      { href: '/impostazioni', icon: Settings,  label: 'Impostazioni', exact: false },
      { href: '/admin/query',  icon: FileText,  label: 'Query SQL',    exact: false },
      { href: '/admin/tables', icon: Database,  label: 'Tabelle DB',   exact: false },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? document.documentElement.getAttribute('data-theme')
      : null;
    const prefersDark = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    const initial = (saved as 'light' | 'dark') || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href) && href !== '/';
  };

  return (
    <aside className={`app-sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/logo-cna.png" alt="CNA" />
        <span className="sidebar-logo-text">CNA Agenda</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Navigazione principale">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ href, icon: Icon, label, exact }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-item${isActive(href, exact) ? ' active' : ''}`}
                title={collapsed ? label : undefined}
              >
                <span className="sidebar-item-icon">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="sidebar-item-label">{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: 'var(--space-3) var(--space-2)', borderTop: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flexShrink: 0 }}>
        {/* Theme toggle */}
        <button
          className="sidebar-item"
          onClick={toggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Tema chiaro' : 'Tema scuro') : undefined}
          aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
        >
          <span className="sidebar-item-icon">
            {theme === 'dark'
              ? <Sun size={18} strokeWidth={1.75} />
              : <Moon size={18} strokeWidth={1.75} />
            }
          </span>
          <span className="sidebar-item-label">
            {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          </span>
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="sidebar-collapse-btn">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronLeft size={14} />
          }
        </button>
      </div>
    </aside>
  );
}
