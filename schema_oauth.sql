-- ============================================================================
-- schema_oauth.sql
--
-- Migrazione AGGIUNTIVA per il login con Google/Apple (oltre a email e
-- password). Va incollata ed eseguita manualmente nel SQL Editor di
-- Supabase (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già
-- eseguito schema.sql (che crea la tabella "profiles").
--
-- Contiene un TRIGGER su "auth.users": crea automaticamente la riga
-- corrispondente in "public.profiles" alla primissima autenticazione di un
-- utente, qualsiasi sia il metodo (email/password, Google, Apple, o
-- qualunque altro provider si aggiunga in futuro). Prima di questa
-- migrazione, la riga in "profiles" veniva creata "a mano" lato client
-- subito dopo supabase.auth.signUp() (vedi AuthContext.jsx): funzionava
-- per l'email/password, ma non ha senso per un login OAuth, che non passa
-- mai da un signUp() esplicito nel nostro codice — Google/Apple creano
-- l'utente direttamente lato Supabase durante il redirect di autenticazione.
--
-- Il trigger, girando lato database con privilegi elevati (SECURITY
-- DEFINER), risolve anche un problema preesistente con la conferma email:
-- se il progetto Supabase richiede la conferma via email, subito dopo
-- signUp() non esiste ancora una sessione attiva, quindi l'inserimento
-- "a mano" in profiles falliva per via delle policy RLS (che richiedono
-- auth.uid() = id). Il trigger non ha questo problema: viene eseguito con
-- gli stessi privilegi della funzione, non con quelli dell'utente in
-- sessione, quindi funziona correttamente in ogni caso.
-- ============================================================================

-- La funzione eseguita dal trigger. "security definer" fa sì che giri con
-- i privilegi di chi l'ha creata (qui, effettivamente un ruolo con pieno
-- accesso al database), bypassando le policy RLS di "profiles" — è
-- esattamente quello che ci serve per poter scrivere nella tabella subito
-- dopo la creazione dell'utente, prima ancora che esista una sessione.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- "on conflict do nothing": se per qualsiasi motivo esistesse già una
  -- riga con questo id (es. il vecchio inserimento lato client in
  -- AuthContext.signUp, lasciato invariato per compatibilità), il trigger
  -- non fallisce e non sovrascrive nulla.
  --
  -- Il nome mostrato viene letto dai metadati dell'utente, che cambiano
  -- forma a seconda del provider:
  --   - email/password (il nostro signUp): raw_user_meta_data->>'full_name'
  --   - Google: raw_user_meta_data->>'full_name' oppure ->>'name'
  --   - Apple: raw_user_meta_data->>'name' (spesso assente: Apple fornisce
  --     il nome reale solo alla primissima autorizzazione, e solo se
  --     richiesto esplicitamente nello scope) — in quel caso resta NULL,
  --     e l'interfaccia mostra semplicemente l'email (vedi Account.jsx).
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      null
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Il trigger vero e proprio: scatta subito dopo ogni nuova riga inserita
-- in auth.users, cioè alla primissima autenticazione di un utente
-- (indipendentemente dal metodo usato per crearla).
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
