// src/components/LanguageSwitcher.jsx
//
// Selettore di lingua "IT / EN", riutilizzato sia nella Navbar che nel Footer.
// Cliccando su una lingua, react-i18next aggiorna istantaneamente tutti i
// testi tradotti in pagina: non serve ricaricare la pagina.

import { useTranslation } from 'react-i18next'
import './LanguageSwitcher.css'

// Le due lingue supportate dal sito, con la chiave usata da i18next.
const LANGUAGES = [
  { code: 'it', labelKey: 'language.it' },
  { code: 'en', labelKey: 'language.en' },
]

// className opzionale: permette al componente che lo usa (Navbar o Footer)
// di aggiungere le proprie regole di posizionamento senza toccare questo file.
function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation()

  // Lingua attualmente attiva (es. "it" o "en")
  const currentLanguage = i18n.resolvedLanguage || i18n.language

  return (
    <div
      className={['language-switcher', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={t('language.label')}
    >
      {LANGUAGES.map(({ code, labelKey }, index) => (
        <span key={code} className="language-switcher-item">
          <button
            type="button"
            className={
              code === currentLanguage
                ? 'language-switcher-button active'
                : 'language-switcher-button'
            }
            // Se è già la lingua attiva non facciamo nulla al click.
            onClick={() => i18n.changeLanguage(code)}
            aria-pressed={code === currentLanguage}
            aria-label={t('language.switchTo', { language: t(labelKey) })}
          >
            {t(labelKey)}
          </button>

          {/* Separatore "/" tra le due lingue, non dopo l'ultima */}
          {index < LANGUAGES.length - 1 && (
            <span className="language-switcher-separator" aria-hidden="true">
              /
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

export default LanguageSwitcher
