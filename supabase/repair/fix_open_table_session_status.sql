-- Hotfix: resolve PL/pgSQL ambiguity between the function output column `status`
-- and table columns named `status` inside open_table_session.
-- Safe to run more than once.

create or replace function public.open_table_session(
  p_table_public_code uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_token_hash text
) returns table(session_id uuid, table_number integer, opened_at timestamptz, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_session public.table_sessions%rowtype;
begin
  select rt.* into v_table
  from public.restaurant_tables as rt
  where rt.public_code = p_table_public_code
    and rt.active = true
  for update;

  if v_table.id is null then
    raise exception 'table not found';
  end if;

  if exists(
    select 1
    from public.table_sessions as ts
    where ts.table_id = v_table.id
      and ts.status in ('OPEN', 'PAYMENT_PENDING')
  ) then
    raise exception 'table already occupied';
  end if;

  insert into public.table_sessions(
    restaurant_id,
    table_id,
    customer_name,
    customer_whatsapp,
    customer_access_token_hash
  )
  values(
    v_table.restaurant_id,
    v_table.id,
    trim(p_customer_name),
    trim(coalesce(p_customer_whatsapp, '')),
    p_token_hash
  )
  returning * into v_session;

  update public.restaurant_tables as rt
  set status = 'OCCUPIED'
  where rt.id = v_table.id;

  return query
  select v_session.id, v_table.number, v_session.opened_at, v_session.status;
end;
$$;

revoke all on function public.open_table_session(uuid, text, text, text) from public;
grant execute on function public.open_table_session(uuid, text, text, text) to service_role;
