# Revisione di sicurezza

**Data:** 6 ottobre 2026  
**Perimetro:** lettura del codice e dei file SQL presenti nel repository. In questa revisione non sono stati eseguiti SQL, chiamate API di test o deploy. Le migrazioni Supabase sono gestite manualmente: le policy effettivamente attive vanno confrontate con l'ordine indicato qui sotto. La CLI Supabase non tiene una cronologia delle esecuzioni SQL Editor.

## Come funziona

### Flusso ordine

| Passo | Cosa decide il componente | Se il browser mente |
|---|---|---|
| 1. Carrello | Il browser gestisce ID prodotto e quantità e mostra i prezzi per UX. `src/context/CartContext.jsx:38–163, 179–202`. | Il carrello locale non è autorevole; prezzi, disponibilità e sconto non vengono accettati dal browser per creare il pagamento. |
| 2. Richiesta checkout | `src/pages/Checkout.jsx:48–80` invia alla Edge Function gli ID/quantità e la lingua; non invia importi. | Un JWT mancante/non valido viene rifiutato. Il backend convalida il corpo e rifiuta quantità non intere o <= 0: `supabase/functions/create-checkout-session/index.ts:73–119`. |
| 3. Prezzi, quantità, bundle | `create-checkout-session` verifica il JWT con `auth.getUser()`, ricava `user.id` dal token e legge nome/prezzo/stock dal DB con Service Role: `.../create-checkout-session/index.ts:77–91, 121–159`. Calcola il bundle sul server e crea i line item Stripe con prezzo DB e quantità verificata: `:167–218`. | Modificare prezzo, sconto o `user_id` nel browser non cambia i valori verificati; `user_id` proviene dal JWT, non dal body. Quantità elevate sono respinte se lo stock letto non basta. **Difetto:** la query non legge né filtra `products.active`, quindi un utente autenticato che conosce l'ID può chiedere un prodotto disattivato ancora a stock. |
| 4. Sessione Stripe | La Edge Function imposta importo e righe, email account, indirizzo Italia, metadata e URL: `.../create-checkout-session/index.ts:225–249`. Stripe presenta e incassa il Checkout. | Il client non può riscrivere i line item o i metadata della sessione già creata. Prezzo totale nell'evento webhook proviene da Stripe, non dal browser. |
| 5. Webhook | Stripe chiama `stripe-webhook`, distribuita senza verifica JWT Supabase; la funzione controlla la firma `stripe-signature` sui byte originali e accetta solo `checkout.session.completed`: `supabase/functions/stripe-webhook/index.ts:118–145`. | Una richiesta costruita dal browser senza firma Stripe valida è respinta con 400. La funzione usa Service Role solo lato server. |
| 6. Ordine, righe e stock | Il webhook controlla `payment_status`, legge l'utente/righe dai metadata della sessione firmata e il totale dagli importi Stripe: `.../stripe-webhook/index.ts:178–235`. Chiama `create_paid_order`: `:239–255`. La RPC definita in `fix_security_stock_orders.sql:95–293` salva ordine e righe, poi scala stock e infine aggiorna lo stato, in una singola transazione. | Un errore nel salvataggio delle righe o in altri passaggi SQL annulla la transazione; il webhook restituisce 500 e Stripe può ritentare (`index.ts:140–151`). Una sessione già registrata con righe complete restituisce successo senza duplicare né riscalare stock (`fix_security_stock_orders.sql:170–213`). Se lo stock finisce tra checkout e pagamento, l'ordine è registrato come `paid_stock_issue`, senza decrementare il prodotto insufficiente. |
| 7. Email | Dopo la registrazione, `sendConfirmationEmail` prova l'invio Resend in un `try/catch` separato: `.../stripe-webhook/index.ts:272–291, 297–372`. | Il mancato invio viene loggato e non annulla l'ordine né fa ritentare un pagamento già registrato. |

**Bundle:** `calculateDiscountPercentage` è chiamata dalla Edge Function sui prodotti distinti validati: 10% con 2 prodotti, 15% con almeno 3, altrimenti 0 (`create-checkout-session/index.ts:167–171`). Non si basa su una percentuale inviata dal browser.

### Cosa è protetto e da cosa

- **Prezzi e importi:** la sessione Stripe usa il prezzo da `products`; il webhook memorizza importo totale/subtotale proveniente dalla sessione Stripe firmata.
- **Quantità:** il checkout richiede quantità intere positive e confronta con lo stock DB. Lo stock può cambiare tra creazione sessione e pagamento: la RPC del nuovo SQL fa il controllo atomico finale.
- **Ordini:** l'utente è preso da un JWT verificato da Auth; RLS limita la lettura agli ordini propri. La creazione da browser deve essere rimossa con `schema_security_fix_A.sql`; la nuova scrittura webhook usa `service_role`.
- **Profili e promozione admin:** `RequireAdmin`/`isAdmin` proteggono l'interfaccia, ma non sono il confine di sicurezza (`src/components/RequireAdmin.jsx:15–33`, `src/App.jsx:122–206`). Il database usa policy RLS; `schema_security_fix_A.sql:59–88` aggiunge il trigger `protect_profiles_is_admin_trigger` e revoca UPDATE della colonna `is_admin` ad `anon` e `authenticated`. `manage-admin` verifica JWT e rilegge `profiles.is_admin` dal DB prima di agire (`supabase/functions/manage-admin/index.ts:55–105`).
- **RPC admin:** le RPC dashboard sono `SECURITY INVOKER`, richiedono `is_admin` nel corpo funzione e revocano l'esecuzione ad `anon` (`schema_admin_dashboard.sql:55–204`). `manage-admin` usa Service Role dopo il controllo admin server-side.
- **Recensioni:** la lettura pubblica è limitata alle recensioni approvate; non c'è policy di inserimento pubblica o per utenti normali (`schema_reviews.sql:35–71`).
- **Trigger/RPC `SECURITY DEFINER`:** trigger di profilo/SKU/snapshot sono operazioni DB; `generate_product_sku` revoca EXECUTE ai ruoli client (`schema_products_sku.sql:81–127`). Il nuovo `is_admin_user()` non interroga RLS ricorsivamente e non è eseguibile da anon (`fix_security_stock_orders.sql:76–92`).
- **Segreti:** frontend solo con URL/anon key Supabase e publishable key Stripe. Chiavi server/Service Role restano nelle Edge Functions/Supabase Secrets. Nessun valore segreto è riportato in questo documento.

## Policy RLS

La tabella seguente descrive il risultato atteso applicando gli SQL in dipendenza; `schema_security_fix_A.sql` deve essere applicato dopo `schema.sql` e `schema_admin.sql`. `fix_security_stock_orders.sql` va prima di `schema_admin_orders.sql`. Le funzioni security-invoker rispettano la RLS del chiamante.

| Tabella | SELECT | INSERT | UPDATE | DELETE | Note |
|---|---|---|---|---|---|
| `public.products` | Chiunque | Admin | Admin | Admin | Lettura pubblica intenzionale per il catalogo (`schema.sql`, `schema_admin.sql`). Nella policy UPDATE non vi è una restrizione a colonne, ma solo gli admin possono usarla. |
| `public.categories` | Chiunque | Admin | Admin | Admin | `schema_categories.sql`; policy admin basata su `profiles.is_admin`. |
| `public.product_images` | Chiunque | Admin | Admin | Admin | `schema_product_images.sql`; lettura pubblica delle foto di catalogo. |
| `public.reviews` | Chiunque, solo `approved = true`; admin tutte | Admin | Admin | Admin | `schema_reviews.sql`; utenti normali non possono inviare/approvare recensioni con la API. |
| `public.profiles` | Utente sulla propria riga; admin tutte dopo `schema_admin_orders.sql` | Utente solo con `id = auth.uid()` | Utente sulla propria riga; admin **nessuna policy admin di UPDATE** | Nessuna policy client | Dopo `schema_security_fix_A.sql`, `is_admin` è protetto sia dal trigger sia dal `REVOKE UPDATE (is_admin)`. Utente normale non può leggere profili altrui. |
| `public.orders` | Utente sui propri ordini; admin tutti dopo `schema_admin_orders.sql` | Nessun client dopo `schema_security_fix_A.sql` | Admin dopo `schema_admin_orders.sql` | Nessuna policy client | Prima di `schema_security_fix_A.sql`, `schema.sql` permette a un utente di inserire un ordine proprio: può fabbricare un ordine/stato non pagato da Stripe. |
| `public.order_items` | Righe dei propri ordini; admin tutte dopo `schema_admin_orders.sql` | Nessun client dopo `schema_security_fix_A.sql` | Nessuna policy client | Nessuna policy client | Prima di `schema_security_fix_A.sql`, l'inserimento proprio è consentito dalla policy base; rimuoverla impedisce righe d'ordine false da browser. |
| `public.product_sku_counters` | Nessuno dei ruoli API | Nessuno dei ruoli API | Nessuno dei ruoli API | Nessuno dei ruoli API | RLS attiva senza policy (`schema_products_sku.sql`); il trigger invoca la funzione proprietaria. |
| `storage.objects` nel bucket `product-images` | Chiunque nel bucket | Admin nel bucket | Admin nel bucket | Admin nel bucket | Bucket pubblico per le immagini; policy per bucket filtrate su `bucket_id` (`schema_admin.sql`). |

**Policy troppo larghe rilevate:** nessuna policy mutativa `USING (true)` o `WITH CHECK (true)` nei SQL esaminati; i `true` sulle tabelle pubbliche sono policy di sola lettura attese per catalogo/categorie/immagini. Due cautele:

1. `schema_admin_orders.sql` permette a un admin di aggiornare l'intera riga `orders`, non solo `status` e `tracking_number`; un admin può quindi anche modificare via API importi o riferimenti Stripe. È privilegio admin, non escalation per utenti normali, ma non applica il principio del minimo privilegio a livello di colonna.
2. Le policy di inserimento ordini/righe e la protezione `profiles.is_admin` dipendono dall'esecuzione di `schema_security_fix_A.sql`. Una policy definita in un file non è attiva finché quel file non viene applicato. In base all'audit live precedente del 6 ottobre, il trigger `protect_profiles_is_admin_trigger` risultava presente; la nuova revisione non ha interrogato il database.

**Altri utenti:** con le policy proprietarie, un utente non può leggere ordini, righe d'ordine o profili di altre persone. Gli admin possono leggere gli ordini/profili di tutti dopo `schema_admin_orders.sql`. Le pagine amministrative ordini/clienti risultavano senza le relative policy/colonna nel controllo live precedente, quindi tale file va applicato dopo il fix; i dati non diventano pubblici.

## Admin: controlli per livello

1. **UI:** link e route sono nascosti/protetti da `RequireAdmin`, che usa lo stato profilo (`src/components/RequireAdmin.jsx:15–33`, `src/App.jsx:122–206`). Un utente può aggirare la UI e invocare REST/Edge Function direttamente: questo controllo da solo non basta.
2. **Edge Function:** `manage-admin` verifica l'Authorization JWT con Supabase Auth, poi legge il profilo vero con Service Role e risponde 403 se il chiamante non è admin (`supabase/functions/manage-admin/index.ts:55–105`). Non si fida di `is_admin` passato dal frontend.
3. **DB/RLS:** policy di scrittura prodotti/categorie/immagini/recensioni controllano `profiles.is_admin`; tabella ordini e profili hanno policy admin in `schema_admin_orders.sql`, tramite `is_admin_user()`. Trigger più revoca di colonna impediscono agli utenti ordinari di aggiornare `is_admin` direttamente.

**Si può diventare admin via chiamata diretta?** Non se `schema_security_fix_A.sql` è realmente applicato: il `REVOKE` blocca l'UPDATE della colonna per `authenticated` e il trigger ripristina il valore precedente per ogni ruolo diverso da `service_role`. La RPC `manage-admin` richiede che il chiamante sia già admin. Il solo schema iniziale (`schema.sql` + `schema_admin.sql`) è invece vulnerabile: consente UPDATE del proprio profilo senza protezione della colonna, come documentato in `schema_security_fix_A.sql`. Verificare che il fix sia presente nel database reale.

## Segreti

Ricerca read-only nel frontend, nei file del repository e nella cronologia Git per pattern di chiavi Stripe/webhook/Service Role/Resend: non sono state individuate credenziali effettive. Le corrispondenze nella cronologia sono stringhe d'esempio con valori segnaposto in `STRIPE_SETUP.md`. `.env` è ignorato da Git e non compare tra i file tracciati; il client frontend legge solo variabili pubbliche `VITE_*`.

Questa è una verifica del contenuto disponibile nel repository e della cronologia interrogata, non la prova che credenziali in altri sistemi non siano mai state esposte. Non sono stati letti o riportati valori locali o secrets Supabase. Se un valore reale è mai stato commesso o condiviso, revocarlo/ruotarlo anche se il commit è stato rimosso.

## Problemi trovati

### Alta

- **Possibile RPC stock eseguibile pubblicamente nel database.** La definizione originale in `schema_stripe_orders.sql:52–79` è `SECURITY DEFINER`, non rifiuta quantità <= 0 e concede a `service_role` senza revocare esplicitamente `PUBLIC`/`anon`. L'audit live precedente ha confermato `EXECUTE` a `anon`: una quantità negativa può aumentare lo stock. `fix_security_stock_orders.sql:15–73` corregge validazione e permessi, ma il file va applicato al DB; non è stato eseguito in questa revisione.
- **Il deploy del webhook dipende dalle RPC SQL aggiornate.** La versione corrente di `stripe-webhook` invoca `create_paid_order`, definita solo in `fix_security_stock_orders.sql`. Eseguire/applicare prima il fix SQL e verificare i permessi; se si distribuisce prima la funzione, il webhook riceverà errore RPC e Stripe continuerà a ritentare gli eventi.
- **Possibile autopromozione admin se manca il security fix.** La policy base di profilo consente all'utente di aggiornare la propria riga (`schema.sql:76–79`). Senza trigger e `REVOKE` di `schema_security_fix_A.sql:59–88`, può impostare `is_admin=true`. La verifica live precedente aveva trovato il trigger; controllare che non sia stato rimosso e che il `REVOKE` sia attivo.

### Media

- **Acquisto di prodotto disattivato:** `create-checkout-session` legge `id, name, price, stock, image_url` e valida la disponibilità ma non `active` (`supabase/functions/create-checkout-session/index.ts:130–159`). Il filtro `active=true` del catalogo UI non è un controllo server. Aggiungere filtro/verifica server-side prima di consentire checkout di produzione.
- **Migrazioni manuali e stato database non riproducibile:** SQL Editor non lascia una cronologia gestita da Supabase CLI; il repository e il database possono divergere. L'audit live precedente non trovava effetti `schema_admin_orders.sql`; le funzioni Admin ordini/clienti restano limitate finché la versione corretta non è applicata.
- **Scritture admin ordini troppo ampie:** la policy UPDATE concede all'admin l'intera riga; limitare a colonne effettivamente modificabili o centralizzare la modifica in un'operazione server-side.
- **RPC stock esposta nel vecchio schema:** non rieseguire dopo il fix la definizione vecchia di `schema_stripe_orders.sql` senza riapplicare `fix_security_stock_orders.sql`, perché ripristinerebbe il body vulnerabile (la GRANT permissiva può anche persistere).

### Bassa

- **Manca un limite esplicito di richieste** nel checkout e nei moduli pubblici osservati. JWT, validazione e Stripe riducono l'abuso, ma non sostituiscono rate limiting/quote contro spam e costi di function/Stripe.
- **Problemi di stock dopo pagamento:** se due clienti completano il pagamento dopo aver visto stock disponibile, la transazione registra il pagamento in stato `paid_stock_issue` per gli articoli ormai esauriti; serve una procedura operativa per contatto/rimborso. Non è una manipolazione browser, ma richiede controllo umano.

## Test di attacco da fare a mano

Eseguire **solo su un progetto di staging**. Questi comandi non sono stati lanciati. Sostituire URL, chiavi, UUID e token con valori di test; non salvare la chiave anon o JWT nel repository. La chiave anon identifica il progetto ma non autentica un utente: i test per profilo proprio e per isolare dati di altri utenti richiedono anche il JWT di un account test.

```powershell
$base = 'https://<PROJECT_REF>.supabase.co'
$anonKey = '<SUPABASE_ANON_KEY>'
$anonHeaders = @("apikey: $anonKey", "Authorization: Bearer $anonKey")
```

### 1. Lettura ordini, righe e profili come anonimo

```powershell
curl.exe -i -H $anonHeaders[0] -H $anonHeaders[1] "$base/rest/v1/orders?select=id,user_id&limit=5"
curl.exe -i -H $anonHeaders[0] -H $anonHeaders[1] "$base/rest/v1/order_items?select=id,order_id&limit=5"
curl.exe -i -H $anonHeaders[0] -H $anonHeaders[1] "$base/rest/v1/profiles?select=id,email&limit=5"
```

**Atteso:** risposta senza righe (spesso `200 []`) o accesso negato; mai dati cliente. Per verificare l'isolamento autenticato, ripetere con `Authorization: Bearer <JWT_UTENTE_TEST>`: ordini e righe solo propri, profilo solo proprio. Con filtro `user_id=neq.<ID_UTENTE_TEST>` / `id=neq.<ID_UTENTE_TEST>`, risultato senza righe.

### 2. Tentativo di modificare prezzo o stock

Usare un prodotto sacrificabile di staging e annotare i valori originali; questa richiesta è mutativa e potrebbe riuscire se la configurazione RLS fosse errata.

```powershell
$productId = '<UUID_PRODOTTO_STAGING>'
curl.exe -i -X PATCH `
  -H $anonHeaders[0] -H $anonHeaders[1] `
  -H 'Content-Type: application/json' `
  -H 'Prefer: return=representation' `
  --data '{"price":0.01,"stock":999}' `
  "$base/rest/v1/products?id=eq.$productId"
```

**Atteso:** 401/403 o nessuna riga aggiornata; il DB non deve cambiare. Se ritorna una riga aggiornata, interrompere i test, ripristinare i valori e correggere le policy.

### 3. Chiamata diretta RPC

```powershell
$zeroUuid = '00000000-0000-0000-0000-000000000000'
curl.exe -i -X POST `
  -H $anonHeaders[0] -H $anonHeaders[1] `
  -H 'Content-Type: application/json' `
  --data "{`"p_product_id`":`"$zeroUuid`",`"p_quantity`":1}" `
  "$base/rest/v1/rpc/decrement_product_stock"

curl.exe -i -X POST `
  -H $anonHeaders[0] -H $anonHeaders[1] `
  -H 'Content-Type: application/json' `
  --data '{"p_user_id":null,"p_stripe_session_id":"","p_total":0,"p_discount_percentage":0,"p_discount_amount":0,"p_shipping_address":null,"p_items":[]}' `
  "$base/rest/v1/rpc/create_paid_order"

curl.exe -i -X POST `
  -H $anonHeaders[0] -H $anonHeaders[1] `
  -H 'Content-Type: application/json' `
  --data '{"p_category_id":"00000000-0000-0000-0000-000000000000","p_year":2026}' `
  "$base/rest/v1/rpc/generate_product_sku"
```

**Atteso dopo i fix:** `decrement_product_stock`, `create_paid_order` e `generate_product_sku` negati (401/403 o errore `permission denied`); lo UUID nullo evita di toccare un prodotto se la vecchia RPC è ancora eseguibile. Una chiamata anon a `admin_dashboard_stats`/`admin_customers` deve essere negata.

### 4. Inserimento di recensione già approvata

Usare un UUID prodotto valido del progetto staging; un eventuale errore FK su UUID inesistente non verifica la policy.

```powershell
$productId = '<UUID_PRODOTTO_STAGING>'
curl.exe -i -X POST `
  -H $anonHeaders[0] -H $anonHeaders[1] `
  -H 'Content-Type: application/json' `
  -H 'Prefer: return=representation' `
  --data "{`"product_id`":`"$productId`",`"customer_name`":`"Security test`",`"rating`":5,`"comment`":`"test`",`"approved`":true}" `
  "$base/rest/v1/reviews"
```

**Atteso:** inserimento negato (401/403, RLS o permesso tabella); non deve apparire una recensione pubblica approvata.

### 5. Tentativo di impostare `is_admin = true`

Richiede un account di test autenticato (JWT ottenuto con il normale login). Chiave `apikey` resta quella anon; non usare un token di produzione.

```powershell
$userJwt = '<JWT_UTENTE_TEST>'
$userId = '<UUID_UTENTE_TEST>'
curl.exe -i -X PATCH `
  -H "apikey: $anonKey" -H "Authorization: Bearer $userJwt" `
  -H 'Content-Type: application/json' `
  -H 'Prefer: return=representation' `
  --data '{"is_admin":true}' `
  "$base/rest/v1/profiles?id=eq.$userId"

curl.exe -i `
  -H "apikey: $anonKey" -H "Authorization: Bearer $userJwt" `
  "$base/rest/v1/profiles?id=eq.$userId&select=id,is_admin"
```

**Atteso:** il PATCH è negato per privilegio colonna oppure il trigger impedisce la modifica; la lettura successiva mostra `is_admin=false`. Se è `true`, disabilitare subito accesso pubblico e correggere il database.

## Cose da fare a mano

- **Stripe Live:** verificare chiavi Live, webhook Live e firma, poi fare un ordine controllato e controllare che ordine/righe/stock coincidano. La presenza di secrets non prova che siano valori Live.
- **Google OAuth:** pubblicare/configurare l'app in Google Cloud, controllare redirect URI e callback Supabase.
- **Backup:** il backup automatico Supabase richiede piano Pro; attivarlo e verificare una procedura di restore, non solo la pianificazione.
- **Rate limiting:** aggiungere limiti per utente/IP alle Edge Function (in particolare checkout e gestione di endpoint pubblici), monitoraggio e protezione da abuso.
- **SQL/manual verification:** verificare nel DB `EXECUTE` su `decrement_product_stock` soltanto a `service_role`, presenza del trigger `protect_profiles_is_admin_trigger`, revoca UPDATE su `profiles.is_admin`, RLS attiva e policy coerenti con la tabella sopra. Applicare SQL solo dopo aver verificato dipendenze e ambiente di destinazione.
