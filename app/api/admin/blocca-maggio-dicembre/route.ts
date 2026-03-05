import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getTimeSlotsForSede, getEndTimeSlotsForSede, isSedeWorkingDay } from '@/utils/dateUtils';
import { format, addDays, isWeekend } from 'date-fns';

/**
 * GET /api/admin/blocca-maggio-dicembre
 *
 * Script one-shot: inserisce "UFF CHIUSO" su slot specifici per sede e persona
 * dal 1° maggio 2026 all'ultimo giorno lavorativo di dicembre 2026.
 *
 * Regole:
 * - Imola  | Collega 2 → blocca martedì (2), mercoledì (3), giovedì (4)
 * - Imola  | Collega 1 → blocca mercoledì (3)
 * - CSPT   | Collega 2 → blocca lunedì (1) e venerdì (5)
 * - Borgo  | Collega 1 → blocca tutti i giorni tranne mercoledì (3)
 *
 * - Salta i weekend e i giorni non lavorativi per la sede.
 * - Idempotente: salta slot già occupati o già bloccati.
 */

// Nomi reali da adattare al valore nel DB (case-insensitive match nella query)
const NOME_COLLEGA_1 = 'collega 1'; // ← sostituisci col nome reale nel DB
const NOME_COLLEGA_2 = 'collega 2'; // ← sostituisci col nome reale nel DB

const NOME_SEDE_IMOLA = 'imola';
const NOME_SEDE_CSPT  = 'cspt';
const NOME_SEDE_BORGO = 'borgo';

/**
 * Restituisce true se questo (sede, persona, dayOfWeek) deve essere bloccato.
 * dow: 0=dom, 1=lun, 2=mar, 3=mer, 4=gio, 5=ven, 6=sab
 */
function deveEssereBloccato(
  sedeNome: string,
  personaNome: string,
  dow: number
): boolean {
  const sede    = sedeNome.toLowerCase();
  const persona = personaNome.toLowerCase();

  // Imola | Collega 2 → mar(2), mer(3), gio(4)
  if (sede.includes(NOME_SEDE_IMOLA) && persona.includes(NOME_COLLEGA_2)) {
    return [2, 3, 4].includes(dow);
  }

  // Imola | Collega 1 → mer(3)
  if (sede.includes(NOME_SEDE_IMOLA) && persona.includes(NOME_COLLEGA_1)) {
    return dow === 3;
  }

  // CSPT | Collega 2 → lun(1), ven(5)
  if (sede.includes(NOME_SEDE_CSPT) && persona.includes(NOME_COLLEGA_2)) {
    return [1, 5].includes(dow);
  }

  // Borgo | Collega 1 → tutti tranne mer(3)
  if (sede.includes(NOME_SEDE_BORGO) && persona.includes(NOME_COLLEGA_1)) {
    return dow !== 3;
  }

  // Nessuna regola: non bloccare
  return false;
}

export async function GET() {
  try {
    const startDay = new Date(2026, 4, 1);  // 1° maggio 2026
    const endDay   = new Date(2026, 11, 31); // 31 dicembre 2026

    // Carica sedi, persone e associazioni
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
          // Salta giorni non lavorativi per questa sede
          if (!isSedeWorkingDay(sede.nome, current)) {
            continue;
          }

          // Persone associate a questa sede
          const sedePersone = persone.filter(p =>
            ps.some(r => r.persona_id === p.id && r.sede_id === sede.id)
          );

          const slots    = getTimeSlotsForSede(sede.nome, current);
          const endSlots = getEndTimeSlotsForSede(sede.nome, current);

          for (const persona of sedePersone) {
            // Applica le regole: se non va bloccato, salta
            if (!deveEssereBloccato(sede.nome, persona.nome, dow)) {
              continue;
            }

            for (let i = 0; i < slots.length; i++) {
              const oraInizio = slots[i].label;
              const oraFine   = endSlots[i + 1]?.label ?? endSlots[endSlots.length - 1].label;

              // Controlla se esiste già qualcosa su questo slot
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

              // Inserisce UFF CHIUSO
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
