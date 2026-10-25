"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, redirectMsg, requireMember } from "@/lib/guard";
import { toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/purchases";
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface RawLine { product_id?: unknown; quantity?: unknown; unit_cost?: unknown; expiry?: unknown; batch_code?: unknown }

export async function createPurchase(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const supplierId = toText(form.get("supplierId"));
  if (supplierId && !UUID.test(supplierId)) return redirectMsg(BACK, "error", "Nhà cung cấp không hợp lệ.");

  let raw: RawLine[] = [];
  try {
    const parsed = JSON.parse(toText(form.get("items")) || "[]");
    if (Array.isArray(parsed)) raw = parsed;
  } catch {
    return redirectMsg(BACK, "error", "Dữ liệu phiếu nhập không hợp lệ.");
  }
  if (raw.length === 0) return redirectMsg(BACK, "error", "Chọn ít nhất một sản phẩm.");

  const items = [];
  for (const l of raw) {
    const productId = String(l.product_id ?? "");
    const quantity = Math.floor(Number(l.quantity));
    const unitCost = Math.floor(Number(l.unit_cost));
    const expiry = String(l.expiry ?? "");
    if (!UUID.test(productId)) return redirectMsg(BACK, "error", "Có dòng chưa chọn sản phẩm.");
    if (!Number.isFinite(quantity) || quantity <= 0) return redirectMsg(BACK, "error", "Số lượng phải lớn hơn 0.");
    if (!Number.isFinite(unitCost) || unitCost < 0) return redirectMsg(BACK, "error", "Giá nhập không hợp lệ.");
    if (expiry && !DATE.test(expiry)) return redirectMsg(BACK, "error", "Hạn sử dụng không hợp lệ.");
    items.push({
      product_id: productId, quantity, unit_cost: unitCost, expiry,
      batch_code: String(l.batch_code ?? "").slice(0, 60),
    });
  }

  const paidText = toText(form.get("paid"));
  const total = items.reduce((a, i) => a + i.quantity * i.unit_cost, 0);
  const paid = paidText === "" ? total : Math.floor(Number(paidText));
  if (!Number.isFinite(paid) || paid < 0) return redirectMsg(BACK, "error", "Số tiền đã trả không hợp lệ.");

  const branch = await defaultBranchId(m.storeId);
  if (!branch) return redirectMsg(BACK, "error", "Cửa hàng chưa có chi nhánh.");

  const { data, error } = await getAdminClient().rpc("create_purchase", {
    p_store: m.storeId, p_branch: branch, p_supplier: supplierId || null,
    p_items: items, p_paid: paid, p_staff: m.staffId, p_note: toText(form.get("note")) || null,
  });
  if (error) return redirectMsg(BACK, "error", error.message);
  for (const p of [BACK, "/suppliers", "/inventory", "/products", "/expiry"]) revalidatePath(p);
  const r = data as { code: string; debt: number };
  return redirectMsg(BACK, "ok", `Đã tạo phiếu ${r.code} và nhập kho.${r.debt > 0 ? ` Ghi nợ ${r.debt.toLocaleString("vi-VN")} đ.` : ""}`);
}
