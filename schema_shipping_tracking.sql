-- ============================================================================
-- schema_shipping_tracking.sql
--
-- Eseguire manualmente nel SQL Editor Supabase dopo che `orders` esiste
-- (schema.sql) e dopo gli script che impostano i grant/policy correnti.
-- Questo script aggiunge solo i campi del tracking e il grant UPDATE sulle
-- sole colonne indicate; non modifica policy RLS né altri grant su orders o
-- order_items.
-- ============================================================================

alter table public.orders
  add column if not exists carrier text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz;

grant update (status, tracking_number, carrier, tracking_url, shipped_at)
  on table public.orders
  to authenticated;
