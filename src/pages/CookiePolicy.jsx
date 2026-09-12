// src/pages/CookiePolicy.jsx
//
// Cookie Policy (/cookie): elenco di ciò che il sito salva nel browser
// dell'utente. Per ora si tratta solo di dati tecnici in localStorage
// (nessun vero "cookie" HTTP, e nessun tracciamento pubblicitario) — la
// pagina va aggiornata se in futuro si aggiungono strumenti di analisi o
// cookie di terze parti.

import { useTranslation } from 'react-i18next'
import LegalPage from '../components/LegalPage'

function CookiePolicy() {
  const { t } = useTranslation()
  const items = t('legal.cookies.items', { returnObjects: true })

  return (
    <LegalPage i18nKey="legal.cookies">
      <section className="legal-extra">
        <div className="legal-table-wrapper">
          <table className="legal-table">
            <thead>
              <tr>
                <th>{t('legal.cookies.tableName')}</th>
                <th>{t('legal.cookies.tablePurpose')}</th>
                <th>{t('legal.cookies.tableDuration')}</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(items) &&
                items.map((item) => (
                  <tr key={item.name}>
                    <td>
                      <code>{item.name}</code>
                    </td>
                    <td>{item.purpose}</td>
                    <td>{item.duration}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="legal-extra-text legal-cookies-outro">{t('legal.cookies.outro')}</p>
      </section>
    </LegalPage>
  )
}

export default CookiePolicy
