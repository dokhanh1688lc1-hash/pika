import { ImageOff, Plus, Search } from "lucide-react";
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
  searchParams: Promise<{ error?: string; ok?: string; q?: string; kind?: string; cat?: string; new?: string }>;
}) {
  const { error, ok, q = "", kind = "", cat = "", new: openNew } = await searchParams;
  const [products, inactive, categories, member] = await Promise.all([
    listProducts(),
    listInactiveProducts(),
    listCategories(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "products.manage") : false;

  const needle = q.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      (!kind || p.kind === kind) &&
      (!cat || p.category === cat) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)),
  );
  const LIMIT = 200;
  const shown = filtered.slice(0, LIMIT);
  const totalStock = filtered.reduce((a, p) => a + (p.stock ?? 0), 0);

  return (
    <>
      <PageHeader title="Hàng hoá" subtitle="Danh mục sản phẩm, dịch vụ và liệu trình. Bấm vào tên để xem, sửa và đổi ảnh." />
      <form className="mb-3 flex flex-wrap gap-2" method="get">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Tìm tên hoặc mã hàng..." className={`${inputClass} rounded-full pl-10`} />
        </div>
        <select name="kind" defaultValue={kind} className="rounded-full border border-pink-100 bg-white px-4 py-2 text-sm">
          <option value="">Tất cả loại hàng</option>
          {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select name="cat" defaultValue={cat} className="max-w-[12rem] rounded-full border border-pink-100 bg-white px-4 py-2 text-sm">
          <option value="">Mọi nhóm</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <button className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white">Lọc</button>
      </form>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <a href="/api/excel/export?type=products" className="btn-secondary shrink-0">Xuất Excel</a>
        {canEdit && <Link href="/products/import" className="btn-secondary shrink-0">Nhập Excel</Link>}
        {canEdit && <Link href="/products/prices" className="btn-secondary shrink-0">Sửa giá hàng loạt</Link>}
      </div>
      <Notice error={error} ok={ok} />

      {canEdit && (
        <details id="new" className="card mb-6" open={openNew === "1"}>
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

      <div className="card mb-3 flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Tổng tồn</p>
          <p className="text-sm text-slate-500">{filtered.length.toLocaleString("vi-VN")} hàng hoá</p>
        </div>
        <p className="text-xl font-semibold">{totalStock.toLocaleString("vi-VN")}</p>
      </div>

      {/* Điện thoại: danh sách thẻ */}
      <ul className="card divide-y divide-pink-100 p-0 md:hidden">
        {shown.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-brand-50">
              <Thumb url={p.imageUrl} big />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-base font-medium leading-snug">{p.name}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500">{p.sku}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-semibold">{vnd(p.price)}</p>
                {p.stock !== null ? (
                  <p className={`text-sm ${p.stock <= p.minStock ? "text-rose-600" : "text-slate-500"}`}>Tồn: {p.stock}</p>
                ) : (
                  <p className="text-sm text-slate-400">{KIND[p.kind]}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Không có sản phẩm phù hợp.</li>}
      </ul>

      {/* Máy tính: bảng */}
      <div className="hidden md:block">
      <Table head={["", "Mã", "Tên", "Loại", "Nhóm", "Giá bán", "Giá vốn", "Tồn", ""]}>
        {shown.map((p) => (
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
            <td className="td"><Link href={`/products/${p.id}`} className="text-brand-700 hover:underline">{canEdit ? "Sửa" : "Xem"}</Link></td>
          </tr>
        ))}
        {shown.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={9}>Chưa có sản phẩm nào. Bấm "+ Thêm" ở trên để bắt đầu.</td></tr>
        )}
      </Table>
      </div>
      {filtered.length > LIMIT && (
        <p className="mt-2 text-center text-sm text-slate-500">Đang hiện {LIMIT}/{filtered.length} sản phẩm — hãy tìm kiếm hoặc lọc để thu hẹp.</p>
      )}

      {canEdit && (
        <Link
          href="/products?new=1#new"
          aria-label="Thêm sản phẩm"
          className="fixed bottom-24 right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95 md:hidden print:hidden"
        >
          <Plus size={28} />
        </Link>
      )}

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

function Thumb({ url, big }: { url?: string | null; big?: boolean }) {
  return (
    <span className={`grid ${big ? "h-14 w-14" : "h-10 w-10"} shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-300`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageOff size={16} />
      )}
    </span>
  );
}
