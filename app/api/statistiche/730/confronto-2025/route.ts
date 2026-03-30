import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

function normalize(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ');
}

// Parole che non fanno parte del nome/cognome nel campo cliente
const NON_NAME_TOKENS = new Set([
  // Tipi di pratiche fiscali / servizi
  '730', 'CAF', 'PATRONATO', 'MOD', 'MODELLO', 'DICHIARAZIONE', 'DICHIA',
  'ISEE', 'RED', 'UNICO', 'REDDITI', 'CUD', 'CU',
  'IMU', 'TARI', 'TASI', 'IVA', 'IRPEF', 'INPS', 'INAIL',
  'F24', 'F23', 'DELEGA', 'DELEGHE',
  'SUCCESSIONE', 'SUCCESSIONI', 'VISURA', 'CATASTO',
  'SPID', 'CIE', 'IDENTITA', 'DIGITALE',
  'PENSIONE', 'PENSIONAMENTO', 'INVALIDITA', 'DISABILITA',
  'BONUS', 'CONTRIBUTO', 'CONTRIBUTI', 'DOMANDA',
  // Contatti
  'TEL', 'CEL', 'CELL', 'TELEF', 'TELEFONO', 'NR', 'NUM',
  // Indirizzi
  'VIA', 'CORSO', 'PIAZZA', 'VIALE',
  // Forme societarie
  'SRL', 'SNC', 'SAS', 'SPA', 'ONLUS', 'ASD',
  // Relazioni familiari (a volte aggiunte come nota)
  'CONIUGE', 'MOGLIE', 'MARITO', 'FIGLIO', 'FIGLIA', 'GENITORE',
  // Generiche
  'PRATICA', 'AGGIORNAMENTO', 'RINNOVO', 'NUOVO', 'NUOVA', 'ALTRO',
]);

/**
 * Estrae solo nome e cognome dal campo cliente 2026,
 * che può contenere note, tipo pratica, numeri, ecc.
 * Es: "ROSSI MARIO - 730 CAF"            → "ROSSI MARIO"
 *     "ROSSI MARIO (CONIUGE)"             → "ROSSI MARIO"
 *     "LIVERANI M.ELISA 730 + IMU 333/..."→ "LIVERANI M.ELISA"
 *     "RICCI MAURO730+IMU TEL .340/..."   → "RICCI MAURO"
 */
function extractName(raw: string): string {
  let s = normalize(raw);

  // Rimuovi contenuto tra parentesi
  s = s.replace(/\(.*?\)/g, ' ');

  // Sostituisci + con spazio (es: "730+IMU" → "730 IMU")
  s = s.replace(/\+/g, ' ');

  // Separa lettere da cifre adiacenti (es: "MAURO730" → "MAURO 730")
  s = s.replace(/([A-ZÀÁÈÉÌÍÒÓÙÚ])(\d)/gi, '$1 $2');
  s = s.replace(/(\d)([A-ZÀÁÈÉÌÍÒÓÙÚ])/gi, '$1 $2');

  // Normalizza spazi multipli
  s = s.replace(/\s+/g, ' ').trim();

  // Prendi la parte prima del primo separatore forte (" - ", "/")
  const dashIdx = s.indexOf(' - ');
  const slashIdx = s.indexOf('/');
  let main = s;
  if (dashIdx > 0) main = s.substring(0, dashIdx);
  else if (slashIdx > 0) main = s.substring(0, slashIdx);

  // Token valido: solo lettere + punto (per nomi tipo M.ELISA, G.CARLO)
  // Deve contenere almeno una lettera e non essere una parola-chiave di servizio
  const isNameToken = (t: string) =>
    /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝ'.]+$/i.test(t) &&
    t.length > 1 &&
    /[A-ZÀÁÈÉÌÍÒÓÙÚ]/i.test(t) &&
    !NON_NAME_TOKENS.has(t);

  const tokens = main.split(/\s+/).filter(isNameToken);

  if (tokens.length >= 2) return tokens.slice(0, 4).join(' ');

  // Fallback: usa l'intera stringa elaborata
  return s.split(/\s+/).filter(isNameToken).slice(0, 4).join(' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 4) return 999; // early exit se troppo diversi
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

/**
 * Riconosce abbreviazioni con punto: G.LUCA vs GIANLUCA, M.ELISA vs MARIAELISA.
 * La parte dopo il punto deve essere un suffisso del nome completo.
 */
function dotAbbrevMatch(t1: string, t2: string): boolean {
  for (const [abbrev, full] of [[t1, t2], [t2, t1]] as [string, string][]) {
    const dotIdx = abbrev.indexOf('.');
    if (dotIdx > 0) {
      const suffix = abbrev.substring(dotIdx + 1);
      if (suffix.length >= 2 && full.endsWith(suffix)) return true;
    }
  }
  return false;
}

function tokenFuzzy(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  if (dotAbbrevMatch(t1, t2)) return true;
  const maxErrors = Math.max(t1.length, t2.length) <= 6 ? 1 : 2;
  return levenshtein(t1, t2) <= maxErrors;
}

// Controlla se tutti i token di `needles` si trovano (fuzzy) in `haystack`
function fuzzySubsetOf(needles: string[], haystack: string[]): boolean {
  if (needles.length === 0) return false;
  const used = new Array(haystack.length).fill(false);
  for (const needle of needles) {
    let found = false;
    for (let j = 0; j < haystack.length; j++) {
      if (!used[j] && tokenFuzzy(needle, haystack[j])) { used[j] = true; found = true; break; }
    }
    if (!found) return false;
  }
  return true;
}

function fuzzyTokenSetMatch(tokens1: string[], tokens2: string[]): boolean {
  if (tokens1.length === 0 || tokens2.length === 0) return false;
  if (tokens1.length === tokens2.length) {
    // Lunghezza uguale: tutti i token devono matchare
    return fuzzySubsetOf(tokens1, tokens2);
  }
  // Lunghezza diversa: il gruppo più corto deve essere un sottoinsieme fuzzy del più lungo
  // (richiede almeno 2 token per evitare falsi positivi)
  const shorter = tokens1.length < tokens2.length ? tokens1 : tokens2;
  const longer  = tokens1.length < tokens2.length ? tokens2 : tokens1;
  if (shorter.length < 2) return false;
  return fuzzySubsetOf(shorter, longer);
}

// ── Indici costruiti una volta sola ───────────────────────────────────────────
interface Index2025 {
  exact: Set<string>;                          // lookup O(1) per match esatto
  tokenSorted: Map<string, string>;            // "COGNOME NOME" ordinato → nome originale
  invertedToken: Map<string, string[]>;        // singolo token → lista nomi 2025 che lo contengono
  allNames: string[];
}

function buildIndex(names2025: string[]): Index2025 {
  const exact = new Set<string>();
  const tokenSorted = new Map<string, string>();
  const invertedToken = new Map<string, string[]>();

  for (const name of names2025) {
    exact.add(name);
    const tokens = name.split(' ').filter(t => t.length > 1);
    const sorted = [...tokens].sort().join(' ');
    if (!tokenSorted.has(sorted)) tokenSorted.set(sorted, name);

    for (const token of tokens) {
      if (!invertedToken.has(token)) invertedToken.set(token, []);
      invertedToken.get(token)!.push(name);
    }
  }

  return { exact, tokenSorted, invertedToken, allNames: names2025 };
}

function findMatch(
  name2026: string,
  idx: Index2025
): { matched: string; method: string } | null {
  // Usa il nome estratto (pulito) per il confronto
  const n = extractName(name2026);
  if (!n) return null;

  const tokens = n.split(' ').filter(t => t.length > 1);

  // 1. Esatto O(1)
  if (idx.exact.has(n)) return { matched: n, method: 'esatto' };

  // 2. Token-set esatto O(1)
  const sorted = [...tokens].sort().join(' ');
  const ts = idx.tokenSorted.get(sorted);
  if (ts) return { matched: ts, method: 'token-set' };

  // 3. Recupera candidati che condividono almeno un token con il nome 2026
  //    (evita di scorrere tutti i 2720 nomi per il fuzzy)
  const candidateSet = new Set<string>();
  for (const t of tokens) {
    const exact = idx.invertedToken.get(t);
    if (exact) exact.forEach((n25: string) => candidateSet.add(n25));
    // token con 1 char di differenza (per typo come SILVA → SILVIA)
    idx.invertedToken.forEach((names: string[], t25: string) => {
      if (tokenFuzzy(t, t25)) names.forEach((n25: string) => candidateSet.add(n25));
    });
  }

  const candidates = Array.from(candidateSet);

  // 4. Fuzzy token-set solo sui candidati
  for (const cand of candidates) {
    const candTokens = cand.split(' ').filter((tok: string) => tok.length > 1);
    if (fuzzyTokenSetMatch(tokens, candTokens)) {
      return { matched: cand, method: 'fuzzy-token' };
    }
  }

  // 5. Levenshtein full-name solo sui candidati
  let bestScore = Infinity;
  let bestName = '';
  for (const cand of candidates) {
    const dist = levenshtein(n, cand);
    if (dist < bestScore) { bestScore = dist; bestName = cand; }
  }
  const maxLen = Math.max(n.length, bestName.length);
  if (bestScore <= 4 && maxLen > 0 && bestScore / maxLen < 0.2) {
    return { matched: bestName, method: `fuzzy(d=${bestScore})` };
  }

  return null;
}

export async function GET() {
  try {
    // ── 1. Leggi il file Excel 2025 ───────────────────────────────────────────
    const xlsxPath = path.join(process.cwd(), 'ELENCO COMPLETO 730 elaborati nel 2025.xlsx');
    if (!fs.existsSync(xlsxPath)) {
      return NextResponse.json({ error: 'File Excel 2025 non trovato nel progetto.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(xlsxPath);
    const wb2025 = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws2025 = wb2025.Sheets[wb2025.SheetNames[0]];
    const raw2025: any[][] = XLSX.utils.sheet_to_json(ws2025, { header: 1 });

    // Intestazioni riga 3 (indice 3), dati da indice 4 — cognome=col7, nome=col8
    const names2025: string[] = [];
    for (let i = 4; i < raw2025.length; i++) {
      const row = raw2025[i];
      const cognome = String(row[7] ?? '').trim();
      const nome    = String(row[8] ?? '').trim();
      if (cognome || nome) names2025.push(normalize(`${cognome} ${nome}`).trim());
    }

    // Costruisce gli indici una volta sola
    const idx = buildIndex(names2025);

    // ── 2. Carica clienti 2026 dal DB ─────────────────────────────────────────
    const res = await query(`
      SELECT UPPER(TRIM(cliente)) AS cliente
      FROM appuntamenti
      WHERE EXTRACT(YEAR FROM data::date) = 2026
        AND cliente IS NOT NULL
        AND TRIM(cliente) <> ''
        AND UPPER(TRIM(cliente)) <> 'UFF CHIUSO'
    `);

    // Deduplicazione per nome estratto (non per stringa grezza):
    // "ALEX SPITILLI 730 IMU TEL..." e "ALEX SPITILLI IMU 730..."
    // estraggono entrambi "ALEX SPITILLI" → una sola voce
    const seenExtracted = new Set<string>();
    const clienti2026: { raw: string; extracted: string }[] = [];
    for (const r of res.rows) {
      const raw = normalize(r.cliente);
      const extracted = extractName(raw);
      if (extracted && !seenExtracted.has(extracted)) {
        seenExtracted.add(extracted);
        clienti2026.push({ raw, extracted });
      }
    }

    // ── 3. Match ──────────────────────────────────────────────────────────────
    const presenti: { cliente_2026: string; nome_estratto: string; corrispondenza_2025: string; metodo: string }[] = [];
    const assenti:  { cliente_2026: string; nome_estratto: string }[] = [];

    for (const c of clienti2026) {
      const match = findMatch(c.raw, idx);
      if (match) presenti.push({ cliente_2026: c.raw, nome_estratto: c.extracted, corrispondenza_2025: match.matched, metodo: match.method });
      else       assenti.push({ cliente_2026: c.raw, nome_estratto: c.extracted });
    }

    // ── 4. Genera Excel di output ─────────────────────────────────────────────
    const wbOut = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Cliente 2026 (originale)', 'Nome estratto', 'Corrispondenza 2025', 'Metodo match'],
      ...presenti.map(r => [r.cliente_2026, r.nome_estratto, r.corrispondenza_2025, r.metodo]),
    ]);
    ws1['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wbOut, ws1, 'Presenti 2025 e 2026');

    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Cliente 2026 (originale)', 'Nome estratto'],
      ...assenti.map(r => [r.cliente_2026, r.nome_estratto]),
    ]);
    ws2['!cols'] = [{ wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wbOut, ws2, 'Solo 2026');

    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Riepilogo confronto 730 2025 vs 2026'],
      [],
      ['Clienti 2026 totali',       clienti2026.length],
      ['Presenti anche nel 2025',   presenti.length],
      ['Non presenti nel 2025',     assenti.length],
      ['Percentuale ritorni', `${Math.round((presenti.length / (clienti2026.length || 1)) * 100)}%`],
    ]);
    ws3['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wbOut, ws3, 'Riepilogo');

    const buffer = XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="confronto_730_2025_2026.xlsx"',
      },
    });
  } catch (error) {
    console.error('Errore confronto 2025:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
