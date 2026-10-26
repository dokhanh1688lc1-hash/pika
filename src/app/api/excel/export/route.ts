import type { NextRequest } from "next/server";
import { getMembership } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";
import { buildXlsx, XLSX_TYPE } from "@/lib/excel";
import { KIND_LABEL, PRODUCT_COLUMNS } from "@/lib/excel-schema";

export const dynamic = "force-dynamic";

/** Xuất hàng hoá hoặc tồn kho ra Excel. ?type=products | stock */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return Response.json({ error: "Chưa kết nối cơ sở dữ liệu" }, { status: 400 });
  const member = await getMembership();
  if (!member) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!can(member.role, "products.manage") && !can(member.role, "inventory.manage") && !can(member.role, "reports.view")) {
    return Response.json({ error: "Không có quyền" }, { status: 403 });
  }
  const type = req.nextUrl.searchParams.get("type") === "stock" ? "stock" : "products";
  const db = getAdminClient();

  // Lấy hết sản phẩm đang bán (phân trang vì Supabase trả tối đa 1000 dòng/lần)
  const prods: Record<string, any>[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db
      .from("products")
      .select("id, sku, name, kind, price, cost, min_stock, package_sessions, product_categories(name)")
      .eq("store_id", member.storeId).eq("active", true).order("name")
      .range(page * 1000, page * 1000 + 999);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    prods.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  const catName = (p: Record<string, any>): string => {
    const c = Array.isArray(p.product_categories) ? p.product_categories[0] : p.product_categories;
    return c?.name ?? "";
  };

  const stockByProduct = new Map<string, number>();
  const { data: levels } = await db.from("inventory_levels").select("product_id, quantity").eq("store_id", member.storeId);
  for (const l of levels ?? []) {
    stockByProduct.set(l.product_id, (stockByProduct.get(l.product_id) ?? 0) + Number(l.quantity));
  }

  let bytes: Uint8Array;
  if (type === "products") {
    const cols = PRODUCT_COLUMNS.filter((c) => c.key !== "openingStock");
    cols.push({ header: "Tồn kho hiện tại (chỉ xem)", key: "stock", width: 22 });
    bytes = await buildXlsx([{
      name: "Hàng hoá", columns: cols,
      rows: prods.map((p) => ({
        sku: p.sku, name: p.name, kind: KIND_LABEL[p.kind] ?? p.kind, category: catName(p),
        price: Number(p.price), cost: Number(p.cost), minStock: p.min_stock,
        sessions: p.package_sessions ?? "", stock: p.kind === "goods" ? stockByProduct.get(p.id) ?? 0 : "",
      })),
    }]);
  } else {
    const goods = prods.filter((p) => p.kind === "goods");
    const { data: batches } = await db
      .from("v_batches").select("sku, product, batch_code, quantity, expiry_date, days_left")
      .eq("store_id", member.storeId).order("expiry_date");
    bytes = await buildXlsx([
      {
        name: "Tồn kho",
        columns: [
          { header: "Mã SP", key: "sku", width: 16 }, { header: "Tên", key: "name", width: 36 },
          { header: "Nhóm hàng", key: "category", width: 20 }, { header: "Tồn kho", key: "stock", width: 12 },
          { header: "Tồn tối thiểu", key: "minStock", width: 14 }, { header: "Giá vốn", key: "cost", width: 14, money: true },
          { header: "Giá trị tồn (vốn)", key: "value", width: 18, money: true },
        ],
        rows: goods.map((p) => {
          const st = stockByProduct.get(p.id) ?? 0;
          return { sku: p.sku, name: p.name, category: catName(p), stock: st, minStock: p.min_stock, cost: Number(p.cost), value: st * Number(p.cost) };
        }),
      },
      {
        name: "Lô hạn dùng",
        columns: [
          { header: "Mã SP", key: "sku", width: 16 }, { header: "Tên", key: "product", width: 36 },
          { header: "Số lô", key: "batch", width: 14 }, { header: "Số lượng", key: "qty", width: 12 },
          { header: "Hạn sử dụng", key: "expiry", width: 14 }, { header: "Còn (ngày)", key: "days", width: 12 },
        ],
        rows: (batches ?? []).map((b) => ({
          sku: b.sku, product: b.product, batch: b.batch_code ?? "", qty: Number(b.quantity),
          expiry: String(b.expiry_date), days: Number(b.days_left),
        })),
      },
    ]);
  }

  const day = new Date().toISOString().slice(0, 10);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="pika-${type === "stock" ? "ton-kho" : "hang-hoa"}-${day}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
