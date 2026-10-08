export interface PracticeCategory {
  id: string;
  label: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
}

export const LOREDANA_CATEGORIES: Record<string, PracticeCategory> = {
  pensioni: {
    id: 'pensioni',
    label: 'Pensioni & Reversibilità',
    description: 'Pensioni di vecchiaia, anticipata, reversibilità, APE sociale, ricostituzioni ed ecocert',
    color: '#2563EB',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
  },
  red: {
    id: 'red',
    label: 'RED / Dichiarazioni Reddituali',
    description: 'Modelli RED e dichiarazioni reddituali INPS per pensionati',
    color: '#7C3AED',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
  },
  invalidita: {
    id: 'invalidita',
    label: 'Invalidità & Legge 104',
    description: 'Invalidità civile, aggravamento, Legge 104, permessi e accompagnamento',
    color: '#DC2626',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800',
  },
  disoccupazione: {
    id: 'disoccupazione',
    label: 'Disoccupazione & NASpI',
    description: 'NASpI, disoccupazione agricola e indennità di fine rapporto',
    color: '#F59E0B',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
  },
  maternita: {
    id: 'maternita',
    label: 'Maternità & Bonus Famiglia',
    description: 'Maternità obbligatoria e facoltativa, bonus nido, bonus nascita e congedi',
    color: '#EC4899',
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-800',
  },
  assegno_unico: {
    id: 'assegno_unico',
    label: 'Assegno Unico',
    description: 'Domande assegno unico universale, modifiche e verifica arretrati',
    color: '#059669',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
  },
  dimissioni_contributi: {
    id: 'dimissioni_contributi',
    label: 'Dimissioni & Contributi',
    description: 'Convalida dimissioni online, controllo posizione contributiva e riscatti',
    color: '#D97706',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
  },
  sostegno_reddito: {
    id: 'sostegno_reddito',
    label: 'Assegno Inclusione / ADI',
    description: 'Assegno di Inclusione (ADI), SFL e sostegno al reddito',
    color: '#0D9488',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
  },
  isee: {
    id: 'isee',
    label: 'ISEE',
    description: 'Dichiarazione Sostitutiva Unica e attestazione ISEE',
    color: '#0284C7',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
  },
  badanti: {
    id: 'badanti',
    label: 'Badanti & Lavoro Domestico',
    description: 'Contratti di lavoro domestico, colf e badanti',
    color: '#10B981',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800',
  },
  altro: {
    id: 'altro',
    label: 'Altro / Consulenza Patronato',
    description: 'Consulenza generica patronato o appuntamenti con causale libera',
    color: '#6B7280',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-800',
  },
};

export const MILECE_CATEGORIES: Record<string, PracticeCategory> = {
  isee: {
    id: 'isee',
    label: 'ISEE',
    description: 'Elaborazione dichiarazione ISEE, DSU ordinaria, corrente e minorenni',
    color: '#005CA9',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-[#005CA9]',
  },
  badanti: {
    id: 'badanti',
    label: 'Badanti & Lavoro Domestico',
    description: 'Gestione pratiche colf, badanti e contratti di lavoro domestico',
    color: '#10B981',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
  },
};

/**
 * Categorizzazione intelligente in base all'operatore e al testo di cliente e note.
 */
export function categorizeEpasaAppointment(
  operatoreId: string,
  cliente: string,
  note?: string | null
): PracticeCategory {
  const text = `${cliente || ''} ${note || ''}`.toLowerCase().trim();
  const op = (operatoreId || '').toUpperCase();

  // ─── MILECE: Fa solo ISEE e Badanti ───
  if (op === 'MILECE') {
    if (/badant|colf|domest/i.test(text)) {
      return MILECE_CATEGORIES.badanti;
    }
    // Per Milece tutti gli altri sono ISEE (voce principale / implicita)
    return MILECE_CATEGORIES.isee;
  }

  // ─── LOREDANA: Ampia gamma di patronato ───
  // 1. Pensioni & Reversibilità
  if (
    /pensio|pens\b|pensoione|reversib|ape\s*sociale|ecocert|contegg.*pensi|posiz.*pensi|ricalcolo\s*pensi|ricost.*pensi|ved\s*per\s*pensi|domanda\s*di\s*pens|quota\s*10[0-4]|enasarco/i.test(
      text
    )
  ) {
    return LOREDANA_CATEGORIES.pensioni;
  }

  // 2. RED
  if (/\bred\b/i.test(text)) {
    return LOREDANA_CATEGORIES.red;
  }

  // 3. Invalidità & Legge 104
  if (
    /invalid|inval|104|legge\s*104|aggrav|permess.*104|accompagnamento|handicap|visita\s*collegiale|invciv/i.test(
      text
    )
  ) {
    return LOREDANA_CATEGORIES.invalidita;
  }

  // 4. Disoccupazione & NASpI
  if (/naspi|disoc|disocc|disoccupaz|agricol/i.test(text)) {
    return LOREDANA_CATEGORIES.disoccupazione;
  }

  // 5. Maternità, Congedi & Bonus Famiglia
  if (/matern|mat\s*fac|conged|nido|bonus\s*nido|bonus\s*nascita|bonus\s*bebe|patern/i.test(text)) {
    return LOREDANA_CATEGORIES.maternita;
  }

  // 6. Assegno Unico
  if (/ass.*unico|assegno\s*unico|modif.*ass.*unico|arr.*ass.*unico|ass\s*familiari/i.test(text)) {
    return LOREDANA_CATEGORIES.assegno_unico;
  }

  // 7. Dimissioni & Contributi
  if (
    /dimiss|convalida\s*dimiss|contrib|volontar|riscatto|estratto\s*conto|controllo\s*contrib|verifica\s*inps/i.test(
      text
    )
  ) {
    return LOREDANA_CATEGORIES.dimissioni_contributi;
  }

  // 8. ADI / Reddito di Inclusione / Sostegni
  if (/adi\b|assegno\s*inclusione|redd.*inclusione|reddito\s*inclusione|carta\s*dedicata|sfl\b/i.test(text)) {
    return LOREDANA_CATEGORIES.sostegno_reddito;
  }

  // 9. ISEE (per Loredana)
  if (/ise{1,2}|issee/i.test(text)) {
    return LOREDANA_CATEGORIES.isee;
  }

  // 10. Badanti (per Loredana)
  if (/badant|colf|domest/i.test(text)) {
    return LOREDANA_CATEGORIES.badanti;
  }

  // 11. Altro / Consulenza Patronato
  return LOREDANA_CATEGORIES.altro;
}
