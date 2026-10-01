# Architettura del Progetto - Agenda Aziendale CNA

Questo documento descrive la struttura architetturale dell'applicazione a seguito del refactoring dei componenti monolitici. L'obiettivo è separare la logica applicativa (gestione dati, scroll infinito, mutazioni ottimistiche) dalla presentazione visiva (subcomponenti atomici), garantendo modularità, leggibilità e facilità di estensione.

---

## 1. Panoramica Generale

L'applicazione è basata su **Next.js 16 (App Router)** e **PostgreSQL**.
Le agende principali sono accessibili tramite la route dinamica `/agenda/[id]`:
- **Agenda 730** (`components/Calendar.tsx` e `components/calendar/*`)
- **Agenda EPASA** (`components/EpasaCalendar.tsx` e `components/epasa/*`)
- **Sale Riunioni** (`components/RoomCalendar.tsx`)
- **Audio Medical** (`components/AudioMedicalCalendar.tsx`)

Tutte le agende comunicano in tempo reale tramite **Server-Sent Events (SSE)** esposti dagli endpoint `/api/.../events`.

---

## 2. Architettura Agenda 730 (`components/calendar/`)

Il componente [Calendar.tsx](file:///c:/Users/manuel.dellicarri/Desktop/cna-agenda/agenda-aziendale/components/Calendar.tsx) agisce ora da puro **orchestratore**: importa e coordina i custom hook e i subcomponenti specializzati.

```
components/
├── Calendar.tsx                        # Orchestratore principale (~120 righe)
└── calendar/
    ├── types.ts                        # Tipi, interfacce e costanti UI
    ├── useCalendarData.ts              # Hook: fetching, SSE real-time, mutazioni ottimistiche
    ├── useCalendarInfiniteScroll.ts    # Hook: buffer date, scroll infinito, ancoraggio
    ├── CalendarHeader.tsx              # Barra superiore (viste, sede, ricerca, stampa, lock)
    ├── CalendarDailyTable.tsx          # Tabella giornaliera con slot orari e drag-and-drop
    ├── CalendarMonthlyView.tsx         # Calendario mensile con calcolo disponibilità
    ├── CalendarSearchModal.tsx         # Ricerca globale (Ctrl+K)
    ├── CalendarPrintModal.tsx          # Configurazione e generazione stampa A4
    └── CalendarDatePickerModal.tsx     # Popup per salto rapido di data
```

### Responsabilità dei Moduli 730:

1. **`useCalendarData.ts`**:
   - Esegue il caricamento parallelo di sedi, persone, relazioni persona-sede e appuntamenti.
   - Sottoscrive il flusso SSE `/api/appuntamenti/events` con debouncing e gestione della finestra di mutazione locale per evitare sovrascritture dell'interfaccia.
   - Fornisce le funzioni ottimistiche: `handleCreateAppointment`, `handleUpdateAppointment`, `handleDeleteAppointment`, `handleEditModeSlotClick`, `handleDrop`.
   - Mantiene una mappa indicizzata `appointmentsByDayPerson` per lookup $O(1)$ degli appuntamenti per giorno e operatore.

2. **`useCalendarInfiniteScroll.ts`**:
   - Gestisce la finestra temporale dei giorni visibili (default: 3 giorni passati, 10 giorni futuri).
   - Rileva il superamento delle soglie di scroll in alto e in basso per caricare blocchi di 5 giorni.
   - Usa un layout effect isomorfo con ancora sul DOM (`[data-date="..."]`) per mantenere stabile la posizione dello scroll quando vengono aggiunti giorni all'inizio.
   - Espone la funzione `navigateToDate(date, behavior)`.

3. **`CalendarHeader.tsx`**:
   - Presenta il logo, il badge live/aggiornato, i selettori di modalità (`giornaliera`/`mensile`), il toggle di modifica slot (lock/unlock), i pulsanti prev/next e il selettore della sede.

4. **`CalendarDailyTable.tsx`**:
   - Rendering della tabella oraria a colonne per operatore con colonne orarie fisse a sinistra e a destra.
   - Gestione delle celle chiuse per sede, degli slot "UFF CHIUSO" e integrazione con il componente `TimeSlot` per il drag-and-drop.

5. **`CalendarMonthlyView.tsx`**:
   - Visualizzazione a griglia mensile con codice cromatico (libero, parziale, pieno, chiuso) e badge del primo giorno libero.

6. **`CalendarSearchModal.tsx` & `CalendarPrintModal.tsx` & `CalendarDatePickerModal.tsx`**:
   - Modali isolate con focus trap, accessibilità da tastiera e rendering condizionale.

---

## 3. Architettura Agenda EPASA (`components/epasa/`)

Seguendo lo stesso pattern architetturale, [EpasaCalendar.tsx](file:///c:/Users/manuel.dellicarri/Desktop/cna-agenda/agenda-aziendale/components/EpasaCalendar.tsx) delega la logica ai moduli nella cartella `components/epasa/`:

```
components/
├── EpasaCalendar.tsx                   # Orchestratore principale
└── epasa/
    ├── types.ts                        # Modelli e interfacce specifiche EPASA
    ├── useEpasaData.ts                 # Hook: caricamento dati EPASA, chiusure, SSE e mutazioni
    ├── useEpasaInfiniteScroll.ts       # Hook: navigazione temporale e scroll infinito
    ├── EpasaHeader.tsx                 # Barra superiore e navigazione EPASA
    ├── EpasaDailyTable.tsx             # Griglia oraria giornaliera per operatori EPASA
    ├── EpasaMonthlyView.tsx            # Vista mensile di riepilogo
    ├── EpasaSearchModal.tsx            # Ricerca appuntamenti EPASA
    ├── EpasaPrintModal.tsx             # Generatore di stampa EPASA
    └── EpasaDatePickerModal.tsx        # Selettore rapido data
```

---

## 4. Vantaggi Ottenuti

* **Manutenibilità**: Modificare la grafica dell'header o il comportamento del modale di stampa non tocca minimamente la logica dei dati o il rendering della tabella.
* **Testabilità**: I custom hook (`useCalendarData`, `useCalendarInfiniteScroll`) possono essere testati in isolamento senza dover istanziare l'intero albero grafico.
* **Zero duplicazione**: Ogni componente risponde a una singola responsabilità (SRP - Single Responsibility Principle).
