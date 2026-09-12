// src/components/CookieBanner.jsx
//
// Banner semplice che informa l'utente sull'uso di cookie/localStorage
// tecnici, con un bottone "Accetta" che salva il consenso in localStorage
// (così il banner non ricompare più) e un link alla Cookie Policy completa.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './CookieBanner.css'

const CONSENT_STORAGE_KEY = 'oliveWoodShop.cookieConsent'

// Verifica se il consenso è già stato dato in una visita precedente.
// Avvolta in try/catch perché localStorage potrebbe non essere disponibile
// (es. modalità di navigazione privata).
function hasAlreadyConsented() {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted'
  } catch {
    return false
  }
}

function CookieBanner() {
  const { t } = useTranslation()

  // Il banner è visibile solo se il consenso non è già stato dato in passato.
  const [visible, setVisible] = useState(() => !hasAlreadyConsented())

  function handleAccept() {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted')
    } catch {
      // Se localStorage non è disponibile il banner ricomparirà alla
      // prossima visita: non è un errore bloccante per l'app.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner" role="dialog" aria-label={t('legal.cookies.title')}>
      <p className="cookie-banner-text">
        {t('cookieBanner.message')}{' '}
        <Link to="/cookie" className="cookie-banner-link">
          {t('cookieBanner.learnMore')}
        </Link>
      </p>
      <button type="button" className="btn-primary cookie-banner-accept" onClick={handleAccept}>
        {t('cookieBanner.accept')}
      </button>
    </div>
  )
}

export default CookieBanner
