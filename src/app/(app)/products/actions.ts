"use server";

import { revalidatePath } from "next/cache";
import { defaultBranchId, redirectMsg, requireMember } from "@/lib/guard";
import { toInt, toText } from "@/lib/parse";
import { deleteProductImage, saveProductImage } from "@/lib/storage";
import { getAdminClient } from "@/lib/supabase/admin";

const BACK = "/products";
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function pickFile(v: FormDataEntryValue | null): File | null {
  return v instanceof File && v.size > 0 ? v : null;
}

/** Tìm nhóm hàng theo tên, chưa có thì tạo mới. */
async function categoryIdFor(storeId: string, name: string): Promise<string | null> {
  if (!name) return null;
  const db = getAdminClient();
  const { data: found } = await db
    .from("product_categories").select("id").eq("store_id", storeId).eq("name", name).maybeSingle();
  if (found) return found.id;
  const { data: created } = await db
    .from("product_categories").insert({ store_id: storeId, name }).select("id").single();
  return created?.id ?? null;
}

function refresh(id?: string) {
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/pos");
  if (id) revalidatePath(`/products/${id}`);
}

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
  const image = pickFile(form.get("image"));

  if (!name || !sku) return redirectMsg(BACK, "error", "Nhập tên và mã sản phẩm.");
  if (!["goods", "service", "package"].includes(kind)) return redirectMsg(BACK, "error", "Loại không hợp lệ.");
  if (price < 0 || cost < 0 || minStock < 0 || openingStock < 0) {
    return redirectMsg(BACK, "error", "Giá và số lượng không được âm.");
  }
  if (kind === "package" && sessions <= 0) return redirectMsg(BACK, "error", "Liệu trình cần số buổi lớn hơn 0.");

  const categoryId = await categoryIdFor(m.storeId, categoryName);
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
        p_expiry: DATE.test(openingExpiry) ? openingExpiry : null,
      });
    }
  }

  let imageNote = "";
  if (image) {
    const saved = await saveProductImage(m.storeId, product.id, image);
    if ("url" in saved) {
      await db.from("products").update({ image_url: saved.url }).eq("id", product.id).eq("store_id", m.storeId);
    } else {
      imageNote = ` Nhưng chưa lưu được ảnh: ${saved.error} (thêm lại ảnh ở trang chi tiết).`;
    }
  }
  refresh();
  return redirectMsg(BACK, "ok", `Đã thêm "${name}".${imageNote}`);
}

/** Sửa thông tin sản phẩm. Không đổi loại (hàng hoá/dịch vụ/liệu trình) để tránh lệch tồn kho. */
export async function updateProduct(form: FormData) {
  const id = toText(form.get("id"));
  const back = `${BACK}/${id}`;
  const m = await requireMember("products.manage", UUID.test(id) ? back : BACK);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Sản phẩm không hợp lệ.");
  const db = getAdminClient();

  const { data: current } = await db
    .from("products").select("kind").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!current) return redirectMsg(BACK, "error", "Không tìm thấy sản phẩm.");

  const name = toText(form.get("name"));
  const sku = toText(form.get("sku")).toUpperCase();
  const price = toInt(form.get("price"));
  const cost = toInt(form.get("cost"));
  const minStock = toInt(form.get("minStock"));
  const sessions = toInt(form.get("sessions"), 0);
  if (!name || !sku) return redirectMsg(back, "error", "Nhập tên và mã sản phẩm.");
  if (price < 0 || cost < 0 || minStock < 0) return redirectMsg(back, "error", "Giá và số lượng không được âm.");
  if (current.kind === "package" && sessions <= 0) return redirectMsg(back, "error", "Liệu trình cần số buổi lớn hơn 0.");

  const categoryId = await categoryIdFor(m.storeId, toText(form.get("category")));
  const { error } = await db
    .from("products")
    .update({
      name, sku, price, cost, category_id: categoryId,
      min_stock: current.kind === "goods" ? minStock : 0,
      package_sessions: current.kind === "package" ? sessions : null,
    })
    .eq("id", id)
    .eq("store_id", m.storeId);
  if (error) {
    const dup = error.code === "23505";
    return redirectMsg(back, "error", dup ? `Mã "${sku}" đã tồn tại.` : `Không lưu được: ${error.message}`);
  }
  refresh(id);
  return redirectMsg(back, "ok", "Đã lưu thay đổi.");
}

/** Ngừng bán (ẩn khỏi POS và danh sách) hoặc bán lại. Không xoá để giữ lịch sử đơn hàng. */
export async function setProductActive(form: FormData) {
  const id = toText(form.get("id"));
  const active = toText(form.get("active")) === "1";
  const back = `${BACK}/${id}`;
  const m = await requireMember("products.manage", UUID.test(id) ? back : BACK);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Sản phẩm không hợp lệ.");
  const { error } = await getAdminClient()
    .from("products").update({ active }).eq("id", id).eq("store_id", m.storeId);
  if (error) return redirectMsg(back, "error", `Không cập nhật được: ${error.message}`);
  refresh(id);
  return redirectMsg(back, "ok", active ? "Đã bán lại sản phẩm." : "Đã ngừng bán sản phẩm (ẩn khỏi POS).");
}

export async function uploadProductImage(form: FormData) {
  const id = toText(form.get("id"));
  const back = `${BACK}/${id}`;
  const m = await requireMember("products.manage", UUID.test(id) ? back : BACK);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Sản phẩm không hợp lệ.");
  const image = pickFile(form.get("image"));
  if (!image) return redirectMsg(back, "error", "Chọn một ảnh trước khi lưu.");

  const db = getAdminClient();
  const { data: product } = await db
    .from("products").select("image_url").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!product) return redirectMsg(BACK, "error", "Không tìm thấy sản phẩm.");

  const saved = await saveProductImage(m.storeId, id, image);
  if (!("url" in saved)) return redirectMsg(back, "error", saved.error);
  const { error } = await db.from("products").update({ image_url: saved.url }).eq("id", id).eq("store_id", m.storeId);
  if (error) {
    await deleteProductImage(saved.url);
    return redirectMsg(back, "error", `Không lưu được ảnh: ${error.message}`);
  }
  await deleteProductImage(product.image_url);
  refresh(id);
  return redirectMsg(back, "ok", "Đã cập nhật ảnh.");
}

export async function removeProductImage(form: FormData) {
  const id = toText(form.get("id"));
  const back = `${BACK}/${id}`;
  const m = await requireMember("products.manage", UUID.test(id) ? back : BACK);
  if (!UUID.test(id)) return redirectMsg(BACK, "error", "Sản phẩm không hợp lệ.");
  const db = getAdminClient();
  const { data: product } = await db
    .from("products").select("image_url").eq("id", id).eq("store_id", m.storeId).maybeSingle();
  if (!product) return redirectMsg(BACK, "error", "Không tìm thấy sản phẩm.");
  await db.from("products").update({ image_url: null }).eq("id", id).eq("store_id", m.storeId);
  await deleteProductImage(product.image_url);
  refresh(id);
  return redirectMsg(back, "ok", "Đã xoá ảnh.");
}
