-- ============================================================================
-- schema.sql
--
-- Schema del database per il progetto "olive-wood-shop".
-- Questo file NON viene eseguito automaticamente: va copiato e incollato
-- manualmente nell'editor SQL di Supabase (Dashboard -> SQL Editor -> New query)
-- e poi eseguito con "Run".
--
-- Contiene:
--   1. Le tabelle: products, profiles, orders, order_items
--   2. L'attivazione della Row Level Security (RLS) su ogni tabella
--   3. Le policy di base che regolano chi può leggere/scrivere cosa
-- ============================================================================

-- L'estensione "pgcrypto" ci serve per generare id univoci di tipo UUID
-- con la funzione gen_random_uuid(). Su Supabase è già disponibile,
-- ma la richiediamo esplicitamente per sicurezza.
create extension if not exists "pgcrypto";


-- ============================================================================
-- TABELLA: products
-- Contiene il catalogo dei prodotti in vendita nel negozio (oggetti in legno
-- d'ulivo). È una tabella pubblica: chiunque visiti il sito deve poterla
-- leggere, anche senza aver fatto login.
-- ============================================================================
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(), -- identificativo univoco del prodotto
  name        text not null,                               -- nome del prodotto (es. "Tagliere in legno d'ulivo")
  description text,                                         -- descrizione estesa del prodotto
  price       numeric(10, 2) not null check (price >= 0),   -- prezzo in euro, con 2 decimali, non negativo
  image_url   text,                                         -- URL dell'immagine del prodotto (es. su Supabase Storage)
  stock       integer not null default 0 check (stock >= 0),-- quantità disponibile in magazzino
  slug        text not null unique,                         -- versione "url-friendly" del nome, usata nei link (es. /prodotto/tagliere-ulivo)
  created_at  timestamptz not null default now()            -- data/ora di creazione del record
);

-- Attiviamo la Row Level Security: da questo momento, senza policy esplicite,
-- NESSUNO potrebbe leggere o scrivere righe di questa tabella (nemmeno gli utenti
-- loggati). Le policy qui sotto definiscono i permessi che vogliamo concedere.
alter table public.products enable row level security;

-- Policy pubblica di sola lettura: chiunque (anche utenti anonimi, non loggati)
-- può fare SELECT sui prodotti. Non concediamo policy di insert/update/delete
-- per il pubblico: la gestione del catalogo va fatta con un ruolo con più
-- privilegi (es. dalla dashboard di Supabase, o da un backend admin futuro).
create policy "I prodotti sono leggibili pubblicamente"
  on public.products
  for select
  using (true);


-- ============================================================================
-- TABELLA: profiles
-- Estende le informazioni dell'utente autenticato (che Supabase gestisce
-- internamente nella tabella "auth.users") con dati aggiuntivi del profilo.
-- L'id di questa tabella corrisponde all'id dell'utente in auth.users.
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade, -- stesso id dell'utente in auth.users
  email      text,                                    -- email dell'utente (comoda da avere anche qui, per query più semplici)
  full_name  text,                                     -- nome e cognome dell'utente
  created_at timestamptz not null default now()        -- data/ora di creazione del profilo
);

alter table public.profiles enable row level security;

-- Un utente può leggere SOLO il proprio profilo (non quello di altri utenti).
-- auth.uid() restituisce l'id dell'utente attualmente autenticato nella richiesta.
create policy "Un utente può leggere solo il proprio profilo"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Un utente può aggiornare SOLO il proprio profilo.
create policy "Un utente può aggiornare solo il proprio profilo"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Un utente può creare SOLO il proprio profilo (id deve coincidere col proprio uid),
-- tipicamente subito dopo la registrazione.
create policy "Un utente può creare solo il proprio profilo"
  on public.profiles
  for insert
  with check (auth.uid() = id);


-- ============================================================================
-- TABELLA: orders
-- Rappresenta un ordine effettuato da un utente (collegato a una sessione
-- di pagamento Stripe).
-- ============================================================================
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(), -- identificativo univoco dell'ordine
  user_id           uuid not null references auth.users (id),   -- utente che ha effettuato l'ordine
  stripe_session_id text,                                        -- id della sessione di checkout Stripe collegata a questo ordine
  status            text not null default 'pending',             -- stato dell'ordine: es. 'pending', 'paid', 'shipped', 'cancelled'
  total             numeric(10, 2) not null check (total >= 0),  -- totale dell'ordine in euro
  created_at        timestamptz not null default now()           -- data/ora di creazione dell'ordine
);

alter table public.orders enable row level security;

-- Un utente può vedere SOLO i propri ordini, non quelli di altri utenti.
create policy "Un utente può leggere solo i propri ordini"
  on public.orders
  for select
  using (auth.uid() = user_id);

-- Un utente può creare ordini solo a proprio nome (user_id deve essere il proprio uid).
create policy "Un utente può creare solo i propri ordini"
  on public.orders
  for insert
  with check (auth.uid() = user_id);


-- ============================================================================
-- TABELLA: order_items
-- Rappresenta le singole righe (prodotti) contenute in un ordine.
-- Ogni riga collega un ordine a un prodotto, con la quantità acquistata
-- e il prezzo al momento dell'acquisto (salvato a parte perché il prezzo
-- del prodotto in "products" potrebbe cambiare in futuro).
-- ============================================================================
create table if not exists public.order_items (
  id                 uuid primary key default gen_random_uuid(),      -- identificativo univoco della riga d'ordine
  order_id           uuid not null references public.orders (id) on delete cascade,   -- ordine a cui appartiene questa riga
  product_id         uuid not null references public.products (id),  -- prodotto acquistato
  quantity           integer not null check (quantity > 0),          -- quantità acquistata di quel prodotto
  price_at_purchase  numeric(10, 2) not null check (price_at_purchase >= 0) -- prezzo unitario del prodotto al momento dell'acquisto
);

alter table public.order_items enable row level security;

-- Un utente può leggere SOLO le righe che appartengono a un proprio ordine.
-- Per verificarlo, la policy controlla che l'ordine collegato (order_id)
-- abbia user_id uguale all'utente attualmente autenticato.
create policy "Un utente può leggere solo le righe dei propri ordini"
  on public.order_items
  for select
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- Un utente può inserire righe SOLO in ordini che gli appartengono
-- (usato tipicamente subito dopo aver creato l'ordine, per aggiungere i prodotti).
create policy "Un utente può inserire righe solo nei propri ordini"
  on public.order_items
  for insert
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );
