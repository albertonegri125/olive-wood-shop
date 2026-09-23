-- ============================================================================
-- schema_order_items_snapshot.sql
--
-- Migrazione AGGIUNTIVA per permettere l'eliminazione DEFINITIVA di un
-- prodotto anche quando ha ordini collegati. Va incollata ed eseguita
-- manualmente nel SQL Editor di Supabase (Dashboard -> SQL Editor -> New
-- query -> Run), DOPO aver già eseguito schema.sql.
--
-- CONTESTO: finora "products.id" era referenziato da "order_items.product_id"
-- con la modalità di default di Postgres ("on delete no action"), che blocca
-- la DELETE con un errore di foreign key (23503) se esistono ordini
-- collegati — comportamento gestito lato applicazione facendo disattivare
-- il prodotto invece di eliminarlo (vedi schema_products_active.sql). Ora
-- vogliamo invece permettere la cancellazione VERA E PROPRIA anche in
-- questo caso, senza perdere la leggibilità dello storico ordini.
--
-- Contiene:
--   1. La colonna "product_name_snapshot" su "order_items" (il prezzo era
--      già salvato a sé in "price_at_purchase" fin da schema.sql: manca
--      solo il nome, oggi letto SOLO tramite join live su "products").
--   2. Un backfill una tantum: valorizza "product_name_snapshot" per le
--      righe d'ordine già esistenti, collegate a prodotti che esistono
--      ancora oggi (chi è già stato eliminato in passato non può ovviamente
--      aver bloccato nulla, dato che finora la DELETE falliva sempre in
--      quel caso).
--   3. La modifica della foreign key "order_items.product_id" da
--      "on delete no action" a "on delete set null" (richiede rendere la
--      colonna nullable): è quello che permette davvero alla DELETE di
--      andare a buon fine invece di fallire con 23503.
--   4. Un trigger "before delete on products" che salva SEMPRE il nome nello
--      snapshot un istante prima che la riga sparisca, qualunque sia il
--      punto del codice (o della dashboard di Supabase) da cui parte la
--      DELETE — più robusto di un salvataggio fatto "a mano" lato client
--      subito prima della chiamata delete(), che si affiderebbe a NON
--      dimenticare mai quel passaggio in ogni punto che elimina un
--      prodotto.
-- ============================================================================


-- ============================================================================
-- 1. COLONNA product_name_snapshot SU order_items
-- Null per le righe collegate a un prodotto ancora esistente (in quel caso
-- il nome si legge dal join live su "products", sempre aggiornato): si
-- valorizza solo quando il prodotto viene eliminato, per non duplicare un
-- dato che altrimenti sarebbe semplicemente vecchio/disallineato rispetto
-- a un'eventuale rinomina del prodotto ancora esistente.
-- ============================================================================
alter table public.order_items
  add column if not exists product_name_snapshot text;

comment on column public.order_items.product_name_snapshot is
  'Nome del prodotto al momento della sua eliminazione definitiva (valorizzato dal trigger snapshot_product_name_before_delete_trigger). Null finché il prodotto collegato esiste ancora: in quel caso il nome va letto dal join su products, sempre aggiornato.';


-- ============================================================================
-- 2. BACKFILL una tantum delle righe già esistenti
-- Copre anche gli ordini storici creati prima di questa migrazione, non
-- solo quelli che verranno toccati da una futura eliminazione.
-- ============================================================================
update public.order_items
set product_name_snapshot = products.name
from public.products
where order_items.product_id = products.id
  and order_items.product_name_snapshot is null;


-- ============================================================================
-- 3. FOREIGN KEY order_items.product_id: da "no action" a "on delete set null"
-- Il nome esatto del vincolo ("order_items_product_id_fkey") è quello
-- generato automaticamente da Postgres per la definizione inline in
-- schema.sql ("product_id uuid not null references public.products (id)");
-- è anche il nome comparso nel messaggio d'errore 23503 che questa
-- migrazione risolve.
-- "drop not null" è necessario PRIMA di cambiare la foreign key: altrimenti,
-- alla prima eliminazione di un prodotto con ordini collegati, il set null
-- fatto dal vincolo violerebbe subito il not null esistente.
-- ============================================================================
alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products (id) on delete set null;


-- ============================================================================
-- 4. TRIGGER: salva il nome del prodotto in ogni order_items collegato,
-- un istante prima che la riga del prodotto venga eliminata.
--
-- "security definer" + search_path fissato: gira con privilegi elevati
-- (bypassa la RLS su order_items, che infatti non ha e non necessita di
-- nessuna nuova policy di UPDATE per gli admin: l'unico scrittore di
-- questo campo è questo trigger, mai una query diretta del client) — stesso
-- pattern già usato per decrement_product_stock (schema_stripe_orders.sql)
-- e protect_profiles_is_admin (schema_security_fix_A.sql).
-- "and product_name_snapshot is null" evita di sovrascrivere uno snapshot
-- già presente (caso normale: non dovrebbe mai accadere che un prodotto
-- venga eliminato due volte, ma resta comunque idempotente).
-- ============================================================================
create or replace function public.snapshot_product_name_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.order_items
  set product_name_snapshot = old.name
  where product_id = old.id
    and product_name_snapshot is null;

  return old;
end;
$$;

drop trigger if exists snapshot_product_name_before_delete_trigger on public.products;

create trigger snapshot_product_name_before_delete_trigger
  before delete on public.products
  for each row execute function public.snapshot_product_name_before_delete();
