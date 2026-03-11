import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isWeekend } from 'date-fns';
import {
  getTimeSlotsForSede,
  isSedeWorkingDay,
  SABATI_730_ECCEZIONE,
} from '@/utils/dateUtils';

// Mesi da considerare: da gennaio 2026 al mese corrente + 1
const ANNO = 2026;
const MESI = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

interface PersonaRow {
  id: number;
  nome: string;
}
interface SedeRow {
  id: number;
  nome: string;
}
interface PersonaSedeRow {
  persona_id: number;
  sede_id: number;
}
interface AppRow {
  persona_id: number;
  sede_id: number;
  data: string;
  ora_inizio: string;
  cliente: string;
}
interface GiornoChiusoRow {
  data: string;
  persona_id: number | null;
}

export async function GET() {
  try {
    const [personeRes, sediRes, psRes, appRes, gcRes] = await Promise.all([
      query('SELECT id, nome FROM persone ORDER BY nome'),
      query('SELECT id, nome FROM sedi ORDER BY nome'),
      query('SELECT persona_id, sede_id FROM persona_sede'),
      query(`SELECT persona_id, sede_id, data, ora_inizio, UPPER(TRIM(cliente)) as cliente
             FROM appuntamenti
             WHERE EXTRACT(YEAR FROM data::date) = ${ANNO}
             ORDER BY data, ora_inizio`),
      query(`SELECT data, persona_id FROM giorni_chiusi`),
    ]);

    const persone: PersonaRow[] = personeRes.rows;
    const sedi: SedeRow[] = sediRes.rows;
    const personaSede: PersonaSedeRow[] = psRes.rows;
    const appointments: AppRow[] = appRes.rows.map((r: any) => ({
      ...r,
      data: r.data instanceof Date ? format(r.data, 'yyyy-MM-dd') : r.data.split('T')[0],
      ora_inizio: r.ora_inizio?.substring(0, 5),
    }));
    const giorniChiusi: GiornoChiusoRow[] = gcRes.rows.map((r: any) => ({
      data: r.data instanceof Date ? format(r.data, 'yyyy-MM-dd') : r.data.split('T')[0],
      persona_id: r.persona_id,
    }));

    const isGiornoChiuso = (dateStr: string, personaId: number) =>
      giorniChiusi.some(
        g => g.data === dateStr && (g.persona_id === null || g.persona_id === personaId)
      );

    // Per ogni persona calcola capacità totale e prenotati per mese
    const risultati = persone.map(persona => {
      // Sedi associate a questa persona
      const sediPersona = personaSede
        .filter(ps => ps.persona_id === persona.id)
        .map(ps => sedi.find(s => s.id === ps.sede_id))
        .filter(Boolean) as SedeRow[];

      const perMese: Record<string, { mese: string; capacita: number; prenotati: number }> = {};

      for (const mese of MESI) {
        const meseStr = `${ANNO}-${String(mese).padStart(2, '0')}`;
        const meseLabel = new Intl.DateTimeFormat('it', { month: 'long', year: 'numeric' }).format(
          new Date(ANNO, mese - 1, 1)
        );

        let capacita = 0;
        let prenotati = 0;

        for (const sede of sediPersona) {
          const giorni = eachDayOfInterval({
            start: startOfMonth(new Date(ANNO, mese - 1, 1)),
            end: endOfMonth(new Date(ANNO, mese - 1, 1)),
          });

          for (const giorno of giorni) {
            const dateStr = format(giorno, 'yyyy-MM-dd');
            // Controlla se è giorno lavorativo per la sede
            if (!isSedeWorkingDay(sede.nome, giorno, '730')) continue;
            // Controlla se giorno chiuso per questa persona/sede
            if (isGiornoChiuso(dateStr, persona.id)) continue;

            const slots = getTimeSlotsForSede(sede.nome, giorno, '730');
            capacita += slots.length;

            // Conta appuntamenti reali (escludi UFF CHIUSO)
            const dayApts = appointments.filter(
              a =>
                a.persona_id === persona.id &&
                a.sede_id === sede.id &&
                a.data === dateStr &&
                a.cliente !== 'UFF CHIUSO'
            );
            prenotati += dayApts.length;
          }
        }

        perMese[meseStr] = { mese: meseLabel, capacita, prenotati };
      }

      // Totali anno
      const totaleCapacita = Object.values(perMese).reduce((s, m) => s + m.capacita, 0);
      const totalePrenotati = Object.values(perMese).reduce((s, m) => s + m.prenotati, 0);

      return {
        id: persona.id,
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
    return NextResponse.json({ error: 'Errore statistiche' }, { status: 500 });
  }
}
