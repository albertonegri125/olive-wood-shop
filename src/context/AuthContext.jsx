// src/context/AuthContext.jsx
//
// Context React che gestisce l'autenticazione dell'utente per tutta l'app,
// appoggiandosi a Supabase Auth. Espone l'utente attualmente loggato (o
// null se nessuno ha fatto login), il suo profilo (tabella "profiles",
// incluso il flag "is_admin" usato dal pannello /admin) e le funzioni per
// accedere, registrarsi e uscire, così ogni pagina/componente può usarle
// tramite useAuth() senza doversi occupare direttamente di Supabase.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Carica la riga di "profiles" collegata a un utente. Isolata in una
// funzione a parte perché va richiamata sia al primo caricamento sia ad
// ogni cambio di sessione (login/logout).
async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

  if (error) {
    // Non blocchiamo l'app per questo: l'utente resta comunque loggato,
    // semplicemente senza dati di profilo extra (es. is_admin resta false).
    console.error('Errore nel caricamento del profilo:', error)
    return null
  }

  return data
}

export function AuthProvider({ children }) {
  // L'utente Supabase attualmente loggato (oggetto con id, email, ecc.),
  // oppure null se nessuno ha fatto login.
  const [user, setUser] = useState(null)
  // Riga corrispondente nella tabella "profiles" (nome, email, is_admin...),
  // oppure null se non loggato o non ancora caricata.
  const [profile, setProfile] = useState(null)
  // true finché non abbiamo ancora controllato se esiste già una sessione
  // salvata (es. l'utente aveva già fatto login in una visita precedente).
  // Serve per evitare "sfarfallii" (es. mostrare per un attimo il link
  // "Accedi" prima di scoprire che l'utente è già loggato).
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Evita di aggiornare lo stato se il provider viene smontato mentre
    // una richiesta a Supabase è ancora in corso.
    let isMounted = true

    // Al primo caricamento, chiediamo a Supabase se esiste già una sessione
    // valida (salvata automaticamente dalla libreria, tipicamente in
    // localStorage), così l'utente resta loggato anche dopo un refresh.
    // Se c'è un utente, carichiamo subito anche il suo profilo, prima di
    // segnalare che il controllo iniziale è concluso (altrimenti una route
    // protetta come RequireAdmin vedrebbe per un istante "loading: false"
    // ma "profile: null" e rimanderebbe alla Home per errore).
    async function init() {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user ?? null
      if (!isMounted) return

      setUser(sessionUser)

      if (sessionUser) {
        const profileData = await loadProfile(sessionUser.id)
        if (isMounted) setProfile(profileData)
      }

      if (isMounted) setLoading(false)
    }

    init()

    // Ci mettiamo in ascolto di ogni cambiamento di stato dell'autenticazione
    // (login, logout, refresh del token, ecc.): ogni volta aggiorniamo
    // "user" (e il profilo collegato) di conseguenza, così tutta l'app
    // resta sincronizzata.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (sessionUser) {
        loadProfile(sessionUser.id).then((profileData) => {
          if (isMounted) setProfile(profileData)
        })
      } else {
        setProfile(null)
      }
    })

    // Alla distruzione del provider, ci disiscriviamo per non lasciare
    // listener "orfani" in giro.
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
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
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
        })
        .select()
        .single()

      if (profileError) {
        console.error('Errore nella creazione del profilo:', profileError)
      } else {
        // Aggiorniamo subito lo stato locale: l'ascoltatore onAuthStateChange
        // qui sopra potrebbe aver già provato a caricare il profilo un
        // istante prima che questo insert venisse eseguito (trovando
        // ancora nessuna riga), quindi non possiamo affidarci solo a lui.
        setProfile(newProfile)
      }
    }

    return { error: null, needsEmailConfirmation: !data.session }
  }

  // Esce dall'account attualmente loggato.
  async function signOut() {
    await supabase.auth.signOut()
  }

  // "isAdmin" è solo una scorciatoia comoda su profile?.is_admin, per non
  // dover ripetere il controllo (e l'optional chaining) in ogni componente.
  const isAdmin = profile?.is_admin === true

  const value = { user, profile, isAdmin, loading, signIn, signUp, signOut }

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
