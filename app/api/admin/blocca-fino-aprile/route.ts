import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { getTimeSlotsForSede, getEndTimeSlotsForSede, isSedeWorkingDay } from '@/utils/dateUtils';
import { format, addDays, isWeekend } from 'date-fns';

/**
 * GET /api/admin/blocca-fino-aprile
 *
 * Script one-shot: inserisce "UFF CHIUSO" su tutti gli slot liberi
 * di ogni sede + persona dal giorno odierno fino al 30 aprile 2026 (incluso).
 * Dal 1° maggio in poi nessuno slot viene toccato → l'agenda torna libera.
 *
 * - Salta i weekend e i giorni non lavorativi per la sede.
 * - Salta gli slot che hanno già un appuntamento reale (cliente != 'UFF CHIUSO').
 * - Salta gli slot che hanno già un 'UFF CHIUSO' (idempotente).
 * - Usa INSERT per ogni slot: sicuro da richiamare più volte.
 */
export async function GET() {
  try {
    const today  = new Date();
    const endDay = new Date(2026, 3, 30); // 30 aprile 2026

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

    // Itera ogni giorno da oggi al 30 aprile
    let current = new Date(today);
    while (current <= endDay) {
      if (!isWeekend(current)) {
        const dateStr = format(current, 'yyyy-MM-dd');
        const dow     = current.getDay();

        for (const sede of sedi) {
          // Verifica se il giorno è lavorativo per questa sede
          if (!isSedeWorkingDay(sede.nome, current)) {
            current = addDays(current, 1);
            continue;
          }

          // Persone associate a questa sede
          const sedePersone = persone.filter(p =>
            ps.some(r => r.persona_id === p.id && r.sede_id === sede.id)
          );

          const slots    = getTimeSlotsForSede(sede.nome, current);
          const endSlots = getEndTimeSlotsForSede(sede.nome, current);

          for (const persona of sedePersone) {
            for (let i = 0; i < slots.length; i++) {
              const oraInizio = slots[i].label;
              const oraFine   = endSlots[i + 1]?.label ?? endSlots[endSlots.length - 1].label;

              // Controlla se esiste già qualcosa su questo slot
              const existing = await query(
                `SELECT id, cliente FROM appuntamenti
                 WHERE persona_id = $1
                   AND sede_id    = $2
                   AND data       = $3
                   AND ora_inizio = $4`,
                [persona.id, sede.id, dateStr, oraInizio]
              );

              if (existing.rows.length > 0) {
                // Slot già occupato (reale o già bloccato): salta
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
      message: `Blocco completato: ${inserted} slot bloccati, ${skipped} già occupati/saltati`,
      inserted,
      skipped,
    });
  } catch (error) {
    console.error('Errore blocca-fino-aprile:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
