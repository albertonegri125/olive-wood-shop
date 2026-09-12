// src/lib/authErrors.js
//
// Supabase restituisce i messaggi di errore dell'autenticazione in inglese
// e come testo libero (es. "Invalid login credentials"). Questa funzione
// traduce i messaggi più comuni in una CHIAVE di traduzione, così le
// pagine di Login/Registrazione possono mostrarli in italiano o inglese
// tramite react-i18next invece del testo grezzo di Supabase.

export function getAuthErrorKey(error) {
  if (!error) return null

  const message = error.message?.toLowerCase() ?? ''

  if (message.includes('invalid login credentials')) {
    return 'auth.errors.invalidCredentials'
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'auth.errors.emailInUse'
  }
  if (message.includes('password') && message.includes('at least')) {
    return 'auth.errors.weakPassword'
  }
  if (message.includes('email') && message.includes('invalid')) {
    return 'auth.errors.invalidEmail'
  }
  if (message.includes('email not confirmed')) {
    return 'auth.errors.emailNotConfirmed'
  }

  // Messaggio generico per qualunque altro errore non riconosciuto.
  return 'auth.errors.generic'
}
