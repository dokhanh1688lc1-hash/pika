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
