"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;
const METHODS = ["cash", "card", "transfer", "ewallet"];

function refresh(id: string) {
  for (const p of ["/orders", `/orders/${id}`, "/dashboard", "/reports", "/inventory", "/customers", "/products"]) {
    revalidatePath(p);
  }
}

/** Thu thêm tiền cho đơn còn nợ. */
export async function collectDebt(form: FormData) {
  const id = toText(form.get("id"));
  const back = UUID.test(id) ? `/orders/${id}` : "/orders";
  const m = await requireMember("pos.sell", back);
  if (!UUID.test(id)) return redirectMsg("/orders", "error", "Đơn hàng không hợp lệ.");
  const method = toText(form.get("method"));
  const amount = toInt(form.get("amount"), 0);
  if (!METHODS.includes(method)) return redirectMsg(back, "error", "Chọn hình thức thanh toán.");
  if (amount <= 0) return redirectMsg(back, "error", "Nhập số tiền thu lớn hơn 0.");

  const { data, error } = await getAdminClient().rpc("pay_order_debt", {
    p_store: m.storeId, p_order: id, p_method: method, p_amount: amount, p_staff: m.staffId,
  });
  if (error) return redirectMsg(back, "error", error.message);
  refresh(id);
  const due = Number((data as { due?: number } | null)?.due ?? 0);
  return redirectMsg(back, "ok", due > 0 ? `Đã thu. Còn nợ ${due.toLocaleString("vi-VN")} đ.` : "Đã thu đủ, đơn hoàn tất.");
}

/** Hoàn tiền (refunded) hoặc huỷ (cancelled) đơn: nhập lại kho, trả tiền, thu hồi điểm. */
export async function voidOrder(form: FormData) {
  const id = toText(form.get("id"));
  const back = UUID.test(id) ? `/orders/${id}` : "/orders";
  const m = await requireMember("orders.refund", back);
  if (!UUID.test(id)) return redirectMsg("/orders", "error", "Đơn hàng không hợp lệ.");
  const kind = toText(form.get("kind"));
  if (kind !== "refunded" && kind !== "cancelled") return redirectMsg(back, "error", "Chọn hoàn tiền hoặc huỷ đơn.");
  if (toText(form.get("confirm")) !== "1") return redirectMsg(back, "error", "Hãy tick ô xác nhận trước khi thực hiện.");

  const { error } = await getAdminClient().rpc("void_order", {
    p_store: m.storeId, p_order: id, p_staff: m.staffId, p_status: kind,
    p_note: toText(form.get("note")) || null,
  });
  if (error) return redirectMsg(back, "error", error.message);
  refresh(id);
  return redirectMsg(back, "ok", kind === "cancelled" ? "Đã huỷ đơn, hàng đã nhập lại kho." : "Đã hoàn tiền, hàng đã nhập lại kho.");
}
