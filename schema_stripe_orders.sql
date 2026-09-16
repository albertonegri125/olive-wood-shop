-- ============================================================================
-- schema_stripe_orders.sql
--
-- Migrazione AGGIUNTIVA per il checkout reale con Stripe. Va incollata ed
-- eseguita manualmente nel SQL Editor di Supabase (Dashboard -> SQL Editor
-- -> New query -> Run), DOPO aver già eseguito schema.sql e
-- schema_orders_discount.sql (che aggiunge discount_percentage/
-- discount_amount a "orders", usate dalla funzione stripe-webhook).
--
-- Contiene:
--   1. Un vincolo di unicità su orders.stripe_session_id (difesa in
--      profondità contro ordini duplicati, in aggiunta al controllo di
--      idempotenza già presente nel codice della funzione stripe-webhook)
--   2. La funzione decrement_product_stock: lo scalo ATOMICO dello stock
--      usato dal webhook per evitare vendite doppie sull'ultimo pezzo
-- ============================================================================


-- ============================================================================
-- 1. VINCOLO DI UNICITÀ su stripe_session_id
-- Stripe può recapitare lo stesso evento webhook più di una volta (è un
-- comportamento previsto, non un bug): il codice della funzione
-- stripe-webhook controlla già se un ordine con questo stripe_session_id
-- esiste prima di crearne uno nuovo, ma quel controllo da solo non basta a
-- escludere una corsa tra due richieste concorrenti (entrambe potrebbero
-- vedere "nessun ordine esistente" nello stesso istante). Questo vincolo a
-- livello di database è la garanzia definitiva: se due richieste provano
-- a inserire un ordine con lo stesso stripe_session_id, la seconda fallisce
-- con un errore che il codice della funzione riconosce e gestisce (non
-- crea un ordine duplicato, né un doppio scalo di stock).
alter table public.orders
  add constraint orders_stripe_session_id_key unique (stripe_session_id);


-- ============================================================================
-- 2. FUNZIONE: decrement_product_stock
-- Scala lo stock di UN prodotto, ma solo se ce n'è ancora abbastanza:
-- un'unica istruzione UPDATE con condizione "stock >= quantità richiesta"
-- è atomica in Postgres (nessun'altra richiesta può intromettersi a metà),
-- quindi elimina la finestra di tempo in cui due acquisti quasi simultanei
-- dell'ultimo pezzo potrebbero controllare entrambi "stock disponibile" e
-- scalarlo entrambi, portandolo sotto zero.
--
-- Ritorna true se lo stock è stato effettivamente scalato (c'era
-- abbastanza disponibilità), false altrimenti (nessuna riga soddisfaceva
-- la condizione: stock insufficiente, o prodotto inesistente).
--
-- "security definer" + "search_path" fissato: gira con privilegi elevati
-- (bypassa la Row Level Security su "products"), quindi va scritta con
-- attenzione a cosa fa esattamente — qui si limita a un update mirato su
-- un id preciso, senza leggere/esporre altri dati.
create or replace function public.decrement_product_stock(
  p_product_id uuid,
  p_quantity integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  update public.products
  set stock = stock - p_quantity
  where id = p_product_id
    and stock >= p_quantity;

  get diagnostics updated_rows = row_count;

  return updated_rows > 0;
end;
$$;

-- Concediamo esplicitamente il permesso di eseguire la funzione al ruolo
-- "service_role" (quello usato dalla Edge Function stripe-webhook tramite
-- la Service Role Key): di norma è già implicito, ma renderlo esplicito
-- evita sorprese se in futuro i permessi di default dovessero cambiare.
grant execute on function public.decrement_product_stock(uuid, integer) to service_role;
