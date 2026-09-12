// src/pages/PrivacyPolicy.jsx
//
// Informativa sulla Privacy (/privacy), obbligatoria per un e-commerce
// europeo (GDPR). Il testo è un PLACEHOLDER con struttura standard: va
// completato con i dati reali del titolare prima di andare online.
//
// TODO: completare con dati reali del titolare (nome, indirizzo, P.IVA se
// presente, email di contatto privacy) — vedi le sezioni tradotte in
// src/locales/it.json e src/locales/en.json, chiave "legal.privacy".

import LegalPage from '../components/LegalPage'

function PrivacyPolicy() {
  return <LegalPage i18nKey="legal.privacy" />
}

export default PrivacyPolicy
