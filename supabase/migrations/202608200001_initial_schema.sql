create extension if not exists pgcrypto with schema extensions;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  phone text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  number integer not null check(number > 0),
  public_code uuid not null default gen_random_uuid(),
  status text not null default 'AVAILABLE' check(status in ('AVAILABLE','OCCUPIED','PAYMENT_PENDING','BLOCKED')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id, number),
  unique(public_code)
);

create table if not exists public.employee_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  role text not null check(role in ('OWNER','ADMIN','MANAGER','CASHIER','WAITER','KITCHEN','BAR')),
  employment_type text not null default 'FIXED' check(employment_type in ('FIXED','TEMPORARY')),
  active_from timestamptz,
  active_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id, slug)
);

create table if not exists public.prep_stations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id, code)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  prep_station_id uuid references public.prep_stations(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null check(price >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id),
  customer_name text not null,
  customer_whatsapp text not null,
  customer_access_token_hash text not null unique,
  status text not null default 'OPEN' check(status in ('OPEN','PAYMENT_PENDING','CLOSED','CANCELLED')),
  opened_at timestamptz not null default now(),
  first_order_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.employee_profiles(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0 check(discount >= 0),
  service_fee numeric(12,2) not null default 0 check(service_fee >= 0),
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_open_session_per_table on public.table_sessions(table_id) where status in ('OPEN','PAYMENT_PENDING');

create table if not exists public.session_staff (
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  employee_id uuid not null references public.employee_profiles(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key(session_id, employee_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  source text not null check(source in ('CUSTOMER','WAITER','CASHIER','ADMIN')),
  created_by_employee_id uuid references public.employee_profiles(id) on delete set null,
  status text not null default 'OPEN' check(status in ('OPEN','COMPLETED','CANCELLED')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  prep_station_id uuid references public.prep_stations(id) on delete set null,
  product_name_snapshot text not null,
  quantity integer not null check(quantity > 0),
  unit_price numeric(12,2) not null check(unit_price >= 0),
  total_price numeric(12,2) generated always as (quantity * unit_price) stored,
  observation text,
  status text not null default 'NEW' check(status in ('NEW','PREPARING','READY','SENT','CANCELLED')),
  source text not null check(source in ('CUSTOMER','WAITER','CASHIER','ADMIN')),
  created_by_employee_id uuid references public.employee_profiles(id) on delete set null,
  prepared_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.employee_profiles(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.item_voids (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  product_name_snapshot text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  reason text not null,
  employee_id uuid not null references public.employee_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  method text not null check(method in ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','OTHER')),
  amount numeric(12,2) not null check(amount > 0),
  employee_id uuid not null references public.employee_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  opened_by uuid not null references public.employee_profiles(id),
  closed_by uuid references public.employee_profiles(id),
  status text not null default 'OPEN' check(status in ('OPEN','CLOSED')),
  opening_amount numeric(12,2) not null default 0,
  expected_amount numeric(12,2),
  reported_amount numeric(12,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  cash_shift_id uuid references public.cash_shifts(id) on delete set null,
  session_id uuid references public.table_sessions(id) on delete set null,
  type text not null check(type in ('SALE','SUPPLY','WITHDRAWAL','EXPENSE','ADJUSTMENT')),
  amount numeric(12,2) not null,
  description text,
  employee_id uuid not null references public.employee_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_employee_id uuid references public.employee_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tables_restaurant_status on public.restaurant_tables(restaurant_id, status);
create index if not exists idx_sessions_restaurant_status on public.table_sessions(restaurant_id, status, opened_at desc);
create index if not exists idx_orders_session_created on public.orders(session_id, created_at desc);
create index if not exists idx_order_items_session_status on public.order_items(session_id, status);
create index if not exists idx_order_items_station_status on public.order_items(prep_station_id, status, created_at);
create index if not exists idx_payments_session on public.payments(session_id, created_at);
create index if not exists idx_audit_restaurant_created on public.audit_logs(restaurant_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_order_item_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'order_items cannot be deleted; cancel the item and record an item_void instead';
end;
$$;

create or replace function public.current_employee_restaurant_id() returns uuid language sql stable security definer set search_path = '' as $$
  select ep.restaurant_id
  from public.employee_profiles ep
  where ep.id = auth.uid()
    and ep.is_active = true
    and (ep.active_from is null or ep.active_from <= now())
    and (ep.active_until is null or ep.active_until > now())
  limit 1;
$$;
revoke all on function public.current_employee_restaurant_id() from public;
grant execute on function public.current_employee_restaurant_id() to authenticated;

create or replace function public.recalculate_table_session(p_session_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_subtotal numeric(12,2);
begin
  select coalesce(sum(oi.total_price), 0) into v_subtotal
  from public.order_items oi
  where oi.session_id = p_session_id and oi.status <> 'CANCELLED';

  update public.table_sessions
  set subtotal = v_subtotal,
      total = greatest(0, v_subtotal + service_fee - discount),
      updated_at = now()
  where id = p_session_id;
end;
$$;
revoke all on function public.recalculate_table_session(uuid) from public;
grant execute on function public.recalculate_table_session(uuid) to service_role;

create or replace function public.open_table_session(
  p_table_public_code uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_token_hash text
) returns table(session_id uuid, table_number integer, opened_at timestamptz, status text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_session public.table_sessions%rowtype;
begin
  select * into v_table
  from public.restaurant_tables
  where public_code = p_table_public_code and active = true
  for update;

  if v_table.id is null then raise exception 'table not found'; end if;
  if exists(select 1 from public.table_sessions where table_id = v_table.id and status in ('OPEN','PAYMENT_PENDING')) then
    raise exception 'table already occupied';
  end if;

  insert into public.table_sessions(restaurant_id, table_id, customer_name, customer_whatsapp, customer_access_token_hash)
  values(v_table.restaurant_id, v_table.id, trim(p_customer_name), trim(p_customer_whatsapp), p_token_hash)
  returning * into v_session;

  update public.restaurant_tables set status = 'OCCUPIED' where id = v_table.id;

  return query select v_session.id, v_table.number, v_session.opened_at, v_session.status;
end;
$$;
revoke all on function public.open_table_session(uuid,text,text,text) from public;
grant execute on function public.open_table_session(uuid,text,text,text) to service_role;

create or replace function public.create_customer_order(
  p_session_id uuid,
  p_token_hash text,
  p_items jsonb
) returns table(order_id uuid, subtotal numeric, total numeric)
language plpgsql security invoker set search_path = '' as $$
declare
  v_session public.table_sessions%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_observation text;
  v_subtotal numeric(12,2);
  v_total numeric(12,2);
begin
  select * into v_session
  from public.table_sessions
  where id = p_session_id and customer_access_token_hash = p_token_hash
  for update;

  if v_session.id is null then raise exception 'invalid customer session'; end if;
  if v_session.status <> 'OPEN' then raise exception 'session is not open'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty order'; end if;

  insert into public.orders(restaurant_id, session_id, source)
  values(v_session.restaurant_id, v_session.id, 'CUSTOMER')
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
      product_name_snapshot, quantity, unit_price, observation, source
    ) values(
      v_session.restaurant_id, v_order_id, v_session.id, v_product.id, v_product.prep_station_id,
      v_product.name, v_quantity, v_product.price, v_observation, 'CUSTOMER'
    );
  end loop;

  update public.table_sessions set first_order_at = coalesce(first_order_at, now()) where id = v_session.id;
  perform public.recalculate_table_session(v_session.id);
  select ts.subtotal, ts.total into v_subtotal, v_total from public.table_sessions ts where ts.id = v_session.id;

  return query select v_order_id, v_subtotal, v_total;
end;
$$;
revoke all on function public.create_customer_order(uuid,text,jsonb) from public;
grant execute on function public.create_customer_order(uuid,text,jsonb) to service_role;

create or replace function public.close_table_session(
  p_session_id uuid,
  p_employee_id uuid,
  p_method text
) returns table(session_id uuid, total numeric, closed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  v_session public.table_sessions%rowtype;
  v_employee public.employee_profiles%rowtype;
  v_closed_at timestamptz := now();
begin
  select * into v_session from public.table_sessions where id = p_session_id for update;
  if v_session.id is null then raise exception 'session not found'; end if;
  if v_session.status not in ('OPEN','PAYMENT_PENDING') then raise exception 'session already closed'; end if;

  select * into v_employee from public.employee_profiles where id = p_employee_id;
  if v_employee.id is null or v_employee.restaurant_id <> v_session.restaurant_id or not v_employee.is_active or v_employee.role not in ('CASHIER','MANAGER','ADMIN','OWNER') then
    raise exception 'employee not authorized';
  end if;
  if p_method not in ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','OTHER') then raise exception 'invalid payment method'; end if;

  perform public.recalculate_table_session(v_session.id);
  select * into v_session from public.table_sessions where id = p_session_id;

  if v_session.total > 0 then
    insert into public.payments(restaurant_id, session_id, method, amount, employee_id)
    values(v_session.restaurant_id, v_session.id, p_method, v_session.total, p_employee_id);
  end if;

  update public.table_sessions set status = 'CLOSED', closed_at = v_closed_at, closed_by = p_employee_id where id = v_session.id;
  update public.restaurant_tables set status = 'AVAILABLE' where id = v_session.table_id;
  insert into public.audit_logs(restaurant_id, actor_employee_id, action, entity_type, entity_id, metadata)
  values(v_session.restaurant_id, p_employee_id, 'TABLE_SESSION_CLOSED', 'table_session', v_session.id, jsonb_build_object('payment_method', p_method, 'total', v_session.total));

  return query select v_session.id, v_session.total, v_closed_at;
end;
$$;
revoke all on function public.close_table_session(uuid,uuid,text) from public;
grant execute on function public.close_table_session(uuid,uuid,text) to service_role;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at before update on public.restaurants for each row execute function public.set_updated_at();
drop trigger if exists restaurant_tables_set_updated_at on public.restaurant_tables;
create trigger restaurant_tables_set_updated_at before update on public.restaurant_tables for each row execute function public.set_updated_at();
drop trigger if exists employee_profiles_set_updated_at on public.employee_profiles;
create trigger employee_profiles_set_updated_at before update on public.employee_profiles for each row execute function public.set_updated_at();
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists table_sessions_set_updated_at on public.table_sessions;
create trigger table_sessions_set_updated_at before update on public.table_sessions for each row execute function public.set_updated_at();
drop trigger if exists prevent_order_item_delete_trigger on public.order_items;
create trigger prevent_order_item_delete_trigger before delete on public.order_items for each row execute function public.prevent_order_item_delete();

alter table public.restaurants enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.prep_stations enable row level security;
alter table public.products enable row level security;
alter table public.table_sessions enable row level security;
alter table public.session_staff enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.item_voids enable row level security;
alter table public.payments enable row level security;
alter table public.cash_shifts enable row level security;
alter table public.cash_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy "staff can read own profile" on public.employee_profiles for select to authenticated using(id = auth.uid());
create policy "staff can read own restaurant" on public.restaurants for select to authenticated using(id = public.current_employee_restaurant_id());
create policy "staff can read restaurant tables" on public.restaurant_tables for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read categories" on public.categories for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read prep stations" on public.prep_stations for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read products" on public.products for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read sessions" on public.table_sessions for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read session staff" on public.session_staff for select to authenticated using(exists(select 1 from public.table_sessions ts where ts.id = session_staff.session_id and ts.restaurant_id = public.current_employee_restaurant_id()));
create policy "staff can read orders" on public.orders for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read order items" on public.order_items for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read payments" on public.payments for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read item voids" on public.item_voids for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read cash shifts" on public.cash_shifts for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read cash movements" on public.cash_movements for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());
create policy "staff can read audit logs" on public.audit_logs for select to authenticated using(restaurant_id = public.current_employee_restaurant_id());

-- Desde 2026 novas tabelas podem não ser expostas automaticamente à Data API.
grant usage on schema public to authenticated, service_role;
grant select on public.employee_profiles, public.restaurants, public.restaurant_tables, public.categories, public.prep_stations, public.products, public.table_sessions, public.session_staff, public.orders, public.order_items, public.item_voids, public.payments, public.cash_shifts, public.cash_movements, public.audit_logs to authenticated;
grant all on public.restaurants, public.restaurant_tables, public.employee_profiles, public.categories, public.prep_stations, public.products, public.table_sessions, public.session_staff, public.orders, public.order_items, public.item_voids, public.payments, public.cash_shifts, public.cash_movements, public.audit_logs to service_role;

-- Realtime para os terminais internos. RLS continua determinando quais eventos cada funcionário pode receber.
do $$
begin
  alter publication supabase_realtime add table public.order_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.table_sessions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.restaurant_tables;
exception when duplicate_object then null;
end $$;
