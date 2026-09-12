// src/components/Footer.jsx
//
// Footer visibile in fondo a ogni pagina del sito. Ripete alcuni elementi
// che rinforzano la fiducia e il branding "artigianale italiano":
// - badge "Handcrafted in Italy"
// - link ai social (per ora placeholder, da collegare ai profili reali)
// - selettore di lingua, ripetuto qui per comodità (già presente in Navbar)

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'
import './Footer.css'

// Link ai social: per ora puntano a "#" (placeholder). Andranno sostituiti
// con gli URL reali dei profili del negozio non appena saranno disponibili.
// Testo semplice, senza icone in cerchi: coerente con il resto del sito,
// dove le etichette sono scritte come su un cartellino di carta.
const SOCIAL_LINKS = [
  { name: 'Instagram', href: '#' },
  { name: 'Facebook', href: '#' },
  { name: 'Pinterest', href: '#' },
]

// Link alle pagine legali obbligatorie per un e-commerce europeo, con la
// chiave di traduzione dell'etichetta e il percorso della route.
const LEGAL_LINKS = [
  { labelKey: 'legal.privacyLink', to: '/privacy' },
  { labelKey: 'legal.termsLink', to: '/termini' },
  { labelKey: 'legal.withdrawalLink', to: '/recesso' },
  { labelKey: 'legal.cookiesLink', to: '/cookie' },
]

function Footer() {
  const { t } = useTranslation()

  // Anno corrente per la riga di copyright, calcolato una volta sola al render.
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Colonna brand: badge "Handcrafted in Italy" + breve tagline */}
        <div className="footer-column footer-brand">
          <span className="eyebrow eyebrow-tag footer-badge">{t('footer.badge')}</span>
          <p className="footer-tagline">{t('footer.tagline')}</p>
        </div>

        {/* Colonna social: nomi separati da un punto, niente icone in cerchio */}
        <div className="footer-column">
          <span className="footer-column-title">{t('footer.socialTitle')}</span>
          <p className="footer-social-links">
            {SOCIAL_LINKS.map(({ name, href }, index) => (
              <span key={name}>
                <a href={href} className="footer-social-link">
                  {name}
                </a>
                {index < SOCIAL_LINKS.length - 1 && (
                  <span className="footer-social-sep" aria-hidden="true">
                    {' '}
                    •{' '}
                  </span>
                )}
              </span>
            ))}
          </p>
        </div>

        {/* Colonna lingua: stesso selettore usato nella Navbar */}
        <div className="footer-column">
          <span className="footer-column-title">{t('footer.languageTitle')}</span>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="footer-bottom">
        {/* Link alle pagine legali obbligatorie, separati da un punto come
            i link social qui sopra: coerenza visiva in tutto il footer. */}
        <p className="footer-legal-links">
          {LEGAL_LINKS.map(({ labelKey, to }, index) => (
            <span key={to}>
              <Link to={to} className="footer-legal-link">
                {t(labelKey)}
              </Link>
              {index < LEGAL_LINKS.length - 1 && (
                <span className="footer-social-sep" aria-hidden="true">
                  {' '}
                  •{' '}
                </span>
              )}
            </span>
          ))}
        </p>

        <p className="footer-rights">
          © {currentYear} OliveWood Creations — {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}

export default Footer
