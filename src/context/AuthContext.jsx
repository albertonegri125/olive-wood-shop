// src/context/AuthContext.jsx
//
// Context React che gestisce l'autenticazione dell'utente per tutta l'app,
// appoggiandosi a Supabase Auth. Espone l'utente attualmente loggato (o
// null se nessuno ha fatto login), il suo profilo (tabella "profiles",
// incluso il flag "is_admin" usato dal pannello /admin) e le funzioni per
// accedere (email/password, Google, Apple), registrarsi e uscire, così
// ogni pagina/componente può usarle tramite useAuth() senza doversi
// occupare direttamente di Supabase.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)
const LOGIN_AT_STORAGE_KEY = 'login_at'
const AUTH_NOTICE_STORAGE_KEY = 'auth_notice'
const AUTH_REDIRECT_STORAGE_KEY = 'auth_redirect_after_login'
const MAX_SESSION_DURATION_MS = 60 * 60 * 1000

function getStoredLoginAt() {
  const storedValue = Number(localStorage.getItem(LOGIN_AT_STORAGE_KEY))
  return Number.isFinite(storedValue) ? storedValue : null
}

function setLoginAt(timestamp = Date.now()) {
  localStorage.setItem(LOGIN_AT_STORAGE_KEY, String(timestamp))
}

function clearLoginAt() {
  localStorage.removeItem(LOGIN_AT_STORAGE_KEY)
}

function getExpiredSessionRedirectPath() {
  if (typeof window === 'undefined') {
    return '/'
  }

  const currentPath = window.location.pathname
  return currentPath === '/checkout' || currentPath.startsWith('/checkout/') ? '/cart' : '/'
}

async function expireSessionAndRedirect() {
  // Il carrello vive sotto un'altra chiave in localStorage (CartContext)
  // e non va toccato qui: la sessione scade in auth, non nel carrello.
  const redirectPath = getExpiredSessionRedirectPath()
  const noticeKey = redirectPath === '/cart' ? 'auth.sessionExpiredCheckout' : 'auth.sessionExpired'

  sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, redirectPath)
  sessionStorage.setItem(AUTH_NOTICE_STORAGE_KEY, noticeKey)
  clearLoginAt()

  try {
    await supabase.auth.signOut()
  } catch (error) {
    console.warn('Logout automatico dopo sessione scaduta fallito:', error)
  }

  window.location.assign('/login')
}

function checkSessionTimeout() {
  const loginAt = getStoredLoginAt()

  if (!loginAt) {
    return
  }

  if (Date.now() - loginAt > MAX_SESSION_DURATION_MS) {
    void expireSessionAndRedirect()
  }
}

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

    async function init() {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user ?? null

      if (!isMounted) {
        return
      }

      if (sessionUser && !localStorage.getItem(LOGIN_AT_STORAGE_KEY)) {
        // Manteniamo il timestamp di login solo una volta: il refresh
        // automatico del token di Supabase NON lo deve resettare.
        setLoginAt()
      }

      checkSessionTimeout()
      setUser(sessionUser)

      if (sessionUser) {
        const profileData = await loadProfile(sessionUser.id)
        if (isMounted) setProfile(profileData)
      }

      if (isMounted) setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)

      if (event === 'SIGNED_IN' && sessionUser && !localStorage.getItem(LOGIN_AT_STORAGE_KEY)) {
        setLoginAt()
      }

      if (event === 'SIGNED_OUT') {
        clearLoginAt()
        sessionStorage.removeItem(AUTH_NOTICE_STORAGE_KEY)
        sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY)
      }

      if (sessionUser) {
        loadProfile(sessionUser.id).then((profileData) => {
          if (isMounted) setProfile(profileData)
        })
      } else {
        setProfile(null)
      }
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionTimeout()
      }
    }

    const intervalId = window.setInterval(() => {
      checkSessionTimeout()
    }, 60000)

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(intervalId)
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

  // Registra un nuovo utente con email, password e nome completo. La riga
  // corrispondente in "profiles" viene creata automaticamente da un
  // trigger sul database (vedi schema_oauth.sql) non appena l'utente viene
  // creato in auth.users — anche se il progetto richiede la conferma email
  // e quindi qui non esiste ancora una sessione attiva.
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

    // La riga in "profiles" viene ormai creata automaticamente da un
    // trigger sul database (vedi schema_oauth.sql, funzione
    // handle_new_user): scatta alla creazione dell'utente in auth.users,
    // quindi esiste già a questo punto. Qui ci limitiamo a caricarla, se
    // la registrazione ha creato subito una sessione attiva (nessuna
    // conferma email richiesta) — altrimenti non c'è ancora nulla da
    // mostrare, in attesa che l'utente confermi l'email.
    if (data.user && data.session) {
      const profileData = await loadProfile(data.user.id)
      setProfile(profileData)
    }

    return { error: null, needsEmailConfirmation: !data.session }
  }

  // Accede (o si registra automaticamente al primo accesso) tramite un
  // provider OAuth esterno. A differenza di signIn/signUp, questa funzione
  // non ritorna una sessione: reindirizza l'intera pagina al provider
  // (Google/Apple), che poi reindirizza di nuovo al sito una volta
  // completata l'autenticazione — da quel momento in poi tutto il resto
  // (creazione utente, riga in "profiles" via trigger, sessione) avviene
  // automaticamente, esattamente come per l'email/password.
  //
  // "redirectTo" fissa la pagina di arrivo dopo il login: usiamo sempre
  // /account (e non "la pagina di partenza") perché quest'ultima andrebbe
  // ricordata attraverso un redirect completo verso un altro sito e
  // ritorno, cosa che l'URL da solo non permette senza complicare parecchio
  // il flusso — /account è comunque una destinazione sensata per chi ha
  // appena effettuato il login.
  async function signInWithOAuthProvider(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/account`,
      },
    })
    return { error }
  }

  function signInWithGoogle() {
    return signInWithOAuthProvider('google')
  }

  function signInWithApple() {
    return signInWithOAuthProvider('apple')
  }

  // Esce dall'account attualmente loggato.
  async function signOut() {
    // Non puliamo il carrello qui: CartContext salva i prodotti in una chiave
    // separata di localStorage, quindi il carrello deve rimanere intatto
    // anche dopo un logout ordinario o uno scaduto.
    clearLoginAt()
    sessionStorage.removeItem(AUTH_NOTICE_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY)
    await supabase.auth.signOut()
  }

  // Avvia il recupero password: manda un'email con un link magico a
  // "redirectTo". Per sicurezza Supabase risponde "successo" anche se
  // l'email non corrisponde a nessun account registrato (così non si può
  // usare questo form per scoprire quali email sono registrate sul sito):
  // il chiamante mostra sempre lo stesso messaggio, a prescindere.
  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  // Imposta una nuova password. Va chiamata da /reset-password: cliccando
  // il link ricevuto via email, supabase-js stabilisce automaticamente una
  // sessione di recupero (rilevata dal codice nell'URL, stesso meccanismo
  // già usato per il redirect OAuth di signInWithGoogle/Apple) PRIMA che
  // questa pagina venga mostrata — updateUser() agisce su quella sessione.
  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  // "isAdmin" è solo una scorciatoia comoda su profile?.is_admin, per non
  // dover ripetere il controllo (e l'optional chaining) in ogni componente.
  const isAdmin = profile?.is_admin === true

  const value = {
    user,
    profile,
    isAdmin,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signOut,
    requestPasswordReset,
    updatePassword,
  }

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
