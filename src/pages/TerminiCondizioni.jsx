// src/pages/TerminiCondizioni.jsx
//
// Termini e Condizioni di vendita (/termini), obbligatori per un
// e-commerce europeo. Il testo è un PLACEHOLDER con struttura standard:
// va completato con i dati reali del venditore prima di andare online.
//
// TODO: dati reali venditore (ragione sociale/nome, indirizzo, P.IVA,
// email, città per il foro competente) — vedi le sezioni tradotte in
// src/locales/it.json e src/locales/en.json, chiave "legal.terms".

import LegalPage from '../components/LegalPage'

function TerminiCondizioni() {
  return <LegalPage i18nKey="legal.terms" />
}

export default TerminiCondizioni
