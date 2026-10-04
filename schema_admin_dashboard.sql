-- ============================================================================
-- schema_admin_dashboard.sql
--
-- Migrazione AGGIUNTIVA per le sezioni "Panoramica" (/admin) e "Clienti"
-- (/admin/clienti) del pannello admin. Va incollata ed eseguita manualmente
-- nel SQL Editor di Supabase (Dashboard -> SQL Editor -> New query -> Run),
-- DOPO aver già eseguito schema.sql, schema_admin.sql,
-- schema_admin_orders.sql, schema_products_active.sql e
-- schema_order_items_snapshot.sql, schema_products_sku.sql e schema_reviews.sql.
--
-- Contiene solo funzioni di LETTURA (aggregazioni), nessuna nuova tabella,
-- colonna o policy:
--   1. admin_dashboard_stats()        -> numeri delle card della Panoramica
--   2. admin_top_products(p_limit)    -> prodotti più venduti
--   3. admin_customers(p_search, ...) -> elenco clienti con n. ordini e
--                                        totale speso
--
-- Perché funzioni SQL e non query dal client: le somme/conteggi vanno
-- calcolati su TUTTI gli ordini. Farlo nel browser vorrebbe dire scaricare
-- ogni ordine a ogni apertura della pagina (e PostgREST ne restituisce al
-- massimo 1000 per richiesta, quindi i totali diventerebbero silenziosamente
-- sbagliati oltre quella soglia).
--
-- SICUREZZA: tutte "security invoker" (il default): girano con i permessi
-- di chi le chiama, quindi la Row Level Security resta attiva e un admin
-- vede esattamente quello che vede già in /admin/ordini (policy di
-- schema_admin_orders.sql). In più ognuna controlla esplicitamente
-- is_admin e rifiuta la chiamata da chiunque altro, invece di restituire
-- in silenzio numeri parziali (i soli ordini propri) a un utente normale.
--
-- Solo "create or replace function" e "grant/revoke": nessun test, nessun
-- blocco begin/rollback — l'intero file può essere incollato ed eseguito
-- in un colpo solo, anche più volte.
-- ============================================================================


-- ============================================================================
-- STATI "PAGATI"
-- Il fatturato somma gli ordini in tutti gli stati successivi al
-- pagamento, non solo 'paid': un ordine passato a 'shipped' o
-- 'delivered' è stato comunque incassato, e altrimenti sparirebbe dal
-- fatturato nel momento in cui viene spedito. Restano esclusi solo stati
-- non incassati come 'pending' o 'cancelled'.
-- ============================================================================


-- ============================================================================
-- 1. admin_dashboard_stats()
-- Un'unica riga JSON con tutti i numeri delle card, per non fare 6
-- richieste separate dalla pagina.
-- Il "mese corrente" è calcolato nel fuso orario italiano: un ordine
-- delle 00:30 del 1° del mese (ora italiana) appartiene al mese nuovo,
-- anche se in UTC è ancora l'ultimo giorno del mese precedente.
-- ============================================================================
create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
stable
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  v_result json;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Accesso riservato agli amministratori.' using errcode = '42501';
  end if;

  select json_build_object(
    'total_orders', (select count(*) from public.orders),
    'total_revenue', (
      select coalesce(sum(total), 0) from public.orders
      where status in ('paid', 'paid_stock_issue', 'processing', 'shipped', 'delivered')
    ),
    'month_revenue', (
      select coalesce(sum(total), 0) from public.orders
      where status in ('paid', 'paid_stock_issue', 'processing', 'shipped', 'delivered')
        and created_at >= v_month_start
    ),
    -- Solo i prodotti attivi: quelli disattivati non sono più in vendita
    -- (vedi schema_products_active.sql).
    'products_count', (select count(*) from public.products where active = true),
    'low_stock_count', (select count(*) from public.products where active = true and stock <= 2),
    'stock_issue_orders', (select count(*) from public.orders where status = 'paid_stock_issue'),
    'pending_reviews', (select count(*) from public.reviews where approved = false)
  ) into v_result;

  return v_result;
end;
$$;


-- ============================================================================
-- 2. admin_top_products(p_limit)
-- Somma delle quantità vendute per prodotto, solo su ordini pagati.
-- I prodotti eliminati (order_items.product_id = null, vedi
-- schema_order_items_snapshot.sql) sono raggruppati per nome salvato
-- nello snapshot, così continuano a comparire in classifica invece di
-- confluire tutti in un'unica riga "null".
-- ============================================================================
create or replace function public.admin_top_products(p_limit integer default 5)
returns table (
  product_id uuid,
  name text,
  sku text,
  quantity_sold bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true) then
    raise exception 'Accesso riservato agli amministratori.' using errcode = '42501';
  end if;

  return query
  select
    oi.product_id,
    coalesce(max(p.name), max(oi.product_name_snapshot)) as name,
    coalesce(max(p.sku), max(oi.product_sku_snapshot)) as sku,
    sum(oi.quantity)::bigint as quantity_sold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
  where o.status in ('paid', 'paid_stock_issue', 'processing', 'shipped', 'delivered')
  group by oi.product_id, case when oi.product_id is null then oi.product_name_snapshot end
  -- Ordinamento per posizione (4 = quantity_sold, 2 = name): "name" da
  -- solo sarebbe ambiguo con la colonna omonima restituita dalla funzione.
  order by 4 desc, 2
  limit greatest(p_limit, 1);
end;
$$;


-- ============================================================================
-- 3. admin_customers(p_search, p_limit, p_offset)
-- Un cliente per riga (tabella profiles), con numero di ordini e totale
-- speso, dal più recente al più vecchio. "total_count" è ripetuto su ogni
-- riga (window function) e serve alla paginazione: è il numero TOTALE di
-- clienti che corrispondono alla ricerca, non solo quelli della pagina.
-- Il totale speso conta solo gli ordini pagati; "order_count" invece
-- conta tutti gli ordini del cliente (è quello che l'admin ritrova poi
-- nello storico).
-- ============================================================================
create or replace function public.admin_customers(
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  order_count bigint,
  total_spent numeric,
  last_order_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true) then
    raise exception 'Accesso riservato agli amministratori.' using errcode = '42501';
  end if;

  return query
  select
    pr.id,
    pr.email,
    pr.full_name,
    pr.created_at,
    count(o.id) as order_count,
    coalesce(sum(o.total) filter (
      where o.status in ('paid', 'paid_stock_issue', 'processing', 'shipped', 'delivered')
    ), 0) as total_spent,
    max(o.created_at) as last_order_at,
    count(*) over () as total_count
  from public.profiles pr
  left join public.orders o on o.user_id = pr.id
  where coalesce(btrim(p_search), '') = ''
     or pr.email ilike '%' || btrim(p_search) || '%'
  group by pr.id
  order by pr.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
end;
$$;


-- ============================================================================
-- PERMESSI
-- Richiamabili solo da utenti loggati (il controllo is_admin dentro ogni
-- funzione fa il resto); mai dal ruolo "anon".
-- ============================================================================
revoke execute on function public.admin_dashboard_stats() from public, anon;
revoke execute on function public.admin_top_products(integer) from public, anon;
revoke execute on function public.admin_customers(text, integer, integer) from public, anon;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_top_products(integer) to authenticated;
grant execute on function public.admin_customers(text, integer, integer) to authenticated;
