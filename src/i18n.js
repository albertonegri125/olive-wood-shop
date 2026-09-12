// src/i18n.js
//
// Configurazione di base di i18next + react-i18next: gestisce la traduzione
// di tutti i testi dell'interfaccia. Lingua di partenza: italiano.
// Se una chiave di traduzione non esiste in italiano, i18next ripiega
// automaticamente sull'inglese (fallbackLng).
//
// Questo file va importato una sola volta, prima di renderizzare l'app
// (vedi src/main.jsx), perché l'inizializzazione di i18next è un
// "effetto collaterale" che deve avvenire prima che i componenti
// chiamino useTranslation().

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import it from './locales/it.json'
import en from './locales/en.json'

// Chiave usata per ricordare la lingua scelta dall'utente in localStorage,
// così la preferenza resta impostata anche alle visite successive.
const LANGUAGE_STORAGE_KEY = 'oliveWoodShop.language'

// Proviamo a leggere la lingua salvata in precedenza. Avvolgiamo l'accesso
// a localStorage in un try/catch perché in alcuni contesti (es. modalità
// di navigazione privata) potrebbe non essere disponibile e generare un errore.
function getSavedLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    return null
  }
}

i18n.use(initReactI18next).init({
  // Le traduzioni sono incluse direttamente nel bundle (nessuna richiesta
  // di rete aggiuntiva): ogni lingua è un semplice oggetto JSON.
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: getSavedLanguage() || 'it', // lingua di default: italiano
  fallbackLng: 'en', // se manca una chiave in italiano, usa l'inglese
  interpolation: {
    escapeValue: false, // React fa già l'escaping dei valori: non serve farlo due volte
  },
})

// Ogni volta che la lingua cambia (es. tramite il selettore IT/EN):
// - la salviamo in localStorage, per ricordarla alla prossima visita
// - aggiorniamo l'attributo lang dell'elemento <html>, utile per
//   accessibilità (screen reader) e per i motori di ricerca
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Se localStorage non è disponibile la preferenza semplicemente non
    // verrà ricordata: non è un errore bloccante per l'app.
  }
})

// Impostiamo subito l'attributo lang anche al primo caricamento
// (senza aspettare un cambio lingua).
document.documentElement.lang = i18n.language

export default i18n
