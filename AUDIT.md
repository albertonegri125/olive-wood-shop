# Audit stato sito OliveWood Creations

**Data:** 6 ottobre 2026  
**Ambito:** revisione statica del repository e verifiche di sola lettura sul progetto Supabase collegato. Nessun file applicativo modificato; nessuna migrazione, commit o deploy eseguito. Questo report è l'unico file creato.

## Riepilogo tabellare

| Area | Stato (OK / Da fare / Rotto) | Dettaglio | Priorità (Alta / Media / Bassa) |
|---|---|---|---|
| Build | OK | `npm run build` completa. Warning: chunk JavaScript principale circa 705 KB minificato (197 KB gzip), oltre la soglia 500 KB di Vite. | Media |
| Lint | Da fare | `npm run lint` termina senza errori, ma segnala 14 warning: effetti con setState sincrono, 2 dipendenze mancanti negli effect, 1 setter inutilizzato e 3 warning Fast Refresh. | Bassa |
| Dipendenze | Da fare | 7 pacchetti hanno release più recenti (`npm outdated`, elenco sotto). `@stripe/stripe-js` appare inutilizzato dal flusso app: `src/lib/stripeClient.js` è l'unico importatore e non risulta importato altrove. `@types/react*` sono probabilmente superflui: l'app non contiene sorgenti React TS/TSX. | Media |
| Variabili frontend | OK | Nel frontend sono lette solo `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`; `.env` contiene queste tre chiavi, è ignorato da Git e non è tracciato. | Bassa |
| Secrets e cronologia Git | OK | I cinque secrets richiesti risultano presenti nel Secret Manager Supabase. Nessun valore è riportato qui. Le corrispondenze `sk_` trovate in `git log -p -S"sk_"` sono esempi segnaposto in `STRIPE_SETUP.md`, non chiavi reali; nessuna chiave reale rilevata nei file tracciati. | Bassa |
| `.gitignore` / Vercel | OK | `.env` escluso; `vercel.json` riscrive gli URL su `/index.html` per SPA. | Bassa |
| Database: RLS | OK | RLS attiva sulle 8 tabelle `public` osservate (categories, order_items, orders, product_images, product_sku_counters, products, profiles, reviews). Nessuna policy INSERT/UPDATE/DELETE con `USING/WITH CHECK true` trovata nel DB live; `true` è usato per SELECT pubblico previsto su catalogo, categorie e immagini. | Bassa |
| Database: RPC stock | Rotto | `decrement_product_stock(uuid, integer)` è `SECURITY DEFINER` ed `anon` ha `EXECUTE`. La funzione non rifiuta quantità negative: una chiamata anonima può aumentare lo stock; quantità positive possono ridurlo arbitrariamente. Il `GRANT` a `service_role` non revoca il default a `PUBLIC`. | Alta |
| Database: migrazioni | Da fare | `supabase migration list` remoto restituisce zero migrazioni e non esiste `supabase/migrations/`. Le modifiche SQL sono state applicate manualmente o non applicate: SQL Editor non conserva qui una cronologia interrogabile. L'introspezione live conferma gli effetti elencati sotto. | Media |
| Database: ordini Admin | Rotto | `schema_admin_orders.sql` non risulta applicato: manca `orders.tracking_number` e nel DB non ci sono policy admin per `orders`, `order_items` o `profiles`. Admin Ordini non può leggere/aggiornare gli ordini altrui; la panoramica e la lista clienti (RPC security-invoker) vedono conteggi/dati limitati da RLS. | Alta |
| Database: policy profili Admin da applicare | Da fare | La policy SELECT proposta in `schema_admin_orders.sql` interroga `profiles` dalla policy della stessa tabella; può causare ricorsione RLS (`infinite recursion`). Correggere/verificare tale policy prima di applicare lo script. | Alta |
| Database: trigger e snapshot | OK | Live presenti `protect_profiles_is_admin_trigger`, `set_product_sku_trigger`, `snapshot_product_name_before_delete_trigger` e trigger `on_auth_user_created`; `order_items.product_id` ha FK `ON DELETE SET NULL`, snapshot nome/SKU presenti. | Bassa |
| Edge Functions | OK | `create-checkout-session` e `manage-admin` ACTIVE con JWT richiesto; `stripe-webhook` ACTIVE con verifica JWT disattivata come previsto. Firma Stripe verificata sul body grezzo. Tutte le variabili server richieste risultano configurate per nome. | Bassa |
| Webhook: righe ordine | Da fare | Se l'INSERT in `order_items` fallisce, il webhook si limita a loggare l'errore e continua a rispondere 200; Stripe non ritenta e l'idempotenza salta future consegne. L'ordine può restare senza righe pur avendo scalato stock e incassato. | Alta |
| Checkout / prezzi | OK | La Edge Function rilegge prezzi e stock dal database e ricrea lo sconto; il client invia solo ID/quantità. Totale e importi registrati arrivano dalla sessione Stripe firmata. | Bassa |
| Catalogo live | Da fare | Codice Shop/Home filtra prodotti `active=true`, ma il catalogo Supabase live contiene ancora il prodotto attivo `PRODOTTO TEST - non acquistare`, con immagine Unsplash. | Alta |
| Foto segnaposto Home | Da fare | In caso di catalogo vuoto/errore, Home usa una foto Unsplash hardcoded come placeholder. | Media |
| Pagine legali | Da fare | Restano campi reali da compilare: venditore, indirizzo, P.IVA/codice fiscale, email privacy/contatto, foro competente, tempi di spedizione e spese di reso. Il PDF del recesso è ancora un link `#`. | Alta |
| i18n | OK | Confronto ricorsivo chiavi `it.json`/`en.json`: nessuna chiave mancante da una lingua. | Bassa |
| Chi siamo / brand | OK | La pagina `about` non contiene nomi personali né prima persona singolare; testi in prima persona plurale. Il nome visibile è `OliveWood Creations`; nessuna variante “Olive Wood Shop” trovata nei file tracciati. | Bassa |
| Card prodotto / immagini | OK | Riquadro card 4:5; `<img>` card con `width`, `height`, `loading="lazy"` e `alt={name}`. Le miniature di galleria hanno `alt=""` (decorative) e dimensioni esplicite, ma i tab della galleria non hanno un nome accessibile specifico per foto. | Media |
| Immagini pesanti | Da fare | `src/assets/logo.png` circa 574 KB (>300 KB). In `public`, `favicon.png` circa 152 KB. | Media |
| Meta / indicizzazione | Da fare | Title presente ma description e Open Graph generici; `og:image`/Twitter image sono percorsi relativi `/src/assets/logo.png`, non URL assoluti per crawler social. Favicon presente. Nessun `sitemap.xml` o `robots.txt`. `lang="it"` iniziale è presente e l'i18n aggiorna la lingua runtime. | Media |
| Accessibilità base | Da fare | Alt descrittivi presenti sulle immagini principali e sulle card. Tab miniature prodotto con immagini decorative senza nome proprio; verificare label/tastiera per galleria. Nessun contrasto evidente sotto soglia nella palette principale calcolata (testo muted 4.82:1, prezzo card su bianco 4.57:1, testo bianco su bottone 4.57:1). Audit WCAG completo non eseguito. | Media |
| Autorizzazione Admin | OK / Da fare | Rotte protette da `RequireAdmin`; RLS e policy admin live per prodotti, categorie, immagini e recensioni; gestione amministratori usa Edge Function con verifica JWT e rilettura server-side di `is_admin`. La sezione ordini/clienti resta bloccata dalle policy mancanti citate sopra. | Alta |
| Input / redirect / HTML | OK | Nessun `dangerouslySetInnerHTML` trovato. Redirect OAuth usa destinazioni same-origin prefissate; redirect login proviene da stato/percorso interno. Label stampa usa escaping HTML. Validazione checkout lato server presente; controllo dettagliato di tutti i form non equivale a test dinamico. | Bassa |
| Verifica end-to-end | Da fare | Non eseguiti acquisti reali/test, test provider Google, test mobile su dispositivi fisici, DNS o verifica deliverability email. Nel manifest non è definito uno script `test`. | Media |

## Build, lint, dipendenze e stringhe cercate

- `npm run build`: successo. Warning Vite per bundle principale oltre 500 KB.
- `npm run lint`: exit code 0, nessun errore, 14 warning già presenti:
  - `src/components/AccountMenu.jsx`, `src/pages/AdminReviews.jsx`, `src/components/Navbar.jsx`, `src/pages/AdminUsers.jsx`, `src/pages/AdminCategories.jsx`, `src/pages/Admin.jsx`: setState sincrono in effect.
  - `src/pages/AdminUsers.jsx` e `src/pages/AdminCategories.jsx`: dipendenza mancante (`fetchAdmins`, `fetchCategories`).
  - `src/pages/Login.jsx`: `setSessionMessageKey` non usato.
  - `src/components/AdminOrderDetail.jsx`, `src/context/CartContext.jsx`, `src/context/AuthContext.jsx`: export Fast Refresh.
- Non è presente uno script `test` in `package.json`.
- `npm outdated` elenca: `@stripe/stripe-js` 9.16.0 → wanted 9.17.0 / latest 10.0.0; `@supabase/supabase-js` 2.116.0 → 2.117.2; `@vitejs/plugin-react` 6.1.1 → 6.1.2; `oxlint` 1.82.0 → 1.87.0; `react-i18next` 17.0.13 → 17.0.16; `react-router-dom` 7.18.3 → 7.18.4; `vite` 8.3.0 → 8.3.3. `npm outdated` restituisce exit code 1 perché trova aggiornamenti.
- Ricerca `TODO/FIXME/console.log/lorem/placeholder/unsplash/example.com/test`:
  - `lorem` e `FIXME`: nessuna corrispondenza significativa nel codice applicativo.
  - `TODO`: soprattutto pagine legali/recesso; `console.log` include debug in `src/pages/Admin.jsx` e log operativi nelle Edge Functions.
  - `placeholder`: oltre a placeholder UI/form, segnaposto legali visibili in `src/locales/it.json` e `src/locales/en.json`.
  - `example.com`: testo esempio nei placeholder dei form admin, non dato aziendale.
  - `test`: prodotto live e file `*_TEST.sql`; nessuna cartella seed trovata.
- Testo hardcoded fuori i18n: il brand nel wordmark/alt è intenzionale; restano stringhe tecniche/log di debug e simboli di controllo. La verifica chiavi i18n non rileva divergenze.

## Variabili, configurazione e secrets

- `src/lib/supabaseClient.js` usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; `src/lib/stripeClient.js` legge `VITE_STRIPE_PUBLISHABLE_KEY`. Nessuna chiave server viene letta dal bundle frontend.
- `.env` è ignorato e non tracciato; `.env.example` documenta solo le tre chiavi VITE sopra.
- Ricerca file tracciati e cronologia `git log -p -S"sk_"`: trovati solo esempi `sk_test_...` segnaposto in `STRIPE_SETUP.md`; nessun valore effettivo riconosciuto. La scansione non sostituisce la rotazione di una chiave eventualmente esposta altrove.
- Secret Supabase trovati per nome: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM`; mancanti: nessuno. La presenza non dimostra che i valori siano validi, in modalità Live, né che il mittente/domain sia verificato.
- `supabase/config.toml`: verify_jwt coerente per le tre funzioni.
- `vercel.json`: rewrite SPA presente. `public/favicon.png` esiste; sitemap e robots assenti.

## Database: inventario SQL e stato live

`supabase migration list` ha restituito `migrations: []`; non esiste `supabase/migrations/`. Questo non prova che nessuno abbia eseguito SQL Editor: lo stato seguente descrive gli **effetti osservati ora nel DB live**, non una cronologia di esecuzione.

| File SQL | Stato verificabile |
|---|---|
| `schema.sql` | Effetti presenti: tabelle base e RLS. |
| `schema_add_shipping_address.sql` | Effetto presente: `orders.shipping_address`. |
| `schema_add_shipping_address_TEST.sql` | Script di verifica; esecuzione non tracciata. |
| `schema_admin.sql` | Effetti presenti: `profiles.is_admin`, policy admin e policy/bucket immagini. |
| `schema_admin_dashboard.sql` | Effetti presenti: `admin_dashboard_stats`, `admin_top_products`, `admin_customers`; grant execute ad authenticated. |
| `schema_admin_orders.sql` | **Effetti principali assenti**: colonna `tracking_number` e policy admin per orders/order_items/profiles non trovate. |
| `schema_admin_users.sql` | Effetti presenti: `promoted_by`, `promoted_at`. |
| `schema_admin_users_TEST.sql` | Script di verifica; esecuzione non tracciata. |
| `schema_categories.sql` | Effetti presenti: tabella, categoria e policy. |
| `schema_categories_name_en.sql` | Effetto presente: `categories.name_en`. |
| `schema_categories_name_en_TEST.sql` | Script di verifica; esecuzione non tracciata. |
| `schema_oauth.sql` | Effetto presente: funzione e trigger `on_auth_user_created` su `auth.users`. |
| `schema_orders_discount.sql` | Effetti presenti: `discount_percentage`, `discount_amount`. |
| `schema_order_items_snapshot.sql` | Effetti presenti: snapshot nome, trigger e FK `ON DELETE SET NULL`. |
| `schema_products_active.sql` | Effetto presente: `products.active`. |
| `schema_products_photo_match.sql` | Effetto presente: `products.photo_match_type`. |
| `schema_products_sku.sql` | Effetti presenti: SKU/counter, snapshot SKU e trigger. |
| `schema_product_details.sql` | Effetti presenti: misure e note prodotto. |
| `schema_product_images.sql` | Effetti presenti: `product_images` e policy RLS. |
| `schema_reviews.sql` | Effetti presenti: `reviews` e policy RLS. |
| `schema_security_fix_A.sql` | Effetti presenti: trigger protezione `is_admin` e rimozione insert client su ordini. |
| `schema_security_fix_TEST.sql` | Script di verifica; esecuzione non tracciata. |
| `schema_stripe_orders.sql` | Effetti presenti: RPC stock e vincolo univoco `orders_stripe_session_id_key`; RPC eseguibile anche da anon, vedere blocco di sicurezza. |

Le tabelle pubbliche elencate sopra hanno tutte RLS attiva. Policy `USING (true)` osservate sono di lettura pubblica; nessuna policy mutativa incondizionata è stata trovata. Supabase concede privilegi SQL a ruoli API anche quando RLS li filtra: i grant SQL non sostituiscono le policy. L'eccezione rilevante è `decrement_product_stock`, RPC `SECURITY DEFINER` invocabile da `anon`.

La policy amministrativa su `profiles` descritta da `schema_admin_orders.sql` usa una subquery sulla stessa tabella protetta: è un pattern di ricorsione RLS da correggere o verificare prima dell'applicazione. Non è attiva nel DB osservato, perché la policy non compare nella lista live.

## Edge Functions e flusso di pagamento

- `create-checkout-session/index.ts`: verifica JWT con `getUser`, valida array/quantità, rilegge prezzo e stock dal DB e applica il bundle lato server. Crea Checkout con solo card e indirizzo di spedizione IT.
- `stripe-webhook/index.ts`: verifica `stripe-signature` con `constructEventAsync` sul body grezzo; usa `session.collected_information.shipping_details`; gestisce eventi non pertinenti, log/errori e idempotenza tramite `stripe_session_id`.
- `orderEmail.ts`: invia email con Resend; errore/assenza API key non annulla l'ordine. Secret configurati per nome; DNS del mittente non verificato.
- `manage-admin/index.ts`: verifica JWT, rilegge `profiles.is_admin` con Service Role prima di ogni azione; protegge l'ultimo admin. Funzione ACTIVE.
- **Difetto webhook:** l'errore nell'inserimento `order_items` viene solo loggato (intorno alle righe 334–339) e non propagato, quindi il webhook può rispondere 200 e marcare come già processata una sessione con ordine incompleto.

## Funzionalità lette nel codice

| Funzionalità | Stato | Evidenza / nota |
|---|---|---|
| Catalogo e categorie | Da fare | `src/pages/Shop.jsx:51–83, 119–190`: filtri, ordinamento, query active. Prodotto di test attivo live. |
| Scheda prodotto | OK | `src/pages/ProductDetail.jsx`: query prodotto, varianti stock, misure/note e chiamata carrello. |
| Galleria | OK | `src/pages/ProductDetail.jsx:146–177, 280–327`: galleria con fallback a `image_url`, miniature e selezione foto. |
| Carrello | OK | `src/context/CartContext.jsx:38–117, 120–163`: reducer, stock, persistenza localStorage; separato dalla sessione auth. |
| Bundle 10% / 15% | OK | `src/context/CartContext.jsx:179–202`; ricalcolo server in `create-checkout-session/index.ts`. Conta prodotti distinti, non quantità. |
| Checkout | Da fare | `src/pages/Checkout.jsx:48–80` chiama function e non manda prezzi; flusso payment attivo. Persistenza `order_items` ha l'errore non propagato segnalato. |
| Profilo e ordini utente | OK | `src/pages/Account.jsx:34–89, 130–186`; RLS sulle righe proprie, fallback a snapshot prodotto. |
| Login email | OK | `src/context/AuthContext.jsx:182–185`; chiamata email/password. |
| Login Google | Da fare | OAuth code in `src/context/AuthContext.jsx:235–249`; configurazione/publish Google Cloud e callback non verificabili dal repository. |
| Reset password | OK | `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`, `AuthContext.jsx:269–289`. |
| Sessione 1 ora / carrello conservato | OK | `src/context/AuthContext.jsx:18, 33–71`; login timestamp non viene azzerato al refresh, carrello usa chiave localStorage distinta. |
| Admin: Panoramica | Da fare | `src/pages/AdminOverview.jsx:53–97`; RPC presenti, ma RLS orders priva delle policy admin rende statistiche/lista recenti incomplete. |
| Admin: Prodotti | OK | `src/pages/Admin.jsx:105, 248, 575–576, 676–732`; CRUD protetto da policy DB, media/upload. |
| Admin: Ordini | Rotto | `src/pages/AdminOrders.jsx:110–116` e `AdminOrderDetail.jsx:88–105, 242–262`; policy live mancanti e `tracking_number` inesistente. |
| Admin: Clienti | Da fare | `src/pages/AdminCustomers.jsx:64, 118`; RPC presente ma invoker/RLS non consente l'elenco completo senza policy admin. |
| Admin: Recensioni | OK | `src/pages/AdminReviews.jsx:71, 110, 130, 169`; policy admin live presente. |
| Admin: Categorie | OK | `src/pages/AdminCategories.jsx:54, 155–196`; policy admin live presente. |
| Admin: Amministratori | OK | `src/pages/AdminUsers.jsx` + `supabase/functions/manage-admin/index.ts`; function attiva e controllo server-side. |
| Stampa etichetta | OK | `src/pages/Admin.jsx:643, 770, 1181`; `src/lib/printLabel.js` apre finestra e applica escaping HTML. |
| Menu “⋯” prodotti | OK | `src/pages/Admin.jsx:1191` (`aria-label` localizzata) e menu contestuale. |

## Contenuti e UI

- Pagine legali: IT `src/locales/it.json:575, 582, 616, 628, 636, 650, 658`; EN `src/locales/en.json:575, 582, 616, 628, 636, 650, 658`. Segnaposto: data ultimo aggiornamento; nome venditore; indirizzo completo; P.IVA/codice fiscale; email privacy/contatto; città/foro; tempi di spedizione; spese di reso; email recesso. `src/pages/DirittoRecesso.jsx:19–30` dichiara il modulo PDF non disponibile e il link punta a `#`.
- Catalogo Supabase live: una riga attiva `PRODOTTO TEST - non acquistare`, slug `prodotto-test-email`, usa immagine Unsplash. Gli altri cinque prodotti interrogati usano immagini dal bucket Supabase.
- `src/pages/Home.jsx:32` mantiene inoltre un URL Unsplash quale fallback in caso di errore/catalogo vuoto.
- `about` IT/EN usa testo in prima persona plurale e non contiene nomi personali né prima persona singolare; verificata anche la chiave `about` in entrambe le lingue. Nessuna stringa di brand “Olive Wood Shop” trovata.
- Card: `src/components/ProductCard.css:35–50` usa `aspect-ratio: 4 / 5`, immagine cover; `ProductCard.jsx:85–92` fornisce alt, dimensioni esplicite e lazy loading. Home/Shop hanno `align-items: stretch`. Immagine hero Home non usa le stesse dimensioni esplicite delle card.
- Immagini >300 KB nel repo: `src/assets/logo.png` (~574 KB); in `/public`: `favicon.png` (~152 KB).
- Meta: `index.html:13–34`; title/description/social card presenti ma description ridotta al solo brand. Percorsi immagine social relativi e non assoluti; sitemap/robots non presenti.
- Accessibilità: immagini review e anteprime admin con `alt=""` sono decorative o richiedono conferma contestuale; le tab miniature galleria hanno immagine vuota e non dichiarano un nome per singola foto. Per il resto i controlli principali osservati hanno testo o `aria-label`.

## Bloccanti per il lancio

1. Revocare EXECUTE su `decrement_product_stock` a `PUBLIC/anon/authenticated` e consentirlo solo al server; validare inoltre `p_quantity > 0`. Verificare con introspezione che `anon_execute=false`.
2. Correggere il trattamento errori del webhook: un errore nel salvataggio righe d'ordine deve fallire la consegna o essere recuperabile in modo atomico/idempotente, non essere confermato con 200.
3. Preparare le policy/colonna mancanti di `schema_admin_orders.sql` per Admin ordini/clienti/dashboard; correggere prima la policy profiles autoreferenziale. Non è stata applicata durante questo audit.
4. Rimuovere/disattivare il prodotto test attivo e sostituire la foto Unsplash; verificare il fallback Home.
5. Completare i campi legali reali e fornire il PDF di recesso.

## Da fare a mano

- Verificare DNS e dominio mittente Resend e ricezione email reale.
- Verificare app OAuth Google pubblicata/configurata in Google Cloud, redirect URI e callback Supabase.
- Verificare chiavi/endpoint Stripe Live, webhook Live e un acquisto end-to-end controllato; la sola presenza dei secret non attesta che siano chiavi Live valide.
- Test fisico su smartphone (layout, checkout e moduli), accessibilità/tastiera e comportamento browser.
- Inserire e validare ragione sociale/nome venditore, indirizzo, P.IVA/codice fiscale, email di contatto, foro competente, tempi di spedizione e condizioni di reso con il responsabile legale/fiscale.
