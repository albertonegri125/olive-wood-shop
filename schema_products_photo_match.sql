-- ============================================================================
-- schema_products_photo_match.sql
--
-- Migrazione AGGIUNTIVA per indicare se il cliente riceve ESATTAMENTE il
-- pezzo fotografato o un pezzo simile. Va incollata ed eseguita manualmente
-- nel SQL Editor di Supabase (Dashboard -> SQL Editor -> New query -> Run),
-- DOPO aver già eseguito schema.sql. Indipendente da schema_products_sku.sql:
-- l'ordine tra i due file non conta.
--
-- Valori ammessi:
--   - 'exact'   -> il cliente riceve esattamente il pezzo in foto
--   - 'similar' -> il cliente riceve un pezzo con forma/dimensioni/
--                  lavorazione simili (default: è il caso più prudente da
--                  comunicare finché l'admin non indica il contrario)
--
-- "not null default 'similar'": i prodotti già esistenti ricevono subito il
-- valore di default, nessun backfill separato necessario.
--
-- Solo DDL idempotente: nessun test, nessun blocco begin/rollback — il file
-- può essere incollato ed eseguito in un colpo solo, anche più volte.
-- ============================================================================

alter table public.products
  add column if not exists photo_match_type text not null default 'similar'
  constraint products_photo_match_type_check check (photo_match_type in ('exact', 'similar'));

comment on column public.products.photo_match_type is
  'exact = il cliente riceve esattamente il pezzo fotografato; similar = riceve un pezzo con le stesse caratteristiche ma non identico.';
