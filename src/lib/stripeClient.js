// src/lib/stripeClient.js
//
// Inizializza Stripe.js lato client, usando la chiave PUBBLICA (mai quella
// segreta, che non deve mai finire nel frontend). Questo file prepara solo
// il "terreno" per il pagamento: il vero flusso di Stripe Checkout (con la
// creazione della sessione di pagamento e il webhook che scala lo stock)
// richiede una funzione server-side e verrà collegato in uno step successivo.
//
// Come per Supabase, la chiave va messa in un file ".env" nella root del
// progetto (NON committato su git — vedi .env.example per il nome esatto
// della variabile). La chiave pubblicabile "test" si trova nella dashboard
// Stripe, in modalità Test: https://dashboard.stripe.com/test/apikeys

import { loadStripe } from '@stripe/stripe-js'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!stripePublishableKey) {
  console.warn(
    'Attenzione: VITE_STRIPE_PUBLISHABLE_KEY non è definita. ' +
      'Aggiungila al file .env (vedi .env.example) per abilitare il pagamento con Stripe.'
  )
}

// loadStripe() carica in modo asincrono lo script di Stripe.js e restituisce
// una Promise che risolve nell'istanza di Stripe pronta all'uso: la
// esportiamo così com'è (una Promise), da usare più avanti con
// `const stripe = await stripePromise`.
//
// Se la chiave non è ancora configurata evitiamo di chiamare loadStripe()
// con una stringa vuota (genererebbe un errore in console): esportiamo
// semplicemente una Promise che risolve a null.
export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null)
