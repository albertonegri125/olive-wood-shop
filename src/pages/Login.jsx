// src/pages/Login.jsx
//
// Pagina di accesso (/login): email + password, usa signIn() dal
// AuthContext (che a sua volta chiama supabase.auth.signInWithPassword()).

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorKey } from '../lib/authErrors'
import SocialAuthButtons from '../components/SocialAuthButtons'
import './Auth.css'

function Login() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Se l'utente è arrivato qui rimandato da una pagina protetta (es.
  // /account o /checkout), dopo il login lo riportiamo lì; altrimenti
  // lo mandiamo alla Home.
  const redirectTo = location.state?.from?.pathname ?? '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorKey(null)
    setSubmitting(true)

    const { error } = await signIn(email, password)

    setSubmitting(false)

    if (error) {
      setErrorKey(getAuthErrorKey(error))
      return
    }

    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.login.title')}</h1>
        <p className="auth-subtitle">{t('auth.login.subtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">
              {t('auth.emailLabel')}
            </label>
            <input
              id="login-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">
              {t('auth.passwordLabel')}
            </label>
            <input
              id="login-password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {errorKey && <p className="auth-error">{t(errorKey)}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
            {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <SocialAuthButtons />

        <p className="auth-switch">
          {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.registerLink')}</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
