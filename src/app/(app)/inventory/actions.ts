"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/inventory";

async function run(form: FormData, mode: "in" | "set") {
  const m = await requireMember("inventory.manage", BACK);
  const productId = toText(form.get("productId"));
  const qty = toInt(form.get("qty"), -1);
  const unitCost = toInt(form.get("unitCost"), 0);
  const note = toText(form.get("note"));
  if (!productId) return redirectMsg(BACK, "error", "Chọn sản phẩm.");
  if (qty < 0 || (mode === "in" && qty === 0)) return redirectMsg(BACK, "error", "Số lượng không hợp lệ.");

  const branch = await defaultBranchId(m.storeId);
  if (!branch) return redirectMsg(BACK, "error", "Cửa hàng chưa có chi nhánh.");

  const { data, error } = await getAdminClient().rpc("adjust_stock", {
    p_store: m.storeId, p_branch: branch, p_product: productId, p_qty: qty, p_mode: mode,
    p_unit_cost: mode === "in" && unitCost > 0 ? unitCost : null,
    p_note: note || (mode === "in" ? "Nhập kho" : "Kiểm kho"), p_staff: m.staffId,
  });
  if (error) return redirectMsg(BACK, "error", error.message);
  revalidatePath("/inventory");
  revalidatePath("/products");
  return redirectMsg(BACK, "ok", `Đã cập nhật. Tồn hiện tại: ${data}.`);
}

export async function stockIn(form: FormData) {
  return run(form, "in");
}

export async function stockCount(form: FormData) {
  return run(form, "set");
}
