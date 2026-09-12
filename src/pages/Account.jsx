// src/pages/Account.jsx
//
// Pagina dell'account (/account, protetta da RequireAuth): mostra i dati
// base del profilo (nome, email) letti dalla tabella "profiles", e uno
// spazio per i futuri ordini dell'utente (per ora vuoto: verrà collegato
// quando implementeremo il checkout completo con il pagamento).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import './Account.css'

function Account() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carichiamo la riga del profilo collegata all'utente loggato (creata al
  // momento della registrazione, vedi AuthContext.signUp).
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        // Non blocchiamo la pagina per questo: mostriamo semplicemente i
        // dati che abbiamo già dalla sessione (email dell'utente Supabase).
        console.error(error)
      } else {
        setProfile(data)
      }

      setLoading(false)
    }

    fetchProfile()
  }, [user.id])

  // Nome da mostrare: quello salvato nel profilo, oppure quello passato in
  // fase di registrazione (metadati dell'utente), oppure nessuno.
  const displayName = profile?.full_name || user.user_metadata?.full_name || ''

  return (
    <div className="account-page">
      <h1 className="account-title">{t('account.title')}</h1>

      <section className="account-section">
        <h2 className="account-section-title">{t('account.profileTitle')}</h2>

        {loading ? (
          <p className="account-message">{t('account.loading')}</p>
        ) : (
          <dl className="account-details">
            <div className="account-detail-row">
              <dt>{t('auth.nameLabel')}</dt>
              <dd>{displayName || t('account.noName')}</dd>
            </div>
            <div className="account-detail-row">
              <dt>{t('auth.emailLabel')}</dt>
              <dd>{profile?.email ?? user.email}</dd>
            </div>
          </dl>
        )}

        <button type="button" className="account-signout" onClick={signOut}>
          {t('navbar.logout')}
        </button>
      </section>

      <section className="account-section">
        <h2 className="account-section-title">{t('account.ordersTitle')}</h2>
        {/* Placeholder: la lista dei veri ordini arriverà con il checkout
            completo (tabella "orders" collegata all'utente). */}
        <p className="account-message">{t('account.ordersEmpty')}</p>
      </section>
    </div>
  )
}

export default Account
