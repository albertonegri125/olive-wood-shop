// src/context/AuthContext.jsx
//
// Context React che gestisce l'autenticazione dell'utente per tutta l'app,
// appoggiandosi a Supabase Auth. Espone l'utente attualmente loggato (o
// null se nessuno ha fatto login) e le funzioni per accedere, registrarsi
// e uscire, così ogni pagina/componente può usarle tramite useAuth()
// senza doversi occupare direttamente di Supabase.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // L'utente Supabase attualmente loggato (oggetto con id, email, ecc.),
  // oppure null se nessuno ha fatto login.
  const [user, setUser] = useState(null)
  // true finché non abbiamo ancora controllato se esiste già una sessione
  // salvata (es. l'utente aveva già fatto login in una visita precedente).
  // Serve per evitare "sfarfallii" (es. mostrare per un attimo il link
  // "Accedi" prima di scoprire che l'utente è già loggato).
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Al primo caricamento, chiediamo a Supabase se esiste già una sessione
    // valida (salvata automaticamente dalla libreria, tipicamente in
    // localStorage), così l'utente resta loggato anche dopo un refresh.
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Ci mettiamo in ascolto di ogni cambiamento di stato dell'autenticazione
    // (login, logout, refresh del token, ecc.): ogni volta aggiorniamo
    // "user" di conseguenza, così tutta l'app resta sincronizzata.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // Alla distruzione del provider, ci disiscriviamo per non lasciare
    // listener "orfani" in giro.
    return () => subscription.unsubscribe()
  }, [])

  // Accede con email e password. Ritorna { error } (error è null se
  // l'accesso è andato a buon fine), così il componente chiamante può
  // mostrare un messaggio in caso di fallimento senza dover gestire
  // eccezioni: onAuthStateChange sopra aggiornerà "user" automaticamente.
  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // Registra un nuovo utente con email, password e nome completo.
  // Dopo la registrazione creiamo anche la riga corrispondente nella
  // tabella "profiles" (id collegato all'utente, email, nome).
  //
  // NOTA: se nel progetto Supabase è attiva la conferma via email, subito
  // dopo signUp() non esiste ancora una sessione attiva (l'utente deve
  // prima cliccare il link ricevuto via email): in quel caso l'inserimento
  // in "profiles" fallirebbe per via delle policy di Row Level Security
  // (che richiedono auth.uid() = id). Una soluzione più robusta per quel
  // caso sarebbe un trigger lato database su auth.users, ma per questo
  // step creiamo il profilo lato client, come richiesto.
  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) {
      return { error }
    }

    // Se la registrazione ha creato subito una sessione attiva (nessuna
    // conferma email richiesta), possiamo creare la riga del profilo.
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
      })

      if (profileError) {
        console.error('Errore nella creazione del profilo:', profileError)
      }
    }

    return { error: null, needsEmailConfirmation: !data.session }
  }

  // Esce dall'account attualmente loggato.
  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = { user, loading, signIn, signUp, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook di comodo per accedere all'autenticazione, con un errore chiaro se
// usato fuori da un <AuthProvider>.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve essere usato dentro un <AuthProvider>')
  }
  return context
}
