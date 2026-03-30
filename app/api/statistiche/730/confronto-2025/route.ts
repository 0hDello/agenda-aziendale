import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

function normalize(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ');
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

function tokenFuzzy(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  const maxErrors = Math.max(t1.length, t2.length) <= 6 ? 1 : 2;
  return levenshtein(t1, t2) <= maxErrors;
}

function fuzzyTokenSetMatch(tokens1: string[], tokens2: string[]): boolean {
  if (tokens1.length === 0 || tokens2.length !== tokens1.length) return false;
  const used = new Array(tokens2.length).fill(false);
  for (const t1 of tokens1) {
    let found = false;
    for (let j = 0; j < tokens2.length; j++) {
      if (!used[j] && tokenFuzzy(t1, tokens2[j])) { used[j] = true; found = true; break; }
    }
    if (!found) return false;
  }
  return true;
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
  const n = normalize(name2026);
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
      SELECT DISTINCT UPPER(TRIM(cliente)) AS cliente
      FROM appuntamenti
      WHERE EXTRACT(YEAR FROM data::date) = 2026
        AND cliente IS NOT NULL
        AND TRIM(cliente) <> ''
        AND UPPER(TRIM(cliente)) <> 'UFF CHIUSO'
      ORDER BY 1
    `);

    const clienti2026: string[] = res.rows.map((r: any) => normalize(r.cliente));

    // ── 3. Match ──────────────────────────────────────────────────────────────
    const presenti: { cliente_2026: string; corrispondenza_2025: string; metodo: string }[] = [];
    const assenti:  { cliente_2026: string }[] = [];

    for (const c of clienti2026) {
      const match = findMatch(c, idx);
      if (match) presenti.push({ cliente_2026: c, corrispondenza_2025: match.matched, metodo: match.method });
      else       assenti.push({ cliente_2026: c });
    }

    // ── 4. Genera Excel di output ─────────────────────────────────────────────
    const wbOut = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Cliente 2026', 'Corrispondenza 2025', 'Metodo match'],
      ...presenti.map(r => [r.cliente_2026, r.corrispondenza_2025, r.metodo]),
    ]);
    ws1['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wbOut, ws1, 'Presenti 2025 e 2026');

    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Cliente 2026 (non trovato nel 2025)'],
      ...assenti.map(r => [r.cliente_2026]),
    ]);
    ws2['!cols'] = [{ wch: 40 }];
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
