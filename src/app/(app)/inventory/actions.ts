"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { applyPriceRule, validateRule, type PriceOp, type PriceRule } from "@/lib/pricing";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/inventory";

async function run(form: FormData, mode: "in" | "set") {
  const m = await requireMember("inventory.manage", BACK);
  const productId = toText(form.get("productId"));
  const qty = toInt(form.get("qty"), -1);
  const unitCost = toInt(form.get("unitCost"), 0);
  const note = toText(form.get("note"));
  const expiry = toText(form.get("expiry"));
  const batchCode = toText(form.get("batchCode"));
  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return redirectMsg(BACK, "error", "Hạn sử dụng không hợp lệ.");
  if (!productId) return redirectMsg(BACK, "error", "Chọn sản phẩm.");
  if (qty < 0 || (mode === "in" && qty === 0)) return redirectMsg(BACK, "error", "Số lượng không hợp lệ.");

  const branch = await defaultBranchId(m.storeId);
  if (!branch) return redirectMsg(BACK, "error", "Cửa hàng chưa có chi nhánh.");

  const { data, error } = await getAdminClient().rpc("adjust_stock", {
    p_store: m.storeId, p_branch: branch, p_product: productId, p_qty: qty, p_mode: mode,
    p_unit_cost: mode === "in" && unitCost > 0 ? unitCost : null,
    p_note: note || (mode === "in" ? "Nhập kho" : "Kiểm kho"), p_staff: m.staffId,
    p_expiry: expiry || null, p_batch_code: batchCode || null,
  });
  if (error) return redirectMsg(BACK, "error", error.message);
  revalidatePath("/inventory");
  revalidatePath("/products");
  return redirectMsg(BACK, "ok", `Đã cập nhật. Tồn hiện tại: ${data}.`);
}

export async function stockIn(form: FormData) {
  return run(form, "in");
}

export async function stockCount(form: FormData) {
  return run(form, "set");
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Sửa một mặt hàng trong kho: tồn thực tế, tồn tối thiểu, giá vốn. Ô để trống thì giữ nguyên. */
export async function editStockItem(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const id = toText(form.get("id"));
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Sản phẩm không hợp lệ.");
  const qtyRaw = toText(form.get("qty"));
  const minRaw = toText(form.get("minStock"));
  const costRaw = toText(form.get("cost"));
  const oldQty = toInt(form.get("oldQty"), -1);
  const qty = qtyRaw === "" ? null : toInt(qtyRaw, -1);
  const min = minRaw === "" ? null : toInt(minRaw, -1);
  const cost = costRaw === "" ? null : toInt(costRaw, -1);
  if ((qty !== null && qty < 0) || (min !== null && min < 0) || (cost !== null && cost < 0)) {
    return redirectMsg(BACK, "error", "Số liệu không hợp lệ (phải là số không âm).");
  }
  const db = getAdminClient();
  const { data: p } = await db.from("products").select("id, kind").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!p || p.kind !== "goods") return redirectMsg(BACK, "error", "Không tìm thấy hàng hoá.");

  const patch: Record<string, number> = {};
  if (min !== null) patch.min_stock = min;
  if (cost !== null) patch.cost = cost;
  if (Object.keys(patch).length) {
    const { error } = await db.from("products").update(patch).eq("id", id).eq("store_id", m.storeId);
    if (error) return redirectMsg(BACK, "error", error.message);
  }
  if (qty !== null && qty !== oldQty) {
    const branch = await defaultBranchId(m.storeId);
    if (!branch) return redirectMsg(BACK, "error", "Cửa hàng chưa có chi nhánh.");
    const { error } = await db.rpc("adjust_stock", {
      p_store: m.storeId, p_branch: branch, p_product: id, p_qty: qty, p_mode: "set",
      p_unit_cost: null, p_note: toText(form.get("note")) || "Sửa tồn kho", p_staff: m.staffId,
      p_expiry: null, p_batch_code: null,
    });
    if (error) return redirectMsg(BACK, "error", error.message);
  }
  revalidatePath("/inventory"); revalidatePath("/products"); revalidatePath("/pos");
  return redirectMsg(BACK, "ok", "Đã lưu thay đổi.");
}

/** Sửa hàng loạt: đặt tồn tối thiểu, kiểm kho (đặt tồn), hoặc sửa giá vốn theo quy tắc. */
export async function bulkStockEdit(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const mode = toText(form.get("mode"));
  const ids = [...new Set(form.getAll("ids").map(String))].filter((i) => UUID.test(i));
  if (ids.length === 0) return redirectMsg(BACK, "error", "Chưa chọn mặt hàng nào.");
  if (ids.length > 1000) return redirectMsg(BACK, "error", "Tối đa 1000 mặt hàng mỗi lần.");
  const value = Number(toText(form.get("value")).replace(",", "."));
  if (!["minStock", "setQty", "cost"].includes(mode)) return redirectMsg(BACK, "error", "Chọn thao tác.");
  if (!Number.isFinite(value) || value < 0) return redirectMsg(BACK, "error", "Giá trị phải là số không âm.");

  const db = getAdminClient();
  const rows: { id: string; cost: number }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("products").select("id, cost")
      .eq("store_id", m.storeId).eq("kind", "goods").eq("active", true).in("id", ids.slice(i, i + 200));
    if (error) return redirectMsg(BACK, "error", error.message);
    for (const r of data ?? []) rows.push({ id: r.id, cost: Number(r.cost) });
  }

  let rule: PriceRule | null = null;
  if (mode === "cost") {
    rule = { field: "cost", op: toText(form.get("op")) as PriceOp, value, round: toInt(form.get("round"), 0) };
    const bad = validateRule(rule);
    if (bad) return redirectMsg(BACK, "error", bad);
  }
  const branch = mode === "setQty" ? await defaultBranchId(m.storeId) : null;
  if (mode === "setQty" && !branch) return redirectMsg(BACK, "error", "Cửa hàng chưa có chi nhánh.");

  let ok = 0, failed = 0;
  for (const r of rows) {
    let error: { message: string } | null = null;
    if (mode === "minStock") {
      ({ error } = await db.from("products").update({ min_stock: Math.round(value) }).eq("id", r.id).eq("store_id", m.storeId));
    } else if (mode === "cost" && rule) {
      ({ error } = await db.from("products").update({ cost: applyPriceRule(r.cost, rule) }).eq("id", r.id).eq("store_id", m.storeId));
    } else {
      ({ error } = await db.rpc("adjust_stock", {
        p_store: m.storeId, p_branch: branch, p_product: r.id, p_qty: Math.round(value), p_mode: "set",
        p_unit_cost: null, p_note: "Kiểm kho hàng loạt", p_staff: m.staffId, p_expiry: null, p_batch_code: null,
      }));
    }
    if (error) failed++; else ok++;
  }
  revalidatePath("/inventory"); revalidatePath("/products"); revalidatePath("/pos");
  const msg = `Đã cập nhật ${ok} mặt hàng.${failed ? ` ${failed} mặt hàng lỗi.` : ""}`;
  return redirectMsg(BACK, failed ? "error" : "ok", msg);
}

/** Sửa nhiều mặt hàng cùng lúc, mỗi mặt hàng một giá trị riêng (tồn thực tế, tồn tối thiểu, giá vốn). */
export async function multiEditStock(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const ids = [...new Set(form.getAll("ids").map(String))].filter((i) => UUID.test(i));
  if (ids.length === 0) return redirectMsg(BACK, "error", "Chưa chọn mặt hàng nào.");
  if (ids.length > 300) return redirectMsg(BACK, "error", "Tối đa 300 mặt hàng mỗi lần.");

  const num = (key: string): number | null | "bad" => {
    const raw = toText(form.get(key));
    if (raw === "") return null;
    const n = toInt(raw, -1);
    return n < 0 ? "bad" : n;
  };
  const edits: { id: string; qty: number | null; oldQty: number; min: number | null; cost: number | null }[] = [];
  for (const id of ids) {
    const qty = num(`qty_${id}`), min = num(`min_${id}`), cost = num(`cost_${id}`);
    if (qty === "bad" || min === "bad" || cost === "bad") {
      return redirectMsg(BACK, "error", "Có ô nhập không hợp lệ (phải là số không âm). Chưa lưu gì.");
    }
    edits.push({ id, qty, oldQty: toInt(form.get(`old_${id}`), -1), min, cost });
  }

  const db = getAdminClient();
  const valid = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("products").select("id").eq("store_id", m.storeId).eq("kind", "goods").in("id", ids.slice(i, i + 200));
    for (const r of data ?? []) valid.add(r.id);
  }
  const branch = await defaultBranchId(m.storeId);
  let ok = 0, failed = 0;
  for (const e of edits) {
    if (!valid.has(e.id)) { failed++; continue; }
    const patch: Record<string, number> = {};
    if (e.min !== null) patch.min_stock = e.min;
    if (e.cost !== null) patch.cost = e.cost;
    let bad = false;
    if (Object.keys(patch).length) {
      const { error } = await db.from("products").update(patch).eq("id", e.id).eq("store_id", m.storeId);
      if (error) bad = true;
    }
    if (!bad && e.qty !== null && e.qty !== e.oldQty && branch) {
      const { error } = await db.rpc("adjust_stock", {
        p_store: m.storeId, p_branch: branch, p_product: e.id, p_qty: e.qty, p_mode: "set",
        p_unit_cost: null, p_note: "Sửa tồn kho (nhiều mặt hàng)", p_staff: m.staffId, p_expiry: null, p_batch_code: null,
      });
      if (error) bad = true;
    }
    if (bad) failed++; else ok++;
  }
  revalidatePath("/inventory"); revalidatePath("/products"); revalidatePath("/pos");
  const msg = `Đã lưu ${ok} mặt hàng.${failed ? ` ${failed} mặt hàng lỗi.` : ""}`;
  return redirectMsg(BACK, failed ? "error" : "ok", msg);
}
