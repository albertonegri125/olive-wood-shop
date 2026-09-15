-- ============================================================================
-- schema_orders_discount.sql
--
-- Migrazione AGGIUNTIVA per registrare lo sconto "bundle" applicato a ogni
-- ordine. Va incollata ed eseguita manualmente nel SQL Editor di Supabase
-- (Dashboard -> SQL Editor -> New query -> Run), DOPO aver già eseguito
-- schema.sql (che crea la tabella "orders").
--
-- Contiene solo due nuove colonne su "orders": nessuna nuova tabella o
-- policy RLS (le policy già esistenti su "orders" restano valide, dato che
-- riguardano l'intera riga e non singole colonne).
--
-- IMPORTANTE: lo sconto viene oggi calcolato solo lato client (vedi
-- CartContext.jsx, getDiscountPercentage/getDiscountedTotal), per mostrare
-- subito il prezzo scontato nell'interfaccia. Quando l'ordine verrà
-- effettivamente creato (al collegamento con Stripe, prossimo step), il
-- backend/webhook dovrà RICALCOLARE lo sconto in modo indipendente prima
-- di salvare queste colonne — non ci si può fidare di un valore calcolato
-- nel browser per registrare quanto è stato effettivamente scontato a un
-- cliente.
-- ============================================================================

-- Percentuale di sconto applicata a questo ordine (0, 10 o 15, secondo gli
-- scaglioni descritti in CartContext.jsx): salvata così com'era al momento
-- dell'acquisto, anche se in futuro le soglie di sconto dovessero cambiare.
alter table public.orders
  add column if not exists discount_percentage numeric(5, 2) not null default 0
    check (discount_percentage >= 0);

-- Importo effettivo scontato (in euro), calcolato su "total": tenerlo salvo
-- separatamente evita di dover ricalcolare a ritroso "quanto avrebbe pagato
-- senza sconto" da un ordine storico.
alter table public.orders
  add column if not exists discount_amount numeric(10, 2) not null default 0
    check (discount_amount >= 0);
