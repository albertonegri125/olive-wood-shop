-- ============================================================================
-- schema_admin_users_TEST.sql
--
-- Query di VERIFICA per schema_admin_users.sql — esegui quel file per
-- primo, poi promuovi/rimuovi un admin di prova dalla sezione "Gestione
-- Admin" (/admin/utenti), poi esegui questa query.
--
-- E' un semplice SELECT di sola lettura: nessuna simulazione di ruolo,
-- nessuna transazione/rollback — non modifica nulla, quindi non c'è nessun
-- rischio che interrompa altro a metà.
-- ============================================================================

select
  p.id,
  p.email,
  p.is_admin,
  p.promoted_at,
  promoter.email as promoted_by_email
from public.profiles p
left join public.profiles promoter on promoter.id = p.promoted_by
order by p.promoted_at desc nulls last
limit 20;

-- ATTESO:
-- - L'utente appena promosso da /admin/utenti ha "is_admin" = true,
--   "promoted_at" valorizzato con l'orario dell'operazione, e
--   "promoted_by_email" con l'email dell'admin che ha eseguito la
--   promozione (chi era loggato quando ha cliccato "Promuovi ad admin").
-- - Un admin rimosso subito dopo ha "is_admin" = false, ma "promoted_at" e
--   "promoted_by_email" restano valorizzati con l'ultima promozione: è
--   voluto, sono una traccia storica (vedi commento in
--   schema_admin_users.sql), non vengono azzerati alla rimozione.
-- - Gli account promossi PRIMA di aver eseguito schema_admin_users.sql (es.
--   con la query manuale "update ... set is_admin = true" di
--   schema_admin.sql) hanno "promoted_at"/"promoted_by_email" null: è
--   normale, non retroattivo.
