// src/pages/Register.jsx
//
// Pagina di registrazione (/register): nome, email, password e conferma
// password. Usa signUp() dal AuthContext (che chiama
// supabase.auth.signUp() e crea la riga corrispondente in "profiles").

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorKey } from '../lib/authErrors'
import './Auth.css'

function Register() {
  const { t } = useTranslation()
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // Se il progetto Supabase richiede la conferma via email, dopo la
  // registrazione non c'è ancora una sessione attiva: invece di
  // reindirizzare l'utente (che non è ancora loggato), mostriamo un
  // messaggio che lo invita a controllare la posta.
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorKey(null)

    // Validazione lato client: le due password devono coincidere.
    if (password !== confirmPassword) {
      setErrorKey('auth.errors.passwordMismatch')
      return
    }

    setSubmitting(true)
    const { error, needsEmailConfirmation: pendingConfirmation } = await signUp(
      email,
      password,
      fullName
    )
    setSubmitting(false)

    if (error) {
      setErrorKey(getAuthErrorKey(error))
      return
    }

    if (pendingConfirmation) {
      setNeedsEmailConfirmation(true)
      return
    }

    navigate('/', { replace: true })
  }

  if (needsEmailConfirmation) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">{t('auth.register.title')}</h1>
          <p className="auth-success">{t('auth.register.checkEmail')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.register.title')}</h1>
        <p className="auth-subtitle">{t('auth.register.subtitle')}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-name">
              {t('auth.nameLabel')}
            </label>
            <input
              id="register-name"
              className="auth-input"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-email">
              {t('auth.emailLabel')}
            </label>
            <input
              id="register-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-password">
              {t('auth.passwordLabel')}
            </label>
            <input
              id="register-password"
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
            <label className="auth-label" htmlFor="register-confirm-password">
              {t('auth.confirmPasswordLabel')}
            </label>
            <input
              id="register-confirm-password"
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
            {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
          </button>
        </form>

        <p className="auth-switch">
          {t('auth.register.hasAccount')} <Link to="/login">{t('auth.register.loginLink')}</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
