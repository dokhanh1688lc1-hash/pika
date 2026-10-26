import {
  dashboardStats, findCustomer, listOrders, listTodayAppointments, lowStockProducts, reportSummary,
  searchProducts, totalReceivable,
} from "@/lib/data/repo";
import { vnd } from "@/lib/format";
import { addDays, vnToday } from "@/lib/period";
import { can, type Permission, type Role } from "@/lib/rbac";

/** Danh sách lệnh hiện trong menu "/" của Telegram (tên lệnh chỉ gồm a-z, 0-9, _). */
export const COMMAND_MENU = [
  { command: "homnay", description: "Tổng quan hôm nay" },
  { command: "doanhthu", description: "Doanh thu hôm nay" },
  { command: "tuan", description: "Báo cáo 7 ngày qua" },
  { command: "thang", description: "Báo cáo tháng này" },
  { command: "donhang", description: "5 đơn hàng gần nhất" },
  { command: "no", description: "Công nợ khách hàng" },
  { command: "lich", description: "Lịch hẹn hôm nay" },
  { command: "sp", description: "Tìm sản phẩm: /sp tên hoặc mã" },
  { command: "khach", description: "Tìm khách: /khach tên hoặc SĐT" },
  { command: "tonkho", description: "Sản phẩm sắp hết hàng" },
  { command: "hethan", description: "Lô hết hạn / sắp hết hạn" },
  { command: "help", description: "Danh sách lệnh" },
];

const DENIED = "Bạn không có quyền dùng chức năng này.";
const anyOf = (role: Role, perms: Permission[]) => perms.some((p) => can(role, p));
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const STATUS: Record<string, string> = { booked: "Đã đặt", in_progress: "Đang làm", done: "Xong", cancelled: "Huỷ" };

async function periodReport(from: string, to: string, label: string, storeId?: string): Promise<string> {
  const r = await reportSummary(from, to, storeId);
  if (!r) return "Chưa có dữ liệu báo cáo.";
  const profit = r.revenue - r.cogs;
  const top = r.products.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} — ${p.quantity} (${vnd(p.revenue)})`).join("\n");
  return [
    `Báo cáo ${label} (${dmy(from)} – ${dmy(to)})`,
    `Doanh thu: ${vnd(r.revenue)} • ${r.orders} đơn`,
    `Lãi gộp: ${vnd(profit)}`,
    r.refundCount ? `Hoàn/huỷ: ${r.refundCount} đơn (${vnd(r.refundAmount)})` : "",
    r.newCustomers ? `Khách mới: ${r.newCustomers}` : "",
    top ? `\nBán chạy:\n${top}` : "",
  ].filter(Boolean).join("\n");
}

/** Trả về nội dung trả lời, hoặc null nếu đây không phải lệnh mở rộng. */
export async function runExtraCommand(
  cmd: string, arg: string, role: Role, storeId?: string,
): Promise<string | null> {
  switch (cmd) {
    case "/homnay": {
      if (!anyOf(role, ["reports.view", "pos.sell"])) return DENIED;
      const [s, appts, low, debt] = await Promise.all([
        dashboardStats(storeId), listTodayAppointments(storeId), lowStockProducts(storeId), totalReceivable(storeId),
      ]);
      return [
        "Hôm nay",
        `Doanh thu: ${vnd(s.todayRevenue)} • ${s.todayOrders} đơn • ${s.newCustomers} khách mới`,
        `Lịch hẹn: ${appts.length}`,
        `Sắp hết hàng: ${low.length} sản phẩm`,
        `Khách còn nợ: ${vnd(debt.amount)} (${debt.count} đơn)`,
      ].join("\n");
    }
    case "/tuan": {
      if (!can(role, "reports.view")) return DENIED;
      const today = vnToday();
      return periodReport(addDays(today, -6), today, "7 ngày", storeId);
    }
    case "/thang": {
      if (!can(role, "reports.view")) return DENIED;
      const today = vnToday();
      return periodReport(`${today.slice(0, 8)}01`, today, "tháng này", storeId);
    }
    case "/donhang": {
      if (!anyOf(role, ["reports.view", "pos.sell"])) return DENIED;
      const rows = (await listOrders(storeId)).slice(0, 5);
      if (!rows.length) return "Chưa có đơn hàng nào.";
      return rows.map((o) => {
        const t = new Date(o.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
        const item = o.firstItem ? ` — ${o.firstItem}${o.moreItems ? ` +${o.moreItems}` : ""}` : "";
        return `• ${o.code} (${t}) ${o.customer}: ${vnd(o.total)}${o.due > 0 ? ` (nợ ${vnd(o.due)})` : ""}${item}`;
      }).join("\n");
    }
    case "/no": {
      if (!anyOf(role, ["reports.view", "pos.sell"])) return DENIED;
      const rows = await listOrders(storeId, true);
      if (!rows.length) return "Không có khách nào còn nợ.";
      const total = rows.reduce((a, r) => a + r.due, 0);
      const top = rows.sort((a, b) => b.due - a.due).slice(0, 10)
        .map((o) => `• ${o.customer} (${o.code}): ${vnd(o.due)}`).join("\n");
      return `Công nợ: ${vnd(total)} • ${rows.length} đơn\n${top}`;
    }
    case "/lich": {
      if (!anyOf(role, ["appointments.manage", "reports.view", "pos.sell"])) return DENIED;
      const rows = await listTodayAppointments(storeId);
      if (!rows.length) return "Hôm nay chưa có lịch hẹn.";
      return rows.map((a) => `• ${a.time} ${a.customer} — ${a.service}${a.staff ? ` (${a.staff})` : ""} [${STATUS[a.status] ?? a.status}]`).join("\n");
    }
    case "/sp": {
      if (!arg) return "Cách dùng: /sp tên hoặc mã sản phẩm. Ví dụ: /sp serum";
      if (!anyOf(role, ["pos.sell", "products.manage", "inventory.manage"])) return DENIED;
      const rows = (await searchProducts(arg, storeId)).slice(0, 8);
      if (!rows.length) return `Không tìm thấy sản phẩm "${arg}".`;
      return rows.map((p) => `• ${p.name} (${p.sku}): ${vnd(p.price)}${p.stock !== null ? ` • tồn ${p.stock}` : ""}`).join("\n");
    }
    case "/khach": {
      if (!arg) return "Cách dùng: /khach tên hoặc số điện thoại. Ví dụ: /khach lan";
      if (!anyOf(role, ["customers.manage", "pos.sell"])) return DENIED;
      const rows = (await findCustomer(arg, storeId)).slice(0, 8);
      if (!rows.length) return `Không tìm thấy khách "${arg}".`;
      return rows.map((c) => `• ${c.name}${c.phone ? ` (${c.phone})` : ""} — ${c.tier}, ${c.points} điểm, chi tiêu ${vnd(c.totalSpent)}`).join("\n");
    }
    default:
      return null;
  }
}
