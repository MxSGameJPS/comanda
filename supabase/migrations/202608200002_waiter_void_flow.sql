alter table public.employee_profiles add column if not exists login_code text;
alter table public.employee_profiles add column if not exists login_email text;

update public.employee_profiles
set login_code = lower(trim(login_code))
where login_code is not null;

update public.employee_profiles
set login_email = lower(trim(login_email))
where login_email is not null;

create unique index if not exists employee_profiles_restaurant_login_code_uq
on public.employee_profiles(restaurant_id, lower(login_code))
where login_code is not null;

create unique index if not exists employee_profiles_login_email_uq
on public.employee_profiles(lower(login_email))
where login_email is not null;

create or replace function public.normalize_employee_login_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.login_code = nullif(lower(trim(coalesce(new.login_code, ''))), '');
  new.login_email = nullif(lower(trim(coalesce(new.login_email, ''))), '');
  return new;
end;
$$;

drop trigger if exists normalize_employee_login_fields_trigger on public.employee_profiles;
create trigger normalize_employee_login_fields_trigger
before insert or update of login_code, login_email on public.employee_profiles
for each row execute function public.normalize_employee_login_fields();

create index if not exists idx_session_staff_employee on public.session_staff(employee_id, linked_at desc);

create or replace function public.link_waiter_session(
  p_table_public_code uuid,
  p_employee_id uuid
) returns table(session_id uuid, table_number integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee public.employee_profiles%rowtype;
  v_table public.restaurant_tables%rowtype;
  v_session public.table_sessions%rowtype;
begin
  select * into v_employee
  from public.employee_profiles
  where id = p_employee_id
    and is_active = true
    and (active_from is null or active_from <= now())
    and (active_until is null or active_until > now());

  if v_employee.id is null then raise exception 'inactive employee'; end if;
  if v_employee.role not in ('WAITER','MANAGER','ADMIN','OWNER') then raise exception 'employee role cannot link tables'; end if;

  select * into v_table
  from public.restaurant_tables
  where public_code = p_table_public_code
    and restaurant_id = v_employee.restaurant_id
    and active = true;

  if v_table.id is null then raise exception 'table not found'; end if;

  select * into v_session
  from public.table_sessions
  where table_id = v_table.id
    and restaurant_id = v_employee.restaurant_id
    and status in ('OPEN','PAYMENT_PENDING')
  order by opened_at desc
  limit 1;

  if v_session.id is null then raise exception 'table has no active session'; end if;

  insert into public.session_staff(session_id, employee_id)
  values(v_session.id, v_employee.id)
  on conflict(session_id, employee_id) do nothing;

  insert into public.audit_logs(restaurant_id, actor_employee_id, action, entity_type, entity_id, metadata)
  values(v_employee.restaurant_id, v_employee.id, 'WAITER_LINKED', 'table_session', v_session.id,
    jsonb_build_object('table_id', v_table.id, 'table_number', v_table.number));

  return query select v_session.id, v_table.number;
end;
$$;
revoke all on function public.link_waiter_session(uuid,uuid) from public;
grant execute on function public.link_waiter_session(uuid,uuid) to service_role;

create or replace function public.create_staff_order(
  p_session_id uuid,
  p_employee_id uuid,
  p_items jsonb
) returns table(order_id uuid, subtotal numeric, total numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee public.employee_profiles%rowtype;
  v_session public.table_sessions%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_observation text;
  v_source text;
  v_subtotal numeric(12,2);
  v_total numeric(12,2);
begin
  select * into v_employee
  from public.employee_profiles
  where id = p_employee_id
    and is_active = true
    and (active_from is null or active_from <= now())
    and (active_until is null or active_until > now());

  if v_employee.id is null then raise exception 'inactive employee'; end if;
  if v_employee.role not in ('WAITER','CASHIER','MANAGER','ADMIN','OWNER') then raise exception 'employee role cannot create orders'; end if;

  select * into v_session
  from public.table_sessions
  where id = p_session_id
    and restaurant_id = v_employee.restaurant_id
  for update;

  if v_session.id is null then raise exception 'session not found'; end if;
  if v_session.status <> 'OPEN' then raise exception 'session is not open'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty order'; end if;

  if v_employee.role = 'WAITER' and not exists(
    select 1 from public.session_staff ss
    where ss.session_id = v_session.id and ss.employee_id = v_employee.id
  ) then raise exception 'waiter is not linked to this session'; end if;

  v_source := case
    when v_employee.role = 'CASHIER' then 'CASHIER'
    when v_employee.role = 'WAITER' then 'WAITER'
    else 'ADMIN'
  end;

  insert into public.orders(restaurant_id, session_id, source, created_by_employee_id)
  values(v_session.restaurant_id, v_session.id, v_source, v_employee.id)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1, least(50, coalesce((v_item->>'quantity')::integer, 1)));
    v_observation := nullif(left(trim(coalesce(v_item->>'observation','')), 500), '');

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and restaurant_id = v_session.restaurant_id
      and active = true;

    if v_product.id is null then raise exception 'invalid or inactive product'; end if;

    insert into public.order_items(
      restaurant_id, order_id, session_id, product_id, prep_station_id,
      product_name_snapshot, quantity, unit_price, observation, source, created_by_employee_id
    ) values(
      v_session.restaurant_id, v_order_id, v_session.id, v_product.id, v_product.prep_station_id,
      v_product.name, v_quantity, v_product.price, v_observation, v_source, v_employee.id
    );
  end loop;

  update public.table_sessions set first_order_at = coalesce(first_order_at, now()) where id = v_session.id;
  perform public.recalculate_table_session(v_session.id);

  select ts.subtotal, ts.total into v_subtotal, v_total
  from public.table_sessions ts where ts.id = v_session.id;

  insert into public.audit_logs(restaurant_id, actor_employee_id, action, entity_type, entity_id, metadata)
  values(v_session.restaurant_id, v_employee.id, 'ORDER_CREATED', 'order', v_order_id,
    jsonb_build_object('source', v_source, 'session_id', v_session.id));

  return query select v_order_id, v_subtotal, v_total;
end;
$$;
revoke all on function public.create_staff_order(uuid,uuid,jsonb) from public;
grant execute on function public.create_staff_order(uuid,uuid,jsonb) to service_role;

create or replace function public.void_order_item(
  p_item_id uuid,
  p_employee_id uuid,
  p_operator_id uuid,
  p_reason text
) returns table(session_id uuid, subtotal numeric, total numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee public.employee_profiles%rowtype;
  v_operator public.employee_profiles%rowtype;
  v_item public.order_items%rowtype;
  v_session public.table_sessions%rowtype;
  v_reason text;
  v_subtotal numeric(12,2);
  v_total numeric(12,2);
begin
  v_reason := left(trim(coalesce(p_reason, '')), 500);
  if length(v_reason) < 3 then raise exception 'cancellation reason is required'; end if;

  select * into v_employee
  from public.employee_profiles
  where id = p_employee_id
    and is_active = true
    and (active_from is null or active_from <= now())
    and (active_until is null or active_until > now());

  if v_employee.id is null then raise exception 'inactive employee'; end if;
  if v_employee.role not in ('WAITER','CASHIER','MANAGER','ADMIN','OWNER') then raise exception 'employee role cannot void items'; end if;

  select * into v_operator
  from public.employee_profiles
  where id = p_operator_id
    and restaurant_id = v_employee.restaurant_id
    and is_active = true;

  if v_operator.id is null then raise exception 'invalid terminal operator'; end if;

  select * into v_item from public.order_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'item not found'; end if;
  if v_item.restaurant_id <> v_employee.restaurant_id then raise exception 'item belongs to another restaurant'; end if;
  if v_item.status = 'CANCELLED' then raise exception 'item already cancelled'; end if;

  select * into v_session from public.table_sessions where id = v_item.session_id for update;
  if v_session.status in ('CLOSED','CANCELLED') then raise exception 'session is closed'; end if;

  if v_employee.role = 'WAITER' and not exists(
    select 1 from public.session_staff ss
    where ss.session_id = v_item.session_id and ss.employee_id = v_employee.id
  ) then raise exception 'waiter is not linked to this session'; end if;

  insert into public.item_voids(
    restaurant_id, session_id, order_item_id, product_name_snapshot,
    quantity, unit_price, total_price, reason, employee_id
  ) values(
    v_item.restaurant_id, v_item.session_id, v_item.id, v_item.product_name_snapshot,
    v_item.quantity, v_item.unit_price, v_item.total_price, v_reason, v_employee.id
  );

  update public.order_items
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_by = v_employee.id,
      cancellation_reason = v_reason
  where id = v_item.id;

  perform public.recalculate_table_session(v_item.session_id);
  select ts.subtotal, ts.total into v_subtotal, v_total
  from public.table_sessions ts where ts.id = v_item.session_id;

  insert into public.audit_logs(
    restaurant_id, actor_employee_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values(
    v_item.restaurant_id,
    v_employee.id,
    'ITEM_REMOVED',
    'order_item',
    v_item.id,
    jsonb_build_object('status', v_item.status, 'quantity', v_item.quantity, 'unit_price', v_item.unit_price),
    jsonb_build_object('status', 'CANCELLED', 'reason', v_reason),
    jsonb_build_object('terminal_operator_id', v_operator.id, 'session_id', v_item.session_id)
  );

  return query select v_item.session_id, v_subtotal, v_total;
end;
$$;
revoke all on function public.void_order_item(uuid,uuid,uuid,text) from public;
grant execute on function public.void_order_item(uuid,uuid,uuid,text) to service_role;
