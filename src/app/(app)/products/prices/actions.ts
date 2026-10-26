"use server";

import { revalidatePath } from "next/cache";
import { applyPriceRule, validateRule, type PriceField, type PriceOp } from "@/lib/pricing";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toInt } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/products/prices";
const UUID = /^[0-9a-f-]{36}$/i;

/** Tính lại giá từ dữ liệu trong DB (không tin giá hiển thị từ trình duyệt) rồi lưu. */
export async function applyBulkPrice(form: FormData) {
  const m = await requireMember("products.manage", BACK);
  const rule = {
    field: String(form.get("field")) as PriceField,
    op: String(form.get("op")) as PriceOp,
    value: Number(String(form.get("value") ?? "").replace(",", ".")),
    round: toInt(form.get("round"), 0),
  };
  const bad = validateRule(rule);
  if (bad) return redirectMsg(BACK, "error", bad);

  const ids = [...new Set(form.getAll("ids").map(String))].filter((i) => UUID.test(i));
  if (ids.length === 0) return redirectMsg(BACK, "error", "Chưa chọn sản phẩm nào.");
  if (ids.length > 2000) return redirectMsg(BACK, "error", "Tối đa 2000 sản phẩm mỗi lần.");

  const db = getAdminClient();
  const rows: { id: string; v: number }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("products").select(`id, ${rule.field}`)
      .eq("store_id", m.storeId).eq("active", true).in("id", ids.slice(i, i + 200));
    if (error) return redirectMsg(BACK, "error", `Lỗi đọc dữ liệu: ${error.message}`);
    for (const r of data ?? []) rows.push({ id: r.id, v: Number((r as Record<string, unknown>)[rule.field]) });
  }

  let changed = 0, failed = 0;
  for (const r of rows) {
    const next = applyPriceRule(r.v, rule);
    if (next === r.v) continue;
    const { error } = await db.from("products").update({ [rule.field]: next }).eq("id", r.id).eq("store_id", m.storeId);
    if (error) failed++; else changed++;
  }
  revalidatePath("/products"); revalidatePath("/pos");
  const label = rule.field === "price" ? "giá bán" : "giá vốn";
  const msg = `Đã cập nhật ${label} cho ${changed} sản phẩm.${failed ? ` ${failed} sản phẩm lỗi.` : ""}`;
  return redirectMsg(BACK, failed ? "error" : "ok", msg);
}
