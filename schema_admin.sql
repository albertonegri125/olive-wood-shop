-- ============================================================================
-- schema_admin.sql
--
-- Migrazione AGGIUNTIVA per il pannello admin (/admin). Va incollata ed
-- eseguita manualmente nel SQL Editor di Supabase (Dashboard -> SQL Editor
-- -> New query -> Run), DOPO aver già eseguito schema.sql.
--
-- Contiene:
--   1. La colonna "is_admin" sulla tabella profiles
--   2. Le policy RLS che permettono agli admin (e solo a loro) di
--      creare/modificare/eliminare prodotti
--   3. Il bucket di Storage "product-images" (pubblico in lettura) e le
--      policy che permettono agli admin di caricare/sostituire/eliminare
--      le immagini al suo interno
-- ============================================================================


-- ============================================================================
-- 1. COLONNA is_admin SU profiles
-- Booleano che marca un utente come amministratore del negozio. Di default
-- è "false": va impostato manualmente a "true" per l'utente che deve avere
-- accesso al pannello, con una query come:
--   update public.profiles set is_admin = true where email = 'tuo@email.it';
-- ============================================================================
alter table public.profiles
  add column if not exists is_admin boolean not null default false;


-- ============================================================================
-- 2. POLICY ADMIN SULLA TABELLA products
-- Finora la tabella aveva solo una policy di SELECT pubblica (chiunque può
-- leggere il catalogo): per creare/modificare/eliminare prodotti dal
-- pannello admin servono anche le policy di INSERT/UPDATE/DELETE, ristrette
-- a chi ha is_admin = true nel proprio profilo.
--
-- "exists (select 1 from public.profiles where profiles.id = auth.uid() ...)"
-- è il pattern standard di Supabase per verificare un ruolo: controlla se
-- l'utente attualmente autenticato (auth.uid()) ha una riga in "profiles"
-- con is_admin = true.
-- ============================================================================
create policy "Gli admin possono creare prodotti"
  on public.products
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

create policy "Gli admin possono modificare prodotti"
  on public.products
  for update
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

create policy "Gli admin possono eliminare prodotti"
  on public.products
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );


-- ============================================================================
-- 3. BUCKET DI STORAGE "product-images"
-- Creato direttamente via SQL inserendo la riga nella tabella di sistema
-- storage.buckets (equivalente a crearlo dalla UI: Dashboard -> Storage ->
-- New bucket -> nome "product-images" -> spunta "Public bucket").
-- "public = true" fa sì che i file siano leggibili da chiunque tramite il
-- loro URL pubblico, senza bisogno di autenticazione (necessario per
-- mostrare le immagini prodotto sul sito a tutti i visitatori).
--
-- Se preferisci crearlo dalla UI invece che con questo comando, salta
-- questo INSERT e crea il bucket manualmente con lo stesso nome esatto
-- "product-images" e "Public bucket" attivo, poi esegui comunque le policy
-- qui sotto.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Lettura pubblica degli oggetti nel bucket (in aggiunta al flag "public"
-- del bucket, che già permette la lettura tramite URL pubblico: questa
-- policy copre anche eventuali richieste autenticate alla stessa tabella).
create policy "Le immagini prodotto sono leggibili pubblicamente"
  on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Solo gli admin possono caricare nuove immagini nel bucket.
create policy "Gli admin possono caricare immagini prodotto"
  on storage.objects
  for insert
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Solo gli admin possono sovrascrivere un'immagine esistente (es. upload
-- con lo stesso nome file, "upsert").
create policy "Gli admin possono sostituire immagini prodotto"
  on storage.objects
  for update
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  )
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Solo gli admin possono eliminare immagini dal bucket (usato quando si
-- elimina un prodotto o se ne sostituisce la foto).
create policy "Gli admin possono eliminare immagini prodotto"
  on storage.objects
  for delete
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );
