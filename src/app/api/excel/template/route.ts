import type { NextRequest } from "next/server";
import { getMembership } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { buildXlsx, XLSX_TYPE } from "@/lib/excel";
import { PRODUCT_COLUMNS, STOCK_COLUMNS } from "@/lib/excel-schema";

export const dynamic = "force-dynamic";

/** File mẫu để nhập. ?type=products | stock */
export async function GET(req: NextRequest) {
  const member = await getMembership();
  if (!member) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!can(member.role, "products.manage") && !can(member.role, "inventory.manage")) {
    return Response.json({ error: "Không có quyền" }, { status: 403 });
  }
  const stock = req.nextUrl.searchParams.get("type") === "stock";
  const bytes = await buildXlsx([stock
    ? {
        name: "Nhập kho", columns: STOCK_COLUMNS,
        rows: [{ sku: "SP001", qty: 20, unitCost: 85000, expiry: "31/12/2027", batch: "L01", note: "Nhập hàng đợt 1" }],
      }
    : {
        name: "Hàng hoá", columns: PRODUCT_COLUMNS,
        rows: [
          { sku: "SP001", name: "Serum vitamin C", kind: "Hàng hoá", category: "Chăm sóc da", price: 250000, cost: 120000, minStock: 5, sessions: "", openingStock: 20 },
          { sku: "DV001", name: "Chăm sóc da cơ bản", kind: "Dịch vụ", category: "Dịch vụ", price: 300000, cost: 0, minStock: 0, sessions: "", openingStock: "" },
          { sku: "LT001", name: "Liệu trình 10 buổi", kind: "Liệu trình", category: "Liệu trình", price: 2500000, cost: 0, minStock: 0, sessions: 10, openingStock: "" },
        ],
      }]);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="mau-${stock ? "nhap-kho" : "hang-hoa"}.xlsx"`,
    },
  });
}
