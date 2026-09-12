// src/components/RequireAuth.jsx
//
// Componente "guardia" per proteggere le route che richiedono il login
// (es. /account, /checkout). Va usato avvolgendo l'elemento della route:
//   <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
//
// - Mentre stiamo ancora verificando se esiste una sessione salvata,
//   mostriamo un breve messaggio di caricamento (evita di rimandare per
//   sbaglio al login un utente che in realtà è già loggato).
// - Se l'utente non è loggato, lo rimandiamo a /login, ricordando la
//   pagina che stava cercando di visitare (così, dopo il login, potremo
//   riportarcelo direttamente).
// - Se è loggato, mostriamo la pagina richiesta.

import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (loading) {
    return <p className="require-auth-loading">{t('auth.checkingSession')}</p>
  }

  if (!user) {
    // "state={{ from: location }}" porta con sé la pagina di partenza:
    // la pagina di Login potrà leggerla per riportare l'utente qui dopo
    // l'accesso, invece di mandarlo sempre e solo alla Home.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default RequireAuth
