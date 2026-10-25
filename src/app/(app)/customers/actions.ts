"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/customers";

export async function createCustomer(form: FormData) {
  const m = await requireMember("customers.manage", BACK);
  const name = toText(form.get("name"));
  const phone = toText(form.get("phone")).replace(/\s/g, "");
  const email = toText(form.get("email"));
  const birthday = toText(form.get("birthday"));
  const note = toText(form.get("note"));
  if (!name) return redirectMsg(BACK, "error", "Nhập tên khách hàng.");
  if (phone && !/^[0-9+]{8,15}$/.test(phone)) return redirectMsg(BACK, "error", "Số điện thoại không hợp lệ.");

  const { error } = await getAdminClient().from("customers").insert({
    store_id: m.storeId, name, phone: phone || null, email: email || null,
    birthday: birthday || null, note: note || null,
  });
  if (error) {
    const dup = error.code === "23505";
    return redirectMsg(BACK, "error", dup ? "Số điện thoại này đã có khách hàng." : `Không lưu được: ${error.message}`);
  }
  revalidatePath("/customers");
  return redirectMsg(BACK, "ok", `Đã thêm khách hàng "${name}".`);
}
