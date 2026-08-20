-- Repair helper for a partially/repeatedly executed initial migration.
-- Run this file once in the Supabase SQL Editor, then rerun
-- supabase/migrations/202608200001_initial_schema.sql from the beginning.
--
-- DROP POLICY IF EXISTS is safe even when some policies were never created.

drop policy if exists "staff can read own profile" on public.employee_profiles;
drop policy if exists "staff can read own restaurant" on public.restaurants;
drop policy if exists "staff can read restaurant tables" on public.restaurant_tables;
drop policy if exists "staff can read categories" on public.categories;
drop policy if exists "staff can read prep stations" on public.prep_stations;
drop policy if exists "staff can read products" on public.products;
drop policy if exists "staff can read sessions" on public.table_sessions;
drop policy if exists "staff can read session staff" on public.session_staff;
drop policy if exists "staff can read orders" on public.orders;
drop policy if exists "staff can read order items" on public.order_items;
drop policy if exists "staff can read payments" on public.payments;
drop policy if exists "staff can read item voids" on public.item_voids;
drop policy if exists "staff can read cash shifts" on public.cash_shifts;
drop policy if exists "staff can read cash movements" on public.cash_movements;
drop policy if exists "staff can read audit logs" on public.audit_logs;
