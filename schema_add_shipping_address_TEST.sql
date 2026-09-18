-- ============================================================================
-- schema_add_shipping_address_TEST.sql
--
-- Query di VERIFICA per schema_add_shipping_address.sql — esegui quel file
-- per primo, poi fai un pagamento di prova con checkout completo (Stripe
-- test mode, con l'indirizzo compilato nella pagina di pagamento), poi
-- esegui questa query.
--
-- E' un semplice SELECT di sola lettura: nessuna simulazione di ruolo,
-- nessuna transazione/rollback — non modifica nulla, quindi non c'è nessun
-- rischio che interrompa altro a metà.
-- ============================================================================

select
  id,
  created_at,
  status,
  shipping_address,
  shipping_address -> 'address' ->> 'city' as shipping_city,
  shipping_address -> 'address' ->> 'postal_code' as shipping_cap
from public.orders
order by created_at desc
limit 5;

-- ATTESO: l'ordine appena creato dal pagamento di prova ha "shipping_address"
-- NON null, con "name" e "address" (line1, city, postal_code, country
-- "IT") valorizzati con quanto inserito nella pagina di Stripe. Ordini
-- creati PRIMA di aver eseguito schema_add_shipping_address.sql avranno
-- shipping_address = null: è normale, non retroattivo.
