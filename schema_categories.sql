-- ============================================================================
-- schema_categories.sql
--
-- Migrazione AGGIUNTIVA per le categorie prodotto. Va incollata ed
-- eseguita manualmente nel SQL Editor di Supabase (Dashboard -> SQL Editor
-- -> New query -> Run), DOPO aver già eseguito schema.sql (e schema_admin.sql,
-- se già eseguito: la policy admin qui sotto richiede la colonna "is_admin"
-- su profiles).
--
-- Contiene:
--   1. La tabella "categories"
--   2. La colonna "category_id" (nullable) su "products"
--   3. Le policy RLS: lettura pubblica, scrittura riservata agli admin
--   4. Le 5 categorie iniziali
--
-- IMPORTANTE per la retrocompatibilità: "category_id" è NULLABLE e senza
-- valore di default. I prodotti già esistenti restano quindi con
-- categoria non impostata (NULL) finché non li si modifica dal pannello
-- admin: il sito continua a mostrarli normalmente (Shop, ProductDetail,
-- Home semplicemente non mostrano tag/badge di categoria per loro).
-- Il form del pannello admin richiede invece SEMPRE una categoria per
-- salvare un prodotto NUOVO o MODIFICATO, così da non crearne altri senza.
-- ============================================================================


-- ============================================================================
-- TABELLA: categories
-- Elenco fisso (o quasi) delle categorie merceologiche del negozio. Il nome
-- salvato qui è quello italiano "di riferimento" (usato come fallback se
-- manca una traduzione): la traduzione vera e propria per IT/EN avviene
-- lato frontend tramite i18n, usando "slug" come chiave stabile — stesso
-- approccio già usato per tutti gli altri testi dell'interfaccia, invece
-- di duplicare le colonne per lingua.
-- ============================================================================
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(), -- identificativo univoco della categoria
  name       text not null,                               -- nome "di riferimento" (italiano), usato come fallback
  slug       text not null unique,                         -- chiave stabile usata sia nei filtri (?category=...) sia per la traduzione i18n
  created_at timestamptz not null default now()            -- data/ora di creazione (determina anche l'ordine di visualizzazione)
);

alter table public.categories enable row level security;

-- Lettura pubblica: i filtri categoria in Shop devono funzionare per
-- chiunque visiti il sito, anche senza login.
create policy "Le categorie sono leggibili pubblicamente"
  on public.categories
  for select
  using (true);

-- Solo gli admin (stesso controllo is_admin già usato altrove) possono
-- creare/modificare/eliminare categorie.
create policy "Gli admin possono gestire le categorie"
  on public.categories
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );


-- ============================================================================
-- COLONNA category_id SU products
-- "on delete set null": se in futuro una categoria venisse eliminata, i
-- prodotti collegati NON vengono cancellati, restano semplicemente senza
-- categoria (invece di sparire o bloccare l'eliminazione della categoria).
-- ============================================================================
alter table public.products
  add column if not exists category_id uuid references public.categories (id) on delete set null;


-- ============================================================================
-- CATEGORIE INIZIALI
-- Cinque INSERT separati (invece di un unico INSERT multi-riga): così ogni
-- riga riceve un "created_at" leggermente diverso, nell'ordine in cui sono
-- scritte qui sotto — è l'ordine con cui compariranno le schede categoria
-- in Shop, dato che il frontend le ordina per data di creazione.
-- "on conflict (slug) do nothing" rende lo script ripetibile: eseguirlo
-- una seconda volta non crea categorie duplicate.
-- ============================================================================
insert into public.categories (name, slug) values ('Cucina', 'kitchen')
  on conflict (slug) do nothing;
insert into public.categories (name, slug) values ('Casa', 'home')
  on conflict (slug) do nothing;
insert into public.categories (name, slug) values ('Accessori', 'accessories')
  on conflict (slug) do nothing;
insert into public.categories (name, slug) values ('Benessere', 'wellness')
  on conflict (slug) do nothing;
insert into public.categories (name, slug) values ('Altro', 'other')
  on conflict (slug) do nothing;
