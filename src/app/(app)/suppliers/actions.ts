"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/suppliers";
const UUID = /^[0-9a-f-]{36}$/i;

function fields(form: FormData) {
  return {
    name: toText(form.get("name")),
    phone: toText(form.get("phone")) || null,
    address: toText(form.get("address")) || null,
    note: toText(form.get("note")) || null,
  };
}

export async function createSupplier(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const f = fields(form);
  if (!f.name) return redirectMsg(BACK, "error", "Nhập tên nhà cung cấp.");
  const { error } = await getAdminClient().from("suppliers").insert({ store_id: m.storeId, ...f });
  if (error) return redirectMsg(BACK, "error", `Không lưu được: ${error.message}`);
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", `Đã thêm "${f.name}".`);
}

export async function updateSupplier(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const id = toText(form.get("id"));
  const f = fields(form);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Nhà cung cấp không hợp lệ.");
  if (!f.name) return redirectMsg(BACK, "error", "Nhập tên nhà cung cấp.");
  const { error } = await getAdminClient().from("suppliers").update(f).eq("id", id).eq("store_id", m.storeId);
  if (error) return redirectMsg(BACK, "error", `Không lưu được: ${error.message}`);
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", "Đã lưu thay đổi.");
}

/** Chỉ xoá được nhà cung cấp chưa có phiếu nhập và không còn công nợ. */
export async function deleteSupplier(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const id = toText(form.get("id"));
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Nhà cung cấp không hợp lệ.");
  const db = getAdminClient();
  const { data: s } = await db.from("suppliers").select("name, debt").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!s) return redirectMsg(BACK, "error", "Không tìm thấy nhà cung cấp.");
  if (Number(s.debt) > 0) return redirectMsg(BACK, "error", "Còn công nợ, hãy thanh toán hết trước khi xoá.");
  const { error } = await db.from("suppliers").delete().eq("id", id).eq("store_id", m.storeId);
  if (error) {
    const used = error.code === "23503";
    return redirectMsg(BACK, "error", used ? "Nhà cung cấp đã có phiếu nhập hàng nên không xoá được (để giữ lịch sử)." : error.message);
  }
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", `Đã xoá "${s.name}".`);
}

export async function paySupplier(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const id = toText(form.get("id"));
  const amount = toInt(form.get("amount"), 0);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Nhà cung cấp không hợp lệ.");
  if (amount <= 0) return redirectMsg(BACK, "error", "Nhập số tiền trả lớn hơn 0.");
  const { data, error } = await getAdminClient().rpc("pay_supplier", {
    p_store: m.storeId, p_supplier: id, p_amount: amount, p_staff: m.staffId,
  });
  if (error) return redirectMsg(BACK, "error", error.message);
  revalidatePath(BACK);
  revalidatePath("/purchases");
  return redirectMsg(BACK, "ok", `Đã trả nợ. Còn nợ ${Number(data).toLocaleString("vi-VN")} đ.`);
}
