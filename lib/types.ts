export interface Sede {
  id: string;
  nome: string;
  created_at?: string;
}

export interface Persona {
  id: string;
  nome: string;
  created_at?: string;
}

export interface PersonaSede {
  id: string;
  persona_id: string;
  sede_id: string;
  created_at?: string;
}

export interface Appuntamento {
  id: string;
  persona_id: string;
  sede_id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  cliente?: string;
  note?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  persona?: Persona;
  sede?: Sede;
}

export interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}


export interface Agenda {
  id: string;
  nome: string;
  descrizione?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}
