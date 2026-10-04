// src/lib/adminFormat.js
//
// Formattazione di prezzi e date condivisa dalle pagine del pannello admin
// (Panoramica, Ordini, Clienti, Recensioni), così tutte mostrano importi e
// date nello stesso formato.

export function formatPrice(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value ?? 0)
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

// Solo giorno/mese/anno, senza ora: per date in cui l'orario non conta
// (es. data di registrazione di un cliente).
export function formatDay(value) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(value))
}
