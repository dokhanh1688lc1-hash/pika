import { ImageOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImagePicker } from "@/components/ImagePicker";
import { Badge, Field, Notice, PageHeader, SubmitButton, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { getProduct } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";
import { removeProductImage, setProductActive, updateProduct, uploadProductImage } from "../actions";

const KIND = { goods: "Hàng hoá", service: "Dịch vụ", package: "Liệu trình" } as const;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const [{ id }, { error, ok }] = await Promise.all([params, searchParams]);
  const [product, member] = await Promise.all([
    getProduct(id),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  if (!product) notFound();
  const canEdit = member ? can(member.role, "products.manage") : false;

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${product.sku} · ${KIND[product.kind]}`}
        action={
          <Link href="/products" className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            ← Danh sách
          </Link>
        }
      />
      <Notice error={error} ok={ok} />
      {!product.active && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Sản phẩm này đã <Badge tone="amber">ngừng bán</Badge> — không hiện ở POS và danh sách chính.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card space-y-4">
          <h2 className="font-medium">Ảnh sản phẩm</h2>
          <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <ImageOff size={40} />
            )}
          </div>
          {canEdit && (
            <>
              <form action={uploadProductImage} className="space-y-3">
                <input type="hidden" name="id" value={product.id} />
                <ImagePicker current={null} />
                <SubmitButton>Lưu ảnh mới</SubmitButton>
              </form>
              {product.imageUrl && (
                <form action={removeProductImage}>
                  <input type="hidden" name="id" value={product.id} />
                  <button className="text-sm text-rose-700 hover:underline">Xoá ảnh hiện tại</button>
                </form>
              )}
            </>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-4 font-medium">Thông tin</h2>
          {canEdit ? (
            <form action={updateProduct} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={product.id} />
              <Field label="Tên *"><input name="name" required defaultValue={product.name} className={inputClass} /></Field>
              <Field label="Mã (SKU) *"><input name="sku" required defaultValue={product.sku} className={inputClass} /></Field>
              <Field label="Nhóm hàng"><input name="category" defaultValue={product.category} className={inputClass} /></Field>
              <Field label="Giá bán (đ)"><input name="price" inputMode="numeric" defaultValue={String(product.price)} className={inputClass} /></Field>
              <Field label="Giá vốn (đ)"><input name="cost" inputMode="numeric" defaultValue={String(product.cost)} className={inputClass} /></Field>
              {product.kind === "goods" && (
                <Field label="Tồn tối thiểu"><input name="minStock" inputMode="numeric" defaultValue={String(product.minStock)} className={inputClass} /></Field>
              )}
              {product.kind === "package" && (
                <Field label="Số buổi"><input name="sessions" inputMode="numeric" defaultValue={String(product.sessions ?? 0)} className={inputClass} /></Field>
              )}
              <div className="sm:col-span-2"><SubmitButton>Lưu thay đổi</SubmitButton></div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Nhóm</dt><dd>{product.category || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Giá bán</dt><dd>{product.price}</dd></div>
            </dl>
          )}

          {canEdit && (
            <form action={setProductActive} className="mt-6 border-t pt-4">
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="active" value={product.active ? "0" : "1"} />
              <p className="mb-2 text-sm text-slate-500">
                {product.active
                  ? "Ngừng bán sẽ ẩn sản phẩm khỏi POS. Lịch sử đơn hàng và tồn kho vẫn được giữ nguyên."
                  : "Bán lại để sản phẩm hiện trở lại ở POS và danh sách."}
              </p>
              <button className={`rounded-xl px-4 py-2 text-sm font-medium ${
                product.active ? "border border-rose-200 text-rose-700 hover:bg-rose-50" : "bg-brand-600 text-white hover:bg-brand-700"
              }`}>
                {product.active ? "Ngừng bán" : "Bán lại"}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
