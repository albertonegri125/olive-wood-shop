// src/lib/supabaseClient.js
//
// Questo file crea e esporta un unico "client" Supabase, cioè l'oggetto
// che useremo in tutta l'app per parlare con il database (query, autenticazione, ecc.).
// Va importato dove serve con: import { supabase } from '../lib/supabaseClient'

import { createClient } from '@supabase/supabase-js'

// Le credenziali NON vanno mai scritte direttamente qui nel codice,
// perché questo file finisce nel repository git e sarebbe visibile a tutti.
//
// Invece le leggiamo da variabili d'ambiente definite in un file ".env"
// nella root del progetto (file che NON deve essere committato: è già
// presente nel .gitignore). Trovi un modello compilabile in ".env.example".
//
// Vite espone le variabili d'ambiente tramite l'oggetto speciale
// import.meta.env, ma SOLO per quelle che iniziano con il prefisso "VITE_".
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Piccolo controllo di sicurezza in fase di sviluppo: se le variabili
// non sono state configurate, avvisiamo chiaramente in console invece
// di lasciare che l'app fallisca con un errore poco chiaro più avanti.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Attenzione: VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY non sono definite. ' +
      'Crea un file .env nella root del progetto partendo da .env.example.'
  )
}

// Creiamo il client Supabase una sola volta e lo esportiamo, così tutta
// l'app usa sempre la stessa istanza (best practice consigliata da Supabase).
// La chiave "anon" è pensata per essere usata lato client: è sicura da
// esporre nel browser perché l'accesso reale ai dati è comunque regolato
// dalle policy di Row Level Security (RLS) impostate sul database.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
