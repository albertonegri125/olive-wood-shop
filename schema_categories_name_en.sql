-- ============================================================================
-- schema_categories_name_en.sql
--
-- Migrazione AGGIUNTIVA per la sezione "Categorie" del pannello admin
-- (/admin/categorie). Va incollata ed eseguita manualmente nel SQL Editor
-- di Supabase (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già
-- eseguito schema_categories.sql.
--
-- PERCHÉ QUESTA COLONNA: le 5 categorie "storiche" mostrano il loro nome
-- in inglese tramite una traduzione vera e propria in src/locales/en.json
-- (chiave "categories.<slug>") — funziona perché quei file sono scritti a
-- mano nel codice sorgente. Una categoria creata dalla nuova sezione
-- "Categorie" del pannello admin, invece, NON può avere una voce in quei
-- file: sono bundle statici, editabili solo nel codice e con un redeploy,
-- non da un pannello admin live. "name_en" è quindi il modo per cui una
-- NUOVA categoria ha comunque un nome inglese, letto direttamente dal
-- database (vedi src/lib/categoryName.js: usato come "defaultValue" di
-- i18next quando la chiave di traduzione statica non esiste).
-- Nullable: se lasciata vuota, il sito in inglese mostra comunque il nome
-- italiano ("name") come ripiego, non resta mai senza etichetta.
--
-- Solo istruzioni DDL/UPDATE idempotenti: nessun test, nessun blocco
-- begin/rollback — l'intero file può essere incollato ed eseguito in un
-- colpo solo.
-- ============================================================================

alter table public.categories
  add column if not exists name_en text;

comment on column public.categories.name_en is
  'Nome della categoria in inglese, gestito dalla sezione Categorie del pannello admin. Null = usa "name" (il nome italiano) anche sul sito in inglese.';

-- Backfill delle 5 categorie iniziali (schema_categories.sql) con lo stesso
-- testo già presente in src/locales/en.json: da questo momento "name_en"
-- e la traduzione statica sono coerenti per loro (non che cambi nulla in
-- pratica: per queste 5 la traduzione statica ha comunque la precedenza,
-- vedi lib/categoryName.js — è solo per non lasciare il campo vuoto senza
-- motivo in Table Editor).
update public.categories set name_en = 'Kitchen' where slug = 'kitchen' and name_en is null;
update public.categories set name_en = 'Home' where slug = 'home' and name_en is null;
update public.categories set name_en = 'Accessories' where slug = 'accessories' and name_en is null;
update public.categories set name_en = 'Wellness' where slug = 'wellness' and name_en is null;
update public.categories set name_en = 'Other' where slug = 'other' and name_en is null;
