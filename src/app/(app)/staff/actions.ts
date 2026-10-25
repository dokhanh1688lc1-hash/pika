"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/staff";
const ROLES = ["manager", "cashier", "technician", "stock_keeper"];

export async function createStaff(form: FormData) {
  const m = await requireMember("staff.manage", BACK);
  const name = toText(form.get("name"));
  const phone = toText(form.get("phone"));
  const role = toText(form.get("role"));
  const percent = Number(toText(form.get("commission")).replace(",", ".") || "0");
  if (!name) return redirectMsg(BACK, "error", "Nhập tên nhân viên.");
  if (!ROLES.includes(role)) return redirectMsg(BACK, "error", "Vai trò không hợp lệ.");
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return redirectMsg(BACK, "error", "Hoa hồng phải từ 0 đến 100%.");
  }
  const { error } = await getAdminClient().from("staff").insert({
    store_id: m.storeId, name, phone: phone || null, role, commission_rate: percent / 100,
  });
  if (error) return redirectMsg(BACK, "error", `Không lưu được: ${error.message}`);
  revalidatePath("/staff");
  return redirectMsg(BACK, "ok", `Đã thêm nhân viên "${name}".`);
}
