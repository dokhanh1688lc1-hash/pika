import type { NextRequest } from "next/server";
import { getMembership } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { reportSummary } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { isIsoDate } from "@/lib/period";
import { ROLE_LABEL, can, type Role } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  draft: "Nháp", paid: "Đã thanh toán", partial: "Còn nợ", refunded: "Hoàn tiền", cancelled: "Đã huỷ",
};

/** Xuất báo cáo ra file Excel (.xlsx) gồm 5 trang: Tổng quan, Theo ngày, Sản phẩm, Hoa hồng, Đơn hàng. */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return Response.json({ error: "Chưa kết nối cơ sở dữ liệu" }, { status: 400 });
  const member = await getMembership();
  if (!member) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!can(member.role, "reports.view")) return Response.json({ error: "Không có quyền" }, { status: 403 });

  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return Response.json({ error: "Khoảng ngày không hợp lệ" }, { status: 400 });
  }

  let report;
  try {
    report = await reportSummary(from, to, member.storeId);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Lỗi báo cáo" }, { status: 400 });
  }
  if (!report) return Response.json({ error: "Không có dữ liệu" }, { status: 404 });

  // Đơn hàng trong kỳ (phân trang vì mỗi lần Supabase trả tối đa 1000 dòng)
  const db = getAdminClient();
  const orders: Record<string, unknown>[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db
      .from("v_orders")
      .select("code, customer, status, total, paid, due, created_at")
      .eq("store_id", member.storeId)
      .gte("created_at", `${from}T00:00:00+07:00`)
      .lt("created_at", `${new Date(Date.parse(`${to}T00:00:00+07:00`) + 86_400_000).toISOString()}`)
      .order("created_at")
      .range(page * 1000, page * 1000 + 999);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    orders.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // exceljs là CommonJS: tuỳ môi trường, lớp nằm ở `default` hoặc ở chính module
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "PiKa Store";
  const money = "#,##0";

  const sheet = (name: string, columns: { header: string; key: string; width: number; money?: boolean }[], rows: object[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = columns.map((c) => ({
      header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: money } : {},
    }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    return ws;
  };

  const profit = report.revenue - report.cogs;
  const commission = report.staff.reduce((a, s) => a + s.commission, 0);
  sheet("Tổng quan", [
    { header: "Chỉ tiêu", key: "k", width: 36 },
    { header: "Giá trị", key: "v", width: 20, money: true },
  ], [
    { k: "Từ ngày", v: from }, { k: "Đến ngày", v: to },
    { k: "Số đơn", v: report.orders },
    { k: "Doanh thu", v: report.revenue },
    { k: "Giá vốn hàng bán", v: report.cogs },
    { k: "Lợi nhuận gộp", v: profit },
    { k: "Hoa hồng nhân viên (tạm tính)", v: commission },
    { k: "Lợi nhuận sau hoa hồng", v: profit - commission },
    { k: "Giảm giá đã cho", v: report.discount },
    { k: "Số đơn hoàn tiền", v: report.refundCount },
    { k: "Tiền hoàn", v: report.refundAmount },
    { k: "Tiền nhập hàng trong kỳ", v: report.purchases },
    { k: "Khách mới", v: report.newCustomers },
  ]);

  sheet("Theo ngày", [
    { header: "Ngày", key: "day", width: 14 },
    { header: "Số đơn", key: "orders", width: 10 },
    { header: "Doanh thu", key: "revenue", width: 18, money: true },
    { header: "Giá vốn", key: "cogs", width: 18, money: true },
    { header: "Lợi nhuận gộp", key: "profit", width: 18, money: true },
  ], report.days.map((d) => ({ ...d, profit: d.revenue - d.cogs })));

  sheet("Sản phẩm", [
    { header: "Mã", key: "sku", width: 14 },
    { header: "Sản phẩm", key: "name", width: 34 },
    { header: "Số lượng", key: "quantity", width: 12 },
    { header: "Doanh thu", key: "revenue", width: 18, money: true },
    { header: "Giá vốn", key: "cost", width: 18, money: true },
    { header: "Lãi gộp", key: "profit", width: 18, money: true },
  ], report.products.map((p) => ({ ...p, profit: p.revenue - p.cost })));

  sheet("Hoa hồng", [
    { header: "Nhân viên", key: "name", width: 26 },
    { header: "Vai trò", key: "role", width: 18 },
    { header: "Doanh thu", key: "revenue", width: 18, money: true },
    { header: "% hoa hồng", key: "rate", width: 12 },
    { header: "Hoa hồng", key: "commission", width: 18, money: true },
  ], report.staff.map((s) => ({ ...s, role: ROLE_LABEL[s.role as Role] ?? s.role, rate: `${(s.rate * 100).toFixed(1)}%` })));

  sheet("Đơn hàng", [
    { header: "Mã đơn", key: "code", width: 18 },
    { header: "Thời gian", key: "at", width: 20 },
    { header: "Khách hàng", key: "customer", width: 26 },
    { header: "Trạng thái", key: "status", width: 16 },
    { header: "Tổng tiền", key: "total", width: 16, money: true },
    { header: "Đã thu", key: "paid", width: 16, money: true },
    { header: "Còn nợ", key: "due", width: 16, money: true },
  ], orders.map((o) => ({
    code: o.code,
    at: new Date(String(o.created_at)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
    customer: o.customer, status: STATUS[String(o.status)] ?? o.status,
    total: Number(o.total), paid: Number(o.paid), due: Number(o.due),
  })));

  const raw = await wb.xlsx.writeBuffer();
  const bytes = new Uint8Array(raw as ArrayBuffer);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao_${from}_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
