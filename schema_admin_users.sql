-- ============================================================================
-- schema_admin_users.sql
--
-- Migrazione AGGIUNTIVA per la sezione "Gestione Admin" del pannello admin
-- (/admin/utenti). Va incollata ed eseguita manualmente nel SQL Editor di
-- Supabase (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già
-- eseguito schema.sql, schema_admin.sql e schema_security_fix_A.sql.
--
-- Aggiunge solo le colonne "promoted_by"/"promoted_at" su "profiles", usate
-- dalla Edge Function "manage-admin" (supabase/functions/manage-admin) per
-- tracciare chi ha promosso ciascun amministratore e quando.
--
-- NESSUNA nuova RLS/policy qui, e apposta: la lettura/scrittura di questi
-- campi e della colonna "is_admin" passa SEMPRE dalla Edge Function
-- "manage-admin" (Service Role Key, che verifica lato server che chi chiama
-- sia già admin), mai da una query diretta del client. Le policy RLS
-- attuali su "profiles" (auth.uid() = id) e le protezioni introdotte da
-- schema_security_fix_A.sql (trigger "protect_profiles_is_admin_trigger" +
-- REVOKE UPDATE (is_admin)) restano invariate e continuano a bloccare
-- qualunque tentativo di scrittura diretta su is_admin dal client, anche da
-- un account già amministratore: è una scelta di sicurezza voluta, non un
-- limite tecnico da aggirare con nuove policy.
--
-- Solo istruzioni DDL idempotenti: nessun test, nessun blocco
-- begin/rollback — l'intero file può essere incollato ed eseguito in un
-- colpo solo. Le query di verifica sono in schema_admin_users_TEST.sql (da
-- eseguire DOPO questo file).
-- ============================================================================


-- ============================================================================
-- COLONNE promoted_by / promoted_at SU profiles
--
-- "promoted_by": id dell'admin che ha effettuato l'ultima promozione di
-- questo utente. Riferisce "public.profiles" (non direttamente
-- "auth.users") perché ci interessa poter risalire a email/nome di chi ha
-- promosso con un semplice join su profiles, senza bisogno di privilegi
-- extra per leggere "auth.users". "on delete set null": se l'account
-- dell'admin che ha fatto la promozione viene in seguito eliminato, la riga
-- dell'utente promosso non viene toccata — si perde solo il riferimento a
-- CHI fu, non lo stato di amministratore in sé.
--
-- "promoted_at": data/ora dell'ultima promozione. Quando un admin viene
-- rimosso (is_admin impostato a false dalla Edge Function) questi due campi
-- NON vengono azzerati: restano come traccia storica dell'ultima
-- promozione avvenuta, utile per l'audit, anche se l'utente non è più admin
-- adesso.
-- ============================================================================
alter table public.profiles
  add column if not exists promoted_by uuid references public.profiles (id) on delete set null;

alter table public.profiles
  add column if not exists promoted_at timestamptz;

comment on column public.profiles.promoted_by is
  'Id dell''admin che ha promosso questo utente ad amministratore (via Edge Function manage-admin). Null se mai promosso da UI (es. promozione fatta manualmente da SQL Editor, come descritto in schema_admin.sql) o se l''admin che lo promosse è stato nel frattempo eliminato.';

comment on column public.profiles.promoted_at is
  'Data/ora dell''ultima promozione ad amministratore via Edge Function manage-admin. Non viene azzerato alla rimozione dei privilegi: resta come traccia storica per l''audit.';
