-- ============================================================================
-- schema_categories_name_en_TEST.sql
--
-- Query di VERIFICA per schema_categories_name_en.sql — esegui quel file
-- per primo, poi prova ad aggiungere/modificare una categoria dalla
-- sezione "Categorie" (/admin/categorie), poi esegui questa query.
--
-- E' un semplice SELECT di sola lettura: nessuna simulazione di ruolo,
-- nessuna transazione/rollback — non modifica nulla, quindi non c'è nessun
-- rischio che interrompa altro a metà.
-- ============================================================================

select
  c.id,
  c.name,
  c.name_en,
  c.slug,
  count(p.id) as products_count
from public.categories c
left join public.products p on p.category_id = c.id
group by c.id, c.name, c.name_en, c.slug
order by c.created_at;

-- ATTESO:
-- - Le 5 categorie iniziali (kitchen/home/accessories/wellness/other) hanno
--   "name_en" valorizzato (Kitchen/Home/Accessories/Wellness/Other).
-- - Una categoria appena creata da /admin/categorie ha "name_en" uguale a
--   quanto scritto nel campo "Nome (inglese)" del form (o null, se
--   lasciato vuoto).
-- - "products_count" corrisponde al numero di prodotti mostrati nella
--   colonna "Prodotti" della tabella in /admin/categorie per quella riga.
