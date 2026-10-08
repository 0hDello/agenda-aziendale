import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns';
import {
  categorizeEpasaAppointment,
  LOREDANA_CATEGORIES,
  MILECE_CATEGORIES,
  PracticeCategory,
} from '@/lib/epasaCategorization';
import {
  TIME_SLOTS_IMOLA,
  TIME_SLOTS_IMOLA_AFTERNOON_2027,
  TIME_SLOTS_CSPT,
  TIME_SLOTS_BORGO,
  isBorgoWorkingDay,
  isMileceWorkingDay,
  isMileceAfternoonWorkingDay,
} from '@/components/epasa/types';

interface SedeRow {
  id: string;
  nome: string;
}

interface OperatoreRow {
  id: string;
  nome: string;
}

interface GiornoChiusoRow {
  data: string | Date;
  operatore_id: string | null;
}

interface AppuntamentoRow {
  id: string;
  sede_id: string;
  operatore_id: string;
  data: string | Date;
  ora: string;
  cliente: string;
  note: string | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get('anno');
    const anno = annoParam ? parseInt(annoParam, 10) : 2026;

    // Carica dati da DB
    const [sediRes, opRes, appRes, gcRes] = await Promise.all([
      query('SELECT id, nome FROM epasa_sedi ORDER BY id'),
      query('SELECT id, nome FROM epasa_operatori ORDER BY id'),
      query(
        `SELECT id, sede_id, operatore_id, data, ora, cliente, note
         FROM epasa_appuntamenti
         WHERE EXTRACT(YEAR FROM data::date) = $1
         ORDER BY data, ora`,
        [anno]
      ),
      query('SELECT data, operatore_id FROM epasa_giorni_chiusi'),
    ]);

    const sedi: SedeRow[] = sediRes.rows.length
      ? sediRes.rows
      : [
          { id: 'imola', nome: 'Imola' },
          { id: 'cspt', nome: 'Castel San Pietro Terme' },
          { id: 'borgo', nome: 'Borgo Tossignano' },
        ];

    const operatori: OperatoreRow[] = opRes.rows.length
      ? opRes.rows
      : [
          { id: 'LOREDANA', nome: 'Loredana' },
          { id: 'MILECE', nome: 'Milece' },
        ];

    const giorniChiusi: GiornoChiusoRow[] = gcRes.rows;

    const uffChiusoSet = new Set<string>();
    const bookedAppointments: Array<{
      id: string;
      sede_id: string;
      sedeNome: string;
      operatore_id: string;
      data: string;
      ora: string;
      cliente: string;
      note: string;
      categoria: PracticeCategory;
    }> = [];

    const sedeMap = new Map(sedi.map(s => [s.id, s.nome]));

    for (const r of appRes.rows as AppuntamentoRow[]) {
      const dataStr =
        r.data instanceof Date ? format(r.data, 'yyyy-MM-dd') : String(r.data).split('T')[0];
      const oraStr = typeof r.ora === 'string' ? r.ora.substring(0, 5) : '';
      const isUffChiuso = r.cliente && r.cliente.trim().toUpperCase() === 'UFF CHIUSO';

      if (isUffChiuso) {
        uffChiusoSet.add(`${r.sede_id}_${r.operatore_id}_${dataStr}_${oraStr}`);
      } else if (r.cliente && r.cliente.trim() !== '') {
        const cat = categorizeEpasaAppointment(r.operatore_id, r.cliente, r.note);
        bookedAppointments.push({
          id: String(r.id),
          sede_id: r.sede_id,
          sedeNome: sedeMap.get(r.sede_id) || r.sede_id,
          operatore_id: r.operatore_id,
          data: dataStr,
          ora: oraStr,
          cliente: r.cliente,
          note: r.note || '',
          categoria: cat,
        });
      }
    }

    const isClosedDay = (dateStr: string, opId: string) =>
      giorniChiusi.some(c => {
        const cDate =
          c.data instanceof Date ? format(c.data, 'yyyy-MM-dd') : String(c.data).split('T')[0];
        return cDate === dateStr && (!c.operatore_id || c.operatore_id === opId);
      });

    const mesiLabels = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
    ];

    // Helper calcolo capacità slot
    const calcSlotCapacity = (opId: string, sId: string, mIndex: number) => {
      const start = startOfMonth(new Date(anno, mIndex, 1));
      const end = endOfMonth(new Date(anno, mIndex, 1));
      const days = eachDayOfInterval({ start, end });
      let cap = 0;

      for (const day of days) {
        const dow = getDay(day); // 0=Dom, 1=Lun, ..., 6=Sab
        if (dow === 0 || dow === 6) continue;
        const dStr = format(day, 'yyyy-MM-dd');

        if (sId === 'cspt') {
          if (opId !== 'LOREDANA' || dow !== 1) continue;
          if (isClosedDay(dStr, opId)) continue;
          for (const slot of TIME_SLOTS_CSPT) {
            if (uffChiusoSet.has(`${sId}_${opId}_${dStr}_${slot}`)) continue;
            cap++;
          }
        } else if (sId === 'borgo') {
          if (opId !== 'LOREDANA' || !isBorgoWorkingDay(day)) continue;
          if (isClosedDay(dStr, opId)) continue;
          for (const slot of TIME_SLOTS_BORGO) {
            if (uffChiusoSet.has(`${sId}_${opId}_${dStr}_${slot}`)) continue;
            cap++;
          }
        } else if (sId === 'imola') {
          if (opId === 'LOREDANA') {
            if (isClosedDay(dStr, opId)) continue;
            for (const slot of TIME_SLOTS_IMOLA) {
              if (uffChiusoSet.has(`${sId}_${opId}_${dStr}_${slot}`)) continue;
              cap++;
            }
          } else if (opId === 'MILECE') {
            if (!isMileceWorkingDay(day)) continue;
            if (isClosedDay(dStr, opId)) continue;
            const slots = isMileceAfternoonWorkingDay(day)
              ? [...TIME_SLOTS_IMOLA, ...TIME_SLOTS_IMOLA_AFTERNOON_2027]
              : TIME_SLOTS_IMOLA;
            for (const slot of slots) {
              if (slot === '08:00') continue;
              if (uffChiusoSet.has(`${sId}_${opId}_${dStr}_${slot}`)) continue;
              cap++;
            }
          }
        }
      }
      return cap;
    };

    // Costruzione statistiche per ciascun operatore
    const operatoriStats = operatori.map(op => {
      const opId = op.id.toUpperCase();
      const opAppointments = bookedAppointments.filter(
        a => a.operatore_id.toUpperCase() === opId
      );

      // Sedi attive per l'operatore
      const activeSedi = opId === 'MILECE'
        ? sedi.filter(s => s.id === 'imola')
        : sedi;

      // Capacità e prenotati mese per mese
      const perMese: Record<string, { mese: string; meseNumero: number; capacita: number; prenotati: number }> = {};
      const perSedePerMese: Record<string, Record<string, { mese: string; meseNumero: number; capacita: number; prenotati: number }>> = {};

      for (const sede of activeSedi) {
        perSedePerMese[sede.nome] = {};
      }

      for (let m = 0; m < 12; m++) {
        const meseNum = m + 1;
        const meseKey = `${anno}-${String(meseNum).padStart(2, '0')}`;
        const meseLabel = `${mesiLabels[m]} ${anno}`;

        let totMeseCap = 0;
        let totMesePre = opAppointments.filter(a => {
          const aM = parseInt(a.data.substring(5, 7), 10);
          return aM === meseNum;
        }).length;

        for (const sede of activeSedi) {
          const capSede = calcSlotCapacity(opId, sede.id, m);
          const preSede = opAppointments.filter(a => {
            const aM = parseInt(a.data.substring(5, 7), 10);
            return aM === meseNum && a.sede_id === sede.id;
          }).length;

          totMeseCap += capSede;
          perSedePerMese[sede.nome][meseKey] = {
            mese: meseLabel,
            meseNumero: meseNum,
            capacita: capSede,
            prenotati: preSede,
          };
        }

        perMese[meseKey] = {
          mese: meseLabel,
          meseNumero: meseNum,
          capacita: totMeseCap,
          prenotati: totMesePre,
        };
      }

      const totaleCapacita = Object.values(perMese).reduce((acc, v) => acc + v.capacita, 0);
      const totalePrenotati = opAppointments.length;
      const occupazionePerc = totaleCapacita > 0 ? Math.round((totalePrenotati / totaleCapacita) * 100) : 0;

      // Statistiche per tipologia di pratica
      const availableCategories = opId === 'MILECE' ? MILECE_CATEGORIES : LOREDANA_CATEGORIES;
      const praticheStats = Object.values(availableCategories).map(cat => {
        const matchingApts = opAppointments.filter(a => a.categoria.id === cat.id);
        const count = matchingApts.length;
        const percentuale = totalePrenotati > 0 ? Math.round((count / totalePrenotati) * 100) : 0;

        const perMeseCat: Record<number, number> = {};
        for (let m = 1; m <= 12; m++) perMeseCat[m] = 0;
        const perSedeCat: Record<string, number> = {};
        for (const s of sedi) perSedeCat[s.id] = 0;

        for (const apt of matchingApts) {
          const m = parseInt(apt.data.substring(5, 7), 10);
          perMeseCat[m] = (perMeseCat[m] || 0) + 1;
          perSedeCat[apt.sede_id] = (perSedeCat[apt.sede_id] || 0) + 1;
        }

        return {
          id: cat.id,
          label: cat.label,
          description: cat.description,
          colore: cat.color,
          badgeBg: cat.badgeBg,
          badgeText: cat.badgeText,
          count,
          percentuale,
          perMese: perMeseCat,
          perSede: perSedeCat,
        };
      });

      // Ordina pratiche: prima quelle con più appuntamenti
      praticheStats.sort((a, b) => b.count - a.count);

      return {
        id: opId,
        nome: op.nome,
        sedi: activeSedi.map(s => s.nome),
        totaleCapacita,
        totalePrenotati,
        occupazionePerc,
        perMese,
        perSedePerMese,
        pratiche: praticheStats,
      };
    });

    // Totale complessivo EPASA
    const totaleCapacitaGlobale = operatoriStats.reduce((acc, o) => acc + o.totaleCapacita, 0);
    const totalePrenotatiGlobale = bookedAppointments.length;
    const occupazioneGlobale =
      totaleCapacitaGlobale > 0 ? Math.round((totalePrenotatiGlobale / totaleCapacitaGlobale) * 100) : 0;

    // Per sede globale
    const perSedeGlobale: Record<string, { capacita: number; prenotati: number; occupazionePerc: number }> = {};
    for (const sede of sedi) {
      let cap = 0;
      let pre = 0;
      for (const op of operatoriStats) {
        if (op.perSedePerMese[sede.nome]) {
          const meseVals = Object.values(op.perSedePerMese[sede.nome]);
          cap += meseVals.reduce((acc, v) => acc + v.capacita, 0);
          pre += meseVals.reduce((acc, v) => acc + v.prenotati, 0);
        }
      }
      perSedeGlobale[sede.nome] = {
        capacita: cap,
        prenotati: pre,
        occupazionePerc: cap > 0 ? Math.round((pre / cap) * 100) : 0,
      };
    }

    // Totale pratiche unificate
    const praticheMap = new Map<string, { label: string; colore: string; badgeBg: string; badgeText: string; count: number }>();
    for (const op of operatoriStats) {
      for (const pr of op.pratiche) {
        if (pr.count === 0) continue;
        const existing = praticheMap.get(pr.id);
        if (existing) {
          existing.count += pr.count;
        } else {
          praticheMap.set(pr.id, {
            label: pr.label,
            colore: pr.colore,
            badgeBg: pr.badgeBg,
            badgeText: pr.badgeText,
            count: pr.count,
          });
        }
      }
    }

    const praticheTotali = Array.from(praticheMap.entries()).map(([id, data]) => ({
      id,
      ...data,
      percentuale: totalePrenotatiGlobale > 0 ? Math.round((data.count / totalePrenotatiGlobale) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      anno,
      sedi,
      operatori,
      operatoriStats,
      totaleGlobale: {
        totaleCapacita: totaleCapacitaGlobale,
        totalePrenotati: totalePrenotatiGlobale,
        occupazionePerc: occupazioneGlobale,
        perSede: perSedeGlobale,
        praticheTotali,
      },
    });
  } catch (error) {
    console.error('Errore API statistiche EPASA:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
