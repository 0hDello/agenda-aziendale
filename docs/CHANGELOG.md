# Changelog - Refactoring Modulare Agende CNA

Tutte le modifiche registrate in questo file sono finalizzate al miglioramento della manutenibilità, leggibilità e separazione delle responsabilità (Separation of Concerns).

---

## [Refactoring Modulare 2026-09-16]

### Obiettivi
- Scomporre i file monolitici `components/Calendar.tsx` (1.227 righe) ed `components/EpasaCalendar.tsx` (1.242 righe).
- Nessuna modifica funzionale visibile all'utente finale (100% retrocompatibile e a zero regressioni).
- Nessun commit o push su Git, in modo da consentire la verifica e il collaudo locale.

---

### Nuovi File Creati

#### Documentazione (`docs/`)
- `docs/ARCHITETTURA.md`: Documento di descrizione dell'architettura e della ripartizione delle responsabilità.
- `docs/CHANGELOG.md`: Registro puntuale di tutte le modifiche e aggiunte.
- `docs/GUIDA_TEST.md`: Checklist di verifica e guida passo-passo per il collaudo dell'utente.

#### Moduli Agenda 730 (`components/calendar/`)
- `components/calendar/types.ts`: Tipi specifici (ViewMode, DayAvailability, PrintOptions, ecc.).
- `components/calendar/useCalendarData.ts`: Hook per recupero dati da API, ricezione SSE, mutazioni ottimistiche (crea, modifica, cancella, blocca/sblocca) e drag-and-drop.
- `components/calendar/useCalendarInfiniteScroll.ts`: Hook per gestione finestra temporale, calcolo giorni visibili e scroll virtuale con preservazione dell'ancora visiva.
- `components/calendar/CalendarHeader.tsx`: Header superiore con cambio vista (giornaliera/mensile), modifica slot, cambio data e selezione sede.
- `components/calendar/CalendarDailyTable.tsx`: Tabella oraria con colonne per operatore e integrazione con celle e `TimeSlot`.
- `components/calendar/CalendarMonthlyView.tsx`: Calendario mensile con calcolo disponibilità e badge primo giorno libero.
- `components/calendar/CalendarSearchModal.tsx`: Modal di ricerca rapida con scorciatoia `Ctrl+K`.
- `components/calendar/CalendarPrintModal.tsx`: Modal di configurazione e rendering della scheda di stampa A4.
- `components/calendar/CalendarDatePickerModal.tsx`: Modal popup del calendario per salto data.

#### Moduli Agenda EPASA (`components/epasa/`)
- `components/epasa/types.ts`: Tipi e interfacce specifiche per EPASA.
- `components/epasa/useEpasaData.ts`: Hook per recupero dati, gestione chiusure e sincronizzazione SSE EPASA.
- `components/epasa/useEpasaInfiniteScroll.ts`: Hook per scroll infinito e navigazione temporale EPASA.
- `components/epasa/EpasaHeader.tsx`: Header EPASA con filtri operatore, vista Loredana e cambio sede.
- `components/epasa/EpasaDailyTable.tsx`: Tabella oraria giornaliera per patronato EPASA.
- `components/epasa/EpasaMonthlyView.tsx`: Vista mensile dedicata per gli operatori EPASA.
- `components/epasa/EpasaSearchModal.tsx`: Ricerca rapida per appuntamenti del patronato.
- `components/epasa/EpasaPrintModal.tsx`: Modal di stampa per EPASA.
- `components/epasa/EpasaDatePickerModal.tsx`: Selettore rapido di data per EPASA.

---

### File Modificati (Refactorizzati)
- `components/Calendar.tsx`: Ridotto da oltre 1.220 righe a un orchestratore compatto e pulito (~130 righe).
- `components/EpasaCalendar.tsx`: Ridotto da oltre 1.240 righe a un orchestratore modulare (~140 righe).

---

### Stato Git
- **Nessun commit effettuato.** Tutti i file risiedono come modifiche/aggiunte non tracciate pronte per il test locale.
