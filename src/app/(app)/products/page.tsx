import { Badge, Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { can } from "@/lib/rbac";
import { getMembership } from "@/lib/auth";
import { listProducts } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { createProduct } from "./actions";

const KIND = { goods: "Hàng hoá", service: "Dịch vụ", package: "Liệu trình" } as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [products, member] = await Promise.all([
    listProducts(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "products.manage") : false;

  return (
    <>
      <PageHeader title="Hàng hoá & dịch vụ" subtitle="Danh mục sản phẩm, dịch vụ và liệu trình" />
      <Notice error={error} ok={ok} />

      {canEdit && (
        <details className="card mb-6">
          <summary className="cursor-pointer font-medium">+ Thêm sản phẩm / dịch vụ / liệu trình</summary>
          <form action={createProduct} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <Field label="Số buổi (liệu trình)"><input name="sessions" inputMode="numeric" className={inputClass} defaultValue="0" /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>Lưu sản phẩm</SubmitButton></div>
          </form>
        </details>
      )}

      <Table head={["Mã", "Tên", "Loại", "Nhóm", "Giá bán", "Giá vốn", "Tồn"]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="td text-slate-500">{p.sku}</td>
            <td className="td font-medium">{p.name}</td>
            <td className="td"><Badge tone="violet">{KIND[p.kind]}</Badge></td>
            <td className="td">{p.category}</td>
            <td className="td">{vnd(p.price)}</td>
            <td className="td">{p.cost ? vnd(p.cost) : "—"}</td>
            <td className="td">{p.stock ?? "—"}</td>
          </tr>
        ))}
        {products.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={7}>Chưa có sản phẩm nào. Bấm "+ Thêm" ở trên để bắt đầu.</td></tr>
        )}
      </Table>
    </>
  );
}
