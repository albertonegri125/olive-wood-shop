-- ============================================================================
-- schema_add_shipping_address.sql
--
-- Aggiunge la colonna "shipping_address" alla tabella "orders", per salvare
-- l'indirizzo di spedizione raccolto da Stripe durante il checkout (vedi
-- "shipping_address_collection" in create-checkout-session e la lettura di
-- "session.shipping_details" nel webhook, stripe-webhook/index.ts).
--
-- Solo DDL, nessun test/transazione nel mezzo: l'intero file può essere
-- incollato ed eseguito in un colpo solo nel SQL Editor di Supabase senza
-- rischio che si interrompa a metà. La query di verifica (un semplice
-- SELECT, senza simulazioni di ruolo) è in un file separato,
-- schema_add_shipping_address_TEST.sql, da eseguire DOPO un pagamento di
-- prova, non subito dopo questo file.
--
-- Va incollato ed eseguito manualmente nel SQL Editor di Supabase
-- (Dashboard -> SQL Editor -> New query -> Run), dopo schema.sql.
-- ============================================================================

alter table public.orders
  add column if not exists shipping_address jsonb;

-- Nessuna nuova policy RLS necessaria: la colonna eredita automaticamente le
-- policy già esistenti sulla riga intera di "orders" (l'utente legge solo i
-- propri ordini, scrive solo il webhook via Service Role Key che bypassa la
-- RLS — vedi schema_security_fix_A.sql per la rimozione delle policy INSERT
-- lato utente).

comment on column public.orders.shipping_address is
  'Indirizzo di spedizione raccolto da Stripe Checkout (session.shipping_details): {"name": "...", "address": {"line1": "...", "line2": "...", "city": "...", "state": "...", "postal_code": "...", "country": "IT"}}. Null se non raccolto (es. ordini creati prima di questa colonna).';
