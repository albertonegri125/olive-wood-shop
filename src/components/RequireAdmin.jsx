// src/components/RequireAdmin.jsx
//
// Componente "guardia" per proteggere la route del pannello admin (/admin).
// A differenza di RequireAuth (che rimanda a /login chi non è loggato e poi
// lo riporta alla pagina di partenza), qui il comportamento richiesto è più
// semplice: chi non è loggato OPPURE è loggato ma non è un admin, viene
// rimandato direttamente alla Home, senza altre spiegazioni in pagina (il
// pannello admin non deve nemmeno "far capire" che esiste a chi non ne ha
// accesso).

import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

function RequireAdmin({ children }) {
  const { user, isAdmin, loading } = useAuth()
  const { t } = useTranslation()

  // Mentre verifichiamo la sessione (e il profilo collegato, che contiene
  // is_admin) mostriamo un breve messaggio, per evitare di rimandare alla
  // Home per un istante un admin che in realtà è già loggato.
  if (loading) {
    return <p className="require-auth-loading">{t('auth.checkingSession')}</p>
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

export default RequireAdmin
