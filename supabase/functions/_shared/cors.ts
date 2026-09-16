// supabase/functions/_shared/cors.ts
//
// Header CORS condivisi da tutte le Edge Function chiamate direttamente
// dal browser (create-checkout-session). Senza questi header, il browser
// blocca la risposta prima ancora che il frontend possa leggerla, perché
// l'origine del sito (es. http://localhost:5173, o il dominio in
// produzione) è diversa da quella della funzione (*.supabase.co).
//
// "*" per semplicità (il progetto non richiede credenziali/cookie cross-
// origin sulle Edge Function: l'autenticazione passa dall'header
// Authorization, gestito a parte). Se in futuro servisse restringere
// l'origine a un dominio preciso, va sostituito qui.
//
// NOTA: stripe-webhook NON usa questo file — le richieste arrivano da
// Stripe, non dal browser, quindi il CORS non c'entra (serve invece la
// verifica della firma, vedi quel file).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
