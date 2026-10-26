"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, requireMember } from "@/lib/guard";
import { cellText, intCell, pick, readSheet } from "@/lib/excel";
import type { ImportResult } from "@/lib/import-result";
import { getAdminClient } from "@/lib/supabase/admin";

const MAX_SHOW = 30;
type Kind = "goods" | "service" | "package";

function parseKind(raw: string): Kind | null | undefined {
  if (!raw) return null;
  const t = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/hang|goods|san pham/.test(t)) return "goods";
  if (/dich vu|service/.test(t)) return "service";
  if (/lieu trinh|package/.test(t)) return "package";
  return undefined;
}

interface Plan {
  n: number; sku: string; name: string; kind: Kind | null; category: string | null;
  price: number | null; cost: number | null; minStock: number | null; sessions: number | null; opening: number | null;
}

export async function importProducts(_prev: ImportResult | null, form: FormData): Promise<ImportResult> {
  const m = await requireMember("products.manage", "/products");
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Chưa chọn file.", errors: [] };
  const sheet = await readSheet(file);
  if ("error" in sheet) return { ok: false, message: sheet.error, errors: [] };

  const errors: string[] = [];
  const plans: Plan[] = [];
  const seen = new Set<string>();
  for (const r of sheet.rows) {
    const c = r.cells;
    const err = (msg: string) => errors.push(`Dòng ${r.n}: ${msg}`);
    const sku = cellText(pick(c, ["masku", "ma", "sku", "mahang", "masp"], ["ma"])).toUpperCase();
    const name = cellText(pick(c, ["ten", "tenhang", "tensanpham", "tenhanghoa"], ["ten"]));
    if (!sku) { err("thiếu Mã (SKU)."); continue; }
    if (seen.has(sku)) { err(`mã "${sku}" bị lặp trong file.`); continue; }
    seen.add(sku);

    const kind = parseKind(cellText(pick(c, ["loai"], ["loai"])));
    if (kind === undefined) { err(`Loại không hợp lệ (dùng: Hàng hoá, Dịch vụ, Liệu trình).`); continue; }
    const nums: Record<string, number | null> = {};
    let bad = false;
    for (const [key, ex, pre, label] of [
      ["price", ["giaban", "gia"], ["giaban"], "Giá bán"],
      ["cost", ["giavon", "gianhap"], ["giavon", "gianhap"], "Giá vốn"],
      ["minStock", ["tontoithieu"], ["tontoithieu", "tonmin"], "Tồn tối thiểu"],
      ["sessions", ["sobuoi"], ["sobuoi"], "Số buổi"],
      ["opening", ["tondauky"], ["tondauky"], "Tồn đầu kỳ"],
    ] as [string, string[], string[], string][]) {
      const v = intCell(pick(c, ex, pre));
      if (v === undefined) { err(`${label} không phải số.`); bad = true; break; }
      if (v !== null && v < 0) { err(`${label} không được âm.`); bad = true; break; }
      nums[key] = v;
    }
    if (bad) continue;
    const catRaw = pick(c, ["nhomhang", "nhom", "danhmuc"], ["nhom"]);
    plans.push({
      n: r.n, sku, name, kind,
      category: catRaw === undefined ? null : cellText(catRaw),
      price: nums.price, cost: nums.cost, minStock: nums.minStock, sessions: nums.sessions, opening: nums.opening,
    });
  }
  if (errors.length) return fail(errors);

  const db = getAdminClient();
  // Sản phẩm hiện có (kể cả đã ngừng bán, vì SKU là duy nhất)
  const existing = new Map<string, { id: string; kind: Kind; active: boolean }>();
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db.from("products").select("id, sku, kind, active")
      .eq("store_id", m.storeId).range(page * 1000, page * 1000 + 999);
    if (error) return { ok: false, message: `Lỗi đọc dữ liệu: ${error.message}`, errors: [] };
    for (const p of data ?? []) existing.set(String(p.sku).toUpperCase(), { id: p.id, kind: p.kind, active: p.active });
    if ((data?.length ?? 0) < 1000) break;
  }

  // Kiểm tra toàn bộ trước khi ghi
  for (const p of plans) {
    const ex = existing.get(p.sku);
    const kind = ex ? ex.kind : p.kind ?? "goods";
    if (ex && p.kind && p.kind !== ex.kind) errors.push(`Dòng ${p.n}: "${p.sku}" đã có, không đổi được loại.`);
    if (!ex && !p.name) errors.push(`Dòng ${p.n}: mã mới "${p.sku}" cần có Tên.`);
    if (!ex && kind === "package" && !(p.sessions && p.sessions > 0)) errors.push(`Dòng ${p.n}: liệu trình mới cần Số buổi > 0.`);
    if (ex && ex.kind === "package" && p.sessions === 0) errors.push(`Dòng ${p.n}: Số buổi phải > 0.`);
    if (p.opening && p.opening > 0 && (kind !== "goods")) errors.push(`Dòng ${p.n}: chỉ hàng hoá mới có tồn đầu kỳ.`);
    if (ex && p.opening && p.opening > 0) errors.push(`Dòng ${p.n}: "${p.sku}" đã có; muốn đổi tồn kho hãy dùng Nhập Excel ở trang Kho.`);
  }
  if (errors.length) return fail(errors);

  const catIds = new Map<string, string | null>();
  const catFor = async (name: string): Promise<string | null> => {
    if (!name) return null;
    if (catIds.has(name)) return catIds.get(name)!;
    const { data: found } = await db.from("product_categories").select("id").eq("store_id", m.storeId).eq("name", name).maybeSingle();
    let id: string | null = found?.id ?? null;
    if (!id) {
      const { data: created } = await db.from("product_categories").insert({ store_id: m.storeId, name }).select("id").single();
      id = created?.id ?? null;
    }
    catIds.set(name, id);
    return id;
  };

  const branch = await defaultBranchId(m.storeId);
  let created = 0, updated = 0, stocked = 0;
  const runtime: string[] = [];
  for (const p of plans) {
    const ex = existing.get(p.sku);
    const patch: Record<string, unknown> = {};
    if (p.name) patch.name = p.name;
    if (p.category !== null) patch.category_id = await catFor(p.category);
    if (p.price !== null) patch.price = p.price;
    if (p.cost !== null) patch.cost = p.cost;
    if (p.minStock !== null && (ex ? ex.kind : p.kind ?? "goods") === "goods") patch.min_stock = p.minStock;
    if (p.sessions !== null && (ex ? ex.kind : p.kind) === "package") patch.package_sessions = p.sessions;

    if (ex) {
      if (Object.keys(patch).length === 0) continue;
      const { error } = await db.from("products").update(patch).eq("id", ex.id).eq("store_id", m.storeId);
      if (error) runtime.push(`Dòng ${p.n} (${p.sku}): ${error.message}`); else updated++;
    } else {
      const kind = p.kind ?? "goods";
      const { data, error } = await db.from("products").insert({
        store_id: m.storeId, sku: p.sku, kind, price: 0, cost: 0, min_stock: 0, ...patch,
      }).select("id").single();
      if (error || !data) { runtime.push(`Dòng ${p.n} (${p.sku}): ${error?.message ?? "không lưu được"}`); continue; }
      created++;
      if (kind === "goods" && p.opening && p.opening > 0 && branch) {
        const { error: e2 } = await db.rpc("adjust_stock", {
          p_store: m.storeId, p_branch: branch, p_product: data.id, p_qty: p.opening, p_mode: "in",
          p_unit_cost: p.cost && p.cost > 0 ? p.cost : null, p_note: "Tồn đầu kỳ (nhập Excel)", p_staff: m.staffId,
          p_expiry: null, p_batch_code: null,
        });
        if (e2) runtime.push(`Dòng ${p.n} (${p.sku}): đã tạo nhưng nhập tồn lỗi: ${e2.message}`); else stocked++;
      }
    }
  }
  revalidatePath("/products"); revalidatePath("/inventory"); revalidatePath("/pos");
  const parts = [`Thêm mới ${created}`, `cập nhật ${updated}`];
  if (stocked) parts.push(`nhập tồn đầu ${stocked}`);
  return {
    ok: runtime.length === 0,
    message: `Hoàn tất: ${parts.join(", ")} sản phẩm.${runtime.length ? ` Có ${runtime.length} dòng lỗi khi lưu.` : ""}`,
    errors: runtime.slice(0, MAX_SHOW),
  };
}

function fail(errors: string[]): ImportResult {
  const extra = errors.length > MAX_SHOW ? [`... và ${errors.length - MAX_SHOW} lỗi khác`] : [];
  return {
    ok: false,
    message: `Có ${errors.length} lỗi — chưa lưu gì. Sửa file rồi nhập lại.`,
    errors: [...errors.slice(0, MAX_SHOW), ...extra],
  };
}
