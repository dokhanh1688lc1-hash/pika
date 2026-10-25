"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/transfers";
const UUID = /^[0-9a-f-]{36}$/i;

export async function transferStock(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const from = toText(form.get("from"));
  const to = toText(form.get("to"));
  const productId = toText(form.get("productId"));
  const qty = toInt(form.get("qty"), 0);
  if (![from, to, productId].every((v) => UUID.test(v))) return redirectMsg(BACK, "error", "Chọn đủ chi nhánh và sản phẩm.");
  if (from === to) return redirectMsg(BACK, "error", "Chi nhánh nguồn và đích phải khác nhau.");
  if (qty <= 0) return redirectMsg(BACK, "error", "Số lượng chuyển phải lớn hơn 0.");

  const { error } = await getAdminClient().rpc("transfer_stock", {
    p_store: m.storeId, p_from: from, p_to: to, p_product: productId, p_qty: qty,
    p_staff: m.staffId, p_note: toText(form.get("note")) || null,
  });
  if (error) return redirectMsg(BACK, "error", error.message);
  for (const p of [BACK, "/inventory", "/products", "/expiry"]) revalidatePath(p);
  return redirectMsg(BACK, "ok", "Đã chuyển kho.");
}

export async function createBranch(form: FormData) {
  const m = await requireMember("settings.manage", BACK);
  const name = toText(form.get("name"));
  if (!name) return redirectMsg(BACK, "error", "Nhập tên chi nhánh.");
  const { error } = await getAdminClient().from("branches").insert({
    store_id: m.storeId, name, address: toText(form.get("address")) || null, is_default: false,
  });
  if (error) return redirectMsg(BACK, "error", `Không lưu được: ${error.message}`);
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", `Đã thêm chi nhánh "${name}".`);
}
