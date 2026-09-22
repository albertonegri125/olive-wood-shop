// supabase/functions/create-checkout-session/index.ts
//
// Edge Function chiamata dal frontend (Checkout.jsx) quando l'utente clicca
// "Procedi al pagamento". Riceve SOLO l'elenco di { product_id, quantity }
// presenti nel carrello e crea una Stripe Checkout Session, restituendone
// l'URL: il browser fa poi un redirect a quell'URL (window.location.href).
//
// PRINCIPIO DI SICUREZZA (il più importante di questa funzione): non ci si
// fida MAI di un prezzo, di uno sconto o di una disponibilità di magazzino
// inviati dal client. Il frontend manda solo "cosa" e "quanto" l'utente
// vuole comprare (product_id + quantity): prezzo, sconto bundle e verifica
// dello stock vengono SEMPRE ricalcolati qui, leggendo i dati reali dal
// database con la Service Role Key (che bypassa la Row Level Security,
// necessaria per leggere/scrivere con privilegi elevati lato server).
// Un utente potrebbe modificare il codice JavaScript nel proprio browser e
// mandare qualsiasi valore: per questo l'unica fonte affidabile è sempre
// il database, mai il payload della richiesta.
//
// Chi ha effettuato la richiesta (user_id) NON viene letto dal corpo della
// richiesta (falsificabile), ma estratto dal token JWT dell'utente
// autenticato, verificato da Supabase stesso tramite supabase.auth.getUser().

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^17.0.0'
import { corsHeaders } from '../_shared/cors.ts'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
// URL pubblico del sito frontend (es. https://tuodominio.it, o
// http://localhost:5173 in sviluppo): serve per costruire gli URL di
// successo/annullamento a cui Stripe reindirizza dopo il pagamento.
// Va impostato come secret della funzione (vedi le istruzioni di deploy).
const siteUrl = Deno.env.get('SITE_URL')

const stripe = new Stripe(stripeSecretKey ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(), // richiesto in ambiente Deno (niente Node "http")
})

// --- Stessa logica a scaglioni di CartContext.jsx (getDiscountPercentage) ---
// Duplicata qui volutamente: questa funzione non può (e non deve) fidarsi
// di uno sconto calcolato lato client, quindi la logica va ripetuta lato
// server sugli stessi identici numeri (numero di PRODOTTI DIVERSI, non di
// pezzi totali) che il client usa solo per l'anteprima visiva.
function calculateDiscountPercentage(distinctProductsCount: number): number {
  if (distinctProductsCount >= 3) return 15
  if (distinctProductsCount === 2) return 10
  return 0
}

Deno.serve(async (req: Request) => {
  // Richiesta "preflight" del browser prima della vera POST: va sempre
  // gestita per prima, rispondendo solo con gli header CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!stripeSecretKey || !siteUrl) {
      throw new Error(
        'Configurazione mancante: STRIPE_SECRET_KEY e/o SITE_URL non impostate come secret della funzione.'
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    // SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sono già
    // disponibili automaticamente in ogni Edge Function di Supabase: non
    // vanno impostate a mano come secret (a differenza di STRIPE_SECRET_KEY
    // e SITE_URL, quelle sì).

    // --- 1. Verifica di chi ha fatto la richiesta -------------------------
    // Un client Supabase "per conto dell'utente", costruito con il suo
    // token JWT (inviato automaticamente da supabase.functions.invoke() nel
    // frontend): getUser() lo verifica presso Supabase Auth e restituisce
    // l'utente autenticato SOLO se il token è valido, altrimenti null.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Devi effettuare l\'accesso per procedere al pagamento.' }, 401)
    }

    const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: 'Sessione non valida: effettua di nuovo l\'accesso.' }, 401)
    }

    // --- 2. Validazione minima del corpo della richiesta -------------------
    const body = await req.json().catch(() => null)
    const items = body?.items

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: 'Il carrello è vuoto.' }, 400)
    }

    // Ogni riga deve avere un product_id (stringa) e una quantity (intero
    // positivo): scartiamo qualunque richiesta malformata prima di toccare
    // il database.
    const sanitizedItems: { product_id: string; quantity: number }[] = []
    for (const item of items) {
      const quantity = Number(item?.quantity)
      if (
        typeof item?.product_id !== 'string' ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return jsonResponse({ error: 'Carrello non valido.' }, 400)
      }
      sanitizedItems.push({ product_id: item.product_id, quantity })
    }

    // --- 3. Lettura dei prezzi/stock REALI dal database ---------------------
    // Client con la Service Role Key: bypassa la Row Level Security, che ci
    // serve qui per leggere qualunque prodotto indipendentemente da chi ha
    // fatto la richiesta (le policy pubbliche di "products" permetterebbero
    // comunque la lettura, ma usiamo comunque il ruolo di servizio per
    // coerenza con il resto della funzione, che dovrà anche scrivere).
    const adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey!)

    const productIds = sanitizedItems.map((item) => item.product_id)
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, name, price, stock, image_url')
      .in('id', productIds)

    if (productsError) {
      console.error(productsError)
      return jsonResponse({ error: 'Errore nella verifica dei prodotti.' }, 500)
    }

    // Se manca anche un solo prodotto richiesto (es. cancellato nel
    // frattempo), non procediamo affatto: meglio bloccare tutto il
    // checkout con un errore chiaro che creare un ordine parziale.
    if (!products || products.length !== sanitizedItems.length) {
      return jsonResponse({ error: 'Uno o più prodotti non sono più disponibili.' }, 400)
    }

    const productsById = new Map(products.map((product) => [product.id, product]))

    // Verifica stock: qui è solo un controllo "in anticipo" per una buona
    // esperienza utente (evitare di mandarlo su Stripe per poi scoprire che
    // non c'è più disponibilità). Il controllo DAVVERO atomico, quello che
    // conta per evitare vendite doppie sull'ultimo pezzo, avviene nel
    // webhook al momento del pagamento effettivo (vedi stripe-webhook),
    // perché lo stock potrebbe comunque cambiare nel tempo che intercorre
    // tra la creazione di questa sessione e il completamento del pagamento.
    for (const item of sanitizedItems) {
      const product = productsById.get(item.product_id)!
      if (product.stock < item.quantity) {
        return jsonResponse(
          { error: `"${product.name}" non ha più scorte sufficienti (disponibili: ${product.stock}).` },
          400
        )
      }
    }

    // --- 4. Ricalcolo dello sconto bundle, SOLO sui dati verificati --------
    // Il numero di prodotti diversi è semplicemente la lunghezza
    // dell'elenco arrivato dal client (un carrello ha già una riga per
    // prodotto, mai due righe per lo stesso id) — ma il valore che conta,
    // il PREZZO, viene sempre dal database appena letto, mai dal client.
    const discountPercentage = calculateDiscountPercentage(sanitizedItems.length)

    // --- 5. Costruzione dei line item per Stripe, con i prezzi verificati ---
    const lineItems = sanitizedItems.map((item) => {
      const product = productsById.get(item.product_id)!
      return {
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(product.price) * 100), // Stripe vuole i centesimi
          product_data: {
            name: product.name,
            // Stripe richiede un URL assoluto https per le immagini: le
            // nostre vengono da Supabase Storage, quindi lo sono già, ma
            // controlliamo comunque per sicurezza (un campo vuoto/malformato
            // non deve far fallire la creazione della sessione).
            images: product.image_url?.startsWith('https://') ? [product.image_url] : [],
          },
        },
        quantity: item.quantity,
      }
    })

    // Lo sconto va applicato come Coupon Stripe (non esiste un semplice
    // "percentuale sul totale" nei parametri della Checkout Session): lo
    // creiamo al volo solo se serve (0% non richiede nessun coupon).
    // "duration: once" = si applica una tantum a questa sessione, non è un
    // coupon riutilizzabile per acquisti futuri.
    let discountsParam: { coupon: string }[] | undefined
    if (discountPercentage > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercentage,
        duration: 'once',
        name: `Sconto bundle ${discountPercentage}%`,
      })
      discountsParam = [{ coupon: coupon.id }]
    }

    // Il prezzo unitario verificato viene salvato anche nei metadata,
    // insieme a product_id/quantity: il webhook (stripe-webhook) userà
    // esattamente questi valori per creare le righe di "order_items" con
    // il prezzo REALMENTE pagato, senza doverlo ricalcolare (e senza
    // rischiare che nel frattempo il prezzo del prodotto sia cambiato).
    const itemsMetadata = sanitizedItems.map((item) => {
      const product = productsById.get(item.product_id)!
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(product.price),
      }
    })

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      // "card" soltanto: su Stripe Checkout, Apple Pay e Google Pay
      // compaiono AUTOMATICAMENTE dentro il metodo "card" sui browser/
      // dispositivi che li supportano, se abilitati nella dashboard Stripe
      // (Settings -> Payment methods) — non richiedono nessun valore
      // aggiuntivo qui. Se in dashboard abiliti anche altri metodi (PayPal,
      // Klarna, ecc.) e vuoi che compaiano in checkout, RIMUOVI questo
      // parametro (o aggiungi i relativi valori): specificandolo, la
      // sessione mostra SOLO i metodi elencati, anche se altri sono
      // abilitati in dashboard.
      payment_method_types: ['card'],
      // Fa comparire nella pagina di pagamento di Stripe stessa il modulo per
      // l'indirizzo di spedizione: lo raccoglie e lo verifica Stripe (CAP,
      // formato via, ecc.), non dobbiamo costruire noi nessun form. Per ora
      // limitato all'Italia ('IT'); per spedire anche altrove basta
      // aggiungere altri codici paese ISO 3166-1 alpha-2 all'elenco.
      shipping_address_collection: {
        allowed_countries: ['IT'],
      },
      line_items: lineItems,
      discounts: discountsParam,
      customer_email: user.email,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      metadata: {
        user_id: user.id,
        discount_percentage: String(discountPercentage),
        items: JSON.stringify(itemsMetadata),
      },
    }

    // DIAGNOSTICA: logga la configurazione ESATTA inviata a Stripe appena
    // prima della creazione della sessione, in particolare
    // "shipping_address_collection" — utile per verificare nei log della
    // function se la versione effettivamente deployata include davvero
    // questo parametro (un redeploy mancante dopo una modifica al codice
    // non produce nessun errore: la sessione viene creata comunque, solo
    // senza il modulo per l'indirizzo di spedizione).
    console.log(
      '[create-checkout-session] Parametri sessione Stripe:',
      JSON.stringify({
        shipping_address_collection: sessionParams.shipping_address_collection,
        payment_method_types: sessionParams.payment_method_types,
        line_items_count: sessionParams.line_items?.length,
        discounts: sessionParams.discounts,
      })
    )

    const session = await stripe.checkout.sessions.create(sessionParams)

    return jsonResponse({ url: session.url })
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: 'Impossibile avviare il pagamento. Riprova più tardi.' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
