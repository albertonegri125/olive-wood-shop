-- ============================================================================
-- schema_products_active.sql
--
-- Migrazione AGGIUNTIVA per la "disattivazione" (soft-delete) dei prodotti.
-- Va incollata ed eseguita manualmente nel SQL Editor di Supabase
-- (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già eseguito
-- schema.sql.
--
-- Perché: eliminare un prodotto già collegato a un ordine esistente
-- (order_items.product_id referenzia products.id, senza "on delete
-- cascade") fa fallire la query DELETE con un errore di foreign key
-- (Postgres code 23503) — comportamento corretto del database, che impedisce
-- di perdere lo storico ordini cancellando un prodotto già venduto. La
-- colonna "active" permette di gestire questo caso lato applicazione:
-- invece di eliminare il prodotto, lo si "disattiva" (active = false), così
-- sparisce dal negozio pubblico ma resta collegato ai suoi ordini passati.
-- ============================================================================

alter table public.products
  add column if not exists active boolean not null default true;
