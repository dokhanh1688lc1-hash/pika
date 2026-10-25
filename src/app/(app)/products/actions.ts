"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/products";

export async function createProduct(form: FormData) {
  const m = await requireMember("products.manage", BACK);
  const db = getAdminClient();

  const name = toText(form.get("name"));
  const sku = toText(form.get("sku")).toUpperCase();
  const kind = toText(form.get("kind"));
  const categoryName = toText(form.get("category"));
  const price = toInt(form.get("price"));
  const cost = toInt(form.get("cost"));
  const minStock = toInt(form.get("minStock"));
  const sessions = toInt(form.get("sessions"), 0);
  const openingStock = toInt(form.get("openingStock"));
  const openingExpiry = toText(form.get("openingExpiry"));

  if (!name || !sku) return redirectMsg(BACK, "error", "Nhập tên và mã sản phẩm.");
  if (!["goods", "service", "package"].includes(kind)) return redirectMsg(BACK, "error", "Loại không hợp lệ.");
  if (price < 0 || cost < 0 || minStock < 0 || openingStock < 0) {
    return redirectMsg(BACK, "error", "Giá và số lượng không được âm.");
  }
  if (kind === "package" && sessions <= 0) return redirectMsg(BACK, "error", "Liệu trình cần số buổi lớn hơn 0.");

  let categoryId: string | null = null;
  if (categoryName) {
    const { data: found } = await db
      .from("product_categories").select("id").eq("store_id", m.storeId).eq("name", categoryName).maybeSingle();
    if (found) categoryId = found.id;
    else {
      const { data: created } = await db
        .from("product_categories").insert({ store_id: m.storeId, name: categoryName }).select("id").single();
      categoryId = created?.id ?? null;
    }
  }

  const { data: product, error } = await db
    .from("products")
    .insert({
      store_id: m.storeId, category_id: categoryId, sku, name, kind, price, cost,
      min_stock: kind === "goods" ? minStock : 0,
      package_sessions: kind === "package" ? sessions : null,
    })
    .select("id")
    .single();
  if (error || !product) {
    const dup = error?.code === "23505";
    return redirectMsg(BACK, "error", dup ? `Mã "${sku}" đã tồn tại.` : `Không lưu được: ${error?.message ?? ""}`);
  }

  if (kind === "goods" && openingStock > 0) {
    const branch = await defaultBranchId(m.storeId);
    if (branch) {
      await db.rpc("adjust_stock", {
        p_store: m.storeId, p_branch: branch, p_product: product.id, p_qty: openingStock,
        p_mode: "in", p_unit_cost: cost || null, p_note: "Tồn đầu kỳ", p_staff: m.staffId,
        p_expiry: /^\d{4}-\d{2}-\d{2}$/.test(openingExpiry) ? openingExpiry : null,
      });
    }
  }
  revalidatePath("/products");
  revalidatePath("/inventory");
  return redirectMsg(BACK, "ok", `Đã thêm "${name}".`);
}
