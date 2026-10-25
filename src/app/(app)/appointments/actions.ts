"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const STATUSES = ["booked", "in_progress", "done", "cancelled"];

const backTo = (date: string) => (DATE.test(date) ? `/appointments?date=${date}` : "/appointments");

interface Parsed {
  customerId: string; productId: string; staffId: string | null;
  startsAt: Date; endsAt: Date; note: string | null; date: string;
}

/** Đọc và kiểm tra form; trả về lỗi dạng chuỗi nếu sai. Giờ nhập được hiểu là giờ Việt Nam. */
async function parse(form: FormData, storeId: string): Promise<Parsed | string> {
  const customerId = toText(form.get("customerId"));
  const productId = toText(form.get("productId"));
  const staffId = toText(form.get("staffId"));
  const date = toText(form.get("date"));
  const time = toText(form.get("time"));
  if (!UUID.test(customerId)) return "Chọn khách hàng.";
  if (!UUID.test(productId)) return "Chọn dịch vụ.";
  if (staffId && !UUID.test(staffId)) return "Nhân viên không hợp lệ.";
  if (!DATE.test(date) || !TIME.test(time)) return "Chọn ngày và giờ hẹn.";
  const startsAt = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(startsAt.getTime())) return "Ngày giờ không hợp lệ.";

  const db = getAdminClient();
  const [{ data: c }, { data: p }, { data: s }] = await Promise.all([
    db.from("customers").select("id").eq("id", customerId).eq("store_id", storeId).maybeSingle(),
    db.from("products").select("id, kind, duration_min").eq("id", productId).eq("store_id", storeId).maybeSingle(),
    staffId
      ? db.from("staff").select("id").eq("id", staffId).eq("store_id", storeId).eq("active", true).maybeSingle()
      : Promise.resolve({ data: { id: "" } }),
  ]);
  if (!c) return "Không tìm thấy khách hàng.";
  if (!p || p.kind === "goods") return "Chọn một dịch vụ hoặc liệu trình.";
  if (!s) return "Không tìm thấy nhân viên.";
  const minutes = Number(p.duration_min) > 0 ? Number(p.duration_min) : 60;
  return {
    customerId, productId, staffId: staffId || null, startsAt,
    endsAt: new Date(startsAt.getTime() + minutes * 60_000),
    note: toText(form.get("note")) || null, date,
  };
}

/** Một nhân viên không thể có hai lịch chồng giờ. */
async function staffBusy(storeId: string, p: Parsed, ignoreId?: string): Promise<boolean> {
  if (!p.staffId) return false;
  let q = getAdminClient()
    .from("appointments").select("id")
    .eq("store_id", storeId).eq("staff_id", p.staffId).in("status", ["booked", "in_progress"])
    .lt("starts_at", p.endsAt.toISOString()).gt("ends_at", p.startsAt.toISOString());
  if (ignoreId) q = q.neq("id", ignoreId);
  const { data } = await q.limit(1);
  return (data ?? []).length > 0;
}

function refresh() {
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function createAppointment(form: FormData) {
  const date = toText(form.get("date"));
  const m = await requireMember("appointments.manage", backTo(date));
  const p = await parse(form, m.storeId);
  if (typeof p === "string") return redirectMsg(backTo(date), "error", p);
  if (await staffBusy(m.storeId, p)) return redirectMsg(backTo(p.date), "error", "Nhân viên đã có lịch trong khung giờ này.");
  const { error } = await getAdminClient().from("appointments").insert({
    store_id: m.storeId, customer_id: p.customerId, product_id: p.productId, staff_id: p.staffId,
    starts_at: p.startsAt.toISOString(), ends_at: p.endsAt.toISOString(), note: p.note, status: "booked",
  });
  if (error) return redirectMsg(backTo(p.date), "error", `Không lưu được: ${error.message}`);
  refresh();
  return redirectMsg(backTo(p.date), "ok", "Đã đặt lịch hẹn.");
}

export async function updateAppointment(form: FormData) {
  const id = toText(form.get("id"));
  const oldDate = toText(form.get("oldDate"));
  const m = await requireMember("appointments.manage", backTo(oldDate));
  if (!UUID.test(id)) return redirectMsg(backTo(oldDate), "error", "Lịch hẹn không hợp lệ.");
  const p = await parse(form, m.storeId);
  if (typeof p === "string") return redirectMsg(backTo(oldDate), "error", p);
  if (await staffBusy(m.storeId, p, id)) return redirectMsg(backTo(oldDate), "error", "Nhân viên đã có lịch trong khung giờ này.");
  const { data, error } = await getAdminClient().from("appointments").update({
    customer_id: p.customerId, product_id: p.productId, staff_id: p.staffId,
    starts_at: p.startsAt.toISOString(), ends_at: p.endsAt.toISOString(), note: p.note,
  }).eq("id", id).eq("store_id", m.storeId).select("id");
  if (error) return redirectMsg(backTo(oldDate), "error", `Không lưu được: ${error.message}`);
  if (!data || data.length === 0) return redirectMsg(backTo(oldDate), "error", "Không tìm thấy lịch hẹn.");
  refresh();
  return redirectMsg(backTo(p.date), "ok", "Đã cập nhật lịch hẹn.");
}

export async function setAppointmentStatus(form: FormData) {
  const id = toText(form.get("id"));
  const date = toText(form.get("date"));
  const status = toText(form.get("status"));
  const m = await requireMember("appointments.manage", backTo(date));
  if (!UUID.test(id) || !STATUSES.includes(status)) return redirectMsg(backTo(date), "error", "Dữ liệu không hợp lệ.");
  const { data, error } = await getAdminClient()
    .from("appointments").update({ status }).eq("id", id).eq("store_id", m.storeId).select("id");
  if (error) return redirectMsg(backTo(date), "error", `Không cập nhật được: ${error.message}`);
  if (!data || data.length === 0) return redirectMsg(backTo(date), "error", "Không tìm thấy lịch hẹn.");
  refresh();
  return redirectMsg(backTo(date), "ok", "Đã cập nhật trạng thái.");
}

export async function deleteAppointment(form: FormData) {
  const id = toText(form.get("id"));
  const date = toText(form.get("date"));
  const m = await requireMember("appointments.manage", backTo(date));
  if (!UUID.test(id)) return redirectMsg(backTo(date), "error", "Lịch hẹn không hợp lệ.");
  const { error } = await getAdminClient().from("appointments").delete().eq("id", id).eq("store_id", m.storeId);
  if (error) return redirectMsg(backTo(date), "error", `Không xoá được: ${error.message}`);
  refresh();
  return redirectMsg(backTo(date), "ok", "Đã xoá lịch hẹn.");
}
