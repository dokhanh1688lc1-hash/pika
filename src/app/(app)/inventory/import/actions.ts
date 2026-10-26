"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, requireMember } from "@/lib/guard";
import { cellText, dateCell, intCell, pick, readSheet } from "@/lib/excel";
import type { ImportResult } from "@/lib/import-result";
import { getAdminClient } from "@/lib/supabase/admin";

const MAX_SHOW = 30;

interface Line { n: number; sku: string; qty: number; unitCost: number | null; expiry: string | null; batch: string; note: string }

export async function importStock(_prev: ImportResult | null, form: FormData): Promise<ImportResult> {
  const m = await requireMember("inventory.manage", "/inventory");
  const mode = form.get("mode") === "set" ? "set" : "in";
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Chưa chọn file.", errors: [] };
  const sheet = await readSheet(file);
  if ("error" in sheet) return { ok: false, message: sheet.error, errors: [] };

  const errors: string[] = [];
  const lines: Line[] = [];
  for (const r of sheet.rows) {
    const c = r.cells;
    const err = (msg: string) => errors.push(`Dòng ${r.n}: ${msg}`);
    const sku = cellText(pick(c, ["masp", "masku", "ma", "sku"], ["ma"])).toUpperCase();
    if (!sku) { err("thiếu Mã SP."); continue; }
    const qty = intCell(pick(c, ["soluong", "sl"], ["soluong"]));
    if (qty === null || qty === undefined) { err("Số lượng trống hoặc không phải số."); continue; }
    if (qty < 0 || (mode === "in" && qty === 0)) { err(mode === "in" ? "Số lượng phải > 0." : "Số lượng không được âm."); continue; }
    const unitCost = intCell(pick(c, ["gianhap", "giavon"], ["gianhap", "giavon"]));
    if (unitCost === undefined || (unitCost !== null && unitCost < 0)) { err("Giá nhập không hợp lệ."); continue; }
    const expiry = dateCell(pick(c, ["hansudung", "han", "hsd"], ["han"]));
    if (expiry === undefined) { err("Hạn sử dụng sai định dạng (dùng dd/mm/yyyy)."); continue; }
    lines.push({
      n: r.n, sku, qty, unitCost, expiry, batch: cellText(pick(c, ["solo", "malo", "lo"], ["solo", "malo"])),
      note: cellText(pick(c, ["ghichu"], ["ghichu"])),
    });
  }
  if (errors.length) return fail(errors);

  const db = getAdminClient();
  const products = new Map<string, { id: string; kind: string }>();
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db.from("products").select("id, sku, kind")
      .eq("store_id", m.storeId).eq("active", true).range(page * 1000, page * 1000 + 999);
    if (error) return { ok: false, message: `Lỗi đọc dữ liệu: ${error.message}`, errors: [] };
    for (const p of data ?? []) products.set(String(p.sku).toUpperCase(), { id: p.id, kind: p.kind });
    if ((data?.length ?? 0) < 1000) break;
  }
  const seen = new Set<string>();
  for (const l of lines) {
    const p = products.get(l.sku);
    if (!p) errors.push(`Dòng ${l.n}: không có sản phẩm mã "${l.sku}".`);
    else if (p.kind !== "goods") errors.push(`Dòng ${l.n}: "${l.sku}" là dịch vụ/liệu trình, không có tồn kho.`);
    if (mode === "set") {
      if (seen.has(l.sku)) errors.push(`Dòng ${l.n}: mã "${l.sku}" bị lặp (kiểm kho chỉ 1 dòng mỗi mã).`);
      seen.add(l.sku);
    }
  }
  if (errors.length) return fail(errors);

  const branch = await defaultBranchId(m.storeId);
  if (!branch) return { ok: false, message: "Cửa hàng chưa có chi nhánh.", errors: [] };

  let done = 0;
  const runtime: string[] = [];
  for (const l of lines) {
    const { error } = await db.rpc("adjust_stock", {
      p_store: m.storeId, p_branch: branch, p_product: products.get(l.sku)!.id, p_qty: l.qty, p_mode: mode,
      p_unit_cost: mode === "in" && l.unitCost && l.unitCost > 0 ? l.unitCost : null,
      p_note: l.note || (mode === "in" ? "Nhập kho (Excel)" : "Kiểm kho (Excel)"), p_staff: m.staffId,
      p_expiry: mode === "in" ? l.expiry : null, p_batch_code: mode === "in" && l.batch ? l.batch : null,
    });
    if (error) runtime.push(`Dòng ${l.n} (${l.sku}): ${error.message}`); else done++;
  }
  revalidatePath("/inventory"); revalidatePath("/products"); revalidatePath("/expiry"); revalidatePath("/pos");
  return {
    ok: runtime.length === 0,
    message: `${mode === "in" ? "Đã nhập kho" : "Đã kiểm kho"} ${done}/${lines.length} dòng.${runtime.length ? ` ${runtime.length} dòng lỗi.` : ""}`,
    errors: runtime.slice(0, MAX_SHOW),
  };
}

function fail(errors: string[]): ImportResult {
  const extra = errors.length > MAX_SHOW ? [`... và ${errors.length - MAX_SHOW} lỗi khác`] : [];
  return { ok: false, message: `Có ${errors.length} lỗi — chưa lưu gì. Sửa file rồi nhập lại.`, errors: [...errors.slice(0, MAX_SHOW), ...extra] };
}
