-- ============================================================================
-- schema_admin_orders.sql
--
-- Migrazione AGGIUNTIVA per la sezione "Ordini" del pannello admin
-- (/admin/ordini). Va incollata ed eseguita manualmente nel SQL Editor di
-- Supabase (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già
-- eseguito schema.sql, schema_admin.sql e schema_security_fix_A.sql.
--
-- Contiene:
--   1. La colonna "tracking_number" su "orders"
--   2. Le policy RLS admin mancanti su orders/order_items/profiles, che
--      servono a far funzionare AdminOrders.jsx con query dirette dal
--      client (stesso pattern di AdminCategories.jsx, non una Edge
--      Function: non è un dato critico come "is_admin").
--
-- VERIFICA PRIMA DI ESEGUIRE IL RESTO DEL FILE
-- ----------------------------------------------------------------------------
-- Ho controllato ogni schema_*.sql già presente in questo repository (la
-- cronologia completa delle migrazioni, pensate per essere applicate in
-- ordine): schema.sql crea solo policy "un utente legge/scrive le PROPRIE
-- righe" su orders/order_items/profiles, e schema_security_fix_A.sql
-- rimuove anche le policy INSERT lato utente su orders/order_items. Nessun
-- file introduce mai una policy che permetta a un admin di leggere o
-- scrivere ordini, righe d'ordine o profili di ALTRI utenti — esattamente
-- lo stesso problema già incontrato con "products" prima di
-- schema_admin.sql.
--
-- Questo è però un controllo sui FILE, non sul database live: se una
-- policy fosse stata aggiunta a mano dalla dashboard di Supabase (senza un
-- file corrispondente qui), non potrei vederla. Prima di eseguire il resto
-- del file, esegui questa query da sola e controlla il risultato:
--
--   select tablename, policyname, cmd, roles, qual
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('orders', 'order_items', 'profiles')
--   order by tablename, cmd;
--
-- Se per una di queste tabelle compare già una policy che permette a un
-- admin di leggere/scrivere righe di ALTRI utenti (non "auth.uid() = ..."),
-- salta la sezione corrispondente qui sotto invece di crearne una
-- duplicata: due policy permissive sulla stessa azione si sommano in OR
-- senza dare errore, ma è complessità inutile da mantenere.
-- ============================================================================


-- ============================================================================
-- 1. COLONNA tracking_number SU orders
-- Numero di tracciamento della spedizione, inserito manualmente dall'admin
-- dal pannello /admin/ordini. Null finché l'ordine non è stato spedito.
-- ============================================================================
alter table public.orders
  add column if not exists tracking_number text;


-- ============================================================================
-- 2. POLICY ADMIN SU orders (SELECT + UPDATE)
-- Stesso controllo is_admin già usato per products/categories/reviews (vedi
-- schema_admin.sql/schema_reviews.sql). SELECT: l'admin vede TUTTI gli
-- ordini, non solo i propri (che di norma non ha). UPDATE: serve a
-- cambiare "status" e "tracking_number" dal pannello.
--
-- NESSUNA policy INSERT/DELETE per gli admin qui: gli ordini si creano solo
-- dal webhook Stripe (Service Role Key, che bypassa comunque la RLS) e non
-- c'è un caso d'uso per eliminarli dal pannello — coerente con la scelta
-- già fatta in schema_security_fix_A.sql di non permettere inserimenti "a
-- mano" di ordini lato client.
-- ============================================================================
create policy "Gli admin possono leggere tutti gli ordini"
  on public.orders
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

create policy "Gli admin possono aggiornare tutti gli ordini"
  on public.orders
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


-- ============================================================================
-- 3. POLICY ADMIN SU order_items (solo SELECT)
-- Serve al dettaglio ordine nel pannello (prodotti acquistati, quantità,
-- prezzo pagato). Nessun UPDATE/INSERT/DELETE per gli admin: le righe di
-- order_items sono lo storico di cosa fu acquistato e a quale prezzo, e non
-- vanno mai modificate da qui.
-- ============================================================================
create policy "Gli admin possono leggere tutte le righe ordine"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );


-- ============================================================================
-- 4. POLICY ADMIN SU profiles (solo SELECT)
-- Serve a mostrare l'email del cliente accanto a ogni ordine. Solo SELECT:
-- nessuna policy di scrittura viene toccata qui, "is_admin" resta protetto
-- esattamente come prima (trigger + REVOKE UPDATE, vedi
-- schema_security_fix_A.sql) — questa policy riguarda solo la LETTURA
-- dell'intera riga, non introduce nessun nuovo modo di scrivere is_admin o
-- altri campi.
--
-- NOTA sulla ricorsione: la subquery qui sotto interroga di nuovo
-- "profiles", la STESSA tabella su cui si applica questa policy (a
-- differenza delle policy sopra, dove la subquery è su una tabella
-- diversa da quella protetta). Non è un problema: per la propria riga,
-- ogni utente resta comunque leggibile tramite la policy già esistente
-- "Un utente può leggere solo il proprio profilo" (auth.uid() = id, vedi
-- schema.sql) — le policy per la stessa azione si combinano in OR, quindi
-- la subquery "admin_check" trova la riga dell'utente corrente grazie a
-- QUELLA policy, senza dipendere da questa per risolversi.
-- ============================================================================
create policy "Gli admin possono leggere tutti i profili"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles as admin_check
      where admin_check.id = auth.uid() and admin_check.is_admin = true
    )
  );
