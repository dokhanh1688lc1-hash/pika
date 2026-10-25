-- Dữ liệu mẫu để phát triển. Chạy sau 0001_init.sql.
-- Sau khi chạy, đặt DEFAULT_STORE_ID = id của cửa hàng bên dưới.
insert into stores (id, name) values ('00000000-0000-0000-0000-000000000001', 'Beauty Demo');
insert into branches (id, store_id, name, is_default)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'Chi nhánh chính', true);

insert into product_categories (store_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Chăm sóc da'),
  ('00000000-0000-0000-0000-000000000001', 'Spa');

insert into products (store_id, sku, name, kind, price, cost, min_stock, category_id)
select '00000000-0000-0000-0000-000000000001', 'SP001', 'Serum Vitamin C 30ml', 'goods', 450000, 220000, 10, id
from product_categories where name = 'Chăm sóc da';

insert into inventory_levels (product_id, branch_id, store_id, quantity)
select id, '00000000-0000-0000-0000-0000000000b1', store_id, 24 from products where sku = 'SP001';
