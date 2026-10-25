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

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Xoá nhân viên. Nhân viên đã gắn vào đơn hàng / lịch hẹn / lịch sử kho thì không xoá hẳn được
 * (sẽ làm mất lịch sử) -> chuyển sang "ngừng hoạt động": không đăng nhập, không hiện trong POS.
 */
export async function removeStaff(form: FormData) {
  const m = await requireMember("staff.manage", BACK);
  const id = toText(form.get("id"));
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Nhân viên không hợp lệ.");
  if (id === m.staffId) return redirectMsg(BACK, "error", "Bạn không thể xoá chính mình.");

  const db = getAdminClient();
  const { data: target } = await db
    .from("staff").select("id, name, role").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!target) return redirectMsg(BACK, "error", "Không tìm thấy nhân viên.");
  if (target.role === "owner") return redirectMsg(BACK, "error", "Không thể xoá chủ cửa hàng.");
  if (target.role === "manager" && m.role !== "owner") {
    return redirectMsg(BACK, "error", "Chỉ chủ cửa hàng mới xoá được quản lý.");
  }

  // Ngắt liên kết Telegram trước (bot ngừng nhận lệnh từ người này)
  await db.from("telegram_links").delete().eq("staff_id", id).eq("store_id", m.storeId);

  const { error } = await db.from("staff").delete().eq("id", id).eq("store_id", m.storeId);
  revalidatePath("/staff");
  revalidatePath("/pos");
  if (!error) return redirectMsg(BACK, "ok", `Đã xoá nhân viên "${target.name}".`);
  if (error.code !== "23503") return redirectMsg(BACK, "error", `Không xoá được: ${error.message}`);

  const { error: e2 } = await db.from("staff").update({ active: false }).eq("id", id).eq("store_id", m.storeId);
  if (e2) return redirectMsg(BACK, "error", `Không cập nhật được: ${e2.message}`);
  return redirectMsg(
    BACK, "ok",
    `"${target.name}" đã có lịch sử bán hàng nên được chuyển sang ngừng hoạt động (giữ nguyên báo cáo cũ).`,
  );
}
