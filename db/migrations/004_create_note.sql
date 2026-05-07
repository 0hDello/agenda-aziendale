-- Migrazione: tabella note globali
-- Eseguire una volta sul database PostgreSQL

CREATE TABLE IF NOT EXISTS note (
  id          SERIAL PRIMARY KEY,
  titolo      TEXT        NOT NULL DEFAULT '',
  contenuto   TEXT        NOT NULL,
  pinned      BOOLEAN     NOT NULL DEFAULT FALSE,
  colore      VARCHAR(20) NOT NULL DEFAULT 'amber',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_pinned_updated
  ON note (pinned DESC, updated_at DESC);

COMMENT ON TABLE note IS 'Note globali aziendali (non legate a singoli appuntamenti)';
COMMENT ON COLUMN note.colore IS 'Colore della nota: amber, green, blue, pink, gray';
COMMENT ON COLUMN note.pinned IS 'Se true, la nota appare in cima alla lista';
