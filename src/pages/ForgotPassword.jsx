// src/pages/ForgotPassword.jsx
//
// Pagina "Password dimenticata" (/forgot-password): l'utente inserisce la
// sua email e riceve un link per impostarne una nuova (vedi ResetPassword,
// la pagina di arrivo di quel link). Usa requestPasswordReset() dal
// AuthContext, che chiama supabase.auth.resetPasswordForEmail().

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorKey } from '../lib/authErrors'
import './Auth.css'

function ForgotPassword() {
  const { t } = useTranslation()
  const { requestPasswordReset } = useAuth()

  const [email, setEmail] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // true dopo l'invio: mostriamo un messaggio di conferma al posto del
  // form, SEMPRE (anche se l'email non corrisponde a nessun account:
  // Supabase risponde comunque "successo" per non rivelare quali indirizzi
  // sono registrati — vedi il commento in AuthContext.requestPasswordReset).
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorKey(null)
    setSubmitting(true)

    const { error } = await requestPasswordReset(email)

    setSubmitting(false)

    if (error) {
      setErrorKey(getAuthErrorKey(error))
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">{t('auth.forgotPassword.title')}</h1>
          <p className="auth-success">{t('auth.forgotPassword.checkEmail')}</p>
          <p className="auth-switch">
            <Link to="/login">{t('auth.forgotPassword.backToLogin')}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.forgotPassword.title')}</h1>
        <p className="auth-subtitle">{t('auth.forgotPassword.subtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="forgot-password-email">
              {t('auth.emailLabel')}
            </label>
            <input
              id="forgot-password-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {errorKey && <p className="auth-error">{t(errorKey)}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
            {submitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/login">{t('auth.forgotPassword.backToLogin')}</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
