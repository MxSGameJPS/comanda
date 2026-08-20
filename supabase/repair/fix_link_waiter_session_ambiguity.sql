-- Hotfix: resolve PL/pgSQL ambiguity between the function output column `session_id`
-- and the `session_staff.session_id` column used by ON CONFLICT.
-- Safe to run more than once.

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
  select ep.* into v_employee
  from public.employee_profiles as ep
  where ep.id = p_employee_id
    and ep.is_active = true
    and (ep.active_from is null or ep.active_from <= now())
    and (ep.active_until is null or ep.active_until > now());

  if v_employee.id is null then
    raise exception 'inactive employee';
  end if;

  if v_employee.role not in ('WAITER','MANAGER','ADMIN','OWNER') then
    raise exception 'employee role cannot link tables';
  end if;

  select rt.* into v_table
  from public.restaurant_tables as rt
  where rt.public_code = p_table_public_code
    and rt.restaurant_id = v_employee.restaurant_id
    and rt.active = true;

  if v_table.id is null then
    raise exception 'table not found';
  end if;

  select ts.* into v_session
  from public.table_sessions as ts
  where ts.table_id = v_table.id
    and ts.restaurant_id = v_employee.restaurant_id
    and ts.status in ('OPEN','PAYMENT_PENDING')
  order by ts.opened_at desc
  limit 1;

  if v_session.id is null then
    raise exception 'table has no active session';
  end if;

  insert into public.session_staff(session_id, employee_id)
  values(v_session.id, v_employee.id)
  on conflict on constraint session_staff_pkey do nothing;

  insert into public.audit_logs(
    restaurant_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values(
    v_employee.restaurant_id,
    v_employee.id,
    'WAITER_LINKED',
    'table_session',
    v_session.id,
    jsonb_build_object('table_id', v_table.id, 'table_number', v_table.number)
  );

  return query
  select v_session.id, v_table.number;
end;
$$;

revoke all on function public.link_waiter_session(uuid, uuid) from public;
grant execute on function public.link_waiter_session(uuid, uuid) to service_role;
