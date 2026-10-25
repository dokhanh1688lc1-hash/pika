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

## Ảnh sản phẩm
1. Chạy lại `supabase/setup.sql` (thêm cột `image_url`).
2. Vào **Hàng hoá & dịch vụ**: chọn ảnh khi thêm sản phẩm, hoặc bấm tên sản phẩm để đổi / xoá ảnh, sửa thông tin, ngừng bán.
3. Ảnh được nén về tối đa 900px (WEBP) ngay trên trình duyệt, giới hạn 2MB. Kho lưu trữ `product-images` tự tạo ở lần tải đầu tiên (không cần làm gì trong Supabase).
4. Ảnh hiện ở danh sách sản phẩm và thẻ sản phẩm trong POS.

## Giai đoạn 2b: công nợ, hoàn/huỷ, nhập hàng, chuyển kho
1. **Chạy lại `supabase/setup.sql`** (thêm view `v_orders`, `v_suppliers` và các hàm `pay_order_debt`, `void_order`, `transfer_stock`, `create_purchase`, `pay_supplier`).
2. **Đơn hàng → bấm mã đơn**: xem và **in hoá đơn** (khổ hẹp kiểu bill), **thu nợ** từng phần cho đơn còn thiếu tiền, **hoàn tiền / huỷ đơn** (nhập lại kho, trả tiền theo hình thức đã thu, thu hồi điểm). Liệu trình khách đã dùng buổi thì không hoàn được. Lọc "Còn nợ" hoặc bấm ô **Khách còn nợ** ở Tổng quan để xem tổng phải thu.
3. **Nhà cung cấp** và **Phiếu nhập hàng**: một phiếu nhập nhiều sản phẩm (có hạn dùng / số lô), tự cộng kho; phần chưa trả được ghi vào công nợ nhà cung cấp, trả nợ ở trang Nhà cung cấp. Tiền chi ghi vào sổ quỹ.
4. **Chuyển kho**: cần ít nhất 2 chi nhánh (chủ cửa hàng thêm ở trang Chuyển kho). Lô cận date chuyển trước và giữ nguyên hạn dùng.
5. **Xoá nhân viên** (trang Nhân viên): nhân viên chưa có lịch sử thì xoá hẳn; đã có đơn / lịch hẹn thì chuyển sang "ngừng hoạt động" để giữ báo cáo cũ. Không xoá được chủ cửa hàng hoặc chính mình.

## Mã QR, hạn lô, tài khoản nhân viên, sửa khách hàng
1. **Chạy lại `supabase/setup.sql`** (thêm cột ngân hàng cho cửa hàng).
2. **Mã QR thanh toán**: Cài đặt → "Cửa hàng & thanh toán QR" → chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản. Sau khi bấm Thanh toán ở POS sẽ hiện hộp thoại có mã QR VietQR (đúng số tiền, nội dung là mã đơn) và nút **In hoá đơn**. Mã QR tải từ img.vietqr.io nên máy cần có internet.
3. **Sửa lô**: mục Hạn sử dụng → bấm "Sửa" ở từng lô để đổi hạn dùng / số lô (nhập nhầm). Đổi số lượng dùng Kiểm kho.
4. **Cấp tài khoản nhân viên**: trang Nhân viên → "Cấp tài khoản" → nhập email + mật khẩu (từ 8 ký tự), gửi cho nhân viên. Họ đăng nhập tại trang đăng nhập và chỉ có quyền theo vai trò. Có thể đổi mật khẩu hoặc thu hồi tài khoản. Xoá nhân viên sẽ xoá luôn tài khoản đăng nhập.
5. **Khách hàng**: bấm tên khách để xem lịch sử mua, sửa thông tin hoặc xoá (chỉ xoá được khách chưa có đơn / lịch hẹn và không còn liệu trình dở).

## Báo cáo, lịch hẹn, nhóm hàng
1. **Chạy lại `supabase/setup.sql`** (thêm hàm `report_summary`). Sau khi cập nhật code cần `npm install` vì có thêm thư viện `exceljs` (Vercel tự cài khi build).
2. **Báo cáo**: chọn Hôm nay / 7 ngày / Tháng này / Tháng trước hoặc khoảng ngày bất kỳ (tối đa 366 ngày). Có doanh thu, giá vốn, lợi nhuận gộp, hoa hồng nhân viên, sản phẩm bán chạy. Nút **Xuất Excel** tải file .xlsx gồm 5 trang (Tổng quan, Theo ngày, Sản phẩm, Hoa hồng, Đơn hàng). Giá vốn tính theo giá vốn hiện tại của sản phẩm.
3. **Lịch hẹn**: đặt lịch, sửa giờ / dịch vụ / nhân viên, đổi trạng thái (Bắt đầu, Hoàn thành, Huỷ, Đặt lại) và xoá. Một nhân viên không thể có hai lịch chồng giờ (thời lượng lấy theo dịch vụ, mặc định 60 phút).
4. **Nhóm hàng**: trang Hàng hoá & dịch vụ → "Quản lý nhóm hàng" để đổi tên hoặc xoá nhóm (sản phẩm trong nhóm chuyển sang chưa phân nhóm).

## Telegram: bot không trả lời
1. Trên Vercel phải có `TELEGRAM_BOT_TOKEN` (từ @BotFather) và `TELEGRAM_WEBHOOK_SECRET` (chỉ chữ, số, `_`, `-`), sau đó Redeploy.
2. Đăng nhập web bằng tài khoản chủ cửa hàng → **Cài đặt → Telegram Bot — trạng thái & đăng ký webhook** → bấm **Đăng ký webhook**. Không cần gõ URL hay lệnh thủ công. Mục này hiện token đúng/sai, webhook trỏ đúng địa chỉ chưa và lỗi gần nhất Telegram gặp.
3. Cùng trang đó: **Tạo mã liên kết** → nhắn bot `/start <mã>` → bấm **Gửi tin thử cho tôi** để kiểm tra.
4. Mở `https://<app>.vercel.app/api/telegram/webhook` bằng trình duyệt: thấy `"ok":true` là route đã chạy.
5. Bot hiểu: `/doanhthu`, `/tonkho`, `/hethan`, `/id` (xem mã chat), `/help`, và câu hỏi tự nhiên (cần `ANTHROPIC_API_KEY`).

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
