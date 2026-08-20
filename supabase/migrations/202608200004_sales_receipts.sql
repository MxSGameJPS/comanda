-- Internal immutable sales receipts.
-- Apply after 001, 002 and 003. Safe for existing data; new receipts are generated when a session closes.

create table if not exists public.sales_receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id),
  receipt_number bigint generated always as identity,
  table_number integer not null,
  table_label text,
  customer_name text not null,
  customer_whatsapp text,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_snapshot jsonb not null default '[]'::jsonb,
  staff_snapshot jsonb not null default '[]'::jsonb,
  items_snapshot jsonb not null default '[]'::jsonb,
  voids_snapshot jsonb not null default '[]'::jsonb,
  closed_by_employee_id uuid references public.employee_profiles(id) on delete set null,
  closed_by_name text,
  created_at timestamptz not null default now(),
  constraint sales_receipts_session_unique unique(session_id)
);

create unique index if not exists sales_receipts_restaurant_number_uq
  on public.sales_receipts(restaurant_id, receipt_number);
create index if not exists idx_sales_receipts_restaurant_closed
  on public.sales_receipts(restaurant_id, closed_at desc);

create or replace function public.prevent_sales_receipt_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'sales receipts are immutable';
end;
$$;

drop trigger if exists prevent_sales_receipt_update on public.sales_receipts;
create trigger prevent_sales_receipt_update
before update on public.sales_receipts
for each row execute function public.prevent_sales_receipt_mutation();

drop trigger if exists prevent_sales_receipt_delete on public.sales_receipts;
create trigger prevent_sales_receipt_delete
before delete on public.sales_receipts
for each row execute function public.prevent_sales_receipt_mutation();

alter table public.sales_receipts enable row level security;

drop policy if exists "staff can read sales receipts" on public.sales_receipts;
create policy "staff can read sales receipts"
on public.sales_receipts for select to authenticated
using(restaurant_id = public.current_employee_restaurant_id());

grant select on public.sales_receipts to authenticated;
grant all on public.sales_receipts to service_role;
grant usage, select on sequence public.sales_receipts_receipt_number_seq to service_role;

create or replace function public.close_table_session(
  p_session_id uuid,
  p_employee_id uuid,
  p_method text
) returns table(session_id uuid, total numeric, closed_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.table_sessions%rowtype;
  v_employee public.employee_profiles%rowtype;
  v_table public.restaurant_tables%rowtype;
  v_closed_at timestamptz := now();
  v_payments jsonb := '[]'::jsonb;
  v_staff jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_voids jsonb := '[]'::jsonb;
  v_receipt_id uuid;
  v_receipt_number bigint;
begin
  select ts.* into v_session
  from public.table_sessions as ts
  where ts.id = p_session_id
  for update;

  if v_session.id is null then raise exception 'session not found'; end if;
  if v_session.status not in ('OPEN','PAYMENT_PENDING') then raise exception 'session already closed'; end if;

  select ep.* into v_employee
  from public.employee_profiles as ep
  where ep.id = p_employee_id;

  if v_employee.id is null
     or v_employee.restaurant_id <> v_session.restaurant_id
     or not v_employee.is_active
     or v_employee.role not in ('CASHIER','MANAGER','ADMIN','OWNER') then
    raise exception 'employee not authorized';
  end if;

  if p_method not in ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','OTHER') then
    raise exception 'invalid payment method';
  end if;

  select rt.* into v_table
  from public.restaurant_tables as rt
  where rt.id = v_session.table_id;

  perform public.recalculate_table_session(v_session.id);
  select ts.* into v_session
  from public.table_sessions as ts
  where ts.id = p_session_id;

  if v_session.total > 0 then
    insert into public.payments(restaurant_id, session_id, method, amount, employee_id)
    values(v_session.restaurant_id, v_session.id, p_method, v_session.total, p_employee_id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'method', p.method,
    'amount', p.amount,
    'created_at', p.created_at
  ) order by p.created_at), '[]'::jsonb)
  into v_payments
  from public.payments as p
  where p.session_id = v_session.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', ep.id,
    'name', ep.name,
    'role', ep.role,
    'linked_at', ss.linked_at
  ) order by ss.linked_at), '[]'::jsonb)
  into v_staff
  from public.session_staff as ss
  join public.employee_profiles as ep on ep.id = ss.employee_id
  where ss.session_id = v_session.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', oi.id,
    'product_name', oi.product_name_snapshot,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price,
    'total_price', oi.total_price,
    'observation', oi.observation,
    'source', oi.source,
    'created_at', oi.created_at
  ) order by oi.created_at), '[]'::jsonb)
  into v_items
  from public.order_items as oi
  where oi.session_id = v_session.id
    and oi.status <> 'CANCELLED';

  select coalesce(jsonb_agg(jsonb_build_object(
    'void_id', iv.id,
    'product_name', iv.product_name_snapshot,
    'quantity', iv.quantity,
    'unit_price', iv.unit_price,
    'total_price', iv.total_price,
    'reason', iv.reason,
    'employee_id', iv.employee_id,
    'employee_name', ep.name,
    'created_at', iv.created_at
  ) order by iv.created_at), '[]'::jsonb)
  into v_voids
  from public.item_voids as iv
  left join public.employee_profiles as ep on ep.id = iv.employee_id
  where iv.session_id = v_session.id;

  update public.table_sessions as ts
  set status = 'CLOSED',
      closed_at = v_closed_at,
      closed_by = p_employee_id
  where ts.id = v_session.id;

  update public.restaurant_tables as rt
  set status = 'AVAILABLE'
  where rt.id = v_session.table_id;

  insert into public.sales_receipts(
    restaurant_id, session_id, table_number, table_label,
    customer_name, customer_whatsapp, opened_at, closed_at,
    subtotal, discount, service_fee, total,
    payment_snapshot, staff_snapshot, items_snapshot, voids_snapshot,
    closed_by_employee_id, closed_by_name
  ) values(
    v_session.restaurant_id, v_session.id, v_table.number, v_table.label,
    v_session.customer_name, nullif(v_session.customer_whatsapp, ''), v_session.opened_at, v_closed_at,
    v_session.subtotal, v_session.discount, v_session.service_fee, v_session.total,
    v_payments, v_staff, v_items, v_voids,
    v_employee.id, v_employee.name
  )
  on conflict on constraint sales_receipts_session_unique do nothing
  returning id, receipt_number into v_receipt_id, v_receipt_number;

  insert into public.audit_logs(
    restaurant_id, actor_employee_id, action, entity_type, entity_id, metadata
  ) values(
    v_session.restaurant_id,
    p_employee_id,
    'TABLE_SESSION_CLOSED',
    'table_session',
    v_session.id,
    jsonb_build_object(
      'payment_method', p_method,
      'total', v_session.total,
      'receipt_id', v_receipt_id,
      'receipt_number', v_receipt_number
    )
  );

  return query select v_session.id, v_session.total, v_closed_at;
end;
$$;

revoke all on function public.close_table_session(uuid,uuid,text) from public;
grant execute on function public.close_table_session(uuid,uuid,text) to service_role;
