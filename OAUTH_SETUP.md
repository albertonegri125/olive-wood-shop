# Configurazione login con Google e Apple

Il codice (`AuthContext.jsx`, `SocialAuthButtons.jsx`) è già pronto, ma
Google e Apple richiedono entrambi una configurazione manuale nelle
rispettive console sviluppatori, oltre che nel progetto Supabase. Senza
questi passaggi, cliccare "Continua con Google/Apple" mostra un errore.

Esegui prima **schema_oauth.sql** (SQL Editor di Supabase): crea il
trigger che genera automaticamente la riga in `profiles` per ogni nuovo
utente, qualsiasi sia il metodo di accesso.

## Google

1. Vai su [Google Cloud Console](https://console.cloud.google.com/) →
   crea un progetto (o usane uno esistente).
2. **APIs & Services → OAuth consent screen**: configuralo (tipo
   "External" va bene per iniziare), con nome app, email di supporto, logo
   opzionale.
3. **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**, tipo "Web application".
4. In **Authorized redirect URIs** incolla l'URL di callback che trovi in
   Supabase (vedi punto 6 sotto) — ha questa forma:
   `https://<il-tuo-project-ref>.supabase.co/auth/v1/callback`
5. Salva: ottieni **Client ID** e **Client Secret**.
6. Nella dashboard Supabase: **Authentication → Providers → Google**,
   attivalo e incolla Client ID/Secret. La pagina mostra proprio l'URL di
   callback da usare al punto 4.
7. In **Authentication → URL Configuration**, aggiungi tra le "Redirect
   URLs" consentite l'indirizzo del tuo sito seguito da `/account`, per
   ogni ambiente che usi, es.:
   - `http://localhost:5173/account` (sviluppo)
   - `https://tuodominio.it/account` (produzione)

## Apple ("Sign in with Apple")

Più articolato di Google: richiede un account **Apple Developer Program**
a pagamento (99$/anno).

1. Vai su [Apple Developer → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Crea un **App ID** (se non esiste già) con la capability "Sign in with
   Apple" attivata.
3. Crea un **Services ID** dedicato (es. `it.tuodominio.oliveewoodcreations.web`):
   sarà il "Client ID" usato da Supabase. Configuralo con:
   - **Domains**: il dominio del tuo sito (es. `tuodominio.it`)
   - **Return URLs**: `https://<il-tuo-project-ref>.supabase.co/auth/v1/callback`
4. Crea una **Key** con "Sign in with Apple" abilitata, associata al tuo
   Team ID e al Services ID sopra: scaricala (file `.p8`, un'unica volta).
5. Nella dashboard Supabase: **Authentication → Providers → Apple**,
   attivalo e inserisci: Services ID (Client ID), Team ID, Key ID, e il
   contenuto del file `.p8` scaricato.
6. Stessa aggiunta di "Redirect URLs" del punto 7 di Google qui sopra
   (`/account` per ogni ambiente).

## Verifica

Dopo aver configurato entrambi (o anche uno solo — il bottone dell'altro
mostrerà semplicemente un errore finché non lo configuri), prova dal sito:
`/login` → "Continua con Google"/"Continua con Apple" → dovresti tornare
autenticato su `/account`, con la riga di profilo già creata (verificabile
in Supabase, tabella `profiles`).
