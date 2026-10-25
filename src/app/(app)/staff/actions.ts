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
    .from("staff").select("id, name, role, user_id").eq("id", id).eq("store_id", m.storeId).maybeSingle();
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
  if (!error) {
    if (target.user_id) await db.auth.admin.deleteUser(target.user_id);
    return redirectMsg(BACK, "ok", `Đã xoá nhân viên "${target.name}".`);
  }
  if (error.code !== "23503") return redirectMsg(BACK, "error", `Không xoá được: ${error.message}`);

  const { error: e2 } = await db.from("staff").update({ active: false, user_id: null }).eq("id", id).eq("store_id", m.storeId);
  if (e2) return redirectMsg(BACK, "error", `Không cập nhật được: ${e2.message}`);
  if (target.user_id) await db.auth.admin.deleteUser(target.user_id);
  return redirectMsg(
    BACK, "ok",
    `"${target.name}" đã có lịch sử bán hàng nên được chuyển sang ngừng hoạt động (giữ nguyên báo cáo cũ).`,
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quản lý chỉ thao tác được tài khoản không phải quản lý/chủ; chủ thao tác được tất cả (trừ chính chủ). */
interface StaffRow { id: string; name: string; role: string; user_id: string | null; active: boolean }
type Target = { error: string; staff?: undefined } | { error?: undefined; staff: StaffRow };

async function loadTarget(storeId: string, id: string, actorRole: string): Promise<Target> {
  if (!UUID.test(id)) return { error: "Nhân viên không hợp lệ." };
  const { data } = await getAdminClient()
    .from("staff").select("id, name, role, user_id, active").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (!data) return { error: "Không tìm thấy nhân viên." };
  if (data.role === "owner") return { error: "Không thao tác được tài khoản chủ cửa hàng." };
  if (data.role === "manager" && actorRole !== "owner") return { error: "Chỉ chủ cửa hàng mới quản lý tài khoản của quản lý." };
  if (!data.active) return { error: "Nhân viên này đã ngừng hoạt động." };
  return { staff: data };
}

/** Cấp tài khoản đăng nhập (email + mật khẩu) cho nhân viên. */
export async function createStaffAccount(form: FormData) {
  const m = await requireMember("staff.manage", BACK);
  const t = await loadTarget(m.storeId, toText(form.get("id")), m.role);
  if (t.error !== undefined) return redirectMsg(BACK, "error", t.error);
  if (t.staff.user_id) return redirectMsg(BACK, "error", "Nhân viên này đã có tài khoản.");

  const email = toText(form.get("email")).toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email)) return redirectMsg(BACK, "error", "Email không hợp lệ.");
  if (password.length < 8) return redirectMsg(BACK, "error", "Mật khẩu cần từ 8 ký tự.");

  const db = getAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return redirectMsg(BACK, "error", taken ? "Email này đã được dùng cho tài khoản khác." : `Không tạo được tài khoản: ${error?.message ?? ""}`);
  }
  const { error: linkErr } = await db.from("staff").update({ user_id: data.user.id }).eq("id", t.staff.id).eq("store_id", m.storeId);
  if (linkErr) {
    await db.auth.admin.deleteUser(data.user.id);
    return redirectMsg(BACK, "error", `Không gắn được tài khoản: ${linkErr.message}`);
  }
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", `Đã cấp tài khoản cho "${t.staff.name}". Gửi email và mật khẩu cho họ để đăng nhập.`);
}

export async function resetStaffPassword(form: FormData) {
  const m = await requireMember("staff.manage", BACK);
  const t = await loadTarget(m.storeId, toText(form.get("id")), m.role);
  if (t.error !== undefined) return redirectMsg(BACK, "error", t.error);
  if (!t.staff.user_id) return redirectMsg(BACK, "error", "Nhân viên này chưa có tài khoản.");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return redirectMsg(BACK, "error", "Mật khẩu cần từ 8 ký tự.");
  const { error } = await getAdminClient().auth.admin.updateUserById(t.staff.user_id, { password });
  if (error) return redirectMsg(BACK, "error", `Không đổi được mật khẩu: ${error.message}`);
  return redirectMsg(BACK, "ok", `Đã đặt mật khẩu mới cho "${t.staff.name}".`);
}

/** Thu hồi tài khoản: nhân viên không đăng nhập được nữa nhưng vẫn còn trong danh sách / báo cáo. */
export async function revokeStaffAccount(form: FormData) {
  const m = await requireMember("staff.manage", BACK);
  const t = await loadTarget(m.storeId, toText(form.get("id")), m.role);
  if (t.error !== undefined) return redirectMsg(BACK, "error", t.error);
  if (!t.staff.user_id) return redirectMsg(BACK, "error", "Nhân viên này chưa có tài khoản.");
  const db = getAdminClient();
  await db.from("staff").update({ user_id: null }).eq("id", t.staff.id).eq("store_id", m.storeId);
  await db.auth.admin.deleteUser(t.staff.user_id);
  revalidatePath(BACK);
  return redirectMsg(BACK, "ok", `Đã thu hồi tài khoản của "${t.staff.name}".`);
}
