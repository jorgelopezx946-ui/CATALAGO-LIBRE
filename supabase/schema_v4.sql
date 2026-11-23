-- CATÁLOGO PRO 3D V4 · Supabase / PostgreSQL
-- Ejecutar en Supabase SQL Editor con una cuenta propietaria del proyecto.
-- Nunca incluir la service_role key en la aplicación web, EXE o APK.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer','seller','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_catalog_admin() returns boolean
language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  whatsapp text,
  description text not null default '',
  status text not null default 'active' check (status in ('active','paused','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null default 'Otros',
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  sizes text,
  colors text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(key,value)
values ('commission_rate','8'::jsonb)
on conflict (key) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  buyer_name text not null,
  buyer_phone text not null,
  delivery_address text not null,
  notes text not null default '',
  subtotal numeric(12,2) not null default 0,
  commission_total numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','preparing','shipped','delivered','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  store_id uuid not null references public.stores(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  commission_rate numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  seller_net numeric(12,2) not null
);

create index if not exists products_store_id_idx on public.products(store_id);
create index if not exists products_active_idx on public.products(active);
create index if not exists order_items_store_id_idx on public.order_items(store_id);
create index if not exists orders_buyer_id_idx on public.orders(buyer_id);

-- Crea perfil seguro y tienda automáticamente cuando el usuario se registra como seller.
-- El cliente nunca puede asignarse el rol admin mediante metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  chosen_role text;
  store_name text;
  store_slug text;
begin
  chosen_role := case when new.raw_user_meta_data->>'role' = 'seller' then 'seller' else 'customer' end;
  insert into public.profiles(id, full_name, phone, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.phone, chosen_role)
  on conflict (id) do nothing;
  if chosen_role = 'seller' then
    store_name := coalesce(nullif(trim(new.raw_user_meta_data->>'store_name'),''), 'Tienda nueva');
    store_slug := trim(both '-' from regexp_replace(lower(store_name), '[^a-z0-9]+', '-', 'g')) || '-' || substr(new.id::text,1,8);
    insert into public.stores(owner_id,name,slug)
    values(new.id,store_name,store_slug)
    on conflict(owner_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_catalogo on auth.users;
create trigger on_auth_user_created_catalogo
after insert on auth.users for each row execute procedure public.handle_new_user();

-- RPC transaccional: el servidor verifica inventario y precio y calcula comisión.
create or replace function public.place_order(
  p_buyer_name text,
  p_buyer_phone text,
  p_delivery_address text,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_order_id uuid;
  v_rate numeric(5,2);
  v_subtotal numeric(12,2) := 0;
  v_commission numeric(12,2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_line numeric(12,2);
  v_fee numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'El carrito está vacío.'; end if;
  select coalesce((value #>> '{}')::numeric,8) into v_rate from public.platform_settings where key='commission_rate';
  v_rate := coalesce(v_rate,8);
  if v_rate < 0 or v_rate > 50 then raise exception 'Comisión de plataforma no válida.'; end if;

  insert into public.orders(buyer_id,buyer_name,buyer_phone,delivery_address,notes)
  values(auth.uid(),p_buyer_name,p_buyer_phone,p_delivery_address,coalesce(p_notes,''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer,0));
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and active=true for update;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    if v_product.stock < v_qty then raise exception 'Existencias insuficientes para %.',v_product.name; end if;
    if not exists(select 1 from public.stores where id=v_product.store_id and status='active') then raise exception 'La tienda no está disponible.'; end if;
    v_line := v_product.price * v_qty;
    v_fee := round(v_line * v_rate / 100,2);
    insert into public.order_items(order_id,product_id,store_id,product_name,quantity,unit_price,commission_rate,commission_amount,seller_net)
    values(v_order_id,v_product.id,v_product.store_id,v_product.name,v_qty,v_product.price,v_rate,v_fee,v_line-v_fee);
    update public.products set stock=stock-v_qty,updated_at=now() where id=v_product.id;
    v_subtotal := v_subtotal + v_line;
    v_commission := v_commission + v_fee;
  end loop;
  update public.orders set subtotal=v_subtotal,commission_total=v_commission where id=v_order_id;
  return v_order_id;
end;
$$;
revoke all on function public.place_order(text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,jsonb) to authenticated;

-- RLS: todas las tablas privadas quedan protegidas por defecto.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.platform_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select to authenticated using (id=auth.uid() or public.is_catalog_admin());
-- No se permite modificar role desde el cliente. Los cambios de rol se realizan desde el panel seguro/SQL.

drop policy if exists "stores public active or owner" on public.stores;
create policy "stores public active or owner" on public.stores for select using (status='active' or owner_id=auth.uid() or public.is_catalog_admin());
drop policy if exists "seller creates own store" on public.stores;
create policy "seller creates own store" on public.stores for insert to authenticated with check(owner_id=auth.uid() and exists(select 1 from public.profiles me where me.id=auth.uid() and me.role='seller'));
drop policy if exists "seller updates own store" on public.stores;
create policy "seller updates own store" on public.stores for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());

 drop policy if exists "products public active or owner" on public.products;
create policy "products public active or owner" on public.products for select using((active=true and exists(select 1 from public.stores visible_store where visible_store.id=store_id and visible_store.status='active')) or exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()) or public.is_catalog_admin());
drop policy if exists "seller inserts own products" on public.products;
create policy "seller inserts own products" on public.products for insert to authenticated with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "seller updates own products" on public.products;
create policy "seller updates own products" on public.products for update to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
drop policy if exists "seller deletes own products" on public.products;
create policy "seller deletes own products" on public.products for delete to authenticated using(exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));

-- Los ajustes de comisión no son modificables desde el cliente. El propietario los administra desde SQL/servidor.
drop policy if exists "settings public read" on public.platform_settings;
create policy "settings public read" on public.platform_settings for select using(key='commission_rate');

drop policy if exists "buyer or seller reads relevant orders" on public.orders;
create policy "buyer or seller reads relevant orders" on public.orders for select to authenticated using(buyer_id=auth.uid() or exists(select 1 from public.order_items oi join public.stores s on s.id=oi.store_id where oi.order_id=id and s.owner_id=auth.uid()) or public.is_catalog_admin());
drop policy if exists "buyer reads and seller reads relevant items" on public.order_items;
create policy "buyer reads and seller reads relevant items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.buyer_id=auth.uid()) or exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()) or public.is_catalog_admin());

-- Estado de pedidos: actualización restringida mediante RPC, no UPDATE directo del cliente.
create or replace function public.set_order_status(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'No autorizado.'; end if;
  if p_status not in ('pending','confirmed','preparing','shipped','delivered','cancelled') then raise exception 'Estado no válido.'; end if;
  if not (public.is_catalog_admin() or exists(
    select 1 from public.order_items oi join public.stores s on s.id=oi.store_id
    where oi.order_id=p_order_id and s.owner_id=auth.uid()
  )) then raise exception 'No tienes permiso para modificar este pedido.'; end if;
  update public.orders set status=p_status where id=p_order_id;
  if not found then raise exception 'Pedido no encontrado.'; end if;
end;
$$;
revoke all on function public.set_order_status(uuid,text) from public;
grant execute on function public.set_order_status(uuid,text) to authenticated;

-- Para asignar el primer superadministrador, hacerlo manualmente desde SQL seguro:
-- update public.profiles set role='admin' where id='UUID_DEL_USUARIO';
-- Nunca exponer la service_role key en frontend.
