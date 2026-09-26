-- ============================================================================
-- schema_products_sku.sql
--
-- Migrazione AGGIUNTIVA per il codice identificativo di magazzino (SKU) dei
-- prodotti. Va incollata ed eseguita manualmente nel SQL Editor di Supabase
-- (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già eseguito
-- schema.sql, schema_categories.sql e schema_order_items_snapshot.sql.
--
-- Formato dello SKU: {PREFISSO_CATEGORIA}-{ANNO}-{PROGRESSIVO_4_CIFRE}
--   es. CUC-2026-0001, CUC-2026-0002, ACC-2026-0001
--   - PREFISSO_CATEGORIA: prime 3 lettere MAIUSCOLE del nome (italiano) della
--     categoria (Cucina -> CUC, Accessori -> ACC, Casa -> CAS, Benessere ->
--     BEN, Altro -> ALT). Un prodotto SENZA categoria usa "ALT", come "Altro".
--   - ANNO: anno di creazione del prodotto (per un prodotto nuovo coincide
--     con l'anno corrente).
--   - PROGRESSIVO: riparte da 0001 per ogni combinazione prefisso+anno.
--
-- Contiene:
--   1. La colonna "sku" su products (text, unique, nullable)
--   2. La tabella "product_sku_counters" con l'ultimo progressivo usato per
--      ogni prefisso+anno
--   3. La funzione generate_product_sku() che calcola il prossimo SKU libero
--   4. Il trigger che assegna lo SKU in automatico all'insert (e lo
--      rigenera se l'admin lo svuota a mano)
--   5. Lo snapshot dello SKU su order_items quando un prodotto viene
--      eliminato (stesso meccanismo già usato per il nome)
--   6. Il backfill degli SKU per i prodotti già esistenti
--
-- Solo istruzioni DDL/UPDATE idempotenti: nessun test, nessun blocco
-- begin/rollback — l'intero file può essere incollato ed eseguito in un
-- colpo solo, anche più volte.
-- ============================================================================


-- ============================================================================
-- 1. COLONNA sku SU products
-- Nullable solo per non far fallire l'ALTER sui prodotti già esistenti: il
-- backfill in fondo al file assegna uno SKU a tutti, e da lì in poi il
-- trigger garantisce che nessun prodotto resti senza.
-- Il nome del vincolo è esplicito ("products_sku_key") perché il pannello
-- admin lo usa per distinguere uno SKU duplicato da uno slug duplicato
-- (entrambi danno lo stesso codice d'errore 23505).
-- ============================================================================
alter table public.products
  add column if not exists sku text constraint products_sku_key unique;

comment on column public.products.sku is
  'Codice identificativo di magazzino, formato PREFISSO-ANNO-NNNN (es. CUC-2026-0001). Generato dal trigger set_product_sku_trigger se non specificato; modificabile a mano dal pannello admin.';


-- ============================================================================
-- 2. TABELLA product_sku_counters
-- Un contatore per ogni combinazione prefisso+anno: l'incremento avviene con
-- un singolo "insert ... on conflict do update", atomico anche con due
-- inserimenti in contemporanea (a differenza di un "max(sku) + 1" calcolato
-- leggendo products, che in quel caso genererebbe lo stesso numero due
-- volte).
-- RLS attiva e NESSUNA policy: il client non deve mai leggerla né
-- scriverla. L'unico accesso passa da generate_product_sku(), che è
-- "security definer".
-- ============================================================================
create table if not exists public.product_sku_counters (
  prefix     text not null,
  year       integer not null,
  last_value integer not null default 0,
  primary key (prefix, year)
);

alter table public.product_sku_counters enable row level security;


-- ============================================================================
-- 3. FUNZIONE generate_product_sku(category_id, year)
-- Il ciclo "loop ... exit when" salta un numero già occupato da uno SKU
-- inserito a mano dall'admin (es. se qualcuno ha scritto CUC-2026-0005
-- manualmente, il contatore arrivato a 5 passa direttamente a 6 invece di
-- fallire sul vincolo unique).
-- lpad con greatest(): oltre 9999 prodotti nello stesso anno/categoria il
-- numero si allunga a 5 cifre invece di venire troncato da lpad.
-- ============================================================================
create or replace function public.generate_product_sku(p_category_id uuid, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_name text;
  v_prefix text;
  v_next integer;
  v_sku text;
begin
  select name into v_category_name
  from public.categories
  where id = p_category_id;

  -- Solo lettere (niente spazi/cifre/punteggiatura), prime 3, maiuscole.
  v_prefix := upper(left(regexp_replace(coalesce(v_category_name, ''), '[^[:alpha:]]', '', 'g'), 3));

  if v_prefix = '' then
    v_prefix := 'ALT';
  end if;

  -- Nome categoria più corto di 3 lettere: completiamo con "X".
  v_prefix := rpad(v_prefix, 3, 'X');

  loop
    insert into public.product_sku_counters (prefix, year, last_value)
    values (v_prefix, p_year, 1)
    on conflict (prefix, year)
      do update set last_value = public.product_sku_counters.last_value + 1
    returning last_value into v_next;

    v_sku := v_prefix || '-' || p_year::text || '-' || lpad(v_next::text, greatest(4, length(v_next::text)), '0');

    exit when not exists (select 1 from public.products where sku = v_sku);
  end loop;

  return v_sku;
end;
$$;

-- Non esponiamo la funzione via API (/rest/v1/rpc/generate_product_sku):
-- chiamata direttamente da un client farebbe solo "bruciare" numeri del
-- contatore. Il trigger qui sotto la può comunque usare, perché gira come
-- "security definer" (con i privilegi del proprietario, non del client).
revoke execute on function public.generate_product_sku(uuid, integer) from public, anon, authenticated;


-- ============================================================================
-- 4. TRIGGER set_product_sku_trigger
-- - All'INSERT: se lo SKU non è stato indicato, lo genera.
-- - All'UPDATE della colonna sku: se l'admin lo svuota dal pannello, viene
--   rigenerato automaticamente (invece di lasciare il prodotto senza).
-- In entrambi i casi uno SKU inserito a mano viene normalizzato (spazi
-- esterni rimossi, tutto maiuscolo), così "cuc-2026-0001 " e
-- "CUC-2026-0001" non possono coesistere come due codici diversi.
-- L'anno è quello di created_at: per un prodotto nuovo il default now() è
-- già applicato quando parte un trigger "before insert", quindi coincide
-- con l'anno corrente.
-- ============================================================================
create or replace function public.set_product_sku()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.sku := nullif(upper(btrim(new.sku)), '');

  if new.sku is null then
    new.sku := public.generate_product_sku(
      new.category_id,
      extract(year from coalesce(new.created_at, now()))::integer
    );
  end if;

  return new;
end;
$$;

drop trigger if exists set_product_sku_trigger on public.products;

create trigger set_product_sku_trigger
  before insert or update of sku on public.products
  for each row execute function public.set_product_sku();


-- ============================================================================
-- 5. SNAPSHOT DELLO SKU SU order_items
-- Come per il nome (vedi schema_order_items_snapshot.sql): quando un
-- prodotto viene eliminato, order_items.product_id diventa null e lo SKU
-- non sarebbe più leggibile dal dettaglio ordine in AdminOrders. Lo
-- salviamo quindi nella riga d'ordine un istante prima dell'eliminazione.
-- La funzione del trigger già esistente viene ridefinita per salvare
-- entrambi i campi; "coalesce" non sovrascrive mai uno snapshot già
-- presente.
-- ============================================================================
alter table public.order_items
  add column if not exists product_sku_snapshot text;

comment on column public.order_items.product_sku_snapshot is
  'SKU del prodotto al momento della sua eliminazione definitiva (valorizzato dal trigger snapshot_product_name_before_delete_trigger). Null finché il prodotto collegato esiste ancora: in quel caso lo SKU va letto dal join su products.';

create or replace function public.snapshot_product_name_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.order_items
  set product_name_snapshot = coalesce(product_name_snapshot, old.name),
      product_sku_snapshot = coalesce(product_sku_snapshot, old.sku)
  where product_id = old.id;

  return old;
end;
$$;


-- ============================================================================
-- 6. BACKFILL degli SKU per i prodotti già esistenti
-- Un prodotto alla volta, in ordine di creazione: così i progressivi
-- rispecchiano l'ordine in cui i prodotti sono stati inseriti (il più
-- vecchio di ogni categoria/anno riceve 0001). L'anno è quello di
-- created_at del singolo prodotto.
-- Ripetibile: tocca solo i prodotti ancora senza SKU.
-- ============================================================================
do $$
declare
  r record;
begin
  for r in
    select id, category_id, created_at
    from public.products
    where sku is null
    order by created_at, id
  loop
    update public.products
    set sku = public.generate_product_sku(r.category_id, extract(year from r.created_at)::integer)
    where id = r.id;
  end loop;
end;
$$;
