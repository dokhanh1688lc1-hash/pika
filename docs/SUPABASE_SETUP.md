# Kết nối Supabase (tắt chế độ demo)

Sau khi làm đủ các bước dưới, dòng cảnh báo "chế độ demo" biến mất, ứng dụng yêu cầu đăng nhập và mọi dữ liệu thuộc cửa hàng của bạn.

## 1. Tạo project Supabase
1. Vào https://supabase.com → **New project**. Chọn region gần Việt Nam (Singapore), đặt mật khẩu database và lưu lại.
2. Đợi project khởi tạo xong (1–2 phút).

## 2. Tạo bảng dữ liệu
1. Trong Supabase mở **SQL Editor → New query**.
2. Dán toàn bộ nội dung file `supabase/setup.sql` → **Run**.
3. Thấy `Success. No rows returned` là xong. File này **chạy lại bao nhiêu lần cũng được** (bỏ qua phần đã có), nên nếu lần trước bị lỗi giữa chừng, cứ chạy lại.
4. Kiểm tra: Table Editor phải có 21 bảng.
5. (Không bắt buộc) `supabase/seed.sql` chỉ dùng cho môi trường thử nghiệm. Bạn không cần chạy vì cửa hàng được tạo ngay khi đăng ký.

## 3. Cấu hình đăng nhập
Vào **Authentication → Providers → Email**:
- Để thử nhanh: tắt **Confirm email** (đăng ký xong dùng được ngay).
- Dùng thật: bật Confirm email, và vào **Authentication → URL Configuration** đặt *Site URL* = địa chỉ app Vercel của bạn.

## 4. Lấy khoá
Vào **Project Settings → API** (hoặc API Keys) và lấy 3 giá trị:

| Biến môi trường (Key trên Vercel) | Lấy ở đâu |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, dạng `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | khoá `anon` / `public` (hoặc *publishable key*) |
| `SUPABASE_SERVICE_ROLE_KEY` | khoá `service_role` / *secret key* — **tuyệt đối bí mật** |

`SUPABASE_SERVICE_ROLE_KEY` bỏ qua mọi phân quyền. Không đưa lên GitHub, không gửi cho ai, không đặt tên bắt đầu bằng `NEXT_PUBLIC_`.

## 5. Khai báo trên Vercel
Project → **Settings → Environment Variables** → thêm 3 biến ở trên (chọn Production, Preview, Development) → **Deployments → Redeploy**.

Kiểm tra: mở `https://<app>.vercel.app/api/health`, thấy `"database":"configured"`.

## 6. Tạo tài khoản và cửa hàng
1. Mở app → tự chuyển tới `/login` → **Tạo tài khoản mới** (email + mật khẩu từ 8 ký tự).
2. Màn hình **Thiết lập cửa hàng**: nhập tên cửa hàng và tên bạn → bạn trở thành *Chủ cửa hàng*.
3. Vào được `/dashboard`. Dữ liệu ban đầu trống (đúng, vì đây là dữ liệu thật của bạn).

## 7. Liên kết Telegram với tài khoản
1. Vào **Cài đặt → Liên kết Telegram → Tạo mã liên kết**.
2. Nhắn cho bot: `/start <mã>`. Bot báo "Liên kết thành công".
3. Từ giờ bot nhận ra bạn là chủ cửa hàng, dùng đúng dữ liệu và quyền của bạn. Không cần `TELEGRAM_ALLOWED_CHAT_IDS` nữa.

Nhân viên khác: họ tạo tài khoản rồi bạn thêm họ vào cửa hàng (màn hình quản lý nhân viên sẽ có ở giai đoạn 2; hiện tại thêm bằng SQL, bảng `staff`, cột `user_id` là id trong Authentication → Users).

## Cảnh báo hạn sử dụng
1. Chạy lại `supabase/setup.sql` (bản mới thêm bảng lô hàng và các hàm xử lý hạn dùng).
2. Khi **nhập kho** hoặc nhập **tồn đầu** cho sản phẩm, điền ô *Hạn sử dụng* (và *Số lô* nếu có). Hàng không điền hạn thì không bị theo dõi.
3. Xem tại mục **Hạn sử dụng** (menu trái), ô cảnh báo trên Tổng quan, hoặc nhắn bot `/hethan`.
4. Tin nhắn tự động mỗi ngày 08:00 (giờ Việt Nam): thêm biến `CRON_SECRET` trên Vercel (một chuỗi ngẫu nhiên dài, chỉ chữ và số) rồi Redeploy. Chỉ chủ cửa hàng, quản lý và thủ kho đã liên kết Telegram mới nhận tin.
5. Số ngày báo trước mặc định 30; đổi bằng biến `EXPIRY_ALERT_DAYS`.
6. Hàng đã hết hạn **không bán được** ở POS. Vào mục Hạn sử dụng bấm **Huỷ lô** để trừ khỏi tồn kho.

## Cập nhật khi có phiên bản mới (quan trọng)
Mỗi khi `supabase/setup.sql` thay đổi (ví dụ giai đoạn 2 thêm hàm bán hàng và nhập kho), hãy **dán lại toàn bộ file và Run** trong SQL Editor. File chạy lại an toàn, không xoá dữ liệu.
Nếu bỏ qua bước này, POS và nhập kho sẽ báo lỗi kiểu `Could not find the function public.create_pos_order`.

## Lỗi thường gặp
| Hiện tượng | Nguyên nhân |
|---|---|
| Vẫn thấy dòng demo | Thiếu một trong 3 biến, hoặc chưa Redeploy |
| Đăng ký xong không vào được | Đang bật Confirm email: mở email xác nhận trước |
| "Không tạo được cửa hàng: ..." | Chưa chạy `setup.sql`, hoặc `SUPABASE_SERVICE_ROLE_KEY` sai |
| "Could not find the function ..." khi bán hàng hoặc nhập kho | Chưa chạy lại `setup.sql` bản mới |
| Trang trắng / lỗi 500 sau khi cấu hình | Xem Vercel → Logs, gửi lỗi cho người phát triển |
