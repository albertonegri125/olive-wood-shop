// supabase/functions/stripe-webhook/index.ts
//
// Edge Function chiamata direttamente da Stripe (non dal browser: niente
// CORS qui) ogni volta che succede qualcosa a una sessione di pagamento.
// Ci interessa un solo evento, "checkout.session.completed": da lì
// creiamo l'ordine vero e proprio nel nostro database.
//
// QUESTA FUNZIONE VA DEPLOYATA CON "--no-verify-jwt" (vedi le istruzioni
// di deploy): Stripe non manda un token Supabase nelle sue richieste, ne
// manda uno SUO, la firma webhook, verificata qui sotto in modo diverso
// (constructEventAsync). Se la funzione richiedesse un JWT Supabase,
// rifiuterebbe ogni chiamata di Stripe con 401 prima ancora di eseguire
// questo codice.
//
// SICUREZZA: la firma verifica che la richiesta arrivi DAVVERO da Stripe
// (e non da chiunque altro che manda un finto "pagamento riuscito" al
// nostro endpoint) e che il corpo non sia stato alterato in transito.
// Per questo leggiamo il corpo come testo grezzo PRIMA di qualunque
// parsing: la firma è calcolata sui byte esatti inviati da Stripe.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@^17.0.0'

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

const stripe = new Stripe(stripeSecretKey ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

// Il client va creato con la Service Role Key: questa funzione scrive
// ordini, righe d'ordine e aggiorna lo stock per conto del sistema, non
// per conto di un utente autenticato (Stripe non manda nessun token
// utente) — serve quindi un accesso che bypassi la Row Level Security.
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const adminClient = createClient(supabaseUrl ?? '', supabaseServiceRoleKey ?? '')

// La verifica della firma richiede l'implementazione "SubtleCrypto" invece
// di quella basata sul modulo "crypto" di Node: necessaria per farla
// funzionare nel runtime Deno delle Edge Function di Supabase.
const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!stripeSecretKey || !webhookSecret) {
    console.error('STRIPE_SECRET_KEY e/o STRIPE_WEBHOOK_SECRET non impostate.')
    return new Response('Configurazione mancante lato server.', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    if (!signature) throw new Error('Header stripe-signature mancante.')
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )
  } catch (error) {
    console.error('Firma webhook non valida:', error)
    return new Response('Firma non valida.', { status: 400 })
  }

  // Rispondiamo comunque 200 a qualsiasi evento che non ci interessa:
  // altrimenti Stripe continuerebbe a ritentare la consegna all'infinito
  // pensando che la ricezione sia fallita.
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session

  try {
    await handleCheckoutCompleted(session)
  } catch (error) {
    // Un 500 qui fa sì che Stripe ritenti automaticamente la consegna più
    // tardi (con backoff): utile per errori temporanei (es. il database
    // momentaneamente irraggiungibile), che vogliamo poter recuperare da
    // soli invece di perdere silenziosamente l'ordine.
    console.error('Errore nella gestione di checkout.session.completed:', error)
    return new Response('Errore interno.', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Il pagamento potrebbe non essere ancora confermato per alcuni metodi
  // "asincroni" (es. bonifici istantanei in alcuni paesi): per le carte —
  // il solo metodo abilitato in create-checkout-session — a questo punto
  // è già sempre "paid". Il controllo resta comunque come rete di
  // sicurezza: se non è pagato, non c'è nulla da registrare qui (un
  // pagamento asincrono andato a buon fine genererebbe un evento separato,
  // "checkout.session.async_payment_succeeded", non gestito da questa
  // versione della funzione).
  if (session.payment_status !== 'paid') {
    console.log(`Sessione ${session.id} non ancora pagata (${session.payment_status}), ignorata.`)
    return
  }

  const userId = session.metadata?.user_id
  const discountPercentage = Number(session.metadata?.discount_percentage ?? '0')
  const itemsJson = session.metadata?.items

  if (!userId || !itemsJson) {
    console.error(`Sessione ${session.id} priva dei metadata attesi, impossibile creare l'ordine.`)
    return
  }

  const items: { product_id: string; quantity: number; unit_price: number }[] =
    JSON.parse(itemsJson)

  // --- Idempotenza -----------------------------------------------------
  // Stripe può recapitare lo stesso evento più di una volta (per policy
  // esplicita: gli handler dei webhook devono gestire consegne duplicate).
  // Se un ordine con questo stripe_session_id esiste già, questa sessione
  // è già stata processata: usciamo subito, senza ripetere lo scalo
  // dello stock una seconda volta.
  const { data: existingOrder } = await adminClient
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existingOrder) {
    console.log(`Sessione ${session.id} già processata (ordine ${existingOrder.id}), salto.`)
    return
  }

  // amount_total/amount_subtotal sono in centesimi e sono i valori
  // EFFETTIVAMENTE addebitati da Stripe (calcolati da Stripe stesso a
  // partire dai line_items e dal coupon che avevamo applicato in
  // create-checkout-session): li usiamo direttamente invece di
  // ricalcolarli, dato che l'evento arriva firmato da Stripe e non può
  // essere stato alterato dal client.
  const total = (session.amount_total ?? 0) / 100
  const amountSubtotal = (session.amount_subtotal ?? session.amount_total ?? 0) / 100
  const discountAmount = Math.max(amountSubtotal - total, 0)

  // --- Indirizzo di spedizione --------------------------------------------
  // Popolato da Stripe stesso perché create-checkout-session imposta
  // "shipping_address_collection": l'utente lo inserisce nella pagina di
  // pagamento di Stripe, non nel nostro sito. Salviamo l'oggetto così com'è
  // (nome + indirizzo strutturato) in una colonna jsonb: è un dato di sola
  // lettura per noi (mostrato in Account.jsx), non serve normalizzarlo in
  // colonne separate. Può essere null se, per qualche motivo, Stripe non
  // l'ha raccolto (es. sessione creata prima di questa modifica).
  const shippingDetails = session.shipping_details ?? null
  const shippingAddress = shippingDetails
    ? { name: shippingDetails.name, address: shippingDetails.address }
    : null

  // --- Scalo atomico dello stock -----------------------------------------
  // Per ogni prodotto, un'unica UPDATE con condizione "stock >= quantity"
  // (vedi la funzione SQL decrement_product_stock, schema_stripe_orders.sql):
  // essendo un'unica istruzione SQL, Postgres la esegue in modo atomico —
  // non c'è nessuna finestra di tempo in cui due richieste concorrenti
  // potrebbero leggere entrambe "stock disponibile" e scalarlo entrambe,
  // portandolo sotto zero (il classico problema di due persone che
  // comprano l'ultimo pezzo quasi nello stesso istante).
  // Il pagamento è già avvenuto a questo punto: se lo stock nel frattempo
  // non basta più, NON si può "annullare" il pagamento da qui (servirebbe
  // un rimborso, decisione che lasciamo al negoziante) — registriamo
  // comunque l'ordine, ma con uno stato che segnala il problema.
  let hasStockIssue = false
  for (const item of items) {
    const { data: decremented, error: decrementError } = await adminClient.rpc(
      'decrement_product_stock',
      { p_product_id: item.product_id, p_quantity: item.quantity }
    )

    if (decrementError) {
      console.error(`Errore nello scalo stock per ${item.product_id}:`, decrementError)
      hasStockIssue = true
    } else if (!decremented) {
      console.error(
        `Stock insufficiente per il prodotto ${item.product_id} (ordine sessione ${session.id}): richiesti ${item.quantity}.`
      )
      hasStockIssue = true
    }
  }

  // --- Creazione dell'ordine ---------------------------------------------
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .insert({
      user_id: userId,
      stripe_session_id: session.id,
      // "paid_stock_issue" segnala che il cliente ha pagato ma almeno un
      // prodotto non aveva più scorte sufficienti: da controllare a mano
      // (contattare il cliente per un rimborso parziale o un ordine
      // posticipato). Non è uno stato "bloccante": l'ordine esiste ed è
      // pagato, va solo rivisto.
      status: hasStockIssue ? 'paid_stock_issue' : 'paid',
      total,
      discount_percentage: discountPercentage,
      discount_amount: discountAmount,
      shipping_address: shippingAddress,
    })
    .select()
    .single()

  if (orderError) {
    // "23505" = violazione di un vincolo unique: un'altra consegna dello
    // stesso evento webhook ha inserito l'ordine un istante prima di noi
    // (corsa tra due richieste concorrenti). Non è un errore vero, è
    // esattamente il caso di idempotenza che il controllo sopra prova a
    // intercettare in anticipo — qui lo gestiamo comunque come rete di
    // sicurezza aggiuntiva.
    if (orderError.code === '23505') {
      console.log(`Sessione ${session.id}: ordine già creato da un'altra richiesta concorrente.`)
      return
    }
    throw orderError
  }

  // --- Righe dell'ordine ---------------------------------------------------
  // "price_at_purchase" usa "unit_price" salvato nei metadata al momento
  // della creazione della sessione (create-checkout-session): è il prezzo
  // VERO pagato per quel prodotto, immutabile anche se in seguito il
  // prezzo del prodotto in "products" dovesse cambiare.
  const orderItemsPayload = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price_at_purchase: item.unit_price,
  }))

  const { error: orderItemsError } = await adminClient.from('order_items').insert(orderItemsPayload)

  if (orderItemsError) {
    console.error(`Errore nella creazione delle righe d'ordine per ${order.id}:`, orderItemsError)
  }

  console.log(`Ordine ${order.id} creato per la sessione ${session.id}${hasStockIssue ? ' (con problemi di stock)' : ''}.`)
}
