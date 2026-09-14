// src/pages/About.jsx
//
// Pagina "Chi siamo" (/chi-siamo, alias /about): breve racconto personale
// di Alberto, per creare una connessione umana prima ancora che l'utente
// guardi un prodotto — foto al lavoro + 2-3 paragrafi di storia, niente
// elenco di caratteristiche aziendali.

import { useTranslation } from 'react-i18next'
import './About.css'

function About() {
  const { t } = useTranslation()

  return (
    <div className="about-page">
      <h1 className="about-title">{t('about.title')}</h1>

      <div className="about-photo-wrapper">
        {/* Foto segnaposto: da sostituire con uno scatto vero di Alberto
            al lavoro nel suo laboratorio (stesso trattamento "placeholder
            da rimpiazzare" della foto hero in Home.jsx). */}
        <img
          className="about-photo"
          src="https://images.unsplash.com/photo-1622219970216-3f358a027666?w=1200"
          alt={t('about.photoAlt')}
        />
      </div>

      <div className="about-body">
        <p className="about-paragraph">{t('about.paragraph1')}</p>
        <p className="about-paragraph">{t('about.paragraph2')}</p>
        <p className="about-paragraph">{t('about.paragraph3')}</p>
      </div>

      {/* Piccola firma scritta a mano, in coda al racconto: stesso tocco
          personale della nota firmata in ProductDetail. */}
      <p className="about-signature">{t('about.signature')}</p>
    </div>
  )
}

export default About
