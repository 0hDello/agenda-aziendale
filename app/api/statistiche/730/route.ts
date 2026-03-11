import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { getTimeSlotsForSede, isSedeWorkingDay } from '@/utils/dateUtils';

const ANNO = 2026;
// Solo aprile (4) → dicembre (12)
const MESI = Array.from({ length: 9 }, (_, i) => i + 4);

interface PersonaRow { id: string; nome: string; }
interface SedeRow    { id: string; nome: string; }
interface PersonaSedeRow { persona_id: string; sede_id: string; }
interface AppRow {
  persona_id: string;
  sede_id:    string;
  data:       string;
  ora_inizio: string;
  ora_fine:   string;
  cliente:    string;
}

export async function GET() {
  try {
    const [personeRes, sediRes, psRes, appRes] = await Promise.all([
      query('SELECT id, nome FROM persone ORDER BY nome'),
      query('SELECT id, nome FROM sedi ORDER BY nome'),
      query('SELECT persona_id, sede_id FROM persona_sede'),
      query(`
        SELECT persona_id, sede_id, data, ora_inizio, ora_fine, UPPER(TRIM(cliente)) AS cliente
        FROM appuntamenti
        WHERE EXTRACT(YEAR FROM data::date) = ${ANNO}
          AND EXTRACT(MONTH FROM data::date) >= 4
        ORDER BY data, ora_inizio
      `),
    ]);

    const persone: PersonaRow[]         = personeRes.rows;
    const sedi: SedeRow[]               = sediRes.rows;
    const personaSede: PersonaSedeRow[] = psRes.rows;

    const appointments: AppRow[] = appRes.rows.map((r: any) => ({
      persona_id: String(r.persona_id),
      sede_id:    String(r.sede_id),
      data: r.data instanceof Date
        ? format(r.data, 'yyyy-MM-dd')
        : String(r.data).split('T')[0],
      ora_inizio: r.ora_inizio?.substring(0, 5) ?? '',
      ora_fine:   r.ora_fine?.substring(0, 5)   ?? '',
      cliente:    r.cliente ?? '',
    }));

    // Gli UFF CHIUSO con ora_inizio–ora_fine coprono più slot:
    // uno slot è bloccato se slot.label >= ora_inizio && slot.label < ora_fine
    const uffChiusoRecords = appointments.filter(a => a.cliente === 'UFF CHIUSO');

    const isSlotUffChiuso = (
      pid: string, sid: string, dateStr: string, slotLabel: string
    ): boolean =>
      uffChiusoRecords.some(
        u =>
          u.persona_id === pid &&
          u.sede_id    === sid &&
          u.data       === dateStr &&
          slotLabel    >= u.ora_inizio &&
          slotLabel    <  u.ora_fine
      );

    const risultati = persone.map(persona => {
      const sediPersona = personaSede
        .filter(ps => String(ps.persona_id) === String(persona.id))
        .map(ps => sedi.find(s => String(s.id) === String(ps.sede_id)))
        .filter(Boolean) as SedeRow[];

      const perMese: Record<string, { mese: string; capacita: number; prenotati: number }> = {};

      for (const mese of MESI) {
        const meseStr   = `${ANNO}-${String(mese).padStart(2, '0')}`;
        const meseLabel = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
          .format(new Date(ANNO, mese - 1, 1));

        let capacita  = 0;
        let prenotati = 0;

        for (const sede of sediPersona) {
          const giorni = eachDayOfInterval({
            start: startOfMonth(new Date(ANNO, mese - 1, 1)),
            end:   endOfMonth(new Date(ANNO, mese - 1, 1)),
          });

          for (const giorno of giorni) {
            const dateStr = format(giorno, 'yyyy-MM-dd');
            if (!isSedeWorkingDay(sede.nome, giorno, '730')) continue;

            const slots = getTimeSlotsForSede(sede.nome, giorno, '730');

            for (const slot of slots) {
              // Slot coperto da UFF CHIUSO → non conta né come capacità né come prenotato
              if (isSlotUffChiuso(String(persona.id), String(sede.id), dateStr, slot.label)) continue;

              capacita++;

              const hasApt = appointments.some(
                a =>
                  String(a.persona_id) === String(persona.id) &&
                  String(a.sede_id)    === String(sede.id) &&
                  a.data               === dateStr &&
                  a.ora_inizio         === slot.label &&
                  a.cliente            !== 'UFF CHIUSO'
              );
              if (hasApt) prenotati++;
            }
          }
        }

        perMese[meseStr] = { mese: meseLabel, capacita, prenotati };
      }

      const totaleCapacita  = Object.values(perMese).reduce((s, m) => s + m.capacita, 0);
      const totalePrenotati = Object.values(perMese).reduce((s, m) => s + m.prenotati, 0);

      return {
        id:   persona.id,
        nome: persona.nome,
        sedi: sediPersona.map(s => s.nome),
        perMese,
        totaleCapacita,
        totalePrenotati,
      };
    });

    return NextResponse.json(risultati);
  } catch (error) {
    console.error('Errore statistiche:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
