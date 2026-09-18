-- ============================================================================
-- schema_security_fix_TEST.sql
--
-- Query di VERIFICA per il fix in schema_security_fix_A.sql — esegui
-- quel file per primo, poi questi blocchi (uno alla volta, non serve
-- eseguirli tutti insieme).
--
-- Usano "set_config" + "set local role" per SIMULARE una richiesta
-- autenticata come utente normale (non service_role) dentro l'editor SQL,
-- che di suo gira con privilegi pieni e altrimenti bypasserebbe sia la RLS
-- sia le REVOKE del fix, dando un falso senso di sicurezza. Ogni blocco è
-- avvolto in "begin/rollback": anche se un test avesse (erroneamente)
-- successo, nessuna modifica resterebbe davvero salvata — e se un test
-- fallisce con un errore, il blocco resta comunque isolato dagli altri
-- (sono transazioni indipendenti, non c'è un unico "begin" complessivo).
--
-- Sostituisci '00000000-0000-0000-0000-000000000000' con l'id REALE di un
-- utente di test già esistente in "profiles" (NON il tuo account admin):
-- lo trovi in Table Editor -> profiles, colonna "id".
-- ============================================================================


-- --- TEST 1: un utente normale NON deve poter diventare admin -------------
-- ATTESO: errore "permission denied for column is_admin" (grazie alla
-- REVOKE del punto 2 di schema_security_fix_A.sql — l'errore blocca la
-- query prima ancora di arrivare al trigger, che comunque farebbe da rete
-- di sicurezza in più).
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.profiles
  set is_admin = true
  where id = '00000000-0000-0000-0000-000000000000';
rollback;


-- --- TEST 2: verifica il trigger ISOLATO dalla REVOKE ----------------------
-- Ridà temporaneamente il permesso sulla colonna (solo dentro questa
-- transazione, annullato dal rollback finale) per verificare che, anche
-- SENZA la REVOKE del punto 2, il trigger da solo impedisca comunque il
-- cambiamento.
-- ATTESO: l'UPDATE non genera errore, ma la SELECT finale mostra ancora
-- is_admin = false (il trigger l'ha silenziosamente ripristinato).
begin;
grant update (is_admin) on public.profiles to authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.profiles
  set is_admin = true
  where id = '00000000-0000-0000-0000-000000000000';
select id, is_admin from public.profiles where id = '00000000-0000-0000-0000-000000000000';
rollback;


-- --- TEST 3 (controllo positivo): l'utente deve poter ANCORA modificare ---
-- --- gli altri campi del proprio profilo -----------------------------------
-- ATTESO: nessun errore, la SELECT finale mostra il nuovo full_name.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
update public.profiles
  set full_name = 'Test verifica fix'
  where id = '00000000-0000-0000-0000-000000000000';
select id, full_name from public.profiles where id = '00000000-0000-0000-0000-000000000000';
rollback;


-- --- TEST 4: un utente normale NON deve poter creare un ordine finto ------
-- ATTESO: un errore che blocca l'inserimento (nessuna policy INSERT resta
-- per "authenticated" su orders, dopo la DROP POLICY del punto 3 di
-- schema_security_fix_A.sql). A seconda della versione di Postgres/
-- Supabase può presentarsi in due forme equivalenti, ENTRAMBE da
-- considerare un successo del test:
--   - "new row violates row-level security policy for table \"orders\""
--     (bloccato dalla Row Level Security: nessuna policy INSERT concede
--     il permesso)
--   - "permission denied for table orders" (bloccato prima ancora, a
--     livello di GRANT/permessi Postgres)
-- In entrambi i casi il risultato che conta è lo stesso: l'inserimento
-- NON va a buon fine. Qualunque altro esito (nessun errore, riga inserita)
-- indica che il fix non è stato applicato correttamente.
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
insert into public.orders (user_id, total)
  values ('00000000-0000-0000-0000-000000000000', 999);
rollback;
