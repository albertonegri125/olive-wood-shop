-- ============================================================================
-- schema_admin_orders.sql
--
-- Ordine di esecuzione: dopo gli schemi base già in uso, eseguire prima
-- fix_security_stock_orders.sql (definisce is_admin_user()), poi questo file.
-- Eseguire manualmente dal SQL Editor Supabase.
--
-- Aggiunge tracking_number e le policy admin su orders, order_items e
-- profiles. Le policy usano is_admin_user() SECURITY DEFINER per evitare
-- ricorsione RLS quando profiles è la tabella protetta.
-- Non concede agli admin UPDATE su profiles.is_admin.
-- ============================================================================

alter table public.orders
  add column if not exists tracking_number text;

drop policy if exists "Gli admin possono leggere tutti gli ordini"
  on public.orders;
create policy "Gli admin possono leggere tutti gli ordini"
  on public.orders
  for select
  using (public.is_admin_user());

drop policy if exists "Gli admin possono aggiornare tutti gli ordini"
  on public.orders;
create policy "Gli admin possono aggiornare tutti gli ordini"
  on public.orders
  for update
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "Gli admin possono leggere tutte le righe ordine"
  on public.order_items;
create policy "Gli admin possono leggere tutte le righe ordine"
  on public.order_items
  for select
  using (public.is_admin_user());

drop policy if exists "Gli admin possono leggere tutti i profili"
  on public.profiles;
create policy "Gli admin possono leggere tutti i profili"
  on public.profiles
  for select
  using (public.is_admin_user());

-- Mantiene esplicitamente la protezione a livello di privilegi colonna.
revoke update (is_admin) on public.profiles from authenticated, anon;
