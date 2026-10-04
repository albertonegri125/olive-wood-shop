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

const AUTH_NOTICE_STORAGE_KEY = 'auth_notice'
const AUTH_REDIRECT_STORAGE_KEY = 'auth_redirect_after_login'

function Login() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionMessageKey, setSessionMessageKey] = useState(() => {
    const noticeKey = sessionStorage.getItem(AUTH_NOTICE_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_NOTICE_STORAGE_KEY)
    return noticeKey
  })

  // Se l'utente è arrivato qui rimandato da una pagina protetta (es.
  // /account o /checkout), dopo il login lo riportiamo lì; altrimenti
  // lo mandiamo alla Home. Se la sessione è scaduta, il redirect viene
  // salvato in sessionStorage prima del logout automatico: evita di
  // perdere il percorso di ritorno sul checkout o sul carrello.
  const redirectTo = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY) ?? location.state?.from?.pathname ?? '/'

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

    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY)
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.login.title')}</h1>
        <p className="auth-subtitle">{t('auth.login.subtitle')}</p>

        {sessionMessageKey && <p className="auth-error" role="alert">{t(sessionMessageKey)}</p>}

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

        <p className="auth-switch">
          <Link to="/forgot-password">{t('auth.login.forgotPassword')}</Link>
        </p>

        <SocialAuthButtons />

        <p className="auth-switch">
          {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.registerLink')}</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
