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

Hướng dẫn từng bước (có hình thức cho người mới): [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Tóm tắt:

1. Tạo project Supabase.
2. Chạy `supabase/setup.sql` trong SQL Editor (chạy lại nhiều lần vẫn an toàn). Dùng Supabase CLI thì dùng `supabase/migrations/0001_init.sql`.
3. Điền `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, deploy lại, rồi đăng ký tài khoản đầu tiên (app tự dẫn tới bước tạo cửa hàng).

## Telegram Bot

1. Tạo bot với @BotFather, lấy token → `TELEGRAM_BOT_TOKEN`.
2. Đặt `TELEGRAM_WEBHOOK_SECRET` là chuỗi ngẫu nhiên dài.
3. Sau khi deploy: `APP_URL=https://<app>.vercel.app npm run telegram:webhook`.
4. Lệnh: `/doanhthu`, `/tonkho`, `/help`, hoặc nhắn tự nhiên để hỏi AI Agent.

Có database: vào Cài đặt → Tạo mã liên kết → nhắn bot `/start <mã>`; bot dùng đúng cửa hàng và quyền của nhân viên. Chưa có database: thêm chat id vào `TELEGRAM_ALLOWED_CHAT_IDS`.

## Deploy lên Vercel

```bash
npm i -g vercel
vercel link
vercel env add ...   # thêm các biến trong .env.example
vercel --prod
```

Hoặc import repo GitHub vào Vercel (Framework: Next.js) và khai báo biến môi trường trong Project Settings.

## Lộ trình

- **Giai đoạn 1 (xong):** khung dự án, schema, RBAC, các màn hình đọc dữ liệu, webhook Telegram, AI Agent chỉ đọc.
- **Giai đoạn 1.5 (xong):** đăng nhập Supabase, tạo cửa hàng, dữ liệu theo từng cửa hàng, liên kết Telegram theo nhân viên.
- **Giai đoạn 2a (xong):** form thêm sản phẩm/khách hàng/nhân viên, nhập kho và kiểm kho, POS thật (giỏ hàng, thanh toán, trừ kho, tích điểm, lên hạng, sổ quỹ), danh sách đơn hàng.
- **Giai đoạn 2b:** sửa/xoá dữ liệu, in hoá đơn, thu nợ đơn còn nợ, hoàn/huỷ đơn, chuyển kho, nhà cung cấp và phiếu nhập, cấp tài khoản cho nhân viên.
- **Giai đoạn 3:** lịch hẹn kéo-thả + nhắc hẹn Telegram, liệu trình, hoa hồng, tích điểm/hạng thành viên.
- **Giai đoạn 4:** AI Agent có thao tác ghi (có bước xác nhận), báo cáo thông minh, đa chi nhánh, ứng dụng PWA/offline.

Chi tiết kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
