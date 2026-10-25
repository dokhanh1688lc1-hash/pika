-- Beauty AI Manager — CÀI ĐẶT CSDL (an toàn khi chạy lại nhiều lần)
-- Dán toàn bộ file này vào Supabase > SQL Editor > Run.
-- Đã có bảng/kiểu nào thì bỏ qua, chỉ tạo phần còn thiếu; không xoá dữ liệu.

-- Schema nền tảng (multi-tenant, RLS)
-- Mọi bảng nghiệp vụ đều có store_id; người dùng chỉ thấy dữ liệu cửa hàng của mình.

create extension if not exists "pgcrypto";

-- ============ Enums ============
do $$ begin
  create type user_role as enum ('owner','manager','cashier','technician','stock_keeper');
exception when duplicate_object then null; end $$;
do $$ begin
  create type product_kind as enum ('goods','service','package');
exception when duplicate_object then null; end $$;
do $$ begin
  create type order_status as enum ('draft','paid','partial','refunded','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_method as enum ('cash','card','transfer','ewallet','points','package');
exception when duplicate_object then null; end $$;
do $$ begin
  create type appointment_status as enum ('booked','in_progress','done','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type stock_move_type as enum ('purchase','sale','adjust','transfer_in','transfer_out','return');
exception when duplicate_object then null; end $$;
do $$ begin
  create type customer_tier as enum ('Thường','Bạc','Vàng','Kim cương');
exception when duplicate_object then null; end $$;

-- ============ Cửa hàng & người dùng ============
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  address text,
  is_default boolean not null default false
);

-- Liên kết auth.users <-> cửa hàng + vai trò (hồ sơ nhân viên)
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text,
  role user_role not null default 'cashier',
  commission_rate numeric(5,4) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ Danh mục ============
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  unique (store_id, name)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  category_id uuid references product_categories(id) on delete set null,
  sku text not null,
  barcode text,
  name text not null,
  kind product_kind not null default 'goods',
  price numeric(14,0) not null default 0,
  cost numeric(14,0) not null default 0,
  min_stock integer not null default 0,
  duration_min integer,                 -- thời lượng (dịch vụ)
  package_sessions integer,             -- số buổi (liệu trình)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, sku)
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  phone text,
  debt numeric(14,0) not null default 0
);

-- ============ Kho ============
create table if not exists inventory_levels (
  product_id uuid not null references products(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  quantity integer not null default 0,
  primary key (product_id, branch_id)
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  branch_id uuid not null references branches(id),
  product_id uuid not null references products(id),
  type stock_move_type not null,
  quantity integer not null,            -- dương = nhập, âm = xuất
  unit_cost numeric(14,0),
  ref_type text,
  ref_id uuid,
  note text,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  branch_id uuid not null references branches(id),
  supplier_id uuid references suppliers(id),
  code text not null,
  total numeric(14,0) not null default 0,
  paid numeric(14,0) not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, code)
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null,
  unit_cost numeric(14,0) not null
);

-- ============ Khách hàng & tích điểm ============
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  birthday date,
  note text,
  tier customer_tier not null default 'Thường',
  points integer not null default 0,
  total_spent numeric(14,0) not null default 0,
  last_visit_at date,
  created_at timestamptz not null default now(),
  unique (store_id, phone)
);

create table if not exists loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  points integer not null,              -- dương = cộng, âm = dùng
  reason text,
  order_id uuid,
  created_at timestamptz not null default now()
);

-- Liệu trình khách đã mua
create table if not exists customer_packages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id),
  sessions_total integer not null,
  sessions_used integer not null default 0,
  expires_at date,
  created_at timestamptz not null default now()
);

-- ============ Bán hàng ============
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  branch_id uuid not null references branches(id),
  code text not null,
  customer_id uuid references customers(id),
  cashier_id uuid references staff(id),
  status order_status not null default 'draft',
  subtotal numeric(14,0) not null default 0,
  discount numeric(14,0) not null default 0,
  total numeric(14,0) not null default 0,
  note text,
  source text not null default 'pos',   -- pos | telegram | web
  created_at timestamptz not null default now(),
  unique (store_id, code)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  staff_id uuid references staff(id),   -- kỹ thuật viên thực hiện (tính hoa hồng)
  quantity integer not null default 1,
  unit_price numeric(14,0) not null,
  discount numeric(14,0) not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  method payment_method not null,
  amount numeric(14,0) not null,
  created_at timestamptz not null default now()
);

create table if not exists cash_transactions (        -- sổ quỹ
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  branch_id uuid references branches(id),
  amount numeric(14,0) not null,        -- dương = thu, âm = chi
  reason text,
  created_at timestamptz not null default now()
);

-- ============ Lịch hẹn ============
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  branch_id uuid references branches(id),
  customer_id uuid not null references customers(id),
  product_id uuid not null references products(id),
  staff_id uuid references staff(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status appointment_status not null default 'booked',
  note text,
  created_at timestamptz not null default now()
);

-- ============ Telegram & AI ============
create table if not exists telegram_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  chat_id bigint unique,
  link_code text unique,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  staff_id uuid references staff(id),
  channel text not null,                -- web | telegram
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  store_id uuid not null references stores(id) on delete cascade,
  actor_id uuid references staff(id),
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ============ Index ============
create index if not exists idx_products_store_id_name on products (store_id, name);
create index if not exists idx_customers_store_id_name on customers (store_id, name);
create index if not exists idx_orders_store_id_created_at on orders (store_id, created_at desc);
create index if not exists idx_order_items_order_id on order_items (order_id);
create index if not exists idx_appointments_store_id_starts_at on appointments (store_id, starts_at);
create index if not exists idx_stock_movements_store_id_product_id_created_at on stock_movements (store_id, product_id, created_at desc);

-- ============ Views phục vụ UI / Bot / AI ============
create or replace view v_products with (security_invoker = true) as
select p.store_id, p.id, p.sku, p.name, p.kind, coalesce(c.name,'') as category,
       p.price, p.cost, p.min_stock,
       case when p.kind = 'goods'
            then coalesce((select sum(i.quantity) from inventory_levels i where i.product_id = p.id), 0)
       end as stock
from products p left join product_categories c on c.id = p.category_id
where p.active;

create or replace view v_daily_revenue with (security_invoker = true) as
select store_id, (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
       sum(total) as revenue, count(*) as orders
from orders where status in ('paid','partial')
group by 1, 2;

create or replace view v_appointments with (security_invoker = true) as
select a.store_id, a.id, a.starts_at, c.name as customer, p.name as service,
       coalesce(s.name,'') as staff, a.status
from appointments a
join customers c on c.id = a.customer_id
join products p on p.id = a.product_id
left join staff s on s.id = a.staff_id;

create or replace view v_staff_performance with (security_invoker = true) as
select s.store_id, s.id, s.name, s.role::text as role, s.commission_rate,
       coalesce(sum(oi.quantity * oi.unit_price - oi.discount) filter (
         where o.status in ('paid','partial')
           and o.created_at >= date_trunc('month', now())), 0) as month_revenue
from staff s
left join order_items oi on oi.staff_id = s.id
left join orders o on o.id = oi.order_id
group by s.id;

-- ============ RLS ============
create or replace function current_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from staff where user_id = auth.uid() and active limit 1
$$;

create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from staff where user_id = auth.uid() and active limit 1
$$;

do $$
declare t text;
begin
  -- Bảng có store_id: chỉ truy cập được dữ liệu cửa hàng của mình
  foreach t in array array[
    'branches','staff','product_categories','products','suppliers','inventory_levels',
    'stock_movements','purchase_orders','customers','loyalty_transactions','customer_packages',
    'orders','payments','cash_transactions','appointments','telegram_links','ai_conversations','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I for all to authenticated
         using (store_id = current_store_id()) with check (store_id = current_store_id())', t);
  end loop;
end $$;

alter table stores enable row level security;
drop policy if exists store_self on stores;
create policy store_self on stores for select to authenticated using (id = current_store_id());

alter table order_items enable row level security;
drop policy if exists tenant_isolation on order_items;
create policy tenant_isolation on order_items for all to authenticated
  using (exists (select 1 from orders o where o.id = order_id and o.store_id = current_store_id()));

alter table purchase_order_items enable row level security;
drop policy if exists tenant_isolation on purchase_order_items;
create policy tenant_isolation on purchase_order_items for all to authenticated
  using (exists (select 1 from purchase_orders o where o.id = purchase_order_id and o.store_id = current_store_id()));

-- Chỉ owner/manager được sửa hồ sơ nhân viên (ghi đè policy chung bằng policy chặt hơn)
drop policy if exists tenant_isolation on staff;
drop policy if exists staff_read on staff;
create policy staff_read on staff for select to authenticated using (store_id = current_store_id());
drop policy if exists staff_write on staff;
create policy staff_write on staff for all to authenticated
  using (store_id = current_store_id() and current_role_name() in ('owner','manager'))
  with check (store_id = current_store_id() and current_role_name() in ('owner','manager'));
