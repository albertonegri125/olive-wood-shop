// src/pages/DirittoRecesso.jsx
//
// Informativa sul diritto di recesso (/recesso), obbligatoria per le
// vendite B2C nell'Unione Europea: 14 giorni di tempo dalla ricezione
// della merce per recedere senza dover fornire alcuna motivazione.
//
// TODO: completare le sezioni segnalate con [placeholder] con i dati reali
// (email di contatto, eventuali condizioni specifiche sulle spese di reso)
// — vedi src/locales/it.json e src/locales/en.json, chiave "legal.withdrawal".

import { useTranslation } from 'react-i18next'
import LegalPage from '../components/LegalPage'

function DirittoRecesso() {
  const { t } = useTranslation()

  return (
    <LegalPage i18nKey="legal.withdrawal">
      {/* Modulo di recesso scaricabile: per ora un placeholder, il vero
          file PDF verrà aggiunto in un secondo momento. */}
      <section className="legal-extra">
        <h2 className="legal-extra-title">{t('legal.withdrawal.formTitle')}</h2>
        <p className="legal-extra-text">{t('legal.withdrawal.formText')}</p>

        {/* TODO: sostituire "#" con il vero URL del PDF una volta pronto
            (es. un file caricato in /public/modulo-recesso.pdf) */}
        <a href="#" className="legal-download-link" aria-disabled="true">
          📄 {t('legal.withdrawal.formDownload')}
        </a>
        <p className="legal-download-note">{t('legal.withdrawal.formPlaceholderNote')}</p>
      </section>
    </LegalPage>
  )
}

export default DirittoRecesso
