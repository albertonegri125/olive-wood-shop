// src/pages/ResetPassword.jsx
//
// Pagina di arrivo (/reset-password) del link ricevuto via email da
// ForgotPassword. Cliccando quel link, supabase-js stabilisce
// automaticamente una sessione di recupero (rilevata dal codice presente
// nell'URL, stesso meccanismo già usato dal redirect OAuth di
// signInWithGoogle/Apple — vedi supabaseClient.js: nessuna configurazione
// aggiuntiva necessaria) PRIMA che questo componente venga mostrato:
// updatePassword() dal AuthContext agisce su quella sessione.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorKey } from '../lib/authErrors'
import './Auth.css'

function ResetPassword() {
  const { t } = useTranslation()
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorKey(null)

    if (password !== confirmPassword) {
      setErrorKey('auth.errors.passwordMismatch')
      return
    }

    setSubmitting(true)
    const { error } = await updatePassword(password)
    setSubmitting(false)

    if (error) {
      // Il caso più comune qui non è una password "sbagliata" ma un link
      // scaduto/già usato (Supabase risponde con un errore generico tipo
      // "Auth session missing" se non c'è una sessione di recupero valida):
      // getAuthErrorKey non lo riconosce esplicitamente, quindi ricade sul
      // messaggio generico — comunque corretto, l'utente riprova da capo.
      setErrorKey(getAuthErrorKey(error))
      return
    }

    // Password aggiornata: la sessione di recupero è ormai una sessione
    // normale, l'utente è già loggato. Lo portiamo al suo account.
    navigate('/account', { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.resetPassword.title')}</h1>
        <p className="auth-subtitle">{t('auth.resetPassword.subtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="reset-password-new">
              {t('auth.resetPassword.newPasswordLabel')}
            </label>
            <input
              id="reset-password-new"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reset-password-confirm">
              {t('auth.confirmPasswordLabel')}
            </label>
            <input
              id="reset-password-confirm"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {errorKey && <p className="auth-error">{t(errorKey)}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
            {submitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
