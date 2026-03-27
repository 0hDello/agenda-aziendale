import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// ── Levenshtein distance ──────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function normalize(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, ' ');
}

// Verifica se due token singoli sono "fuzzy-uguali":
// accetta 1 errore per token corti (<=6), 2 errori per token più lunghi
function tokenFuzzy(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  const dist = levenshtein(t1, t2);
  const maxL = Math.max(t1.length, t2.length);
  const maxErrors = maxL <= 6 ? 1 : 2;
  return dist <= maxErrors;
}

// Fuzzy token-set: ogni token di t1 deve trovare un match fuzzy in t2 (biunivoco)
// Gestisce ordine qualsiasi (nome/cognome invertiti) + piccoli typo per token
function fuzzyTokenSetMatch(tokens1: string[], tokens2: string[]): boolean {
  if (tokens1.length === 0 || tokens2.length !== tokens1.length) return false;
  const used = new Array(tokens2.length).fill(false);
  for (const t1 of tokens1) {
    let found = false;
    for (let j = 0; j < tokens2.length; j++) {
      if (!used[j] && tokenFuzzy(t1, tokens2[j])) {
        used[j] = true;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

// Dato un nome 2026 e una lista di nomi 2025 ("COGNOME NOME"),
// restituisce il miglior match o null
function findMatch(
  name2026: string,
  names2025: string[]
): { matched: string; method: string } | null {
  const n = normalize(name2026);
  if (!n) return null;

  const tokens2026 = n.split(' ').filter(t => t.length > 1);

  let bestScore = Infinity;
  let bestName = '';

  for (const name25 of names2025) {
    const n25 = normalize(name25);

    // 1. Corrispondenza esatta
    if (n === n25) return { matched: n25, method: 'esatto' };

    const tokens2025 = n25.split(' ').filter(t => t.length > 1);

    // 2. Token-set esatto: stessi token in ordine qualsiasi
    if (tokens2026.length > 0 && tokens2025.length === tokens2026.length) {
      const sorted1 = [...tokens2026].sort().join(' ');
      const sorted2 = [...tokens2025].sort().join(' ');
      if (sorted1 === sorted2) return { matched: n25, method: 'token-set' };
    }

    // 3. Fuzzy token-set: ogni token ha una corrispondenza fuzzy (gestisce typo + ordine)
    if (fuzzyTokenSetMatch(tokens2026, tokens2025)) {
      return { matched: n25, method: 'fuzzy-token' };
    }

    // 4. Accumula il miglior Levenshtein sull'intero nome
    const dist = levenshtein(n, n25);
    if (dist < bestScore) {
      bestScore = dist;
      bestName = n25;
    }
  }

  // 5. Fuzzy full-name: accetta se distanza ≤ 20% della lunghezza e ≤ 4 caratteri
  const maxLen = Math.max(n.length, bestName.length);
  if (bestScore <= 4 && maxLen > 0 && bestScore / maxLen < 0.2) {
    return { matched: bestName, method: `fuzzy(d=${bestScore})` };
  }

  return null;
}

export async function GET() {
  try {
    // ── 1. Leggi il file Excel 2025 ───────────────────────────────────────────
    const xlsxPath = path.join(
      process.cwd(),
      'ELENCO COMPLETO 730 elaborati nel 2025.xlsx'
    );
    if (!fs.existsSync(xlsxPath)) {
      return NextResponse.json(
        { error: 'File Excel 2025 non trovato nel progetto.' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(xlsxPath);
    const wb2025 = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws2025 = wb2025.Sheets[wb2025.SheetNames[0]];
    const raw2025: any[][] = XLSX.utils.sheet_to_json(ws2025, { header: 1 });

    // Le intestazioni sono alla riga indice 3, i dati partono dall'indice 4
    // cognome = col 7, nome = col 8
    const names2025: string[] = [];
    for (let i = 4; i < raw2025.length; i++) {
      const row = raw2025[i];
      const cognome = String(row[7] ?? '').trim();
      const nome = String(row[8] ?? '').trim();
      if (cognome || nome) {
        names2025.push(normalize(`${cognome} ${nome}`).trim());
      }
    }

    // ── 2. Carica appuntamenti 2026 dal DB ────────────────────────────────────
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
    const assenti: { cliente_2026: string }[] = [];

    for (const c of clienti2026) {
      const match = findMatch(c, names2025);
      if (match) {
        presenti.push({
          cliente_2026: c,
          corrispondenza_2025: match.matched,
          metodo: match.method,
        });
      } else {
        assenti.push({ cliente_2026: c });
      }
    }

    // ── 4. Genera Excel di output ─────────────────────────────────────────────
    const wbOut = XLSX.utils.book_new();

    // Foglio 1: presenti in entrambi gli anni
    const sheet1Data = [
      ['Cliente 2026', 'Corrispondenza 2025', 'Metodo match'],
      ...presenti.map(r => [r.cliente_2026, r.corrispondenza_2025, r.metodo]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wbOut, ws1, 'Presenti 2025 e 2026');

    // Foglio 2: solo in 2026
    const sheet2Data = [
      ['Cliente 2026 (non trovato nel 2025)'],
      ...assenti.map(r => [r.cliente_2026]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!cols'] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wbOut, ws2, 'Solo 2026');

    // Foglio 3: riepilogo
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Riepilogo confronto 730 2025 vs 2026'],
      [],
      ['Clienti 2026 totali', clienti2026.length],
      ['Presenti anche nel 2025', presenti.length],
      ['Non presenti nel 2025', assenti.length],
      ['Percentuale ritorni', `${Math.round((presenti.length / (clienti2026.length || 1)) * 100)}%`],
    ]);
    ws3['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wbOut, ws3, 'Riepilogo');

    const buffer = XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="confronto_730_2025_2026.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Errore confronto 2025:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
