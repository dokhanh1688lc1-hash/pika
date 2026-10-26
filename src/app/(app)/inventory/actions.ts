"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { applyPriceRule, validateRule, type PriceOp, type PriceRule } from "@/lib/pricing";
import { deleteProductImage, ensureBucket, saveProductImage } from "@/lib/storage";
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

const MAX_IMAGE_JOBS = 100;

function pickFiles(form: FormData, key: string): File[] {
  return form.getAll(key).filter((v): v is File => v instanceof File && v.size > 0);
}

/** Gán ảnh cho một sản phẩm: tải bản riêng, cập nhật liên kết, rồi xoá ảnh cũ của chính sản phẩm đó. */
async function setImage(storeId: string, p: { id: string; image_url: string | null }, file: File): Promise<string | null> {
  const saved = await saveProductImage(storeId, p.id, file, { skipBucketCheck: true });
  if (!("url" in saved)) return saved.error;
  const { error } = await getAdminClient().from("products").update({ image_url: saved.url }).eq("id", p.id).eq("store_id", storeId);
  if (error) { await deleteProductImage(saved.url); return error.message; }
  await deleteProductImage(p.image_url);
  return null;
}

async function runInBatches<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/** Đặt cùng một ảnh cho các mặt hàng đã chọn hoặc cho cả một nhóm hàng. */
export async function bulkSetImage(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const file = pickFiles(form, "image")[0];
  if (!file) return redirectMsg(BACK, "error", "Chọn một ảnh trước.");
  const target = toText(form.get("target"));
  const db = getAdminClient();

  let q = db.from("products").select("id, image_url").eq("store_id", m.storeId).eq("kind", "goods").eq("active", true);
  if (target === "category") {
    const name = toText(form.get("category"));
    if (!name) return redirectMsg(BACK, "error", "Chọn nhóm hàng.");
    const { data: cat } = await db.from("product_categories").select("id").eq("store_id", m.storeId).eq("name", name).maybeSingle();
    if (!cat) return redirectMsg(BACK, "error", "Không tìm thấy nhóm hàng.");
    q = q.eq("category_id", cat.id);
  } else {
    const ids = [...new Set(form.getAll("ids").map(String))].filter((i) => UUID.test(i));
    if (ids.length === 0) return redirectMsg(BACK, "error", "Chưa chọn mặt hàng nào.");
    q = q.in("id", ids.slice(0, 500));
  }
  const { data: prods, error } = await q.limit(MAX_IMAGE_JOBS + 1);
  if (error) return redirectMsg(BACK, "error", error.message);
  if (!prods?.length) return redirectMsg(BACK, "error", "Không có mặt hàng nào để đổi ảnh.");
  if (prods.length > MAX_IMAGE_JOBS) {
    return redirectMsg(BACK, "error", `Tối đa ${MAX_IMAGE_JOBS} mặt hàng mỗi lần. Hãy lọc nhỏ hơn rồi làm lại.`);
  }
  const bad = await ensureBucket();
  if (bad) return redirectMsg(BACK, "error", bad);

  let ok = 0, firstErr = "";
  await runInBatches(prods, 5, async (p) => {
    const err = await setImage(m.storeId, p, file);
    if (err) firstErr ||= err; else ok++;
  });
  revalidatePath("/inventory"); revalidatePath("/products"); revalidatePath("/pos");
  const failed = prods.length - ok;
  return redirectMsg(BACK, failed ? "error" : "ok",
    `Đã đổi ảnh cho ${ok}/${prods.length} mặt hàng.${failed ? ` Lỗi: ${firstErr}` : ""}`);
}

/** Tải nhiều ảnh một lúc: tên file (bỏ đuôi) trùng mã sản phẩm thì gán ảnh cho sản phẩm đó. */
export async function importImagesBySku(form: FormData) {
  const m = await requireMember("inventory.manage", BACK);
  const files = pickFiles(form, "images");
  if (files.length === 0) return redirectMsg(BACK, "error", "Chọn các file ảnh trước.");
  if (files.length > MAX_IMAGE_JOBS) return redirectMsg(BACK, "error", `Tối đa ${MAX_IMAGE_JOBS} ảnh mỗi lần.`);

  const db = getAdminClient();
  const skus = files.map((f) => f.name.replace(/\.[^.]+$/, "").trim().toUpperCase());
  const found = new Map<string, { id: string; image_url: string | null }>();
  const { data: prods } = await db.from("products").select("id, sku, image_url")
    .eq("store_id", m.storeId).eq("active", true).in("sku", [...new Set(skus)]);
  for (const p of prods ?? []) found.set(String(p.sku).toUpperCase(), { id: p.id, image_url: p.image_url });

  const bad = await ensureBucket();
  if (bad) return redirectMsg(BACK, "error", bad);

  const missing: string[] = [];
  const jobs: { sku: string; file: File; p: { id: string; image_url: string | null } }[] = [];
  const used = new Set<string>();
  files.forEach((file, i) => {
    const p = found.get(skus[i]);
    if (!p) missing.push(file.name);
    else if (used.has(skus[i])) missing.push(`${file.name} (trùng mã)`);
    else { used.add(skus[i]); jobs.push({ sku: skus[i], file, p }); }
  });

  let ok = 0, firstErr = "";
  await runInBatches(jobs, 5, async (j) => {
    const err = await setImage(m.storeId, j.p, j.file);
    if (err) firstErr ||= err; else ok++;
  });
  revalidatePath("/inventory"); revalidatePath("/products"); revalidatePath("/pos");
  const parts = [`Đã gán ảnh cho ${ok}/${files.length} file.`];
  if (missing.length) parts.push(`Không khớp mã: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}.`);
  if (firstErr) parts.push(`Lỗi: ${firstErr}`);
  return redirectMsg(BACK, missing.length || firstErr ? "error" : "ok", parts.join(" "));
}
