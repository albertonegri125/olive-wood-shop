// src/components/LegalPage.jsx
//
// Layout condiviso dalle pagine legali (Privacy, Termini, Recesso, Cookie):
// titolo, data di ultimo aggiornamento, testo introduttivo e un elenco di
// sezioni (titolo + corpo), lette da locales/*.json tramite la chiave
// passata in "i18nKey". Le singole pagine possono aggiungere contenuto
// extra (es. il modulo di recesso scaricabile) tramite "children".
//
// Le sezioni sono un ARRAY dentro il file di traduzione: usiamo l'opzione
// { returnObjects: true } di react-i18next per farci restituire l'intero
// array (di solito t() restituisce solo stringhe).

import { useTranslation } from 'react-i18next'
import './LegalPage.css'

function LegalPage({ i18nKey, children }) {
  const { t } = useTranslation()
  const sections = t(`${i18nKey}.sections`, { returnObjects: true })

  return (
    <div className="legal-page">
      <h1 className="legal-title">{t(`${i18nKey}.title`)}</h1>
      <p className="legal-updated">{t('legal.lastUpdated')}</p>
      <p className="legal-intro">{t(`${i18nKey}.intro`)}</p>

      {Array.isArray(sections) &&
        sections.map((section) => (
          <section className="legal-section" key={section.heading}>
            <h2 className="legal-section-title">{section.heading}</h2>
            <p className="legal-section-body">{section.body}</p>
          </section>
        ))}

      {children}
    </div>
  )
}

export default LegalPage
