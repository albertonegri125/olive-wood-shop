-- ============================================================================
-- schema_reviews.sql
--
-- Migrazione AGGIUNTIVA per le recensioni clienti (riprova sociale). Va
-- incollata ed eseguita manualmente nel SQL Editor di Supabase (Dashboard
-- -> SQL Editor -> New query -> Run), DOPO aver già eseguito schema.sql
-- (e schema_admin.sql, se già eseguito: la policy admin qui sotto richiede
-- la colonna "is_admin" su profiles).
--
-- Contiene:
--   1. La tabella "reviews"
--   2. Le policy RLS: lettura pubblica SOLO delle recensioni approvate,
--      gestione completa riservata agli admin
-- ============================================================================


-- ============================================================================
-- TABELLA: reviews
-- Una recensione cliente collegata a un prodotto. "approved" parte da
-- false: ogni recensione va moderata a mano (impostando approved = true)
-- prima di comparire sul sito, per evitare spam o contenuti inappropriati.
-- ============================================================================
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(), -- identificativo univoco della recensione
  product_id    uuid not null references public.products (id) on delete cascade, -- prodotto recensito
  customer_name text not null,                               -- nome mostrato pubblicamente (es. "Marco")
  rating        smallint not null check (rating >= 1 and rating <= 5), -- punteggio da 1 a 5 stelle
  comment       text,                                         -- testo della recensione (facoltativo)
  photo_url     text,                                         -- foto del cliente/del pezzo ricevuto, su Supabase Storage (facoltativa)
  created_at    timestamptz not null default now(),           -- data/ora di invio
  approved      boolean not null default false                -- true solo dopo moderazione manuale: solo allora è visibile sul sito
);

alter table public.reviews enable row level security;

-- Lettura pubblica SOLO delle recensioni già approvate: chiunque visiti il
-- sito (anche senza login) può leggerle, ma mai quelle in attesa di
-- moderazione.
create policy "Le recensioni approvate sono leggibili pubblicamente"
  on public.reviews
  for select
  using (approved = true);

-- Gli admin (stesso controllo is_admin già usato per i prodotti, vedi
-- schema_admin.sql) possono leggere/creare/modificare/eliminare qualunque
-- recensione, incluse quelle non ancora approvate. Utile fin da subito per
-- inserire a mano le prime recensioni via SQL Editor (impostando
-- direttamente approved = true), e in futuro per un'eventuale coda di
-- moderazione nel pannello /admin.
create policy "Gli admin possono gestire tutte le recensioni"
  on public.reviews
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

-- Indice per velocizzare la query più frequente: tutte le recensioni
-- approvate di un dato prodotto (usata in ProductDetail.jsx).
create index if not exists reviews_product_id_approved_idx
  on public.reviews (product_id, approved);


-- ============================================================================
-- Esempio per inserire una prima recensione di prova via SQL Editor
-- (sostituisci l'uuid con l'id reale di un prodotto esistente):
--
-- insert into public.reviews (product_id, customer_name, rating, comment, approved)
-- values ('INCOLLA-QUI-ID-PRODOTTO', 'Marco', 5, 'Bellissimo, si vede la cura artigianale.', true);
-- ============================================================================
