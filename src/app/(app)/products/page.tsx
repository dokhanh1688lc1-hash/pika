import { ImageOff } from "lucide-react";
import Link from "next/link";
import { ImagePicker } from "@/components/ImagePicker";
import { Badge, Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listCategories, listInactiveProducts, listProducts } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { can } from "@/lib/rbac";
import { ConfirmForm } from "@/components/ConfirmButton";
import { createProduct, deleteCategory, renameCategory } from "./actions";

const KIND = { goods: "Hàng hoá", service: "Dịch vụ", package: "Liệu trình" } as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [products, inactive, categories, member] = await Promise.all([
    listProducts(),
    listInactiveProducts(),
    listCategories(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "products.manage") : false;

  return (
    <>
      <PageHeader title="Hàng hoá & dịch vụ" subtitle="Danh mục sản phẩm, dịch vụ và liệu trình. Bấm vào tên để xem, sửa và đổi ảnh." />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/api/excel/export?type=products" className="btn-secondary">Xuất Excel</a>
        {canEdit && <Link href="/products/import" className="btn-secondary">Nhập Excel</Link>}
        {canEdit && <Link href="/products/prices" className="btn-secondary">Sửa giá hàng loạt</Link>}
      </div>
      <Notice error={error} ok={ok} />

      {canEdit && (
        <details className="card mb-6">
          <summary className="cursor-pointer font-medium">+ Thêm sản phẩm / dịch vụ / liệu trình</summary>
          <form action={createProduct} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3"><ImagePicker /></div>
            <Field label="Tên *"><input name="name" required className={inputClass} /></Field>
            <Field label="Mã (SKU) *"><input name="sku" required className={inputClass} placeholder="SP001" /></Field>
            <Field label="Loại">
              <select name="kind" className={inputClass} defaultValue="goods">
                <option value="goods">Hàng hoá (có tồn kho)</option>
                <option value="service">Dịch vụ</option>
                <option value="package">Liệu trình (nhiều buổi)</option>
              </select>
            </Field>
            <Field label="Nhóm hàng"><input name="category" className={inputClass} placeholder="Chăm sóc da" /></Field>
            <Field label="Giá bán (đ)"><input name="price" inputMode="numeric" className={inputClass} defaultValue="0" /></Field>
            <Field label="Giá vốn (đ)"><input name="cost" inputMode="numeric" className={inputClass} defaultValue="0" /></Field>
            <Field label="Tồn tối thiểu (hàng hoá)"><input name="minStock" inputMode="numeric" className={inputClass} defaultValue="0" /></Field>
            <Field label="Tồn đầu kỳ (hàng hoá)"><input name="openingStock" inputMode="numeric" className={inputClass} defaultValue="0" /></Field>
            <Field label="Hạn sử dụng của tồn đầu"><input name="openingExpiry" type="date" className={inputClass} /></Field>
            <Field label="Số buổi (liệu trình)"><input name="sessions" inputMode="numeric" className={inputClass} defaultValue="0" /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>Lưu sản phẩm</SubmitButton></div>
          </form>
        </details>
      )}

      <Table head={["", "Mã", "Tên", "Loại", "Nhóm", "Giá bán", "Giá vốn", "Tồn"]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="td w-14">
              <Thumb url={p.imageUrl} />
            </td>
            <td className="td text-slate-500">{p.sku}</td>
            <td className="td font-medium">
              <Link href={`/products/${p.id}`} className="text-brand-700 hover:underline">{p.name}</Link>
            </td>
            <td className="td"><Badge tone="violet">{KIND[p.kind]}</Badge></td>
            <td className="td">{p.category}</td>
            <td className="td">{vnd(p.price)}</td>
            <td className="td">{p.cost ? vnd(p.cost) : "—"}</td>
            <td className="td">{p.stock ?? "—"}</td>
          </tr>
        ))}
        {products.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={8}>Chưa có sản phẩm nào. Bấm "+ Thêm" ở trên để bắt đầu.</td></tr>
        )}
      </Table>

      {canEdit && categories.length > 0 && (
        <details className="card mt-6">
          <summary className="cursor-pointer font-medium text-slate-600">Quản lý nhóm hàng ({categories.length})</summary>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <form action={renameCategory} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="name" required defaultValue={c.name} className={`${inputClass} max-w-xs`} />
                  <span className="text-xs text-slate-400">{c.products} sản phẩm</span>
                  <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-100">Đổi tên</button>
                </form>
                <ConfirmForm
                  action={deleteCategory}
                  hidden={{ id: c.id }}
                  message={`Xoá nhóm "${c.name}"? ${c.products} sản phẩm trong nhóm sẽ chuyển sang chưa phân nhóm.`}
                >
                  <button className="text-xs text-rose-700 hover:underline">Xoá nhóm</button>
                </ConfirmForm>
              </li>
            ))}
          </ul>
        </details>
      )}

      {inactive.length > 0 && (
        <details className="card mt-6">
          <summary className="cursor-pointer font-medium text-slate-600">Đã ngừng bán ({inactive.length})</summary>
          <ul className="mt-3 space-y-2 text-sm">
            {inactive.map((p) => (
              <li key={p.id} className="flex items-center justify-between">
                <span>{p.sku} · {p.name}</span>
                <Link href={`/products/${p.id}`} className="text-brand-700 hover:underline">Xem / bán lại</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Thumb({ url }: { url?: string | null }) {
  return (
    <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageOff size={16} />
      )}
    </span>
  );
}
