-- Admin/catalog incremental migration.
-- Apply after 001 + 002. This file does not recreate existing policies.

alter table public.restaurant_tables
  add column if not exists label text,
  add column if not exists seats integer check (seats is null or seats > 0);

alter table public.products
  add column if not exists sort_order integer not null default 0;

create unique index if not exists one_owner_per_restaurant
  on public.employee_profiles(restaurant_id)
  where role = 'OWNER';

create index if not exists idx_products_restaurant_active_sort
  on public.products(restaurant_id, active, sort_order, name);

create index if not exists idx_categories_restaurant_active_sort
  on public.categories(restaurant_id, active, sort_order, name);

create index if not exists idx_employee_profiles_restaurant_role_active
  on public.employee_profiles(restaurant_id, role, is_active);

comment on column public.restaurant_tables.label is 'Nome opcional para exibição, ex.: Varanda, Salão, Mesa VIP.';
comment on column public.restaurant_tables.seats is 'Quantidade opcional de lugares da mesa.';
