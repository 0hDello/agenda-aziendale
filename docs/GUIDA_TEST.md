# Guida di Collaudo e Test Manuali

Questa guida fornisce la procedura passo-passo per verificare che tutte le funzionalità delle agende continuino a funzionare perfettamente dopo il refactoring.

---

## 1. Come Avviare l'Applicazione

Nel terminale, assicurati che il database locale sia attivo e avvia il server di sviluppo:

```bash
npm run dev
```

Apri il browser su [http://localhost:3000](http://localhost:3000).

---

## 2. Checklist Test Agenda 730 (`/agenda/730`)

### A. Navigazione & Viste
- [ ] **Cambio Sede**: Seleziona Imola, Borgo Tossignano e Castel San Pietro Terme dal menu a tendina. Verifica che gli operatori e le colonne orarie si aggiornino.
- [ ] **Vista Giornaliera vs Mensile**: Clicca sui pulsanti "Giornaliera" e "Mensile" nella barra superiore. Verifica che il passaggio sia fluido.
- [ ] **Scorrimento Infinito (Infinite Scroll)**: Nella vista giornaliera, scorri la tabella verso il basso e verso l'alto; verifica che vengano caricati ulteriori giorni senza scatti visivi.
- [ ] **Data Picker**: Clicca sul riquadro centrale della data (es. "mercoledì 16 settembre 2026") e seleziona un giorno qualsiasi del calendario o premi "Vai a Oggi".
- [ ] **Frecce Prev / Next**: Clicca sulle frecce `<` e `>` per avanzare o retrocedere di un giorno (o di un mese se in vista mensile).

### B. Gestione Appuntamenti
- [ ] **Nuovo Appuntamento**: Clicca su uno slot orario libero per un operatore. Verifica che si apra la finestra `AppointmentModal`, compila i dati (cliente, note) e salva. L'appuntamento deve comparire immediatamente.
- [ ] **Modifica Appuntamento**: Clicca su un appuntamento esistente, modifica una nota e salva.
- [ ] **Trascina & Rilascia (Drag and Drop)**: Trascina un appuntamento da uno slot orario a un altro per lo stesso operatore o un altro operatore.
- [ ] **Cancellazione**: Clicca sull'appuntamento ed eliminalo confermando l'avviso.

### C. Modalità Modifica (Blocco / Sblocco Slot)
- [ ] Clicca sull'icona del lucchetto (arancione quando attiva).
- [ ] Clicca su uno slot vuoto: deve apparire la richiesta del motivo di chiusura (es. "Ferie") e lo slot deve diventare grigio scuro con l'etichetta `uff. chiuso`.
- [ ] Clicca nuovamente sullo slot bloccato: deve sbloccarsi tornando libero.
- [ ] Esci dalla modalità modifica disattivando il lucchetto.

### D. Ricerca Rapida & Stampa
- [ ] **Ricerca (Ctrl+K o pulsante "Cerca")**: Premi `Ctrl+K`, digita il nome di un cliente o una data. Clicca sul risultato e verifica che il calendario salti automaticamente a quel giorno/sede.
- [ ] **Stampa (Pulsante "Stampa")**: Clicca sul pulsante "Stampa", seleziona un intervallo date e uno o più operatori. Clicca su "Stampa": deve aprirsi l'anteprima di stampa A4 con le tabelle formattate.

---

## 3. Checklist Test Agenda EPASA (`/agenda/epasa`)

- [ ] **Caricamento Pagina**: Accedi a `/agenda/epasa`. Verifica la visualizzazione degli operatori EPASA e delle fasce orarie.
- [ ] **Cambio Sede**: Seleziona Imola, Borgo o CSPT. Verifica le regole di presenza operatore per ciascuna sede.
- [ ] **Vista Loredana**: Clicca sull'interruttore/pulsante dedicato per accedere alla vista personalizzata di Loredana.
- [ ] **Inserimento & Modifica Appuntamenti**: Testa l'apertura della modale `EpasaAppointmentModal` e il salvataggio di un appuntamento.
- [ ] **Ricerca e Stampa EPASA**: Verifica il funzionamento della ricerca e dell'anteprima di stampa.

---

## 4. Conferma Fine Test

Una volta completata la verifica:
- Se riscontri qualsiasi comportamento anomalo, segnalalo per un rapido aggiustamento.
- Se tutto funziona come desiderato, potrai procedere al commit in autonomia quando preferisci.
