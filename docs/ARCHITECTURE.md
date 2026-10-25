# Kiến trúc Beauty AI Manager

## Tổng quan

```
 Web App (Next.js)  ─┐
 Telegram Bot ───────┼─►  Lớp dữ liệu src/lib/data/repo.ts  ─►  Supabase (Postgres + RLS)
 AI Agent (tools) ───┘            ▲
                                  └── một nguồn sự thật cho UI, bot và AI
```

Cả ba kênh dùng chung một lớp truy cập dữ liệu (`repo.ts`), nên số liệu luôn nhất quán và dễ kiểm soát quyền.

## Module nghiệp vụ (so với KiotViet)

| Module | Bảng chính | Trạng thái |
|---|---|---|
| Hàng hoá, dịch vụ, liệu trình | `products`, `product_categories` | Schema + màn hình danh sách |
| Kho nhiều chi nhánh | `branches`, `inventory_levels`, `stock_movements`, `purchase_orders` | Schema + màn hình tồn kho |
| Bán hàng POS | `orders`, `order_items`, `payments` | Schema + khung giao diện |
| Khách hàng, tích điểm, hạng | `customers`, `loyalty_transactions`, `customer_packages` | Schema + danh sách |
| Lịch hẹn | `appointments` | Schema + danh sách hôm nay |
| Nhân viên, hoa hồng | `staff`, `order_items.staff_id` | Schema + bảng hiệu suất |
| Nhà cung cấp, công nợ | `suppliers`, `purchase_orders` | Schema |
| Sổ quỹ | `cash_transactions` | Schema |
| Telegram / AI | `telegram_links`, `ai_conversations`, `audit_logs` | Webhook + agent chỉ đọc |

## Bảo mật

- **Multi-tenant:** mọi bảng có `store_id`; RLS giới hạn theo `current_store_id()` của người dùng đăng nhập.
- **Phân quyền:** vai trò `owner/manager/cashier/technician/stock_keeper`; ma trận quyền ở `src/lib/rbac.ts`, quyền ghi hồ sơ nhân viên chặn ở mức RLS.
- **Service-role key** chỉ dùng phía server (`src/lib/supabase/admin.ts`), bỏ qua RLS nên mọi truy vấn phải lọc `store_id`.
- **Telegram:** xác thực header `X-Telegram-Bot-Api-Secret-Token`; chat phải được liên kết với nhân viên.
- **AI Agent:** chỉ có công cụ đọc. Khi thêm công cụ ghi, bắt buộc: (1) kiểm tra quyền của người gọi, (2) bước xác nhận rõ ràng của người dùng, (3) ghi `audit_logs`.

## Việc cần làm trước khi chạy production

1. `/api/ai/chat` hiện chưa kiểm tra phiên đăng nhập (có `TODO(auth)`): thêm Supabase Auth + middleware trước khi mở công khai, nếu không bất kỳ ai cũng gọi được AI Agent và tốn chi phí API.
2. `repo.ts` dùng `DEFAULT_STORE_ID`: thay bằng store của người dùng đang đăng nhập (hoặc của chat Telegram đã liên kết).
3. Thêm rate limit cho webhook và `/api/ai/chat`.
4. Sinh kiểu TypeScript từ schema: `supabase gen types typescript`.
