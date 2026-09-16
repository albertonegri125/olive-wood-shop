// src/components/SocialAuthButtons.jsx
//
// Separatore "oppure" + bottoni "Continua con Google"/"Continua con Apple",
// condivisi da Login.jsx e Register.jsx (stesso comportamento in entrambe:
// i provider OAuth non hanno un vero e proprio "accesso" separato da
// "registrazione" — al primo utilizzo creano l'account automaticamente,
// alle volte successive fanno semplicemente accedere lo stesso utente).
//
// Lo stile dei due bottoni segue deliberatamente le linee guida ufficiali
// di branding di Google e Apple (colori, bordo, disposizione del logo)
// invece dello stile generico del sito: sono elementi che gli utenti
// devono riconoscere a colpo d'occhio come "il bottone di Google/Apple",
// non come un bottone qualsiasi ridecorato.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getAuthErrorKey } from '../lib/authErrors'
import { IconGoogleLogo, IconAppleLogo } from './icons'
import './SocialAuthButtons.css'

function SocialAuthButtons() {
  const { t } = useTranslation()
  const { signInWithGoogle, signInWithApple } = useAuth()

  // Non serve uno stato "submitting" prolungato: dopo la chiamata il
  // browser viene reindirizzato via dal sito (verso Google/Apple), quindi
  // il componente smette comunque di esistere. Serve solo per disabilitare
  // il bottone subito dopo il click (evita doppi click) e per mostrare un
  // eventuale errore SE la richiesta fallisce prima ancora di reindirizzare
  // (es. provider non configurato in Supabase).
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [errorKey, setErrorKey] = useState(null)

  async function handleClick(provider, signInFn) {
    setErrorKey(null)
    setLoadingProvider(provider)

    const { error } = await signInFn()

    if (error) {
      setErrorKey(getAuthErrorKey(error))
      setLoadingProvider(null)
    }
    // Nessun "else": in caso di successo la pagina sta già per essere
    // sostituita dal redirect verso il provider, non c'è altro da fare qui.
  }

  return (
    <div className="social-auth">
      <div className="social-auth-divider">
        <span>{t('auth.orDivider')}</span>
      </div>

      {errorKey && <p className="auth-error">{t(errorKey)}</p>}

      <button
        type="button"
        className="social-auth-button social-auth-button-google"
        onClick={() => handleClick('google', signInWithGoogle)}
        disabled={loadingProvider !== null}
      >
        <IconGoogleLogo className="social-auth-icon" />
        {t('auth.continueWithGoogle')}
      </button>

      <button
        type="button"
        className="social-auth-button social-auth-button-apple"
        onClick={() => handleClick('apple', signInWithApple)}
        disabled={loadingProvider !== null}
      >
        <IconAppleLogo className="social-auth-icon" />
        {t('auth.continueWithApple')}
      </button>
    </div>
  )
}

export default SocialAuthButtons
