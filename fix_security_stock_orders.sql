-- ============================================================================
-- fix_security_stock_orders.sql
--
-- Eseguire nel SQL Editor Supabase DOPO gli schema già esistenti
-- (incluso schema_stripe_orders.sql) e PRIMA di schema_admin_orders.sql.
-- Questo file non va eseguito prima di schema.sql, schema_orders_discount.sql,
-- schema_add_shipping_address.sql e schema_stripe_orders.sql.
--
-- Contiene:
--   1. La protezione della RPC decrement_product_stock
--   2. La funzione is_admin_user() per policy senza ricorsione RLS
--   3. La RPC atomica create_paid_order, chiamabile solo da service_role
-- ============================================================================

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
  v_stock integer;
begin
  if p_product_id is null then
    raise exception using
      errcode = '22023',
      message = 'product_id non può essere null';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception using
      errcode = '22023',
      message = 'quantity deve essere maggiore di zero';
  end if;

  select stock
    into v_stock
    from public.products
   where id = p_product_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = format('Prodotto %s inesistente', p_product_id);
  end if;

  if v_stock < p_quantity then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stock insufficiente per il prodotto %s: disponibili %s, richiesti %s',
        p_product_id,
        v_stock,
        p_quantity
      );
  end if;

  update public.products
     set stock = stock - p_quantity
   where id = p_product_id;

  return true;
end;
$$;

revoke execute on function public.decrement_product_stock(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.decrement_product_stock(uuid, integer)
  to service_role;


create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and is_admin is true
  );
$$;

revoke execute on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated, service_role;


create or replace function public.create_paid_order(
  p_user_id uuid,
  p_stripe_session_id text,
  p_total numeric,
  p_discount_percentage numeric,
  p_discount_amount numeric,
  p_shipping_address jsonb,
  p_items jsonb
)
returns table (
  order_id uuid,
  already_processed boolean,
  has_stock_issue boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_existing_status text;
  v_existing_count bigint;
  v_expected_count bigint;
  v_existing_items jsonb;
  v_expected_items jsonb;
  v_has_stock_issue boolean := false;
  v_item record;
  v_inserted_count bigint;
begin
  if p_user_id is null
     or p_stripe_session_id is null
     or btrim(p_stripe_session_id) = ''
     or p_total is null
     or p_total < 0
     or p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Dati ordine non validi';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_items) as item(
        product_id uuid,
        quantity integer,
        unit_price numeric
      )
     where product_id is null
        or quantity is null
        or quantity <= 0
        or unit_price is null
        or unit_price < 0
  ) then
    raise exception using
      errcode = '22023',
      message = 'Le righe ordine contengono prodotto, quantità o prezzo non validi';
  end if;

  -- Serializza consegne concorrenti della stessa sessione Stripe.
  perform pg_advisory_xact_lock(hashtextextended(p_stripe_session_id, 0));

  select o.id, o.status
    into v_order_id, v_existing_status
    from public.orders as o
   where o.stripe_session_id = p_stripe_session_id
   for update;

  if found then
    select count(*)
      into v_existing_count
      from public.order_items as oi
     where oi.order_id = v_order_id;

    v_expected_count := jsonb_array_length(p_items);

    select coalesce(
      jsonb_agg(
        jsonb_build_array(item.product_id, item.quantity, item.unit_price)
        order by item.product_id, item.quantity, item.unit_price
      ),
      '[]'::jsonb
    )
      into v_expected_items
      from jsonb_to_recordset(p_items) as item(
        product_id uuid,
        quantity integer,
        unit_price numeric
      );

    select coalesce(
      jsonb_agg(
        jsonb_build_array(oi.product_id, oi.quantity, oi.price_at_purchase)
        order by oi.product_id, oi.quantity, oi.price_at_purchase
      ),
      '[]'::jsonb
    )
      into v_existing_items
      from public.order_items as oi
     where oi.order_id = v_order_id;

    if v_existing_count = v_expected_count
       and v_existing_items = v_expected_items then
      return query select v_order_id, true, v_existing_status = 'paid_stock_issue';
      return;
    end if;

    raise exception using
      errcode = '55000',
      message = format(
        'Ordine %s già presente ma incompleto o non corrispondente alla sessione Stripe %s',
        v_order_id,
        p_stripe_session_id
      );
  end if;

  insert into public.orders (
    user_id,
    stripe_session_id,
    status,
    total,
    discount_percentage,
    discount_amount,
    shipping_address
  )
  values (
    p_user_id,
    p_stripe_session_id,
    'pending',
    p_total,
    coalesce(p_discount_percentage, 0),
    coalesce(p_discount_amount, 0),
    p_shipping_address
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    price_at_purchase
  )
  select
    v_order_id,
    item.product_id,
    item.quantity,
    item.unit_price
  from jsonb_to_recordset(p_items) as item(
    product_id uuid,
    quantity integer,
    unit_price numeric
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> jsonb_array_length(p_items) then
    raise exception using
      errcode = 'P0001',
      message = 'Non tutte le righe ordine sono state salvate';
  end if;

  -- L'ordine e tutte le righe sono già inseriti nella transazione. Ogni
  -- decremento è atomico; lo stato paid viene scritto solo dopo questo ciclo.
  for v_item in
    select item.product_id, item.quantity
      from jsonb_to_recordset(p_items) as item(
        product_id uuid,
        quantity integer,
        unit_price numeric
      )
     order by item.product_id
  loop
    begin
      perform public.decrement_product_stock(v_item.product_id, v_item.quantity);
    exception
      when sqlstate 'P0001' then
        v_has_stock_issue := true;
        raise warning 'Stock insufficiente per il prodotto % nell''ordine %',
          v_item.product_id, v_order_id;
    end;
  end loop;

  update public.orders
     set status = case
       when v_has_stock_issue then 'paid_stock_issue'
       else 'paid'
     end
   where id = v_order_id;

  return query select v_order_id, false, v_has_stock_issue;
end;
$$;

revoke execute on function public.create_paid_order(
  uuid, text, numeric, numeric, numeric, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_paid_order(
  uuid, text, numeric, numeric, numeric, jsonb, jsonb
) to service_role;
