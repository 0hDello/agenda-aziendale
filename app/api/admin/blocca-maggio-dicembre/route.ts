import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getTimeSlotsForSede, getEndTimeSlotsForSede, isSedeWorkingDay } from '@/utils/dateUtils';
import { format, addDays, isWeekend } from 'date-fns';

/**
 * GET /api/admin/blocca-maggio-dicembre
 *
 * Script one-shot: inserisce "UFF CHIUSO" su slot specifici per sede e persona
 * dal 1° maggio 2026 al 31 dicembre 2026.
 *
 * Regole:
 * - IMOLA  | COLLEGA 2 → martedì (2), mercoledì (3), giovedì (4)
 * - IMOLA  | COLLEGA 1 → mercoledì (3)
 * - CSPT   | COLLEGA 2 → lunedì (1), venerdì (5)
 * - BORGO  | COLLEGA 1 → tutti tranne mercoledì (3)
 *
 * - Salta i weekend e i giorni non lavorativi per la sede.
 * - Idempotente: salta slot già occupati o già bloccati.
 */

function deveEssereBloccato(
  sedeNome: string,
  personaNome: string,
  dow: number
): boolean {
  const sede    = sedeNome.toUpperCase().trim();
  const persona = personaNome.toUpperCase().trim();

  // IMOLA | COLLEGA 2 → mar(2), mer(3), gio(4)
  if (sede === 'IMOLA' && persona === 'COLLEGA 2') {
    return [2, 3, 4].includes(dow);
  }

  // IMOLA | COLLEGA 1 → mer(3)
  if (sede === 'IMOLA' && persona === 'COLLEGA 1') {
    return dow === 3;
  }

  // CSPT | COLLEGA 2 → lun(1), ven(5)
  if (sede === 'CSPT' && persona === 'COLLEGA 2') {
    return [1, 5].includes(dow);
  }

  // BORGO | COLLEGA 1 → tutti tranne mer(3)
  if (sede === 'BORGO' && persona === 'COLLEGA 1') {
    return dow !== 3;
  }

  return false;
}

export async function GET() {
  try {
    const startDay = new Date(2026, 4, 1);   // 1° maggio 2026
    const endDay   = new Date(2026, 11, 31); // 31 dicembre 2026

    const [sediRes, personeRes, psRes] = await Promise.all([
      query('SELECT * FROM sedi ORDER BY nome'),
      query('SELECT * FROM persone ORDER BY nome'),
      query('SELECT * FROM persona_sede'),
    ]);
    const sedi    = sediRes.rows;
    const persone = personeRes.rows;
    const ps      = psRes.rows as { persona_id: string; sede_id: string }[];

    let inserted = 0;
    let skipped  = 0;

    let current = new Date(startDay);
    while (current <= endDay) {
      if (!isWeekend(current)) {
        const dateStr = format(current, 'yyyy-MM-dd');
        const dow     = current.getDay();

        for (const sede of sedi) {
          if (!isSedeWorkingDay(sede.nome, current)) {
            continue;
          }

          const sedePersone = persone.filter(p =>
            ps.some(r => r.persona_id === p.id && r.sede_id === sede.id)
          );

          const slots    = getTimeSlotsForSede(sede.nome, current);
          const endSlots = getEndTimeSlotsForSede(sede.nome, current);

          for (const persona of sedePersone) {
            if (!deveEssereBloccato(sede.nome, persona.nome, dow)) {
              continue;
            }

            for (let i = 0; i < slots.length; i++) {
              const oraInizio = slots[i].label;
              const oraFine   = endSlots[i + 1]?.label ?? endSlots[endSlots.length - 1].label;

              const existing = await query(
                `SELECT id FROM appuntamenti
                 WHERE persona_id = $1
                   AND sede_id    = $2
                   AND data       = $3
                   AND ora_inizio = $4`,
                [persona.id, sede.id, dateStr, oraInizio]
              );

              if (existing.rows.length > 0) {
                skipped++;
                continue;
              }

              await query(
                `INSERT INTO appuntamenti
                   (persona_id, sede_id, data, ora_inizio, ora_fine, cliente, note, highlight, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, 'UFF CHIUSO', '', NULL, NOW(), NOW())`,
                [persona.id, sede.id, dateStr, oraInizio, oraFine]
              );
              inserted++;
            }
          }
        }
      }
      current = addDays(current, 1);
    }

    return NextResponse.json({
      success: true,
      message: `Blocco maggio-dicembre completato: ${inserted} slot bloccati, ${skipped} già occupati/saltati`,
      inserted,
      skipped,
    });
  } catch (error) {
    console.error('Errore blocca-maggio-dicembre:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
