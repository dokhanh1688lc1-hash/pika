"use server";

import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/expiry";

/** Huỷ phần còn lại của một lô (hàng hết hạn): trừ tồn kho và ghi lịch sử kho. */
export async function disposeBatch(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const batchId = toText(form.get("batchId"));
  if (!batchId) return redirectMsg(BACK, "error", "Thiếu mã lô.");
  const { data, error } = await getAdminClient().rpc("dispose_batch", {
    p_store: m.storeId, p_batch: batchId, p_staff: m.staffId, p_note: null,
  });
  if (error) return redirectMsg(BACK, "error", error.message);
  revalidatePath("/expiry");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return redirectMsg(BACK, "ok", `Đã huỷ ${data} sản phẩm của lô và trừ khỏi tồn kho.`);
}

/** Sửa hạn sử dụng / số lô của một lô (khi nhập nhầm). Số lượng chỉnh bằng Kiểm kho. */
export async function updateBatch(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const batchId = toText(form.get("batchId"));
  const expiry = toText(form.get("expiry"));
  const code = toText(form.get("batchCode"));
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return redirectMsg(BACK, "error", "Lô không hợp lệ.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(Date.parse(expiry))) {
    return redirectMsg(BACK, "error", "Hạn sử dụng không hợp lệ.");
  }
  const { data, error } = await getAdminClient()
    .from("product_batches")
    .update({ expiry_date: expiry, batch_code: code ? code.slice(0, 60) : null })
    .eq("id", batchId).eq("store_id", m.storeId).gt("quantity", 0)
    .select("id");
  if (error) return redirectMsg(BACK, "error", `Không lưu được: ${error.message}`);
  if (!data || data.length === 0) return redirectMsg(BACK, "error", "Không tìm thấy lô (hoặc lô đã được xử lý).");
  for (const p of [BACK, "/inventory", "/dashboard"]) revalidatePath(p);
  return redirectMsg(BACK, "ok", "Đã cập nhật hạn sử dụng của lô.");
}
