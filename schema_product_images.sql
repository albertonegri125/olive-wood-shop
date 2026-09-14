-- ============================================================================
-- schema_product_images.sql
--
-- Migrazione AGGIUNTIVA per la galleria multi-foto dei prodotti. Va
-- incollata ed eseguita manualmente nel SQL Editor di Supabase (Dashboard
-- -> SQL Editor -> New query -> Run), DOPO aver già eseguito schema.sql
-- (e schema_admin.sql, se già eseguito: la policy admin qui sotto richiede
-- la colonna "is_admin" su profiles).
--
-- Contiene:
--   1. La tabella "product_images" (foto aggiuntive di un prodotto)
--   2. Le policy RLS: lettura pubblica, scrittura riservata agli admin
--
-- IMPORTANTE: "products.image_url" NON viene toccato da questa migrazione
-- e resta il campo con la foto principale/di fallback, usato da tutto il
-- codice esistente che mostra un solo prodotto con una sola immagine
-- (es. ProductCard.jsx, le miniature della lista in Admin.jsx). Un
-- prodotto con solo "image_url" compilato e NESSUNA riga in
-- "product_images" continua a funzionare esattamente come prima: la
-- galleria (ProductDetail.jsx) in quel caso mostra semplicemente quella
-- singola immagine, senza striscia di miniature.
-- ============================================================================


-- ============================================================================
-- TABELLA: product_images
-- Foto aggiuntive di un prodotto, in ordine di visualizzazione. Quando un
-- prodotto ne ha almeno una, l'admin mantiene sincronizzato anche
-- "products.image_url" con la prima foto (display_order più basso), così
-- il codice che legge solo quel campo (es. ProductCard) mostra sempre la
-- foto principale corretta.
-- ============================================================================
create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(), -- identificativo univoco della foto
  product_id    uuid not null references public.products (id) on delete cascade, -- prodotto a cui appartiene
  image_url     text not null,                               -- URL pubblico su Supabase Storage
  display_order integer not null default 0,                  -- ordine di visualizzazione (0 = prima foto/principale)
  created_at    timestamptz not null default now()           -- data/ora di caricamento
);

alter table public.product_images enable row level security;

-- Lettura pubblica: la galleria prodotto deve essere visibile a chiunque
-- visiti il sito, anche senza login (stessa policy pubblica già usata per
-- la tabella "products").
create policy "Le foto prodotto sono leggibili pubblicamente"
  on public.product_images
  for select
  using (true);

-- Solo gli admin (stesso controllo is_admin già usato per products e
-- reviews) possono creare/modificare/eliminare foto: la gestione avviene
-- dal pannello /admin.
create policy "Gli admin possono gestire le foto prodotto"
  on public.product_images
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

-- Indice per velocizzare la query più frequente: tutte le foto di un dato
-- prodotto, in ordine (usata in ProductDetail.jsx).
create index if not exists product_images_product_id_order_idx
  on public.product_images (product_id, display_order);
