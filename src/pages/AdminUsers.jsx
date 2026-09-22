// src/pages/AdminUsers.jsx
//
// Sezione "Gestione Admin" del pannello admin (/admin/utenti, protetta da
// RequireAdmin): permette di promuovere o rimuovere altri amministratori
// senza dover eseguire SQL manuale nel SQL Editor di Supabase.
//
// Ogni lettura/scrittura relativa a "is_admin" passa dalla Edge Function
// "manage-admin" (Service Role Key, verifica lato server che chi chiama sia
// già admin): MAI una query diretta del client sulla colonna is_admin, che
// resta protetta da trigger + REVOKE anche per un account già admin (vedi
// schema_security_fix_A.sql) — è una scelta di sicurezza voluta, non un
// limite tecnico da aggirare con codice frontend "furbo".

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AdminNav from '../components/AdminNav'
import '../pages/Auth.css'
import './Admin.css'
import './AdminUsers.css'

// L'errore restituito da supabase.functions.invoke() per una risposta
// non-2xx non contiene direttamente il messaggio JSON mandato dalla
// function: va letto dal Response grezzo in error.context. Centralizzato
// qui perché lo stesso pattern si ripete per ognuna delle quattro azioni
// chiamate in questa pagina (list/search/promote/revoke).
async function extractErrorMessage(error, fallback) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json()
      if (body?.error) return body.error
    } catch {
      // Risposta non-JSON o già consumata: usiamo il fallback sotto.
    }
  }
  return fallback
}

function formatDate(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleString('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function AdminUsers() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // --- Elenco admin attuali ------------------------------------------------
  const [admins, setAdmins] = useState([])
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [listError, setListError] = useState(null)

  async function fetchAdmins() {
    setLoadingAdmins(true)
    setListError(null)

    const { data, error } = await supabase.functions.invoke('manage-admin', {
      body: { action: 'list' },
    })

    if (error) {
      console.error(error)
      setListError(await extractErrorMessage(error, t('adminUsers.error')))
    } else {
      setAdmins(data?.admins ?? [])
    }

    setLoadingAdmins(false)
  }

  useEffect(() => {
    void fetchAdmins()
  }, [])

  // --- Ricerca utenti da promuovere -----------------------------------------
  // "null" = nessuna ricerca ancora effettuata (per distinguerlo da "[]",
  // ricerca fatta ma senza risultati).
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  async function handleSearch(event) {
    event.preventDefault()

    const email = searchEmail.trim()
    if (!email) return

    setSearching(true)
    setSearchError(null)

    const { data, error } = await supabase.functions.invoke('manage-admin', {
      body: { action: 'search', email },
    })

    if (error) {
      console.error(error)
      setSearchError(await extractErrorMessage(error, t('adminUsers.error')))
      setSearchResults(null)
    } else {
      setSearchResults(data?.results ?? [])
    }

    setSearching(false)
  }

  // --- Promuovi / rimuovi ----------------------------------------------------
  // Id dell'utente su cui è in corso un'azione: disabilita solo il bottone
  // di quella riga, le altre restano utilizzabili.
  const [pendingId, setPendingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function handlePromote(targetUser) {
    setPendingId(targetUser.id)
    setActionError(null)

    const { data, error } = await supabase.functions.invoke('manage-admin', {
      body: { action: 'promote', user_id: targetUser.id },
    })

    if (error) {
      console.error(error)
      setActionError(await extractErrorMessage(error, t('adminUsers.error')))
    } else if (data?.profile) {
      // Aggiorniamo lista admin e risultati di ricerca già in memoria,
      // invece di rifare entrambe le chiamate da capo.
      setAdmins((current) => [...current, data.profile])
      setSearchResults((current) =>
        current
          ? current.map((item) => (item.id === targetUser.id ? { ...item, is_admin: true } : item))
          : current
      )
    }

    setPendingId(null)
  }

  async function handleRevoke(admin) {
    const isSelf = admin.id === user?.id
    const confirmed = window.confirm(
      isSelf ? t('adminUsers.confirmRevokeSelf') : t('adminUsers.confirmRevoke', { email: admin.email })
    )
    if (!confirmed) return

    setPendingId(admin.id)
    setActionError(null)

    const { data, error } = await supabase.functions.invoke('manage-admin', {
      body: { action: 'revoke', user_id: admin.id },
    })

    if (error) {
      console.error(error)
      setActionError(await extractErrorMessage(error, t('adminUsers.error')))
    } else if (data?.profile) {
      setAdmins((current) => current.filter((item) => item.id !== admin.id))
      setSearchResults((current) =>
        current
          ? current.map((item) => (item.id === admin.id ? { ...item, is_admin: false } : item))
          : current
      )
    }

    setPendingId(null)
  }

  return (
    <div className="admin-page">
      <AdminNav />

      <div className="admin-header">
        <h1 className="admin-title">{t('adminUsers.title')}</h1>
      </div>

      {actionError && <p className="auth-error">{actionError}</p>}

      {/* --- Elenco admin attuali --- */}
      <section className="admin-form-panel adminusers-panel">
        <h2>{t('adminUsers.currentAdminsTitle')}</h2>

        {loadingAdmins && <p className="admin-message">{t('adminUsers.loading')}</p>}
        {!loadingAdmins && listError && <p className="admin-message">{listError}</p>}
        {!loadingAdmins && !listError && admins.length === 0 && (
          <p className="admin-message">{t('adminUsers.empty')}</p>
        )}

        {!loadingAdmins && !listError && admins.length > 0 && (
          <ul className="adminusers-list">
            {admins.map((admin) => (
              <li className="adminusers-item" key={admin.id}>
                <div className="adminusers-item-info">
                  <span className="adminusers-item-email">
                    {admin.email}
                    {admin.id === user?.id ? ` (${t('adminUsers.you')})` : ''}
                  </span>
                  <span className="adminusers-item-meta">
                    {admin.promoted_at
                      ? t('adminUsers.promotedBy', {
                          email: admin.promoted_by_email ?? t('adminUsers.promotedByUnknownEmail'),
                          date: formatDate(admin.promoted_at),
                        })
                      : t('adminUsers.promotedByUnknown')}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  disabled={pendingId === admin.id}
                  onClick={() => handleRevoke(admin)}
                >
                  {pendingId === admin.id ? t('adminUsers.revoking') : t('adminUsers.revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Ricerca e promozione --- */}
      <section className="admin-form-panel adminusers-panel">
        <h2>{t('adminUsers.searchTitle')}</h2>
        <p className="admin-form-hint">{t('adminUsers.searchHint')}</p>

        <form className="adminusers-search-form" onSubmit={handleSearch}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="adminusers-search-email">
              {t('adminUsers.searchLabel')}
            </label>
            <input
              id="adminusers-search-email"
              className="auth-input"
              type="email"
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder={t('adminUsers.searchPlaceholder')}
              required
            />
          </div>
          <button type="submit" className="btn-secondary" disabled={searching}>
            {searching ? t('adminUsers.searching') : t('adminUsers.searchButton')}
          </button>
        </form>

        {searchError && <p className="auth-error">{searchError}</p>}

        {searchResults !== null && searchResults.length === 0 && (
          <p className="admin-message">{t('adminUsers.searchEmpty')}</p>
        )}

        {searchResults !== null && searchResults.length > 0 && (
          <ul className="adminusers-list">
            {searchResults.map((result) => (
              <li className="adminusers-item" key={result.id}>
                <div className="adminusers-item-info">
                  <span className="adminusers-item-email">
                    {result.email}
                    {result.full_name ? ` — ${result.full_name}` : ''}
                  </span>
                </div>
                {result.is_admin ? (
                  <span className="adminusers-already-admin">{t('adminUsers.alreadyAdmin')}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={pendingId === result.id}
                    onClick={() => handlePromote(result)}
                  >
                    {pendingId === result.id ? t('adminUsers.promoting') : t('adminUsers.promote')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default AdminUsers
