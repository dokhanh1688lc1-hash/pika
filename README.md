# Beauty AI Manager

Phần mềm quản lý kinh doanh cho ngành làm đẹp (spa, salon, mỹ phẩm) theo hướng tương đương KiotViet: bán hàng POS, kho, khách hàng, lịch hẹn, nhân viên, báo cáo — tích hợp **Web App**, **Telegram Bot** và **AI Agent**.

## Công nghệ

| Lớp | Lựa chọn |
|---|---|
| Web App | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 3 |
| CSDL / Auth | Supabase (Postgres, Row Level Security, Auth) |
| Telegram Bot | Webhook chạy trên Vercel (`/api/telegram/webhook`) |
| AI Agent | Anthropic SDK, tool-calling, mặc định chỉ đọc dữ liệu |
| Hosting | Vercel (region `sin1`) |
| CI | GitHub Actions (typecheck + build) |

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền biến môi trường (có thể bỏ trống để chạy chế độ demo)
npm run dev                  # http://localhost:3000
```

Chưa cấu hình Supabase thì app tự chạy **chế độ demo** với dữ liệu mẫu.

## Thiết lập CSDL

1. Tạo project Supabase.
2. Chạy `supabase/migrations/0001_init.sql` trong SQL Editor (hoặc `supabase db push`).
3. (Tuỳ chọn) chạy `supabase/seed.sql`, rồi đặt `DEFAULT_STORE_ID=00000000-0000-0000-0000-000000000001`.
4. Điền `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Telegram Bot

1. Tạo bot với @BotFather, lấy token → `TELEGRAM_BOT_TOKEN`.
2. Đặt `TELEGRAM_WEBHOOK_SECRET` là chuỗi ngẫu nhiên dài.
3. Sau khi deploy: `APP_URL=https://<app>.vercel.app npm run telegram:webhook`.
4. Lệnh: `/doanhthu`, `/tonkho`, `/help`, hoặc nhắn tự nhiên để hỏi AI Agent.

Chỉ chat đã liên kết (`telegram_links`) hoặc nằm trong `TELEGRAM_ALLOWED_CHAT_IDS` mới dùng được bot.

## Deploy lên Vercel

```bash
npm i -g vercel
vercel link
vercel env add ...   # thêm các biến trong .env.example
vercel --prod
```

Hoặc import repo GitHub vào Vercel (Framework: Next.js) và khai báo biến môi trường trong Project Settings.

## Lộ trình

- **Giai đoạn 1 (hiện tại):** khung dự án, schema, RBAC, các màn hình đọc dữ liệu, webhook Telegram, AI Agent chỉ đọc.
- **Giai đoạn 2:** đăng nhập Supabase + middleware, POS đầy đủ (giỏ hàng, thanh toán, in hoá đơn), nhập kho/kiểm kho/chuyển kho, công nợ, sổ quỹ.
- **Giai đoạn 3:** lịch hẹn kéo-thả + nhắc hẹn Telegram, liệu trình, hoa hồng, tích điểm/hạng thành viên.
- **Giai đoạn 4:** AI Agent có thao tác ghi (có bước xác nhận), báo cáo thông minh, đa chi nhánh, ứng dụng PWA/offline.

Chi tiết kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
