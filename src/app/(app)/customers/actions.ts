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

const UUID = /^[0-9a-f-]{36}$/i;

export async function updateCustomer(form: FormData) {
  const id = toText(form.get("id"));
  const back = UUID.test(id) ? `/customers/${id}` : BACK;
  const m = await requireMember("customers.manage", back);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Khách hàng không hợp lệ.");
  const name = toText(form.get("name"));
  const phone = toText(form.get("phone")).replace(/\s/g, "");
  const birthday = toText(form.get("birthday"));
  if (!name) return redirectMsg(back, "error", "Nhập tên khách hàng.");
  if (phone && !/^[0-9+]{8,15}$/.test(phone)) return redirectMsg(back, "error", "Số điện thoại không hợp lệ.");
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return redirectMsg(back, "error", "Ngày sinh không hợp lệ.");

  const { data, error } = await getAdminClient().from("customers").update({
    name, phone: phone || null, email: toText(form.get("email")) || null,
    birthday: birthday || null, note: toText(form.get("note")) || null,
  }).eq("id", id).eq("store_id", m.storeId).select("id");
  if (error) {
    const dup = error.code === "23505";
    return redirectMsg(back, "error", dup ? "Số điện thoại này đã có khách hàng khác." : `Không lưu được: ${error.message}`);
  }
  if (!data || data.length === 0) return redirectMsg(BACK, "error", "Không tìm thấy khách hàng.");
  revalidatePath(BACK);
  revalidatePath(back);
  return redirectMsg(back, "ok", "Đã lưu thay đổi.");
}

/**
 * Xoá khách hàng. Không xoá nếu đã có đơn hàng / lịch hẹn (giữ lịch sử và doanh thu)
 * hoặc còn liệu trình chưa dùng hết (xoá sẽ làm khách mất quyền lợi).
 */
export async function deleteCustomer(form: FormData) {
  const id = toText(form.get("id"));
  const back = UUID.test(id) ? `/customers/${id}` : BACK;
  const m = await requireMember("customers.manage", back);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Khách hàng không hợp lệ.");
  const db = getAdminClient();
  const { data: c } = await db.from("customers").select("name").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!c) return redirectMsg(BACK, "error", "Không tìm thấy khách hàng.");

  const { data: pk } = await db
    .from("customer_packages").select("sessions_total, sessions_used").eq("customer_id", id).eq("store_id", m.storeId);
  if ((pk ?? []).some((p) => p.sessions_used < p.sessions_total)) {
    return redirectMsg(back, "error", "Khách còn liệu trình chưa dùng hết nên không xoá được.");
  }
  const { error } = await db.from("customers").delete().eq("id", id).eq("store_id", m.storeId);
  if (error) {
    return redirectMsg(
      back, "error",
      error.code === "23503"
        ? "Khách đã có đơn hàng hoặc lịch hẹn nên không xoá được (để giữ lịch sử và doanh thu). Bạn có thể sửa thông tin khách thay vì xoá."
        : `Không xoá được: ${error.message}`,
    );
  }
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", `Đã xoá khách hàng "${c.name}".`);
}
