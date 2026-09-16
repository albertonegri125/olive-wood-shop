# Configurazione del checkout Stripe

Il codice è pronto (`Checkout.jsx`, `CheckoutSuccess.jsx`, `CheckoutCancel.jsx`,
le due Edge Function in `supabase/functions/`), ma per farlo funzionare
davvero servono alcuni passaggi manuali: creare l'account Stripe, deployare
le funzioni, collegare il webhook. Segui l'ordine qui sotto.

Prima di iniziare, esegui nel SQL Editor di Supabase, in quest'ordine (se
non l'hai già fatto in un passaggio precedente del progetto):
`schema.sql` → `schema_orders_discount.sql` → `schema_stripe_orders.sql`.

---

## 1. Crea l'account Stripe e prendi le chiavi (modalità Test)

1. Registrati su [dashboard.stripe.com/register](https://dashboard.stripe.com/register).
2. Dopo l'accesso, controlla in alto a destra che sia attivo il toggle
   **"Test mode"** (dati e pagamenti finti, nessun addebito reale — è la
   modalità in cui sviluppare e testare tutto, prima di passare a quella
   reale).
3. Vai su **Developers → API keys** (o direttamente
   [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)).
   Troverai due chiavi:
   - **Publishable key** (`pk_test_...`): non è più strettamente
     necessaria con il flusso attuale (il redirect a Stripe Checkout non
     richiede Stripe.js lato client), ma se vuoi comunque compilarla per
     usi futuri va in `.env` come `VITE_STRIPE_PUBLISHABLE_KEY` (vedi
     `.env.example`).
   - **Secret key** (`sk_test_...`): **non va mai nel frontend**. Serve
     solo alla Edge Function `create-checkout-session` (vedi step 3).
4. Per testare un pagamento userai carte di test, es. `4242 4242 4242 4242`,
   qualsiasi data futura, qualsiasi CVC — l'elenco completo è su
   [stripe.com/docs/testing](https://stripe.com/docs/testing).

## 2. Installa la Supabase CLI e collega il progetto

Se non l'hai già fatto:

```bash
npm install -g supabase
supabase login
```

Dalla cartella del progetto (`olive-wood-shop`):

```bash
supabase link --project-ref <il-tuo-project-ref>
```

Il "project ref" è il codice nel tuo URL Supabase
(`https://<project-ref>.supabase.co`), oppure lo trovi in
**Project Settings → General**.

## 3. Configura i secret delle Edge Function

Le due funzioni leggono alcuni valori come variabili d'ambiente. `SUPABASE_URL`,
`SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili
automaticamente in ogni Edge Function: **non** vanno impostati a mano.
Servono invece questi tre, da impostare come secret:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
supabase secrets set SITE_URL=http://localhost:5173
```

(`SITE_URL` va aggiornato quando pubblichi il sito, es.
`https://tuodominio.it` — è l'indirizzo a cui Stripe reindirizza dopo il
pagamento; puoi anche impostarne uno diverso più avanti e rifare il
`secrets set`, ha effetto immediato senza bisogno di un nuovo deploy).

Il terzo secret, `STRIPE_WEBHOOK_SECRET`, lo otterrai allo step 5 (serve
prima creare il webhook su Stripe, che a sua volta richiede l'URL della
funzione — quindi va fatto dopo il deploy).

## 4. Deploya le Edge Function

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

Il flag `--no-verify-jwt` su `stripe-webhook` è **fondamentale**: quella
funzione riceve richieste da Stripe (autenticate con la firma webhook, non
con un token Supabase) — senza questo flag, Supabase rifiuterebbe ogni
chiamata di Stripe con un 401 prima ancora di eseguire il codice. Lo stesso
comportamento è già dichiarato in `supabase/config.toml`: se usi una
versione della CLI che lo rispetta in automatico il flag è ridondante, ma
non fa danno specificarlo comunque.

Dopo il deploy, la CLI stampa l'URL pubblico di ciascuna funzione, del tipo:

```
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Tienilo a portata: serve al prossimo step.

## 5. Configura il Webhook Secret su Supabase

1. Nella dashboard Stripe, vai su **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL**: incolla l'URL di `stripe-webhook` ottenuto sopra.
3. **Events to send**: seleziona solo `checkout.session.completed`
   (è l'unico evento gestito dalla funzione).
4. Salva. Stripe mostra ora un **Signing secret** (`whsec_...`): copialo.
5. Impostalo come secret della funzione:

   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
   ```

Da questo momento in poi il checkout è completo end-to-end: un pagamento
di test dovrebbe generare una riga in `orders` (con `status = 'paid'`),
le relative righe in `order_items`, e scalare lo stock dei prodotti
acquistati — puoi verificarlo sia dalla dashboard Supabase (Table Editor)
sia dai log della funzione (`supabase functions logs stripe-webhook`).

### Testare il webhook in locale (facoltativo)

Se vuoi testare senza deployare a ogni modifica, usa la [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe login
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

(richiede `supabase functions serve` avviato in un altro terminale, con un
file `supabase/.env` locale contenente gli stessi secret di cui sopra). Il
comando `stripe listen` stampa un webhook secret temporaneo (`whsec_...`)
da usare al posto di quello di produzione durante i test locali.

## 6. Attiva Apple Pay / Google Pay / PayPal / Klarna dalla dashboard

Il codice imposta `payment_method_types: ['card']`: con questa
impostazione, **Apple Pay e Google Pay compaiono automaticamente** dentro
il metodo "carta" sui dispositivi/browser che li supportano, se il metodo
è abilitato in dashboard — non serve nessuna modifica al codice.

1. Vai su **Settings → Payment methods**
   ([dashboard.stripe.com/settings/payment_methods](https://dashboard.stripe.com/settings/payment_methods)).
2. **Apple Pay**: attivalo dall'elenco. Se il tuo dominio non è già
   verificato, Stripe ti guida nella verifica (di solito automatica se il
   sito è raggiungibile pubblicamente in HTTPS).
3. **Google Pay**: attivalo allo stesso modo — non richiede verifica del
   dominio.
4. **PayPal / Klarna** (o altri metodi locali, es. iDEAL, Bancontact):
   attivali dallo stesso elenco. **Attenzione**: perché compaiano
   davvero nella pagina di pagamento, devi anche **rimuovere** (o
   estendere) la riga `payment_method_types: ['card']` in
   `create-checkout-session/index.ts` — specificando esplicitamente
   `['card']`, la sessione mostra *solo* quel metodo, anche se altri sono
   abilitati in dashboard. Due opzioni:
   - **Rimuovi del tutto la riga** `payment_method_types: ['card']`
     dal codice e rideploya la funzione: Stripe Checkout userà
     automaticamente tutti i metodi abilitati in dashboard, senza doverli
     elencare a mano.
   - Oppure aggiungi esplicitamente i valori che ti servono, es.
     `payment_method_types: ['card', 'paypal', 'klarna']`.
5. Rideploya se hai modificato il codice:
   ```bash
   supabase functions deploy create-checkout-session
   ```

Con questi passaggi, il checkout mostra automaticamente Apple Pay/Google
Pay (via "card") e, se scelto, PayPal/Klarna/altri metodi — tutti gestiti
da Stripe stesso, senza logica aggiuntiva nel nostro codice.
