-- ============================================================================
-- schema_security_fix_A.sql
--
-- FIX CRITICO — da eseguire PRIMA di aprire il sito a pagamenti veri.
-- Solo istruzioni DDL/GRANT/REVOKE: nessun test, nessun blocco
-- begin/rollback — l'intero file può essere incollato ed eseguito in un
-- colpo solo nel SQL Editor di Supabase senza rischio che si interrompa a
-- metà. Le query di verifica sono in schema_security_fix_TEST.sql (da
-- eseguire DOPO questo file).
--
-- BUG: la policy di UPDATE su "profiles" (schema.sql) è:
--   using (auth.uid() = id)
-- senza un "with check" che escluda singole colonne. Poiché non limita
-- QUALI campi si possono cambiare, qualunque utente autenticato può
-- eseguire dal browser (con il client Supabase già caricato dalla pagina):
--   supabase.from('profiles').update({ is_admin: true }).eq('id', <il proprio id>)
-- e autopromuoversi amministratore. Tutte le policy admin del progetto
-- (products, categories, product_images, reviews — vedi i rispettivi
-- schema_*.sql) si basano su "profiles.is_admin = true": questo singolo
-- bug comprometteva l'intero pannello /admin.
--
-- Il fix è a DUE livelli indipendenti (difesa in profondità: se uno dei
-- due venisse per errore rimosso in futuro, l'altro resta a proteggere):
--   1. Un trigger che ripristina "is_admin" al valore precedente per
--      chiunque non sia il ruolo di servizio (service_role) — funziona
--      SEMPRE, qualunque siano i permessi GRANT sulla tabella, e non fa
--      fallire un update legittimo che includesse per sbaglio anche
--      is_admin invariato insieme ad altri campi (lo ignora e basta,
--      invece di bloccare l'intera richiesta).
--   2. Una REVOKE del permesso di scrittura sulla singola colonna
--      "is_admin" per i ruoli "authenticated" e "anon" — un secondo
--      livello indipendente dalla RLS e dal trigger.
--
-- In più, rimuove le policy INSERT ormai orfane su "orders"/"order_items":
-- da quando gli ordini vengono creati solo dal webhook Stripe (Service
-- Role Key, che bypassa comunque la RLS), permettere a un utente
-- autenticato di inserire "a mano" un proprio ordine non serve più a
-- nulla di buono — anzi, è un varco che permetterebbe di iniettare ordini
-- finti (es. status "paid" mai davvero pagato) nella propria cronologia.
--
-- Va incollato ed eseguito manualmente nel SQL Editor di Supabase
-- (Dashboard -> SQL Editor -> New query -> Run), DOPO schema.sql e
-- schema_admin.sql (che introduce la colonna is_admin).
-- ============================================================================


-- ============================================================================
-- 1. TRIGGER: blocca la modifica di is_admin da parte di chiunque non sia
--    il ruolo di servizio.
--
-- "auth.role()" restituisce il ruolo associato alla richiesta corrente:
-- 'anon' per visitatori non loggati, 'authenticated' per utenti loggati,
-- 'service_role' per chiamate fatte con la Service Role Key (usata SOLO
-- dalle Edge Function lato server, mai esposta al browser). Se il
-- chiamante non è 'service_role', il trigger riscrive "is_admin" con il
-- valore che aveva PRIMA dell'update, qualunque valore fosse stato
-- inviato nella richiesta.
-- ============================================================================
create or replace function public.protect_profiles_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_is_admin_trigger on public.profiles;

create trigger protect_profiles_is_admin_trigger
  before update on public.profiles
  for each row execute function public.protect_profiles_is_admin();


-- ============================================================================
-- 2. REVOKE: secondo livello di protezione, indipendente dal trigger.
-- Toglie ai ruoli "authenticated" (utenti loggati) e "anon" (visitatori
-- non loggati) il permesso di scrivere sulla singola colonna "is_admin",
-- indipendentemente da RLS e trigger. NON tocca il permesso di scrittura
-- sulle altre colonne: un utente continua a poter aggiornare il proprio
-- full_name/email normalmente.
-- ============================================================================
revoke update (is_admin) on public.profiles from authenticated;
revoke update (is_admin) on public.profiles from anon;


-- ============================================================================
-- 3. RIMOZIONE delle policy INSERT ormai orfane su orders/order_items.
-- I nomi devono corrispondere ESATTAMENTE a quelli creati in schema.sql.
-- Le policy di SELECT ("un utente può leggere solo i propri ordini/righe")
-- NON vengono toccate: restano, servono alla pagina "I tuoi ordini"
-- (Account.jsx). Il webhook Stripe (stripe-webhook, Service Role Key)
-- continua a poter inserire ordini/righe regolarmente: la Service Role Key
-- bypassa sempre la Row Level Security, non ha mai avuto bisogno di
-- queste policy per funzionare.
-- ============================================================================
drop policy if exists "Un utente può creare solo i propri ordini" on public.orders;
drop policy if exists "Un utente può inserire righe solo nei propri ordini" on public.order_items;


-- ============================================================================
-- NOTA: come promuovere un admin resta INVARIATO rispetto a prima del fix.
-- Eseguita così (senza simulare un ruolo, con i privilegi pieni con cui
-- gira normalmente l'editor SQL), questa è esattamente il canale
-- legittimo già documentato in schema_admin.sql — il trigger e la REVOKE
-- qui sopra bloccano solo i tentativi fatti dal client con i privilegi di
-- un utente normale, non questo tipo di operazione amministrativa diretta:
--
--   update public.profiles set is_admin = true where email = 'tuo@email.it';
-- ============================================================================
